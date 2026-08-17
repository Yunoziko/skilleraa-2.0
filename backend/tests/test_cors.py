"""CORS allowlist must always include production Skilleraa origins."""
import re
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from cors_origins import CORS_ORIGIN_REGEX, build_cors_allowlist


class TestCorsAllowlist(unittest.TestCase):
    def test_stale_localhost_env_still_allows_production(self):
        origins = build_cors_allowlist("http://localhost:3000")
        for required in (
            "https://www.skilleraa.com",
            "https://www.skilleraa.com/",
            "https://skilleraa.com",
            "https://skilleraa.com/",
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ):
            self.assertIn(required, origins)
        self.assertNotIn("*", origins)

    def test_empty_and_wildcard_env_never_use_star(self):
        for raw in (None, "", "*", '"*"', " * "):
            origins = build_cors_allowlist(raw)
            self.assertNotIn("*", origins)
            self.assertIn("https://www.skilleraa.com", origins)

    def test_quoted_csv_and_trailing_slash_env(self):
        origins = build_cors_allowlist(
            '"https://www.skilleraa.com/, https://skilleraa.com"'
        )
        self.assertIn("https://www.skilleraa.com", origins)
        self.assertIn("https://www.skilleraa.com/", origins)
        self.assertIn("https://skilleraa.com", origins)

    def test_origin_regex_matches_production_and_local(self):
        rx = re.compile(CORS_ORIGIN_REGEX)
        self.assertTrue(rx.fullmatch("https://www.skilleraa.com"))
        self.assertTrue(rx.fullmatch("https://www.skilleraa.com/"))
        self.assertTrue(rx.fullmatch("https://skilleraa.com"))
        self.assertTrue(rx.fullmatch("https://skilleraa.com/"))
        self.assertTrue(rx.fullmatch("http://localhost:3000"))
        self.assertFalse(rx.fullmatch("https://evil.example"))
        self.assertFalse(rx.fullmatch("*"))


if __name__ == "__main__":
    unittest.main()
