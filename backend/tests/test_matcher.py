import unittest

from app.matcher import generate_variants, is_match


class MatcherTests(unittest.TestCase):
    def test_preserves_name_format_variants(self):
        self.assertTrue(is_match("daud k. azole", ["Daud K Azole"]))

    def test_matches_wordnet_synonyms(self):
        self.assertTrue(is_match("large", ["big"]))

    def test_generate_variants_includes_common_formats(self):
        variants = generate_variants("Daud K Azole")
        self.assertIn("Daud K Azole", variants)
        self.assertIn("Daud K. Azole", variants)


if __name__ == "__main__":
    unittest.main()
