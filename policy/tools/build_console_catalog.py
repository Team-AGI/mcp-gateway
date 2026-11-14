"""Build the read-only console catalog from policy sources; static evidence is not deployment evidence."""
import argparse
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT.parent / "full_stack_lab/gateway/app/organization_policies.json"
RUNTIME = ROOT.parent / "full_stack_lab/opa"
MODES = ("auto", "feature", "manual", "structural")


def runtime_rules():
    """Rules the running gateway evaluates (its policy ledger), and whether OPA loads the policy/pac package at all."""
    ledger = set(json.loads((RUNTIME / "policy_ledger.json").read_text(encoding="utf-8"))["policy_ledger"])
    loaded = any("data.mcp.pol" in path.read_text(encoding="utf-8") for path in RUNTIME.glob("*.rego"))
    return ledger, loaded


def candidates_of(classification):
    return sorted(set(re.findall(r"(?:MCP|PAC|P)-[A-Z0-9]+(?:-[A-Z0-9]+)*", classification.get("evidence", ""))))


def build():
    sheet_bytes = (ROOT / "source/sheet.json").read_bytes()
    classification_bytes = (ROOT / "source/classification.json").read_bytes()
    sheet = json.loads(sheet_bytes)["policies"]
    classes = json.loads(classification_bytes)["policies"]
    titles_bytes = (ROOT / "source/console_titles.json").read_bytes()
    titles = json.loads(titles_bytes)
    if set(sheet) != set(classes) or set(sheet) != set(titles["policies"]):
        raise ValueError("Policy sources contain different identifiers")
    rules, tests = set(), set()
    for path in (ROOT / "pac").glob("*.rego"):
        text = path.read_text(encoding="utf-8")
        if path.name.endswith("_test.rego"):
            tests.update(f"POL-{a.upper()}-{n}" for a, n in re.findall(r"test_pol_([a-z])_(\d{2})_(?:pass|block)_", text))
        else:
            rules.update(a or b for a, b in re.findall(r'lib\.finding\("(POL-[A-Z]-\d{2})"|"policy_id": "(POL-[A-Z]-\d{2})"', text))
    ledger, pac_loaded = runtime_rules()
    policies = []
    for pid, source in sheet.items():
        if not re.fullmatch(r"POL-[A-Z]-\d{2}", pid):
            raise ValueError("Invalid policy identifier")
        classification = classes[pid]
        rule = source.get("rule") or {}
        candidates = candidates_of(classification)
        meta = titles["policies"][pid]
        if meta["mode"] not in MODES or meta["group"] not in titles["groups"] or source["priority"] not in ("P1", "P2", "P3"):
            raise ValueError(f"{pid}: invalid console metadata")
        policies.append({"id": pid, "name": source["target"], "stage": source["stage"],
                         "title": meta["title"], "group": meta["group"], "group_title": titles["groups"][meta["group"]],
                         "mode": meta["mode"], "priority": source["priority"],
                         "content": source["content"], "condition": source["condition"],
                         "required_evidence": source.get("evidence", ""),
                         "pass_condition": rule.get("pass_condition", ""),
                         "block_condition": rule.get("block_condition", ""),
                         "has_rule": pid in rules, "has_test_definition": pid in tests,
                         "candidate_rule_ids": candidates,
                         "rule_runtime": pac_loaded and pid in rules,
                         "runtime_rule_ids": [c for c in candidates if c in ledger]})
    return {"schema": 1, "source_sha256": hashlib.sha256(sheet_bytes).hexdigest(),
            "summary": {"mode": {m: sum(p["mode"] == m for p in policies) for m in MODES}, "pac_runtime_loaded": pac_loaded,
                        "with_runtime_rule": sum(bool(p["runtime_rule_ids"]) for p in policies)},
            "classification_sha256": hashlib.sha256(classification_bytes).hexdigest(),
            "titles_sha256": hashlib.sha256(titles_bytes).hexdigest(), "policies": policies}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    rendered = json.dumps(build(), ensure_ascii=False, indent=2) + "\n"
    if args.check:
        if not OUTPUT.is_file() or OUTPUT.read_text(encoding="utf-8") != rendered:
            raise SystemExit("Console policy catalog is out of date")
    else:
        OUTPUT.write_text(rendered, encoding="utf-8")


if __name__ == "__main__":
    main()
