import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))

import parse_seasons as ps  # noqa: E402


def match(a, b, winner=None, maps=None, scores=(None, None)):
    """Wikitext for one {{Match}} in either the old or the new page style."""
    def opp(name, score):
        return "{{SoloOpponent|name=%s|race=t%s}}" % (name, f"|score={score}" if score is not None else "")
    parts = ["{{Match", f"|opponent1={opp(a, scores[0])}", f"|opponent2={opp(b, scores[1])}"]
    if winner:
        parts.append(f"|winner={winner}")
    for i, w in enumerate(maps or [], start=1):
        parts.append("|map%d={{Map|map=X|winner=%s}}" % (i, w))
    return "\n".join(parts) + "\n}}"


class WikitextTests(unittest.TestCase):
    def test_find_templates_handles_nesting_and_case(self):
        text = "x {{Match|a={{Map|winner=1}}|b=2}} y {{match|c=3}} {{Matchlist|z=1}}"
        found = ps.find_templates(text, "Match")
        self.assertEqual([body for _, _, body in found], ["|a={{Map|winner=1}}|b=2", "|c=3"])

    def test_split_params_only_splits_top_level_pipes(self):
        pos, named = ps.split_params("|Shuttle|race1=p|map1={{Map|map=A|winner=2}}|note=[[a|b]]")
        self.assertEqual(pos, ["Shuttle"])
        self.assertEqual(named, {"race1": "p", "map1": "{{Map|map=A|winner=2}}", "note": "[[a|b]]"})

    def test_display_splits_page_and_shown_name(self):
        ps.CANON.clear()
        self.assertEqual(ps.display(ps.clean("Shuttle_(Player){{!}}Shuttle")), ("Shuttle", "Shuttle (Player)"))
        self.assertEqual(ps.display("Flash"), ("Flash", None))

    def test_opponent_reads_old_and_new_styles(self):
        ps.CANON.clear()
        old = ps.opponent("{{SoloOpponent|flag=kr|name=Rain|race=P|score=3|win=1}}")
        self.assertEqual((old["name"], old["race"], old["score"]), ("Rain", "P", "3"))
        new = ps.opponent("{{1Opponent|herO}}")
        self.assertEqual((new["name"], new["race"]), ("herO", None))
        self.assertIsNone(ps.opponent("{{1Opponent|TBD}}"))


class MatchTests(unittest.TestCase):
    def setUp(self):
        ps.CANON.clear()

    def winner(self, text):
        return ps.parse_match(ps.find_templates(text, "Match")[0][2])["winner"]

    def test_winner_from_explicit_field(self):
        self.assertEqual(self.winner(match("A", "B", winner=2, maps=[2])), 2)

    def test_winner_from_maps_ignores_skipped(self):
        self.assertEqual(self.winner(match("A", "B", maps=[1, 2, 1, "skip", "skip"])), 1)

    def test_winner_from_scores(self):
        self.assertEqual(self.winner(match("A", "B", scores=(1, 3))), 2)

    def test_no_winner_when_nothing_recorded(self):
        self.assertIsNone(self.winner(match("A", "B")))


class GroupStandingTests(unittest.TestCase):
    def test_dual_tournament(self):
        # A beats B, C beats D, A beats C (1st), B beats D (D 4th), C beats B (C 2nd, B 3rd)
        series = [("A", "B"), ("C", "D"), ("A", "C"), ("B", "D"), ("C", "B")]
        order, notes = ps.group_standing(["A", "B", "C", "D"], series, None)
        self.assertEqual(order, ["A", "C", "B", "D"])
        self.assertEqual(notes, [])

    def test_round_robin_tie_settled_head_to_head(self):
        # A 3-0; B and C both 1-2 and C beat B; D 1-2 as well would be circular, so D goes 1-2 by beating... keep it simple
        series = [("A", "B"), ("A", "C"), ("A", "D"), ("B", "D"), ("C", "B"), ("C", "D")]
        order, notes = ps.group_standing(["A", "B", "C", "D"], series, None)
        self.assertEqual(order, ["A", "C", "B", "D"])

    def test_circular_tie_uses_tiebreaker_order(self):
        series = [("A", "B"), ("B", "C"), ("C", "A"), ("A", "D"), ("B", "D"), ("C", "D")]
        order, notes = ps.group_standing(["A", "B", "C", "D"], series, ["B", "A", "C"])
        self.assertEqual(order, ["B", "A", "C", "D"])
        self.assertTrue(any("tiebreaker group" in n for n in notes))

    def test_circular_tie_without_tiebreaker_is_flagged(self):
        series = [("A", "B"), ("B", "C"), ("C", "A"), ("A", "D"), ("B", "D"), ("C", "D")]
        _, notes = ps.group_standing(["A", "B", "C", "D"], series, None)
        self.assertTrue(any("UNRESOLVED" in n for n in notes))


@unittest.skipUnless((ps.SRC / "s01.wiki").exists(), "Liquipedia source files not present")
class RealSeasonTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        seasons, cls.identities = ps.parse_all()
        cls.seasons = {s["season"]: s for s in seasons}

    def placements(self, n):
        return {p["player"]: p["placement"] for p in self.seasons[n]["players"]}

    def test_player_counts(self):
        self.assertEqual({n: len(s["players"]) for n, s in self.seasons.items()}, {1: 16, **{n: 28 for n in range(2, 22)}})

    def test_spellings_and_renames_resolve_to_one_player(self):
        self.assertEqual(self.identities["Best"], ["BeSt"])
        self.assertEqual(self.identities["tulbo"], ["YSC", "huro"])
        self.assertEqual(self.identities["Jaedong"], ["JD"])
        names = {p["player"] for s in self.seasons.values() for p in s["players"]}
        self.assertFalse(names & {"BeSt", "hero", "Snow", "Soma", "JD", "huro", "Where", "Sorry"})

    def test_s5_follows_match_results_not_the_prize_table(self):
        pl = self.placements(5)
        self.assertEqual((pl["Sea"], pl["Sharp"]), ("17th-22nd", "23rd-28th"))
        self.assertTrue(any("prize table puts Sharp" in n for n in self.seasons[5]["notes"]))

    def test_s5_third_place_match_separates_3rd_and_4th(self):
        pl = self.placements(5)
        self.assertEqual((pl["Rain"], pl["SnOw"], pl["herO"], pl["Mini"]), ("1st", "2nd", "3rd", "4th"))

    def test_s1_round_robin_ties_and_tiebreaker(self):
        pl = self.placements(1)
        self.assertEqual((pl["EffOrt"], pl["free"]), ("9th-12th", "13th-16th"))  # head-to-head
        self.assertEqual((pl["PianO"], pl["Larva"]), ("9th-12th", "13th-16th"))  # three-way tie, playoff
        self.assertEqual((pl["Sea"], pl["Last"]), ("3rd", "3rd"))                # no third-place match

    def test_s21_new_page_style(self):
        pl = self.placements(21)
        self.assertEqual((pl["soma"], pl["Flash"], pl["Leta"], pl["Light"]), ("1st", "2nd", "3rd", "3rd"))
        self.assertEqual(self.seasons[21]["bracket"]["r3m1"]["score"], "4-3")
        self.assertEqual(self.seasons[21]["prizeByPlace"]["5-8"], 2_000_000)


if __name__ == "__main__":
    unittest.main()
