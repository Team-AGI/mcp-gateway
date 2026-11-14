"""An approval-pending call waits for the administrator and reports the decision (11-14)."""
import ast
import asyncio
import unittest
from pathlib import Path
from types import SimpleNamespace as NS
from unittest.mock import AsyncMock

APP = Path(__file__).resolve().parents[1] / "gateway" / "app"
if not APP.exists():
    APP = Path("/app/app")


def await_approval(db):
    tree = ast.parse((APP / "mcp_facade.py").read_text(encoding="utf-8"))
    node = next(n for n in tree.body if getattr(n, "name", None) == "_await_approval")
    namespace = {"asyncio": NS(get_running_loop=asyncio.get_running_loop, sleep=lambda _: asyncio.sleep(0)), "db": db}
    exec(compile(ast.Module(body=[node], type_ignores=[]), "mcp_facade.py", "exec"), namespace)
    return namespace["_await_approval"]


class ApprovalHoldChecks(unittest.IsolatedAsyncioTestCase):
    async def run_with(self, rows, seconds=0.05):
        db = NS(fetch_one=AsyncMock(side_effect=rows))
        return await await_approval(db)("approval", seconds), db

    async def test_approval_during_the_hold_is_reported(self):
        decided, _ = await self.run_with([{"status": "PENDING", "lapsed": False}, {"status": "APPROVED", "lapsed": False}])
        self.assertEqual(decided, "APPROVED")

    async def test_rejection_and_lapse_end_the_wait(self):
        self.assertEqual((await self.run_with([{"status": "REJECTED", "lapsed": False}]))[0], "REJECTED")
        self.assertEqual((await self.run_with([{"status": "PENDING", "lapsed": True}]))[0], "EXPIRED")

    async def test_no_answer_within_the_hold_keeps_the_request_waiting(self):
        decided, db = await self.run_with(lambda *a: {"status": "PENDING", "lapsed": False}, seconds=0.02)
        self.assertIsNone(decided)
        self.assertGreater(db.fetch_one.await_count, 0)


if __name__ == "__main__":
    unittest.main()
