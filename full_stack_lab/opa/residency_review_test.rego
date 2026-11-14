package mcp.authz_test

import rego.v1
import data.mcp.authz.decision

reviewed_foreign_target := object.union(residency_target(["US"], ["US"]), {
    "transfer_basis": "independently reviewed basis", "transfer_reviewed": true,
})

test_reviewed_foreign_internal_grade_avoids_repeated_approval if {
    result := decision with input as residency_input("nonimportant", [reviewed_foreign_target], data.residency)
    result.decision == "Allow"
    result.policy_id == "P-AUTHZ-ALLOW-001"
}

test_transfer_review_cannot_outrank_contract_block if {
    document := residency_input("nonimportant", [reviewed_foreign_target], data.residency)
    request := object.union(document, {"contract": object.union(base.contract, {"schema_hash_match": false})})
    result := decision with input as request
    result.decision == "Block"
    result.policy_id == "MCP-CATALOG-001"
}

test_transfer_review_cannot_override_dlp if {
    document := residency_input("nonimportant", [reviewed_foreign_target], data.residency)
    patch := with_input({"principal": {"role": "admin"}, "tool": {"action": "x"},
                        "resource": {"data_class": "important"}, "request": {"dlp": ["kr-rrn"]},
                        "approval": {"granted": true}})
    result := decision with input as object.union(patch, {"pac": document.pac})
    result.decision == "Block"
    result.policy_id == "P-DLP-001"
}

test_transfer_review_cannot_override_pac_scope if {
    document := residency_input("nonimportant", [reviewed_foreign_target], data.residency)
    facts := object.union(document.pac.facts, {"approval": object.union(document.pac.facts.approval, {"data_scopes": []})})
    request := object.union(document, {"pac": {"request": document.pac.request, "facts": facts}})
    result := decision with input as request
    result.decision == "Block"
    result.policy_id == "PAC-11"
}
