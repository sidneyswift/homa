#!/usr/bin/env python3
"""Focused regressions for ingestion-ledger source completion roll-ups."""

import importlib.util
import unittest
from pathlib import Path


SCRIPT = Path(__file__).with_name("ingestion-ledger.py")
SPEC = importlib.util.spec_from_file_location("ingestion_ledger", SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(MODULE)


class SourceCompletionProblemsTest(unittest.TestCase):
    def test_complete_source_has_no_problem(self):
        record = {
            "sourceCompleteness": {"status": "complete"},
            "capture": {"gateReview": {"unresolvedFindingCount": 0}},
        }
        self.assertEqual(MODULE.source_completion_problems(record), [])

    def test_requested_original_is_waiting(self):
        record = {"originalRecovery": {"status": "requested"}}
        self.assertEqual(
            MODULE.source_completion_problems(record),
            ["original re-share is requested"],
        )

    def test_partial_source_and_unresolved_findings_are_both_visible(self):
        record = {
            "sourceCompleteness": {"status": "awaiting-source"},
            "capture": {"gateReview": {"unresolvedFindingCount": 9}},
        }
        self.assertEqual(
            MODULE.source_completion_problems(record),
            [
                "source completeness is awaiting-source",
                "capture review has 9 unresolved finding(s)",
            ],
        )

    def test_boolean_is_not_accepted_as_an_unresolved_count(self):
        record = {"capture": {"gateReview": {"unresolvedFindingCount": True}}}
        self.assertEqual(MODULE.source_completion_problems(record), [])


if __name__ == "__main__":
    unittest.main()
