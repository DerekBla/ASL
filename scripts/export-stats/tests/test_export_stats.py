import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))

import export_stats as ex  # noqa: E402

REPO = HERE.parents[2]
SOURCE = REPO / "data" / "source"
SCRIPT = HERE.parent / "export_stats.py"


class PlacementTests(unittest.TestCase):
    def test_ranges_use_an_en_dash(self):
        for raw in ("9th-12th", "9th–12th", "9-12"):
            self.assertEqual(ex.to_placement(raw), {"label": "9th–12th", "best": 9, "worst": 12, "status": "final"})

    def test_singles_and_ordinals(self):
        self.assertEqual([ex.to_placement(x)["label"] for x in ("1st", "2", "3rd", "4th")], ["1st", "2nd", "3rd", "4th"])
        self.assertEqual(ex.to_placement("23rd-28th")["label"], "23rd–28th")
        self.assertEqual(ex.to_placement("11-13")["label"], "11th–13th")

    def test_rejects_garbage(self):
        for raw in ("", "TBD", "8th-5th", "1-2-3"):
            with self.assertRaises(ValueError):
                ex.to_placement(raw)


class EloTests(unittest.TestCase):
    def test_zero_sum_and_ordering(self):
        rating, peak = ex.compute_elo([{"A": 1, "B": 2, "C": 3, "D": 3}])
        self.assertAlmostEqual(sum(rating.values()), 4 * ex.ELO_START)
        self.assertGreater(rating["A"], rating["B"])
        self.assertGreater(rating["B"], rating["C"])
        self.assertEqual(peak["A"][1], 1)

    def test_same_tier_pairs_do_not_play(self):
        rating, _ = ex.compute_elo([{"A": 5, "B": 5}])
        self.assertEqual(rating, {"A": ex.ELO_START, "B": ex.ELO_START})

    def test_history_has_one_point_per_season_played(self):
        rating, peak, history = ex.compute_elo_history([{"A": 1, "B": 2}, {"B": 1, "C": 2}, {"A": 1, "C": 2}])
        self.assertEqual([n for n, _ in history["A"]], [1, 3])
        self.assertEqual([n for n, _ in history["B"]], [1, 2])
        self.assertEqual(history["A"][-1][1], rating["A"])
        self.assertEqual(max(history["B"], key=lambda x: x[1]), (peak["B"][1], peak["B"][0]))

    def test_absent_players_keep_their_rating(self):
        rating, peak = ex.compute_elo([{"A": 1, "B": 2}, {"B": 1, "C": 2}])
        first, _ = ex.compute_elo([{"A": 1, "B": 2}])
        self.assertEqual(rating["A"], first["A"])
        self.assertEqual(peak["A"][1], 1)


@unittest.skipUnless((SOURCE / "liquipedia" / "results.json").exists(), "Liquipedia results not present")
class BuildTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = ex.build(SOURCE)

    def test_every_file_is_built(self):
        self.assertEqual(sorted(self.data), [
            "elo.json", "manifest.json", "placements.json", "player-stats.json", "players.json",
            "race-stats.json", "seasons.json", "series.json", "validation.json"])
        self.assertEqual(self.data["manifest.json"]["schemaVersion"], ex.SCHEMA_VERSION)

    def test_no_problems_in_committed_source(self):
        problems = [w for w in self.data["validation.json"] if w["code"] in ex.PROBLEM_CODES]
        self.assertEqual(problems, [])

    def test_season_sizes_and_tiers(self):
        per = Counter(r["season"] for r in self.data["placements.json"])
        self.assertEqual(per, Counter({1: 16, **{n: 28 for n in range(2, 22)}}))
        for n in range(2, 22):
            tiers = Counter(r["placement"]["label"] for r in self.data["placements.json"] if r["season"] == n)
            self.assertEqual((tiers["1st"], tiers["2nd"], tiers["5th–8th"]), (1, 1, 4), f"S{n}")
            self.assertEqual((tiers["9th–12th"], tiers["13th–16th"], tiers["17th–22nd"], tiers["23rd–28th"]), (4, 4, 6, 6), f"S{n}")
            self.assertEqual(tiers["3rd"] + tiers["4th"], 2, f"S{n}")

    def test_one_row_per_player_per_season_and_one_race_per_player(self):
        keys = [(r["player"], r["season"]) for r in self.data["placements.json"]]
        self.assertEqual(len(keys), len(set(keys)))
        races = {}
        for r in self.data["placements.json"]:
            self.assertEqual(races.setdefault(r["player"], r["race"]), r["race"])

    def test_no_case_variant_players(self):
        lowered = Counter(p["player"].lower() for p in self.data["players.json"])
        self.assertEqual([n for n, c in lowered.items() if c > 1], [])

    def test_confirmed_identities_and_races(self):
        race = {p["player"]: p["race"] for p in self.data["players.json"]}
        for name in ("SnOw", "herO", "Best", "EffOrt", "HyuN", "tulbo", "Jaedong"):
            self.assertIn(name, race)
        for alias in ("Snow", "hero", "BeSt", "Effort", "Hyun", "huro", "JD"):
            self.assertNotIn(alias, race)
        self.assertEqual({n: race[n] for n in ("sSak", "Ample", "Speed", "Shine", "tulbo", "Jaedong")},
                         {"sSak": "T", "Ample": "T", "Speed": "T", "Shine": "Z", "tulbo": "P", "Jaedong": "Z"})

    def test_elo_history_matches_current_and_peak(self):
        seasons = {(r["player"], r["season"]) for r in self.data["placements.json"]}
        for row in self.data["elo.json"]:
            points = row["history"]
            self.assertEqual(len(points), row["seasons"], row["player"])
            self.assertTrue(all((row["player"], p["season"]) in seasons for p in points), row["player"])
            self.assertAlmostEqual(points[-1]["elo"], row["currentElo"], places=1)
            self.assertAlmostEqual(max(p["elo"] for p in points), row["peakElo"], places=1)

    def test_career_stats_agree_with_seasons(self):
        champs = Counter(s["winner"] for s in self.data["seasons.json"])
        for r in self.data["player-stats.json"]:
            self.assertEqual(r["championships"], champs.get(r["player"], 0), r["player"])
        self.assertEqual(sum(r["seasons"] for r in self.data["player-stats.json"]), len(self.data["placements.json"]))
        self.assertEqual([r["rank"] for r in self.data["elo.json"]], list(range(1, len(self.data["elo.json"]) + 1)))

    def test_prize_money_adds_up_to_what_the_pages_list(self):
        s21 = sum(r["prizeKrw"] for r in self.data["placements.json"] if r["season"] == 21)
        self.assertEqual(s21, 78_000_000)
        self.assertEqual(sum(r["prizeKrw"] for r in self.data["player-stats.json"]),
                         sum(r["prizeKrw"] or 0 for r in self.data["placements.json"]))

    def test_race_stats_are_consistent(self):
        rs = self.data["race-stats.json"]
        self.assertEqual(sum(r["championships"] for r in rs["overall"]), 21)
        for row in rs["participantsBySeason"]:
            self.assertEqual(row["T"] + row["Z"] + row["P"] + row["unknown"], row["total"])
        cross = {(r["race"], r["vs"]): r for r in rs["seriesByMatchup"]["allStages"]["crossRace"]}
        self.assertEqual(cross[("T", "Z")]["wins"], cross[("Z", "T")]["losses"])
        counted = sum(r["wins"] for r in cross.values()) + sum(rs["seriesByMatchup"]["allStages"]["mirrors"].values()) \
            + rs["seriesByMatchup"]["allStages"]["unknownRace"]
        self.assertEqual(counted, len(self.data["series.json"]))


@unittest.skipUnless((SOURCE / "liquipedia" / "results.json").exists(), "Liquipedia results not present")
class CliTests(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.tmp, ignore_errors=True)

    def run_cli(self, source, out, *flags, seed="0"):
        env = {**os.environ, "PYTHONHASHSEED": seed}
        return subprocess.run([sys.executable, str(SCRIPT), str(source), str(out), *flags],
                              capture_output=True, env=env)

    def test_deterministic_across_processes(self):
        # Separate processes with different hash seeds: same-process runs hide ordering bugs.
        for i, seed in enumerate(("1", "2", "3")):
            self.assertEqual(self.run_cli(SOURCE, self.tmp / f"o{i}", seed=seed).returncode, 0)
        names = sorted(p.name for p in (self.tmp / "o0").iterdir())
        for name in names:
            first = (self.tmp / "o0" / name).read_bytes()
            self.assertNotIn(b"\r\n", first, name)
            for i in (1, 2):
                self.assertEqual(first, (self.tmp / f"o{i}" / name).read_bytes(), name)

    def test_committed_output_is_fresh(self):
        self.assertEqual(self.run_cli(SOURCE, self.tmp / "out").returncode, 0)
        for path in sorted((self.tmp / "out").iterdir()):
            committed = (REPO / "data" / "generated" / path.name).read_bytes().replace(b"\r\n", b"\n")
            self.assertEqual(path.read_bytes(), committed, f"{path.name}: run pnpm stats:export")

    def test_missing_source_fails_loudly(self):
        result = self.run_cli(self.tmp / "nope", self.tmp / "out")
        self.assertEqual(result.returncode, 1)
        self.assertIn(b"INPUT ERROR", result.stderr)

    def test_strict_fails_on_problems_and_overrides_are_applied(self):
        src = self.tmp / "src"
        shutil.copytree(SOURCE / "liquipedia", src / "liquipedia", ignore=shutil.ignore_patterns("*.wiki"))
        (src / "overrides.json").write_text(json.dumps({"names": {"Queen": "Queen!"}, "races": {"Queen!": "Z"}}), encoding="utf-8")
        self.assertEqual(self.run_cli(src, self.tmp / "ok", "--strict").returncode, 0)
        players = {p["player"]: p for p in json.loads((self.tmp / "ok" / "players.json").read_text(encoding="utf-8"))}
        self.assertEqual((players["Queen!"]["race"], players["Queen!"]["aliases"]), ("Z", ["Queen"]))
        results = json.loads((src / "liquipedia" / "results.json").read_text(encoding="utf-8"))
        results[4]["players"].pop()
        (src / "liquipedia" / "results.json").write_text(json.dumps(results), encoding="utf-8")
        self.assertEqual(self.run_cli(src, self.tmp / "bad", "--strict").returncode, 2)
        self.assertEqual(self.run_cli(src, self.tmp / "bad").returncode, 0)


if __name__ == "__main__":
    unittest.main()
