"""Per-policy decision counts for the console policy screen; isolated API test, no live DB."""
import ast
import asyncio
import unittest
from datetime import UTC, datetime, timedelta
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock


def load(db):
    path = Path(__file__).resolve().parents[1] / "gateway/app/main.py"
    node = next(n for n in ast.parse(path.read_text(encoding="utf-8")).body if getattr(n, "name", "") == "policy_activity")
    node.decorator_list = []
    node.args.defaults = [ast.Constant(24), ast.Constant(None)]
    ns = {"datetime": datetime, "UTC": UTC, "timedelta": timedelta, "db": db, "asyncio": asyncio,
          "decommission": SimpleNamespace(REAL_CALL="true")}
    exec(compile(ast.fix_missing_locations(ast.Module(body=[node], type_ignores=[])), str(path), "exec"), ns)
    return ns


class PolicyActivityTests(unittest.IsolatedAsyncioTestCase):
    def test_requires_administrator_and_bounds_the_window(self):
        path = Path(__file__).resolve().parents[1] / "gateway/app/main.py"
        node = next(n for n in ast.parse(path.read_text(encoding="utf-8")).body if getattr(n, "name", "") == "policy_activity")
        self.assertEqual(ast.unparse(node.args.defaults[1]), "Depends(admin_caller)")
        self.assertEqual(ast.unparse(node.args.defaults[0]), "Query(24, ge=1, le=720)")

    async def test_counts_by_rule_and_decision_and_compares_with_the_window_before(self):
        db = SimpleNamespace(fetch_all=AsyncMock(side_effect=[
            [{"policy_id": "P-1", "decision": "Block", "n": 3}, {"policy_id": "P-1", "decision": "Alert", "n": 1}],
            [{"decision": "Block", "n": 2}]]))
        out = await load(db)["policy_activity"](168)
        self.assertEqual(out["window_hours"], 168)
        self.assertEqual(out["rows"], [{"policy_id": "P-1", "decision": "Block", "n": 3}, {"policy_id": "P-1", "decision": "Alert", "n": 1}])
        self.assertEqual(out["previous"], [{"decision": "Block", "n": 2}])
        (query, (since, until)), _ = db.fetch_all.call_args_list[0]
        self.assertIn("GROUP BY d.policy_id, d.decision", query)
        self.assertEqual(until - since, timedelta(hours=168))
        (_, (before, end)), _ = db.fetch_all.call_args_list[1]
        self.assertEqual(end, since)
        self.assertEqual(end - before, timedelta(hours=168))


if __name__ == "__main__":
    unittest.main()
