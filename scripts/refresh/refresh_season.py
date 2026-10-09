"""Refresh the season in progress from Liquipedia and publish it, unattended.

Meant to be run on a schedule while a season is being played (see `--schedule` below and
Docs/tooling-specs/stats-refresh.md). One run:

 1. Finds the season in progress in data/generated/seasons.json. None: stop, no network.
 2. Refuses to run unless the repo is on `main` with no uncommitted changes to tracked files.
 3. Downloads that season's page (one Liquipedia request). Same revision as before: stop.
 4. Looks for new casts on YouTube, parses, exports with --strict.
 5. Stops and puts the data back if the export has a problem, or prints a note it did not
    print before: a new note is something a person has to read first (a new spelling of a
    player's name is never merged without Derek).
 6. Runs the Python and Vitest tests and the typecheck. Any failure: put the data back, stop.
 7. Commits data/ to main and deploys to production with the Vercel CLI.

Nothing public changes unless every step before it passed. Everything is appended to
.logs/stats-refresh.log.

Usage: python scripts/refresh/refresh_season.py [--force] [--no-deploy]
         --force      go on even if the page's revision has not changed
         --no-deploy  commit, but leave the deploy to a person
       python scripts/refresh/refresh_season.py --schedule [hours]   register the Windows task
       python scripts/refresh/refresh_season.py --unschedule         remove it
Exit:  0 nothing to do or published, 2 a step failed (data put back), 3 repo not ready,
       5 committed but the deploy failed (the next run tries the deploy again)
"""

from __future__ import annotations

import datetime
import json
import shutil
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
LOG = REPO / ".logs" / "stats-refresh.log"
# Left behind when a commit was made but not deployed, so the next run deploys first.
PENDING = REPO / ".logs" / "deploy-pending"
TASK = "StarCoins stats refresh"
# Keeps child processes from opening console windows when the task runs in the background.
NO_WINDOW = getattr(subprocess, "CREATE_NO_WINDOW", 0)


def log(message: str) -> None:
    line = f"{datetime.datetime.now().isoformat(timespec='seconds')}  {message}"
    LOG.parent.mkdir(exist_ok=True)
    with LOG.open("a", encoding="utf-8") as f:
        f.write(line + "\n")
    if sys.stdout:  # pythonw has no console
        print(line)


def run(args: list[str], *, shell: bool = False) -> subprocess.CompletedProcess:
    """Runs a command in the repo. pnpm and npx are .cmd files on Windows, so they need a shell."""
    return subprocess.run(" ".join(args) if shell else args, cwd=REPO, shell=shell, text=True,
                          capture_output=True, encoding="utf-8", errors="replace", creationflags=NO_WINDOW)


def step(name: str, args: list[str], *, shell: bool = False) -> bool:
    done = run(args, shell=shell)
    if done.returncode != 0:
        tail = "\n".join((done.stdout + "\n" + done.stderr).strip().splitlines()[-25:])
        log(f"FAILED: {name} (exit {done.returncode})\n{tail}")
    return done.returncode == 0


def season_in_progress() -> int | None:
    seasons = json.loads((REPO / "data" / "generated" / "seasons.json").read_text(encoding="utf-8"))
    newest = max(seasons, key=lambda s: s["season"])
    return newest["season"] if newest["status"] == "in_progress" else None


def revision(season: int) -> int | None:
    index = json.loads((REPO / "data" / "source" / "liquipedia" / "index.json").read_text(encoding="utf-8"))
    return index.get(f"s{season:02d}", {}).get("revid")


def notes() -> set[str]:
    rows = json.loads((REPO / "data" / "generated" / "validation.json").read_text(encoding="utf-8"))
    return {f"{r['code']}: {r['message']}" for r in rows}


# Set once the repo is known to be a clean main: only then is it safe to discard changes in data/.
clean_start = False


def put_back() -> None:
    if clean_start:
        run(["git", "checkout", "--", "data"])


def deploy() -> bool:
    PENDING.parent.mkdir(exist_ok=True)
    PENDING.write_text("a refresh commit is waiting to be deployed\n", encoding="utf-8")
    for attempt in (1, 2):  # the CLI sometimes fails once and works on the next try
        if step(f"deploy, attempt {attempt}", ["npx", "vercel", "deploy", "--prod", "--yes"], shell=True):
            PENDING.unlink(missing_ok=True)
            return True
    return False


def refresh(force: bool, do_deploy: bool) -> int:
    for tool in ("git", "pnpm", "npx"):
        if not shutil.which(tool):
            log(f"NOT READY: {tool} is not on the PATH")
            return 3
    branch = run(["git", "branch", "--show-current"]).stdout.strip()
    dirty = run(["git", "status", "--porcelain", "--untracked-files=no"]).stdout.strip()
    if branch != "main" or dirty:
        log(f"NOT READY: on branch {branch!r} with {'uncommitted changes' if dirty else 'a clean tree'}; "
            "the refresh only runs on a clean main")
        return 3
    global clean_start
    clean_start = True
    if PENDING.exists() and do_deploy:
        log("An earlier refresh was committed but not deployed; deploying it now")
        if not deploy():
            return 5

    season = season_in_progress()
    if season is None:
        log("No season in progress; nothing to do")
        return 0
    before, notes_before = revision(season), notes()
    py = sys.executable.replace("pythonw.exe", "python.exe")
    if not step("download the season page", [py, "scripts/liquipedia/fetch_seasons.py", str(season)]):
        put_back()
        return 2
    after = revision(season)
    if after == before and not force:
        log(f"S{season}: Liquipedia page unchanged (revision {after})")
        put_back()
        return 0
    log(f"S{season}: page revision {before} -> {after}")

    # New casts are a nice extra: a YouTube hiccup must not hold the results back.
    if not step("look for new casts", [py, "scripts/youtube/fetch_vods.py", str(season)]):
        run(["git", "checkout", "--", "data/source/youtube"])
    ok = (step("parse", [py, "scripts/liquipedia/parse_seasons.py", "--quiet"])
          and step("export", [py, "scripts/export-stats/export_stats.py", "data/source", "data/generated", "--strict"]))
    if ok:
        new_notes = sorted(n for n in notes() - notes_before if not n.startswith("IN_PROGRESS"))
        if new_notes:
            log("STOPPED: the export printed notes it did not print before; a person should read them:\n  "
                + "\n  ".join(new_notes))
            ok = False
    ok = (ok and step("parser tests", [py, "-m", "unittest", "discover", "-s", "scripts/liquipedia/tests"])
          and step("exporter tests", [py, "-m", "unittest", "discover", "-s", "scripts/export-stats/tests"])
          and step("typecheck", ["pnpm", "-s", "typecheck"], shell=True)
          and step("site tests", ["pnpm", "-s", "test"], shell=True))
    if not ok:
        put_back()
        log("Nothing was published; the data is back as it was")
        return 2

    if not run(["git", "status", "--porcelain", "--untracked-files=no", "data"]).stdout.strip():
        log(f"S{season}: the page changed but the results did not")
        return 0
    finished = season_in_progress() is None
    message = f"Refresh S{season} from Liquipedia (revision {after})" + ("; the season is complete" if finished else "")
    if not (step("stage", ["git", "add", "data"]) and step("commit", ["git", "commit", "-m", message])):
        return 2
    log(f"Committed: {message}")
    if not do_deploy:
        log("Not deploying (--no-deploy)")
        return 0
    if not deploy():
        log("The commit is on main but the site was not deployed; the next run tries again")
        return 5
    log(f"Published S{season}" + (". The season is complete, so later runs do nothing." if finished else ""))
    return 0


def schedule(hours: int) -> int:
    """Registers a Windows scheduled task that runs the refresh every few hours while logged in."""
    pythonw = Path(sys.executable).with_name("pythonw.exe")
    command = f'"{pythonw if pythonw.exists() else sys.executable}" "{Path(__file__).resolve()}"'
    done = subprocess.run(["schtasks", "/Create", "/F", "/TN", TASK, "/SC", "HOURLY", "/MO", str(hours), "/TR", command],
                          text=True, capture_output=True)
    print(done.stdout or done.stderr)
    return done.returncode


def main(argv: list[str]) -> int:
    if "--schedule" in argv:
        rest = [a for a in argv if a.isdigit()]
        return schedule(int(rest[0]) if rest else 3)
    if "--unschedule" in argv:
        done = subprocess.run(["schtasks", "/Delete", "/F", "/TN", TASK], text=True, capture_output=True)
        print(done.stdout or done.stderr)
        return done.returncode
    try:
        return refresh("--force" in argv, "--no-deploy" not in argv)
    except Exception as e:  # an unattended run must leave a trace
        log(f"CRASHED: {e!r}")
        put_back()
        return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
