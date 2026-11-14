import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { inboxRoute, inboxActions, loadInbox, alertCallsHref, waitText } from "../gateway/app/agent_static/inbox.mjs";
import { myRoute } from "../gateway/app/agent_static/my.mjs";

const source = readFileSync(new URL("../gateway/app/agent_static/console.js", import.meta.url), "utf8");
const safe = source.slice(source.indexOf("class Raw {"), source.indexOf("function detailText("));
const kit = runInNewContext(`${safe}
const chip = (tone, label) => html\`<span class="chip \${tone}">\${label}</span>\`;
const kv = (pairs) => html\`<dl>\${pairs.filter(([, v]) => v !== undefined && v !== null && v !== "").map(([k, v]) => html\`<dt>\${k}</dt><dd>\${v}</dd>\`)}</dl>\`;
({ html, raw, chip, kv, short });`);

const NOW = Date.now();
const ago = (ms) => new Date(NOW - ms).toISOString();
const HOUR = 3600000;

function context(overrides = {}) {
  const responses = {
    "/approvals": { approvals: [
      { id: "a1", requested_by: "tok-1", display_name: "김직원", department: "개발", server_id: "files", tool: "write", reason: "배포 파일 갱신", policy_id: "P-APPROVAL-1",
        action: "w", data_class: "nonimportant", arguments: { path: "/a" }, created_at: ago(5 * HOUR), expires_at: ago(-HOUR), own: false },
      { id: "a2", requested_by: "tok-2", display_name: "관리자", server_id: "docs", tool: "read", created_at: ago(10 * 60000), expires_at: ago(-HOUR), own: true },
    ], history: [], total: 2, page_size: 30 },
    "/gw/dispatch-intents": { rows: [{ request_id: "r1", user_token: "tok-1", display_name: "김직원", server_id: "files", tool_name: "write", action: "w", attempted_at: ago(2 * HOUR), decision_id: 77 }] },
    "/api/signup-requests?status=pending": { requests: [{ id: 3, username: "newbie", display_name: "새 직원", status: "pending", requested_at: ago(30 * 60000) },
      { id: 4, username: "done", display_name: "처리됨", status: "approved", requested_at: ago(HOUR) }] },
    "/gw/endpoint/inventory": { agents: [
      { endpoint_id: "pc-1", hostname: "host-1", owner_name: "박직원", managed_state: "pending", policy_hash: "h1", status: "active", last_seen_at: ago(60000) },
      { endpoint_id: "pc-2", hostname: "host-2", managed_state: "active", policy_hash: "h2", status: "active" },
      { endpoint_id: "pc-3", hostname: "host-3", managed_state: "pending", policy_hash: "", status: "active" }] },
    "/api/mcp-requests": { requests: [{ id: 9, status: "VALIDATED", display_name: "새 MCP", submitted_by_name: "최직원", created_at: ago(26 * HOUR), own: false },
      { id: 10, status: "APPROVED", registered_server_id: "x", display_name: "등록됨", created_at: ago(HOUR) },
      { id: 11, status: "REJECTED", display_name: "거부됨", created_at: ago(HOUR) }] },
    "/gw/endpoint/requests": { requests: [{ id: "q1", hostname: "host-9", owner_name: "정직원", server_label: "Notes", purpose: "메모 정리", source_url: "https://example.test/mcp", created_at: ago(3 * HOUR) }] },
    "alerts": { alerts: [
      { id: 12, kind: "new-tool", created_at: ago(HOUR), evidence: { server_id: "docs", added: ["x"] } },
      { id: 11, kind: "new-tool", created_at: ago(2 * HOUR), evidence: { server_id: "docs", added: ["x"] } },
      { id: 3, kind: "call-burst", created_at: ago(3 * HOUR), evidence: { server_id: "files" } }] },
    "/gw/policy/ledger": { policies: [{ policy_id: "P-APPROVAL-1", name: "쓰기 승인" }] },
    ...overrides.responses,
  };
  const opened = [], setLists = [], seen = [];
  const c = {
    ...kit,
    ago: (v) => (v ? "방금" : "—"), when: (v) => `시각:${v}`, entityRef: (v) => v, json: (v) => JSON.stringify(v), empty: (v, o = {}) => kit.html`<p class="empty">${o.filtered ? "조건에 맞는 결과 없음" : v}</p>`,
    panel: (title, body) => kit.html`<section data-title="${String(title)}">${body}</section>`, head: (title, o = {}) => kit.html`<h1>${title}</h1>${o.status || ""}`,
    kpiStrip: (items) => kit.html`<div class="kpis">${items.map(([label, value]) => kit.html`<div class="kpi">${label}:${value}</div>`)}</div>`,
    chartBox: (id) => kit.html`<div id="${id}"></div>`, charts: { bars: (items, o) => ({ items, o }) },
    openDrawer: (title, body) => opened.push({ title, body: String(body) }),
    api: async (path) => { const v = responses[path]; if (v === undefined || v instanceof Error) throw v || new Error(path); return v; },
    gw: async (path) => {
      if (path.startsWith("audit/alerts?")) { const v = responses.alerts; if (v instanceof Error) throw v; return v; }
      if (path.startsWith("activity?")) return responses.recent ?? { rows: [{ at: ago(HOUR), decision: "Allow", server: "files", tool: "read" }] };
      if (path.startsWith("approvals/") && path.endsWith("/evidence")) return responses.evidence ?? { explanation: {}, evidence_sha256: "x" };
      const v = responses[`/gw/${path}`]; if (v === undefined || v instanceof Error) throw v || new Error(path); return v;
    },
    ACTION: { w: "쓰기", r: "읽기" }, DATA_CLASS: { nonimportant: "내부" }, INTAKE_STATUS: { VALIDATED: ["restrict", "검증 완료"] }, MANAGED_STATE: { pending: "활성화 대기" },
    ALERT_KIND: { "new-tool": "새 도구", "call-burst": "호출 급증" }, decisionChip: (d) => kit.chip("allow", d), policyLabel: (id) => ({ "P-APPROVAL-1": "쓰기 승인" }[id] || id),
    impactExplanation: () => "설명", alertTarget: (a) => [a.evidence?.server_id || "—", ""], alertDetail: (a) => (a.evidence?.added || []).join(","),
    alertGroups: (alerts) => { const m = new Map(); for (const a of alerts) { const k = `${a.kind}:${a.evidence?.server_id}`; if (!m.has(k)) m.set(k, []); m.get(k).push(a); }
      return [...m.values()].map((rows) => ({ rows, first: rows.at(-1).created_at, last: rows[0].created_at })); },
    alertsSeen: () => overrides.seen || [], markAlertsSeen: (rows) => seen.push(...rows.map((r) => r.id)),
    approvalHistory: () => kit.html`<p>이력</p>`, setApprovalLists: (first, selected) => setLists.push({ first, selected }), setLedger() {}, reload() {}, refreshBadges() {},
  };
  return { c, opened, setLists, seen };
}

const markup = async (c, query = "") => String((await inboxRoute(c, new URLSearchParams(query))).html);

test("처리함은 여섯 갈래의 대기를 오래된 것부터 한 표에 모으고 처리된 것은 뺀다", async () => {
  const { c } = context();
  const { items } = await loadInbox(c);
  assert.equal(items.length, 9);
  const stamps = items.map((i) => new Date(i.at).getTime());
  assert.deepEqual(stamps, [...stamps].sort((a, b) => a - b));
  assert.ok(!items.some((i) => i.summary === "등록됨" || i.summary === "거부됨" || i.summary === "done" || i.summary === "host-2" || i.summary === "host-3"));
  const out = await markup(c);
  for (const label of ["호출 승인", "도입 신청", "엔드포인트 요청", "가입·기기", "실행 확인", "경보", "처리 이력"]) assert.match(out, new RegExp(label));
  assert.match(out, /<th>유형<\/th><th>요약<\/th><th>요청자<\/th>\s*<th class="num">대기<\/th><th class="num">만료<\/th>/);
  assert.match(out, /대기:9/); assert.match(out, /평균 대기:/); assert.match(out, /가장 오래된 대기:1일/);
  assert.doesNotMatch(out, /<div class="tabs"|role="tab"/);
});

test("유형 칩은 건수를 보이고 선택한 유형만 표에 남기며 본인 요청은 표시한다", async () => {
  const { c } = context();
  const all = await markup(c);
  assert.match(all, /호출 승인 <b class="n ">2<\/b>/); assert.match(all, /가입·기기 <b class="n ">2<\/b>/); assert.match(all, /경보 <b class="n ">2<\/b>/);
  assert.match(all, /본인 요청/);
  const only = await markup(c, "f=people");
  assert.equal((only.match(/data-act="inbox-open"/g) || []).length, 2);
  assert.doesNotMatch(only, /files\.write/);
  const none = await markup(context({ responses: { "/gw/dispatch-intents": { rows: [] } } }).c, "f=execution");
  assert.match(none, /조건에 맞는 결과 없음/);
});

test("읽은 경보는 처리함에서 빠지고 같은 경보는 한 행으로 묶인다", async () => {
  const { c } = context({ seen: [[11, 12]] });
  const { items } = await loadInbox(c);
  assert.deepEqual(items.filter((i) => i.type === "alert").map((i) => i.raw.id), [3]);
  const both = await loadInbox(context().c);
  const grouped = both.items.find((i) => i.type === "alert" && i.raw.id === 12);
  assert.equal(grouped.count, 2);
});

test("일부 조회가 실패해도 나머지는 보이고 실패한 유형을 칩으로 알린다", async () => {
  const { c } = context({ responses: { "/gw/dispatch-intents": new Error("x"), alerts: new Error("y") } });
  const out = await markup(c);
  assert.match(out, /조회 실패 실행 확인, 경보/);
  assert.match(out, /files\.write/);
});

test("호출 승인 서랍은 맥락과 같은 무게의 승인·거부 버튼을 두고 본인 요청에는 버튼이 없다", async () => {
  const { c, opened, setLists } = context();
  const actions = inboxActions(c);
  await markup(c);
  assert.equal(setLists.at(-1).selected.approvals.length, 2);
  await actions["inbox-open"]({ dataset: { key: "approval:a1" } });
  const body = opened[0].body;
  assert.match(body, /김직원 · 개발/); assert.match(body, /쓰기 승인/); assert.match(body, /P-APPROVAL-1/); assert.match(body, /배포 파일 갱신/);
  assert.match(body, /같은 사용자·서버 최근 호출/); assert.match(body, /files\.read/);
  assert.match(body, /data-act="reject"[^>]*>거부<[^]*data-act="approve"[^>]*>승인</);
  assert.equal((body.match(/class="btn"/g) || []).length, 2);
  assert.doesNotMatch(body, /primary|danger/);
  await actions["inbox-open"]({ dataset: { key: "approval:a2" } });
  assert.match(opened[1].body, /본인 요청/); assert.doesNotMatch(opened[1].body, /data-act="approve"|data-act="reject"/);
});

test("중대 영향 승인 서랍은 설명 증빙을 함께 보인다", async () => {
  const { c, opened } = context({ responses: { "/approvals": { approvals: [{ id: "h1", requested_by: "t", server_id: "hr", tool: "fire", explanation: { summary: "x" },
    created_at: ago(HOUR), expires_at: ago(-HOUR), own: false }], history: [], total: 1, page_size: 30 } } });
  await markup(c);
  await inboxActions(c)["inbox-open"]({ dataset: { key: "approval:h1" } });
  assert.match(opened[0].body, /설명 증빙/); assert.match(opened[0].body, /설명/);
});

test("가입·기기·실행 확인·엔드포인트 요청·경보 서랍은 기존 처리 동작에 연결된다", async () => {
  const { c, opened, seen } = context();
  const actions = inboxActions(c);
  await markup(c);
  const open = async (key) => { await actions["inbox-open"]({ dataset: { key } }); return opened.at(-1).body; };
  const signup = await open("signup:3");
  assert.match(signup, /data-act="signup-reject" data-id="3"[^]*data-act="signup-approve" data-id="3"/);
  const device = await open("device:pc-1");
  assert.match(device, /data-act="device-activate" data-id="pc-1" data-hash="h1"/); assert.match(device, /활성화 대기/);
  const execution = await open("execution:r1");
  assert.match(execution, /data-act="intent-resolve" data-id="r1" data-outcome="not_executed"[^]*data-outcome="executed"/); assert.match(execution, /#\/activity\?d=77/);
  const asked = await open("endpoint:q1");
  assert.match(asked, /data-act="endpoint-request-close" data-id="q1" data-name="Notes" data-endpoint="host-9"/); assert.match(asked, /#\/intake\?t=new&amp;name=Notes/);
  const alert = await open("alert:12");
  assert.match(alert, /data-act="inbox-ack" data-key="alert:12"/); assert.match(alert, /server=docs/);
  actions["inbox-ack"]({ dataset: { key: "alert:12" } });
  assert.deepEqual(seen, [12, 11]);
});

test("시각이 없는 항목은 대기 시간을 지어내지 않고 평균·최장에서 뺀다", async () => {
  const { c } = context({ responses: { "/gw/endpoint/inventory": { agents: [{ endpoint_id: "pc-9", hostname: "host-9", managed_state: "pending", policy_hash: "h", status: "active" }] },
    "/approvals": { approvals: [], history: [], total: 0, page_size: 30 }, "/api/mcp-requests": { requests: [] }, "/gw/endpoint/requests": { requests: [] },
    "/gw/dispatch-intents": { rows: [] }, "/api/signup-requests?status=pending": { requests: [] }, alerts: { alerts: [] } } });
  const out = await markup(c);
  assert.match(out, /대기:1/); assert.match(out, /평균 대기:—/); assert.match(out, /가장 오래된 대기:—/);
  assert.match(out, /<td class="num nowrap " title="[^"]*">—<\/td>/);
});

test("도입 신청 행은 서랍 없이 도입 심사 상세 주소로 이동한다", async () => {
  const out = await markup(context().c);
  assert.match(out, /data-act="goto" data-href="#\/intake\/9"/);
});

test("처리 이력 보기는 대기 표 대신 승인 이력을 보인다", async () => {
  const out = await markup(context().c, "view=history");
  assert.match(out, /이력/); assert.doesNotMatch(out, /inbox-table/);
});

test("경보 관련 호출 주소는 대상 서버·정책·사용자와 전후 한 시간을 싣고 근거가 없으면 비운다", () => {
  const link = alertCallsHref({ created_at: "2026-11-01T10:00:00Z", evidence: { server_id: "docs", policy_id: "P-1", user_token: "u" } });
  const q = new URLSearchParams(link.split("?")[1]);
  assert.equal(q.get("since"), "2026-11-01T09:00:00.000Z"); assert.equal(q.get("until"), "2026-11-01T11:00:00.000Z");
  assert.equal(q.get("server"), "docs"); assert.equal(q.get("policy"), "P-1"); assert.equal(q.get("principal"), "u");
  assert.equal(alertCallsHref({ created_at: "2026-11-01T10:00:00Z", evidence: {} }), "");
  assert.equal(alertCallsHref({ created_at: "nope", evidence: { server_id: "x" } }), "");
});

test("대기 시간은 방금·분·시간·일로 줄인다", () => {
  assert.equal(waitText(30000), "방금"); assert.equal(waitText(5 * 60000), "5분"); assert.equal(waitText(3 * HOUR), "3시간"); assert.equal(waitText(50 * HOUR), "2일");
});

test("내 MCP는 사용 가능한 MCP·내 동의·내 신청·새 신청 네 탭과 동의 상태 열을 둔다", async () => {
  const calls = [];
  const consentTab = { key: "pending", label: "확인 필요", n: 1, hot: true, body: kit.html`<p>동의 본문</p>` };
  const c = { ...kit, viewer: { kit: {}, managed_devices: [{ status: "active", managed_state: "pending" }] }, MANAGED_STATE: { active: "활성", pending: "활성화 대기" },
    INTAKE_STATUS: { HOLD: ["outline", "검토 대기"], REJECTED: ["block", "거부"] }, when: (v) => v, empty: (v) => v, panel: (title, body) => kit.html`<section>${title}${body}</section>`,
    head: (title) => title, page: (value) => value, listToolbar: () => "", approvedMcpSearch: () => "",
    api: async (path) => { calls.push(path); return path === "/api/mcp-requests" ? { requests: [{ id: 1, status: "HOLD", display_name: "내 신청", review_note: "보완", created_at: "t" }] }
      : path === "/api/approved-mcp" ? { servers: [{ server_id: "files" }, { server_id: "docs" }] } : { requests: [], registry: [] }; },
    consentTabs: async () => [consentTab, { key: "history", label: "이력", body: kit.html`<p>이력 본문</p>` }],
    consentRows: () => [{ server_id: "files", status: "PENDING" }, { server_id: "docs", status: "GRANTED" }],
    approvedMcpTable: (servers, _query, consentOf) => kit.html`${servers.map((s) => consentOf(s.server_id))}`,
    intakeNewBody: (pre) => kit.html`<form>${pre.name}</form>` };
  const page = (await myRoute(c, "", new URLSearchParams("t=consent"))).html;
  assert.deepEqual(page.tabs.map((t) => t.key), ["available", "consent", "mine", "new"]);
  assert.equal(page.active, "available");
  const available = String(page.tabs[0].body);
  assert.match(available, /#\/my\?t=consent&server=files[^]*동의 필요/); assert.match(available, /chip allow">동의/);
  const consent = page.tabs[1];
  assert.equal(consent.n, 1); assert.equal(consent.hot, true); assert.match(String(consent.body), /동의 본문[^]*이력 본문/);
  assert.match(String(page.tabs[2].body), /내 신청[^]*검토 대기[^]*보완/);
  assert.match(String(page.kpis), /data-act="pc-kit"[^]*활성화 대기/); assert.match(String(page.kpis), /동의 필요[^]*value">1</); assert.match(String(page.kpis), /진행 중 신청[^]*value">1</);
  assert.ok(!calls.includes("/api/mcp-catalog/search"));
  await myRoute(c, "new", new URLSearchParams("name=Notes"));
  assert.ok(calls.includes("/api/mcp-catalog/search"));
  assert.equal((await myRoute(c, "mine", new URLSearchParams())).html.active, "mine");
});
