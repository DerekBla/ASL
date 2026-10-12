"""Refresh the stored ladder replays from cwal.gg and publish them, unattended.

Meant to be run on a schedule (see `--schedule` below and Docs/tooling-specs/replays-refresh.md).
One run:

 1. Refuses to run unless the repo is on `main` with no uncommitted changes to tracked files.
 2. Fetches each chosen pro's newest games (`pnpm replays:fetch`). Same games as before: stop.
 3. Reads the build orders (`pnpm replays:export`).
 4. Runs the typecheck and the Vitest tests. Any failure: put everything back, stop.
 5. Commits data/ and public/replays/ to main and deploys to production with the Vercel CLI.

Nothing public changes unless every step before it passed. Everything is appended to
.logs/stats-refresh.log, the same log the season refresh writes.

Usage: python scripts/refresh/refresh_replays.py [--no-deploy]
         --no-deploy  commit, but leave the deploy to a person
       python scripts/refresh/refresh_replays.py --schedule [day]   register the Windows task
                                                  (MON, TUE, ...; default MON, at 09:15)
       python scripts/refresh/refresh_replays.py --unschedule       remove it
Exit:  0 nothing to do or published, 2 a step failed (files put back), 3 repo not ready,
       5 committed but the deploy failed (the next run of either refresh tries again)
"""

from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

import refresh_season
from refresh_season import PENDING, deploy, log, run, step

TASK = "StarCoins replays refresh"
# Everything a replay refresh writes. Only these paths are committed or put back.
PATHS = ["data/source/cwal", "data/generated/builds.json", "public/replays"]
DAYS = ("MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN")

# Set once the repo is known to be a clean main: only then is it safe to discard changes.
clean_start = False


def put_back() -> None:
    if clean_start:
        run(["git", "checkout", "--", *PATHS])
        run(["git", "clean", "-fdq", "--", "public/replays", "data/source/cwal"])


def changed() -> bool:
    return bool(run(["git", "status", "--porcelain", "--", *PATHS]).stdout.strip())


def refresh(do_deploy: bool) -> int:
    for tool in ("git", "pnpm", "npx"):
        if not shutil.which(tool):
            log(f"replays NOT READY: {tool} is not on the PATH")
            return 3
    branch = run(["git", "branch", "--show-current"]).stdout.strip()
    dirty = run(["git", "status", "--porcelain", "--untracked-files=no"]).stdout.strip()
    if branch != "main" or dirty:
        log(f"replays NOT READY: on branch {branch!r} with {'uncommitted changes' if dirty else 'a clean tree'}; "
            "the refresh only runs on a clean main")
        return 3
    global clean_start
    clean_start = True
    # deploy() and its PENDING marker are shared with the season refresh.
    refresh_season.clean_start = True
    if PENDING.exists() and do_deploy:
        log("An earlier refresh was committed but not deployed; deploying it now")
        if not deploy():
            return 5

    if not step("fetch replays from cwal.gg", ["pnpm", "-s", "replays:fetch"], shell=True):
        put_back()
        return 2
    if not changed():
        log("Replays: no new games")
        return 0
    ok = (step("read build orders", ["pnpm", "-s", "replays:export"], shell=True)
          and step("typecheck", ["pnpm", "-s", "typecheck"], shell=True)
          and step("site tests", ["pnpm", "-s", "test"], shell=True))
    if not ok:
        put_back()
        log("Replays: nothing was published; the files are back as they were")
        return 2

    message = "Refresh ladder replays from cwal.gg"
    if not (step("stage", ["git", "add", "--", *PATHS]) and step("commit", ["git", "commit", "-m", message])):
        put_back()
        return 2
    log(f"Committed: {message}")
    if not do_deploy:
        log("Not deploying (--no-deploy)")
        return 0
    if not deploy():
        log("The commit is on main but the site was not deployed; the next run tries again")
        return 5
    log("Published the new replays")
    return 0


def schedule(day: str) -> int:
    """Registers a Windows scheduled task that runs the refresh once a week while logged in."""
    pythonw = Path(sys.executable).with_name("pythonw.exe")
    command = f'"{pythonw if pythonw.exists() else sys.executable}" "{Path(__file__).resolve()}"'
    done = subprocess.run(["schtasks", "/Create", "/F", "/TN", TASK, "/SC", "WEEKLY", "/D", day, "/ST", "09:15",
                           "/TR", command], text=True, capture_output=True)
    print(done.stdout or done.stderr)
    return done.returncode


def main(argv: list[str]) -> int:
    if "--schedule" in argv:
        days = [a.upper() for a in argv if a.upper() in DAYS]
        return schedule(days[0] if days else "MON")
    if "--unschedule" in argv:
        done = subprocess.run(["schtasks", "/Delete", "/F", "/TN", TASK], text=True, capture_output=True)
        print(done.stdout or done.stderr)
        return done.returncode
    try:
        return refresh("--no-deploy" not in argv)
    except Exception as e:  # an unattended run must leave a trace
        log(f"replays CRASHED: {e!r}")
        put_back()
        return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
