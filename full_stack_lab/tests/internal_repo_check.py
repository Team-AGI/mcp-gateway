"""The internal copy of an approved source holds the verified branch only and names every server it serves."""
import ast
import unittest
from pathlib import Path
from types import SimpleNamespace as NS
from unittest.mock import AsyncMock
from urllib.parse import quote

APP = Path(__file__).resolve().parents[1] / "gateway" / "app"
if not APP.exists():
    APP = Path("/app/app")


def load(names, namespace):
    tree = ast.parse((APP / "agent_service.py").read_text(encoding="utf-8"))
    nodes = [n for n in tree.body if getattr(n, "name", None) in names]
    exec(compile(ast.Module(body=nodes, type_ignores=[]), "agent_service.py", "exec"), namespace)
    return namespace


class FakeGitea:
    def __init__(self, branches):
        self.branches = list(branches)

    async def get(self, path, params=None):
        page = self.branches[:50]
        return NS(is_success=True, json=lambda: [{"name": b} for b in page])

    async def delete(self, path):
        self.branches.remove(path.rsplit("/", 1)[-1].replace("%2F", "/"))
        return NS(is_success=True)


class InternalRepoChecks(unittest.IsolatedAsyncioTestCase):
    async def test_only_the_verified_branch_stays(self):
        ns = load({"keep_approved_branch"}, {"quote": quote, "httpx": NS(AsyncClient=object)})
        gitea = FakeGitea(["main"] + [f"feature/x{i}" for i in range(120)])
        await ns["keep_approved_branch"](gitea, "/api/v1/repos/mcp/servers", "main")
        self.assertEqual(gitea.branches, ["main"])

    def test_description_keeps_every_server_from_the_repository(self):
        ns = load({"internal_repo_description"}, {})
        text = ns["internal_repo_description"]("Fetch · Time · 검증 커밋 0123456789ab", {"display_name": "Git", "commit_sha": "e1dc4b18dbb9aa"})
        self.assertEqual(text, "Fetch · Git · Time · 검증 커밋 e1dc4b18dbb9")
        self.assertEqual(ns["internal_repo_description"]("", {"display_name": "Time", "commit_sha": "e1dc4b18dbb9aa"}), "Time · 검증 커밋 e1dc4b18dbb9")


if __name__ == "__main__":
    unittest.main()
