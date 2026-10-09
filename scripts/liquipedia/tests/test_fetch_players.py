import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import fetch_players as fp  # noqa: E402


class BirthDateTests(unittest.TestCase):
    def test_reads_the_template_and_the_plain_form(self):
        self.assertEqual(fp.birth_date("|name=x\n|birth_date={{Birth date and age|1992|7|5}}\n|race=t"), "1992-07-05")
        self.assertEqual(fp.birth_date("  | birth_date = 1990-02-18"), "1990-02-18")

    def test_missing_or_unreadable_is_none(self):
        for text in ("", "|race=z", "|birth_date=", "|birth_date=unknown", "|birth_date={{Birth date and age|1992|13|5}}"):
            self.assertIsNone(fp.birth_date(text), text)


if __name__ == "__main__":
    unittest.main()
