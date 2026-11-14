"""Check policy catalog provenance and unavailable-data behavior without a service stack."""
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class CatalogTests(unittest.TestCase):
    def test_generated_catalog_matches_original_identifiers_and_content(self):
        generator = load("console_catalog_generator", ROOT / "policy/tools/build_console_catalog.py")
        expected = generator.build()
        actual = json.loads(generator.OUTPUT.read_text(encoding="utf-8"))
        self.assertEqual(actual, expected)
        originals = json.loads((ROOT / "policy/source/sheet.json").read_text(encoding="utf-8"))["policies"]
        self.assertEqual(len(actual["policies"]), 90)
        self.assertEqual({p["id"] for p in actual["policies"]}, set(originals))
        for policy in actual["policies"]:
            self.assertEqual(policy["content"], originals[policy["id"]]["content"])
            self.assertNotIn("applied", policy)
            self.assertNotIn("note", policy)
        # Only rules the running gateway evaluates count as enforcement, and written policy/pac rules are not enforcement
        # while OPA does not load them. The development review's status and limitation stay out of the console data.
        ledger = set(json.loads((ROOT / "full_stack_lab/opa/policy_ledger.json").read_text(encoding="utf-8"))["policy_ledger"])
        loaded = any("data.mcp.pol" in f.read_text(encoding="utf-8") for f in (ROOT / "full_stack_lab/opa").glob("*.rego"))
        self.assertEqual(actual["summary"]["pac_runtime_loaded"], loaded)
        for policy in actual["policies"]:
            self.assertNotIn("status", policy)
            self.assertNotIn("limitation", policy)
            self.assertLessEqual(set(policy["runtime_rule_ids"]), ledger)
            self.assertEqual(policy["rule_runtime"], loaded and policy["has_rule"])

    def test_console_titles_groups_and_modes_cover_every_policy(self):
        actual = json.loads((ROOT / "full_stack_lab/gateway/app/organization_policies.json").read_text(encoding="utf-8"))
        self.assertEqual(actual["summary"]["mode"], {"auto": 39, "feature": 23, "manual": 22, "structural": 6})
        self.assertEqual(len({p["group"] for p in actual["policies"]}), 26)
        for policy in actual["policies"]:
            self.assertTrue(policy["title"].strip())
            self.assertTrue(policy["group_title"].strip())
            self.assertIn(policy["priority"], {"P1", "P2", "P3"})
            self.assertTrue(policy["id"].startswith(f"POL-{policy['group'][0]}-"))

    def test_rule_presence_agrees_with_existing_policy_trace(self):
        generator = load("catalog_generator_trace", ROOT / "policy/tools/build_console_catalog.py")
        trace = load("catalog_existing_trace", ROOT / "policy/tools/trace.py")
        sources, _ = trace.rule_sources()
        actual = generator.build()
        self.assertEqual({p["id"] for p in actual["policies"] if p["has_rule"]}, set(sources))

    def test_missing_and_invalid_catalog_are_unavailable_not_empty_success(self):
        reader = load("catalog_reader", ROOT / "full_stack_lab/gateway/app/organization_policy.py")
        with tempfile.TemporaryDirectory() as temp:
            base = Path(temp)
            with patch.object(reader, "__file__", str(base / "organization_policy.py")):
                self.assertEqual(reader.catalog(), {"source_state": "unavailable", "policies": []})
                (base / "organization_policies.json").write_text('{"schema":1,"policies":null}', encoding="utf-8")
                self.assertEqual(reader.catalog()["source_state"], "unavailable")
                (base / "organization_policies.json").write_text('{"schema":1,"policies":[{}]}', encoding="utf-8")
                self.assertEqual(reader.catalog()["source_state"], "unavailable")
                (base / "organization_policies.json").write_text('{"schema":1,"policies":[]}', encoding="utf-8")
                self.assertEqual(reader.catalog()["source_state"], "available")


if __name__ == "__main__":
    unittest.main()
