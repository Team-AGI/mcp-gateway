import test from "node:test";
import assert from "node:assert/strict";
import * as m from "../gateway/app/agent_static/screens.mjs";

const NOW = Date.parse("2026-11-14T12:00:00Z");
const ago = (minutes) => new Date(NOW - minutes * 60000).toISOString();
const agents = [
  { endpoint_id: "a", owner_token: "ta", managed_state: "active", last_seen_at: ago(1), shadow: 0 },
  { endpoint_id: "b", owner_token: "tb", managed_state: "pending", last_seen_at: ago(30), shadow: 2 },
  { endpoint_id: "c", owner_token: "tc", managed_state: "quarantined", last_seen_at: ago(3000), shadow: 1 },
  { endpoint_id: "d", owner_token: "td", last_seen_at: null },
  { endpoint_id: "e", owner_token: "te", managed_state: "active", last_seen_at: ago(5), status: "revoked" },
];

test("endpoint cards split reporting from silent PCs and ignore revoked ones", () => {
  assert.deepEqual(m.endpointCards(agents, NOW), { total: 4, reporting: 1, silent: 3, quarantined: 1, pending: 1 });
  assert.deepEqual(m.managedMix(agents), { active: 1, pending: 1, quarantined: 1, unmanaged: 1 });
  assert.deepEqual(m.reportAges(agents, NOW), { quarter: 1, hour: 1, day: 0, older: 2 });
  assert.equal(m.filterEndpoints(agents, { silent: true, now: NOW }).length, 3);
  assert.equal(m.shadowPcs(agents), 2);
});

test("the PC stage walks from signup to an activated PC", () => {
  const stage = (token, status = "active") => m.pcStage({ token, status }, agents);
  assert.equal(stage("ta"), "active"); assert.equal(stage("tb"), "installed");
  assert.equal(stage("zz"), "signed"); assert.equal(stage("zz", "disabled"), "none");
});

test("user rows join call counts by name and keep deleted users in the same list", () => {
  const accounts = [{ user_id: "u1", token: "ta", display_name: "가나", department: "개발", status: "active" }];
  const rows = m.userRows(accounts, [{ user_id: "u2", display_name: "삭제", status: "deleted" }], agents, m.peopleStats([{ key: "가나", total: 7, Block: 3 }]));
  assert.deepEqual(rows.map((r) => [r.state, r.stage, r.calls, r.blocked]), [["active", "active", 7, 3], ["deleted", "none", 0, 0]]);
  assert.deepEqual(m.userCards(accounts, [{}], [{ status: "pending" }, { status: "approved" }], [{ user_token: "x" }, { user_token: "x" }, { user_token: "y", resumed_at: "t" }]),
    { total: 1, active: 1, stopped: 1, pending: 1, deleted: 1 });
  assert.deepEqual(m.departmentCounts([{ department: "a" }, { department: "b" }, { department: "a" }]), [{ name: "a", value: 2 }, { name: "b", value: 1 }]);
  assert.deepEqual(m.topBlocked([{ key: "x", Block: 1 }, { key: "y", Block: 5 }, { key: "z", Block: 0 }, { other: true, key: "o", Block: 9 }]), [{ name: "y", value: 5 }, { name: "x", value: 1 }]);
});

test("termination cards, stage counts and the due date follow the case status", () => {
  assert.deepEqual(m.terminationCards({ open_cases: 2, overdue: 1, retired_residue: 4 }), { open: 2, waiting: 0, overdue: 1, unresolved: 0, residue: 4 });
  const cases = [{ status: "OPEN" }, { status: "REVOKING" }, { status: "ASSESSED" }, { status: "CLOSED", grade: "T1" }, { status: "CLOSED", grade: "T3" }];
  const steps = Array.from({ length: 7 }, (_, i) => `s${i}`);
  assert.deepEqual(m.stageCounts(cases, steps).map((s) => s.value), [0, 0, 1, 0, 1, 0, 3]);
  assert.deepEqual(m.gradeCounts(cases).map((g) => g.value), [1, 0, 1]);
  assert.equal(m.caseDue({ status: "OPEN", opened_at: "2026-11-01T00:00:00Z" }, 14), "2026-11-15T00:00:00.000Z");
  assert.equal(m.caseDue({ status: "CLOSED", opened_at: "2026-11-01T00:00:00Z" }, 14), null);
});

test("server cards count attention, near expiry and blocking servers", () => {
  const servers = [{ id: "a", status: "READY", lifecycle: "OPERATING", calls: 10, blocked: 1 }, { id: "b", status: "DRIFT", lifecycle: "OPERATING", calls: 0 },
    { id: "c", status: "READY", lifecycle: "RETIRED" }];
  const regs = { a: { valid_until: new Date(NOW + 5 * 86400000).toISOString() }, b: { valid_until: new Date(NOW + 90 * 86400000).toISOString() } };
  assert.deepEqual(m.serverCards(servers, regs, NOW), { operating: 2, attention: 1, due: 1, blocked: 1 });
  assert.deepEqual(m.statusMix(servers), { READY: 1, DRIFT: 1 });
  assert.equal(m.blockRate(servers[0]), 10); assert.equal(m.blockRate(servers[1]), null);
});

test("shadow MCPs group by label and address, and the supply chain table lists affected servers first", () => {
  const entries = [{ server_label: "Docs", transport: "stdio", endpoint_ref: "x", endpoint_id: "e1", classification: "retired-residue", reported_at: "2026-11-01" },
    { server_label: "Docs", transport: "stdio", endpoint_ref: "x", endpoint_id: "e2", classification: "shadow", reported_at: "2026-11-02" },
    { server_label: "Other", transport: "sse", endpoint_ref: "y", endpoint_id: "e1", classification: "shadow", reported_at: "2026-11-03" }];
  const groups = m.shadowGroups(entries);
  assert.deepEqual(groups.map((g) => [g.label, g.endpoints.size, g.cls]), [["Other", 1, "shadow"], ["Docs", 2, "shadow"]]);
  const rows = m.impactRows([{ server_id: "a", judgement: "영향 없음" }, { server_id: "b", judgement: "영향 있음", evidence: [{ version: "1" }, { version: "1" }, { version: "2" }] }], { b: 3 });
  assert.deepEqual(rows.map((r) => [r.server_id, r.versions, r.users]), [["b", ["1", "2"], 3], ["a", [], null]]);
});

test("intake cards separate waiting, high risk and reassessment; stages and risk mix add up", () => {
  const requests = [
    { status: "VALIDATED", risk: { status: "ok", tier: "high" }, created_at: "2026-11-01T00:00:00Z" },
    { status: "HOLD", risk: { status: "hold" }, created_at: "2026-11-01T00:00:00Z", endpoint_reapproval_required: true },
    { status: "APPROVED", risk: { status: "ok", tier: "low" }, created_at: "2026-11-01T00:00:00Z", reviewed_at: "2026-11-03T00:00:00Z" },
    { status: "REJECTED", risk: { status: "ok", tier: "low" }, created_at: "2026-11-01T00:00:00Z", reviewed_at: "2026-11-05T00:00:00Z" },
    { status: "VALIDATING" }];
  assert.deepEqual(m.intakeCards(requests, 1), { waiting: 2, days: 3, high: 1, reassess: 2 });
  assert.deepEqual(m.intakeStages(requests).map((s) => s.value), [1, 2, 1, 1]);
  assert.deepEqual(m.riskMix(requests), { low: 2, medium: 0, high: 1, very_high: 0, none: 2 });
  assert.deepEqual(m.scanSummary({ critical: 2, high: 1, scanners: { Trivy: { status: "FAILED" } } }), { critical: 2, high: 1, failed: true });
});

test("a trend series groups decisions by bucket in time order", () => {
  const rows = m.seriesRows([{ at: "2026-11-02T00:00:00Z", decision: "Block", n: "2" }, { at: "2026-11-01T00:00:00Z", decision: "Allow", n: 4 }, { at: "2026-11-02T00:00:00Z", decision: "Allow", n: 1 }]);
  assert.deepEqual(rows.map((r) => [r.at, r.Allow, r.Block]), [["2026-11-01T00:00:00Z", 4, 0], ["2026-11-02T00:00:00Z", 1, 2]]);
});
