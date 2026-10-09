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


class MapAndVodTests(unittest.TestCase):
    def test_map_names_drop_the_wiki_page_suffix(self):
        self.assertEqual(ps.map_name("Tempest (Map)"), "Tempest")
        self.assertEqual(ps.map_name("Nemesis (ASL)"), "Nemesis")
        self.assertEqual(ps.map_name(" Fighting Spirit "), "Fighting Spirit")
        self.assertIsNone(ps.map_name(""))

    def test_games_keep_their_order_and_skip_unplayed_maps(self):
        text = ("{{Match|opponent1={{1Opponent|A}}|opponent2={{1Opponent|B}}"
                "|map2={{Map|map=Two|winner=2}}|map1={{Map|map=One|winner=1}}|map3={{Map|map=Three|winner=skip}}}}")
        m = ps.parse_match(ps.find_templates(text, "Match")[0][2])
        self.assertEqual(ps.games_of(m, "A", "B"), [{"map": "One", "winner": "A"}, {"map": "Two", "winner": "B"}])

    def test_youtube_links_in_every_spelling(self):
        self.assertEqual(ps.youtube_link("https://gaming.youtube.com/watch?v=6TTGeGWY6hQ&t=34m0s"), ("6TTGeGWY6hQ", 2040))
        self.assertEqual(ps.youtube_link("https://youtu.be/6TTGeGWY6hQ?t=1h5m51s"), ("6TTGeGWY6hQ", 3951))
        self.assertEqual(ps.youtube_link("http://www.youtube.com/watch?v=6TTGeGWY6hQ&t=1032"), ("6TTGeGWY6hQ", 1032))
        self.assertEqual(ps.youtube_link("https://www.youtube.com/watch?v=6TTGeGWY6hQ"), ("6TTGeGWY6hQ", 0))
        self.assertIsNone(ps.youtube_link("https://vod.sooplive.com/player/190582275"))
        self.assertIsNone(ps.youtube_link(None))

    def test_titles_say_what_a_cast_covers(self):
        slot = ps.title_slot
        self.assertEqual(slot("[ENG] ASL Season21 | Ro.16 Group A (Tastosis)"), (21, "ro16", "A"))
        self.assertEqual(slot("[ENG] AfreecaTV StarLeague(ASL) S16 Ro.24 Group F (Tastosis)"), (16, "ro24", "F"))
        self.assertEqual(slot("[ENG] 2024 SSL AUTUMN | Ro.24 Group B (Tastosis)"), (18, "ro24", "B"))
        self.assertEqual(slot("[ENG] ASL S16 RO.8 Match3 Sharp vs Mini (Tastosis)"),
                         (16, "ro8", (3, frozenset({"sharp", "mini"}))))
        self.assertEqual(slot("[ENG] 2024 SSL AUTUMN | RO.8 M3 Rain vs Rush (Tastosis)"),
                         (18, "ro8", (3, frozenset({"rain", "rush"}))))
        self.assertEqual(slot("[ENG] ASL Season16 Finals SoulKey vs Mini (Tastosis)"),
                         (16, "final", (None, frozenset({"soulkey", "mini"}))))
        self.assertEqual(slot("[ENG] AfreecaTV StarLeague(ASL) S8 3/4 Place Match")[:2], (8, "third"))
        self.assertEqual(slot("[ENG] AfreecaTV StarLeague(ASL) S4 Ro.8 Day 2"), (4, "ro8", ("day", 2)))

    def test_titles_that_are_not_a_cast_of_asl_games_are_ignored(self):
        for title in ("[ENG] ASL Season21 | RO.16 Group Nomination (Tastosis)",
                      "AfreecaTV StarLeague(ASL) S5 Ro.16 Group A Highlight",
                      "[ENG] 2026 GSL S1 Code S Ro.4 & FINALS", "[2021 GSL S1] RO8 Match4 INnoVation vs Trap"):
            self.assertIsNone(ps.title_slot(title), title)

    def test_vods_prefer_the_page_link_and_fall_back_to_titles(self):
        en = "SOOP esports EN"
        vods = ps.Vods({
            "aaaaaaaaaaa": {"title": "[ENG] ASL Season30 | Ro.24 Group A (Tastosis)", "channel": en},
            "bbbbbbbbbbb": {"title": "[ENG] ASL Season30 Ro.8 Match2 Queen vs SoulKey (Tastosis)", "channel": en},
            "ccccccccccc": {"title": "[ENG] ASL Season30 | Ro.24 Group B", "channel": "Someone Else"},
            "ddddddddddd": {"title": "[ENG] AfreecaTV StarLeague(ASL) S30 Ro.4 Day1", "channel": en},
        })
        self.assertEqual(vods.url(("aaaaaaaaaaa", 90)), "https://www.youtube.com/watch?v=aaaaaaaaaaa&t=90s")
        self.assertIsNone(vods.url(("zzzzzzzzzzz", 0)))  # not known to exist any more
        self.assertEqual(vods.group(30, "ro24", "Group A"), "https://www.youtube.com/watch?v=aaaaaaaaaaa")
        self.assertIsNone(vods.group(30, "ro24", "Group B"))  # other channels are never matched by title
        # Found by the two names, whatever the bracket slot or the capitals in the title.
        self.assertEqual(vods.playoff(30, "r1m4", "Soulkey", "Queen"), "https://www.youtube.com/watch?v=bbbbbbbbbbb")
        self.assertIsNone(vods.playoff(30, "r1m2", "Flash", "Rain"))
        self.assertEqual(vods.by_day(30, "ro4"), [{"label": "Day 1", "url": "https://www.youtube.com/watch?v=ddddddddddd"}])
        # A cast titled by day belongs to the match of the same number in its round.
        self.assertEqual(vods.playoff(30, "r2m1", "Flash", "Rain"), "https://www.youtube.com/watch?v=ddddddddddd")
        self.assertIsNone(vods.playoff(30, "r2m2", "Bisu", "Mini"))


class QualifierTests(unittest.TestCase):
    def test_newer_pages_write_opponents_as_1v1opponent(self):
        text = "{{Match|bestof=3|opponent1={{1v1Opponent|Larva|flag=|race=|score=2}}|opponent2={{1v1Opponent|bartlett|flag=kr|race=p|score=0}}}}"
        m = ps.parse_match(ps.find_templates(text, "Match")[0][2])
        self.assertEqual((m["a"]["name"], m["b"]["name"], m["winner"], m["score"]), ("Larva", "bartlett", 1, [2, 0]))
        empty = "{{Match|opponent1={{1v1Opponent||flag=kr|score=2}}|opponent2={{1v1Opponent|A|score=0}}}}"
        self.assertIsNone(ps.parse_match(ps.find_templates(empty, "Match")[0][2]))

    @unittest.skipUnless((ps.SRC / "qualifiers.json").exists(), "qualifier pages not present")
    def test_stored_qualifiers_are_decided_series_with_real_scores(self):
        ps.parse_all()
        series = ps.parse_qualifiers()
        self.assertGreater(len(series), 4000)
        self.assertEqual(min(q["season"] for q in series), 4)
        for q in series:
            won, lost = (int(x) for x in q["score"].split("-"))
            self.assertTrue(won > lost >= 0, q)
            self.assertNotEqual(q["winner"], q["loser"])


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

    def test_maps_and_casts_of_stored_seasons(self):
        quarter = self.seasons[21]["bracket"]["r1m1"]
        self.assertEqual([g["map"] for g in quarter["games"]], ["Match Point", "KnockOut", "Jane Doe"])
        self.assertEqual({g["winner"] for g in quarter["games"]}, {"soma"})
        first = self.seasons[3]["groups"][0]["series"][0]
        self.assertEqual(first["games"], [{"map": "Camelot", "winner": "Shuttle"}])
        self.assertEqual(first["vod"], "https://www.youtube.com/watch?v=6TTGeGWY6hQ&t=2040s")
        # Older playoff casts are titled by day: day 2 is the round's second match.
        self.assertEqual(self.seasons[4]["bracket"]["r1m2"]["vod"], "https://www.youtube.com/watch?v=toURJRI-K-k")
        self.assertEqual(self.seasons[4]["roundVods"], [])
        self.assertEqual(self.seasons[21]["roundVods"], [])


if __name__ == "__main__":
    unittest.main()
