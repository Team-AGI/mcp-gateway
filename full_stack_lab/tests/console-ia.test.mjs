import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import * as state from "../gateway/app/agent_static/console-state.mjs";
import * as inbox from "../gateway/app/agent_static/inbox.mjs";
import * as my from "../gateway/app/agent_static/my.mjs";

const source = readFileSync(new URL("../gateway/app/agent_static/console.js", import.meta.url), "utf8");
const service = readFileSync(new URL("../gateway/app/agent_service.py", import.meta.url), "utf8");
const adminPages = ["overview", "inbox", "activity", "intake", "servers", "connections", "termination", "people", "endpoints", "policy", "my"];
const employeePages = ["my", "activity"];
const code = source.slice(0, source.indexOf("document.addEventListener(\"click\", (event) => {")).replace(/^import[\s\S]*?;\r?\n/gm, "");

function build(admin = true, extra = {}) {
  const calls = [], requests = [], timers = new Map(), elements = new Map();
  const inventory = { agents: [], entries: [], listeners: [], os_events: [], managed_events: [],
    coverage: { reporting_recently: 0 }, settings: {},
    pages: Object.fromEntries(["entries", "listeners", "os_events"].map((key) => [key, { total: 0, limit: 50, next_cursor: null }])) };
  const responses = {
    "/api/consents": { consents: [] }, "/approvals": { approvals: [], history: [] }, "/gw/dispatch-intents": { rows: [] },
    "/gw/registry": { servers: [], tools: [], registrations: {} },
    "/gw/policy/matrix": { capabilities: [], runtime_envelopes: [] },
    "/gw/enforcement": { enforcement: "enforce" },
    "/gw/policy/ledger": { policies: [] }, "/gw/policy/activity?hours=24": { rows: [], previous: [] },
    "/gw/overview": { servers: [], workstations: [], pending_approvals: 2, unresolved_execution: 0, termination: {}, execution: {}, series: [], flows: [], top_policies: [] },
    "/gw/latency": {}, "/gw/endpoint/network-quality": {}, "/gw/health": {},
    "/api/integrations": { items: [], devices: [], summary: { devices: { bypass_possible: 0 } } },
    "/api/connectors": { items: [], summary: { pending: 3, expired: 1 } },
    "/api/connectors?summary=1": { summary: { pending: 3, expired: 1 } },
    "/gw/endpoint/inventory": inventory,
    "/gw/endpoint/inventory?classification=shadow,retired-residue": inventory,
    "/api/accounts": { accounts: [] }, "/api/accounts/deleted": { accounts: [] }, "/api/signup-requests": { requests: [] },
    "/api/identity": { provider: "local", bindings: [] }, "/gw/suspensions": { suspensions: [] },
    "/api/mcp-requests": { requests: [] }, "/api/approved-mcp": { servers: [] },
    "/api/mcp-catalog/search": { requests: [], registry: [] },
    "/gw/audit/siem": { configured: true, pending: 1, retrying: 0 }, "/gw/audit/incidents": { incidents: [], timer_status: "정상" },
    "/gw/audit/retention": { days: 366, floor_days: 184, jurisdictions: ["EU"] },
    ...extra,
  };
  const node = (key) => {
    if (!elements.has(key)) elements.set(key, { innerHTML: "", textContent: "", dataset: {},
      classList: { contains: () => false, toggle() {} }, querySelector: () => null, querySelectorAll: () => [], focus() {},
      setAttribute(key, value) { this[key] = value; }, showModal() { this.open = true; }, close() { this.open = false; } });
    return elements.get(key);
  };
  const context = vm.createContext({ ...state, ...inbox, ...my, URLSearchParams, FormData, AbortController, setTimeout, clearTimeout, encodeURIComponent, decodeURIComponent,
    lang: () => "ko", locale: () => "ko-KR", t: (v) => v,
    clockText: () => "12:00", dateTimeText: () => "10-27 12:00",
    localStorage: { getItem: () => "fixture-token" }, location: { hash: "#/activity", replace() {} },
    history: { state: null, replaceState() {}, pushState() {}, back() {} },
    document: { hidden: false, querySelector: node, querySelectorAll: () => [] },
    charts: { DECISION_LABEL: {}, register() {}, mountVisible() {}, disposeAll() {}, redraw() {}, spark: () => "", tone: (name) => name },
    setInterval(fn) { const id = timers.size + 1; timers.set(id, fn); return id; },
    clearInterval(id) { timers.delete(id); },
    fetch: async (url, options) => {
      calls.push(url);
      requests.push({ url, ...options });
      let value = responses[url];
      if (value === undefined && url.startsWith("/gw/activity/analysis?")) value = { total: 0 };
      if (value === undefined && url.startsWith("/gw/activity?")) value = { rows: [], total: 0, cursor: 0 };
      if (value === undefined && url === "/api/signup-requests?status=pending") value = responses["/api/signup-requests"];
      if (value === undefined && url.startsWith("/gw/audit/events?")) value = { events: [], has_more: false };
      if (value === undefined && url.startsWith("/gw/audit/alerts?")) value = { alerts: [], last_24h: 0 };
      if (value === undefined && url.startsWith("/gw/endpoint/tool-events?")) value = { rows: [], total: 0 };
      if (value === undefined && url === "/gw/endpoint/requests") value = { requests: [] };
      assert.notEqual(value, undefined, `unexpected request: ${url}`);
      if (typeof value === "function") value = await value();
      if (value instanceof Error) throw value;
      return { ok: true, status: 200, headers: { get: () => null }, json: async () => value };
    },
  });
  vm.runInContext(`${code}\nviewer = ${JSON.stringify({ admin, pages: admin ? adminPages : employeePages })};
    globalThis.ui = { ROUTES, canonicalRoute, renderNav, refreshBadges, covPage, covPaging, badges, ACTIONS,
      validityChip, empty, renderFeed, renderFeedStatus, policyLabel, catalogResults,
      rememberDetail, closeDrawer, openDrawer, decisionAction, shadowLink, alertGroups, markAlertsSeen, alertsSeen,
      refreshAlertBell, resetIntakeTools, FORMS, intakeStatus, rememberFeed, showDecision, route,
      setFeed(value) { Object.assign(feed, value); },
      stopLive, stopIntake, setCurrent(value) { current = value; }, pageModel(fn) { page = fn; },
      refreshApprovalLists, startApprovalRefresh, stopApprovalRefresh, feedCharts,
      refreshDashboard, startDashboardRefresh, stopDashboardRefresh,
      analysisState() { return feed; },
      evidenceSaver(fn) { ACTIONS["save-json"] = fn; toast = () => {}; },
      analysisHooks() { route = () => {}; },
      approvalState() { return { ...approvalPaging, failed: approvalFailed }; },
      approvalActions(askFn) { ask = askFn; route = () => {}; refreshBadges = () => {}; toast = () => {}; },
      activityHooks(render, start) { renderFeed = render; startLive = start; },
      refreshHook(fn) { refreshIntake = fn; }, policyDrawer(fn) { openDrawer = fn; } };`, context);
  context.ui.pageModel((value) => value);
  return { ...context.ui, context, calls, requests, timers, responses, inventory, node };
}

test("상세는 최초 1회 push, 전환·탭은 replace, 닫기는 목록 기록으로 돌아간다", async () => {
  const ui = build(false), writes = [];
  ui.setCurrent({ page: "activity", arg: "", query: new URLSearchParams("q=lookup&page=3&decision=Block") });
  Object.assign(ui.context.history, {
    pushState(state, _, url) { this.state = state; writes.push(["push", url]); },
    replaceState(state, _, url) { this.state = state; writes.push(["replace", url]); },
    back() { writes.push(["back"]); },
  });
  ui.rememberDetail(41); ui.rememberDetail(42); ui.rememberDetail(42);
  assert.deepEqual(writes.map((x) => x[0]), ["push", "replace"]);
  assert.match(writes[0][1], /q=lookup&page=3&decision=Block&d=41/);
  const scope = { querySelectorAll: () => [] };
  const bar = { parentElement: scope, querySelectorAll: () => [] };
  await ui.ACTIONS.tab({ dataset: { tab: "execution" }, closest: (selector) => selector === ".tabs" ? bar : {} });
  assert.match(writes.at(-1)[1], /dt=execution/);
  ui.closeDrawer(); assert.equal(writes.at(-1)[0], "back");
  ui.context.history.state = null;
  ui.rememberDetail(42); ui.closeDrawer(); assert.equal(writes.at(-1)[0], "replace");
  assert.doesNotMatch(writes.at(-1)[1], /[?&](d|dt)=/);
});

test("새로고침 목록의 검색·필터·페이지는 URL이 정본이며 이전 조건을 남기지 않는다", async () => {
  const ui = build(false);
  await ui.ROUTES.activity("", "live", new URLSearchParams("q=lookup&page=3&decision=Block&endpoint=ep1"));
  let request = new URL(ui.calls.find((url) => url.startsWith("/gw/activity?")), "https://unit.test");
  assert.equal(request.searchParams.get("page"), "3");
  assert.equal(request.searchParams.get("q"), "lookup");
  assert.equal(request.searchParams.get("decision"), "Block");
  ui.calls.length = 0;
  await ui.ROUTES.activity("", "live", new URLSearchParams());
  request = new URL(ui.calls.find((url) => url.startsWith("/gw/activity?")), "https://unit.test");
  assert.equal(request.searchParams.get("page"), "1");
  assert.equal(request.searchParams.has("q"), false);
  assert.equal(request.searchParams.has("decision"), false);
});

test("늦은 첫 상세 응답은 나중에 연 호출의 상세와 기록을 덮지 않는다", async () => {
  const ui = build(false), pending = new Map(), writes = [];
  ui.setCurrent({ page: "activity", arg: "", query: new URLSearchParams() });
  ui.context.history.pushState = (_, __, url) => writes.push(url);
  ui.context.history.replaceState = (_, __, url) => writes.push(url);
  ui.context.fetch = (url) => new Promise((resolve) => pending.set(new URL(url, "https://unit.test").searchParams.get("decision_id"), resolve));
  const first = ui.showDecision(1), second = ui.showDecision(2);
  const response = (id) => ({ ok: true, status: 200, headers: { get: () => null }, json: async () => ({ rows: [{
    id, decision: "Allow", server: "files", tool: "read", planes: ["gateway"], outcome_axes: { task: "업무 성공" },
  }] }) });
  pending.get("2")(response(2)); await second;
  pending.get("1")(response(1)); await first;
  assert.equal(ui.node("#drawer-title").textContent, "호출 #2");
  assert.equal(writes.length, 1); assert.match(writes[0], /d=2/);
});

test("미등록 MCP 조치는 엔드포인트·근거 기록을 보존하고 동의는 역할별 도구로 좁힌다", () => {
  const ui = build(true);
  const shadow = String(ui.decisionAction({ decision: "Block", policy_id: "MCP-SHADOW-001", device_id: "pc/<1>",
    evidence: { record_kind: "listener", record_id: 73 }, reason: '<script>x</script>' }));
  assert.match(shadow, /#\/endpoints\?t=shadow/); assert.match(shadow, /endpoint=pc%2F%3C1%3E/); assert.match(shadow, /record_kind=listener/); assert.match(shadow, /record_id=73/);
  assert.doesNotMatch(shadow, /<script>/); assert.match(shadow, /사유/); assert.match(shadow, /실행 안 함/);
  for (const admin of [true, false]) {
    const part = String(build(admin).decisionAction({ decision: "Block", policy_id: "PAC-CONSENT-001", server: "files/a", tool: "read x" }));
    assert.match(part, /#\/my\?t=consent&/);
    assert.match(part, /server=files%2Fa/); assert.match(part, /tool=read\+x/);
  }
});

test("경보는 종류·대상·사유로 묶고 모든 원본과 최초·최근 시각을 유지한다", () => {
  const ui = build(), row = { kind: "unapproved-endpoint-mcp", evidence: { endpoint_id: "ep1", label: "files", reason: "미등록" } };
  const alerts = [{ ...row, id: 3, created_at: "2026-11-01T10:00:00Z" }, { ...row, id: 1, created_at: "2026-11-01T09:00:00Z" },
    { ...row, id: 4, created_at: "2026-11-01T11:00:00Z", evidence: { ...row.evidence, label: "other" } }];
  const groups = ui.alertGroups(alerts);
  assert.equal(groups.length, 2); assert.equal(groups[0].rows.length, 2);
  assert.equal(groups[0].first, alerts[1].created_at); assert.equal(groups[0].last, alerts[0].created_at);
  assert.deepEqual(Array.from(groups.flatMap((g) => g.rows), (r) => r.id).sort(), [1, 3, 4]);
});

test("필터된 경보만 읽음으로 기록하고 종은 전체 미열람 수를 서버에서 받는다", async () => {
  const ui = build(), storage = new Map();
  Object.assign(ui.context.localStorage, { getItem: (k) => storage.get(k) || null, setItem: (k,v) => storage.set(k,v) });
  ui.responses["/gw/audit/alerts?limit=1&read_ranges=1%2C3"] = { unread_count: 1200 };
  ui.markAlertsSeen([{ id: 1 }, { id: 3 }]);
  await ui.refreshAlertBell();
  assert.deepEqual(JSON.parse(JSON.stringify(ui.alertsSeen())), [[1, 1], [3, 3]]);
  assert.equal(ui.node("#alert-count").textContent, "99+");
  assert.equal(ui.node("#alert-bell")["aria-label"], "읽지 않음 1200건");
});

test("경보 기간 API와 표시 건수는 URL 및 응답 범위에 맞는다", async () => {
  const ui = build();
  const out = (await ui.ROUTES.activity("", "alerts", new URLSearchParams("t=alerts&hours=24"))).html;
  assert.ok(ui.calls.includes("/gw/audit/alerts?limit=200&hours=24"));
  const alerts = out.tabs.find((x) => x.key === "alerts");
  assert.match(String(alerts.body), /경보 없음/);
  const kept = { page: "activity", arg: "", query: new URLSearchParams("t=alerts&hours=24") };
  assert.equal(ui.canonicalRoute(kept), kept);
  const moved = ui.canonicalRoute({ page: "security", arg: "", query: new URLSearchParams("t=alerts&hours=24") });
  assert.equal(moved.page, "activity"); assert.equal(moved.query.get("t"), "alerts"); assert.equal(moved.query.get("hours"), "24");
});

test("동의 직행 필터와 도구별 조작·일괄 확인 취소는 범위를 보존한다", async () => {
  const ui = build(false, { "/api/consents": { consents: [
    { id: 1, server_id: "files", tool_name: "read", status: "PENDING", grade: "important", terms: { destinations: ["docs.example.test"] } },
    { id: 2, server_id: "files", tool_name: "write", status: "PENDING" },
  ] } });
  const page = await ui.ROUTES.my("", "consent", new URLSearchParams("t=consent&server=files&tool=read"));
  const body = String(page.html.tabs.find((x) => x.key === "consent").body);
  assert.match(body, /data-id="1" data-decision="grant"/); assert.match(body, /data-id="1" data-decision="deny"/);
  assert.doesNotMatch(body, /files.write/);
  let confirmation;
  vm.runInContext("ask = globalThis.confirmation;", Object.assign(ui.context, { confirmation: async (v) => { confirmation = v; return null; } }));
  await ui.ACTIONS["consent-server"]({ dataset: { id: "files", consents: "1", decision: "grant" } });
  assert.match(String(confirmation.fields), /도구 수/); assert.match(String(confirmation.fields), /docs.example.test/); assert.match(String(confirmation.fields), /중요/);
  assert.equal(ui.calls.filter((url) => url.startsWith("/api/consents/server")).length, 0);
});

test("도구 조회 중복·이전 주소의 늦은 응답·실패 뒤 재시도를 처리한다", async () => {
  const ui = build(false), status = { textContent: "", setAttribute() {} }, tools = { innerHTML: "", replaceChildren() { this.innerHTML = ""; } };
  const endpoint = { value: "https://one.example/mcp", setAttribute() {} };
  const form = { dataset: {}, elements: { endpoint_url: endpoint, namedItem: () => endpoint }, querySelector: (s) => s === "[data-requested-tools]" ? tools : status };
  const button = { disabled: false, closest: () => form };
  let resolve, requests = 0;
  ui.context.fetch = () => { requests++; return new Promise((done) => { resolve = done; }); };
  const first = ui.ACTIONS["intake-discover"](button);
  await ui.ACTIONS["intake-discover"](button); assert.equal(requests, 1); assert.equal(button.disabled, true);
  endpoint.value = "https://two.example/mcp"; ui.resetIntakeTools(form);
  resolve({ ok: true, status: 200, headers: { get: () => null }, json: async () => ({ tools: [{ name: "stale" }] }) });
  await first; assert.equal(tools.innerHTML, ""); assert.equal(button.disabled, false); assert.equal(form.dataset.discoveredEndpoint, undefined);
  ui.context.fetch = async () => { throw new Error("offline"); };
  await ui.ACTIONS["intake-discover"](button); assert.equal(status.textContent, "도구 조회 실패");
  ui.context.fetch = async () => ({ ok: true, status: 200, headers: { get: () => null }, json: async () => ({ tools: [{ name: "fresh" }] }) });
  await ui.ACTIONS["intake-discover"](button);
  assert.match(String(tools.innerHTML), /fresh/); assert.equal(form.dataset.discoveredEndpoint, endpoint.value);
});

test("신청 실패는 입력과 도구 선택을 남기고 해당 필드를 접근성 오류로 표시한다", async () => {
  const ui = build(false), values = { intake_kind: "remote-endpoint", endpoint_url: "https://one.example/mcp", display_name: "원래 이름", purpose: "원래 목적", requested_tool: "read" };
  class Data { get(k) { return values[k] || null; } getAll(k) { return values[k] ? [values[k]] : []; } }
  ui.context.FormData = Data;
  const elements = new Map(), messages = new Map();
  const item = (m,k) => { if (!m.has(k)) m.set(k, { textContent: "", setAttribute(n,v) { this[n] = v; } }); return m.get(k); };
  const form = { dataset: { discoveredEndpoint: values.endpoint_url }, elements: { namedItem: (k) => k in values ? item(elements,k) : null }, querySelector: (s) => item(messages,s) };
  ui.context.fetch = async () => ({ ok: false, status: 422, headers: { get: () => null }, json: async () => ({ detail: [{ loc: ["body", "display_name"], msg: "validation" }] }) });
  await ui.FORMS.intake(form);
  assert.equal(values.display_name, "원래 이름"); assert.equal(values.requested_tool, "read");
  assert.equal(item(elements,"display_name")["aria-invalid"], "true");
  assert.equal(item(messages,'[data-field-error="display_name"]').textContent, "입력 확인 필요");
  assert.equal(form.dataset.submitting, "false");
});

test("엔드포인트 검색·상태·선택은 세 표를 같은 ID로 좁히고 식별값을 분리한다", async () => {
  const ui = build(), q = new URLSearchParams("t=devices&q=kim&state=pending&endpoint=ep1");
  ui.setCurrent({ page: "endpoints", arg: "", query: q });
  const inventory = { ...ui.inventory, agents: [{ endpoint_id: "ep1", hostname: "host-one", owner_name: "직원 이름", managed_state: "pending", local_username: "pc-user", status: "active" }] };
  ui.responses["/gw/endpoint/inventory?q=kim&state=pending&endpoint=ep1"] = inventory;
  ui.responses["/gw/endpoint/inventory?classification=shadow,retired-residue&endpoint=ep1"] = ui.inventory;
  ui.responses["/api/integrations"] = { items: [], devices: [
    { endpoint_id: "ep1", hostname: "host-one", account: "pc-user", state: "observed_only", checks: {} },
    { endpoint_id: "ep2", hostname: "host-other", account: "other-user", state: "observed_only", checks: {} },
  ] };
  const out = await ui.ROUTES.endpoints("", "devices", q);
  const body = String(out.html.tabs.find((tab) => tab.key === "devices").body);
  assert.match(body, /選択|선택 기기/); assert.match(body, /<dl class="kv">/);
  assert.match(body, /<dt>호스트<\/dt><dd>host-one/); assert.match(body, /<dt>PC 계정<\/dt><dd>pc-user/);
  assert.match(body, /직원 이름/); assert.doesNotMatch(body, /host-other|other-user/);
  assert.match(body, /name="q"[^>]*value="kim"/); assert.match(body, /value="pending" selected/);
});

test("미등록 근거 직행 URL은 해당 엔드포인트 목록과 기존 기록 상세를 함께 연다", async () => {
  const ui = build();
  ui.context.matchMedia = () => ({ matches: false });
  ui.context.location.hash = "#/endpoints?t=shadow&endpoint=ep1&record_kind=listener&record_id=73&dt=source";
  ui.responses["/gw/endpoint/inventory?endpoint=ep1"] = ui.inventory;
  ui.responses["/gw/endpoint/inventory?classification=shadow,retired-residue&endpoint=ep1"] = ui.inventory;
  ui.responses["/gw/endpoint/records/listener/73"] = { id: 73, record_kind: "listener", endpoint_id: "ep1", address: "127.0.0.1", provenance: {} };
  ui.responses["/gw/endpoint/correlation?kind=listener&record_id=73"] = { records: [] };
  await ui.route();
  assert.ok(ui.calls.includes("/gw/endpoint/records/listener/73"));
  assert.match(String(ui.node("#drawer-body").innerHTML), /d-panel-source/);
  assert.match(String(ui.node("#drawer-body").innerHTML), /d-tab-source[^>]*aria-selected="true"/);
});

test("종료 목록의 예상·실제 결과와 케이스 근거 링크는 별도 열이다", async () => {
  const ui = build(true, {
    "/gw/termination/relationships": { relationships: [{ id: "rel1", display_name: "문서 서버", status: "ACTIVE", lifecycle: "OPERATING", latest_case: "case1", readiness: { best_attainable_grade: "T1" } }] },
    "/gw/termination/cases": { cases: [{ id: "case1", relationship_id: "rel1", display_name: "문서 서버", grade: "T2", status: "ASSESSED" }], summary: {} },
  });
  const out = await ui.ROUTES.termination();
  for (const tab of out.html.tabs) {
    const body = String(tab.body);
    assert.match(body, /<th>예상 결과<\/th><th>실제 결과<\/th><th>근거<\/th>/);
    assert.match(body, /완전 종료/); assert.match(body, /부분 종료/);
    assert.match(body, /href="#\/termination\/case1\?t=evidence"/);
  }
});

test("브라우저 배포 소스는 개발 주석을 포함하지 않고 만료창은 라벨과 값이다", () => {
  for (const name of ["console.js", "console-state.mjs", "charts.mjs", "inbox.mjs", "my.mjs", "i18n-en.mjs", "i18n.mjs", "login.js"]) {
    const body = readFileSync(new URL(`../gateway/app/agent_static/${name}`, import.meta.url), "utf8");
    assert.doesNotMatch(body, /^\s*\/\/|^\s*\/\*/m);
  }
  assert.match(source, /\["만료 시각",/); assert.match(source, /\["만료 사유",/); assert.match(source, /\["재로그인",/);
});

test("관리자는 네 그룹 열 개 메뉴를 순서대로, 직원과 협력사는 내 MCP와 내 호출만 본다", () => {
  assert.doesNotMatch(source, /\/api\/my-connections|href="#\/connections"/);
  const roles = service.slice(service.indexOf("PAGES_BY_ROLE ="), service.indexOf("ROLE_LABELS ="));
  const ids = (role) => [...roles.match(new RegExp(`"${role}": \\(([^)]+)\\)`))[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(ids("admin"), adminPages);
  for (const role of ["employee", "partner"]) assert.deepEqual(ids(role), employeePages);
  for (const admin of [true, false]) {
    const ui = build(admin); ui.renderNav("activity");
    const markup = ui.node("#nav").innerHTML;
    assert.deepEqual([...markup.matchAll(/href="#\/([\w-]+)"/g)].map((m) => m[1]), admin ? adminPages.filter((id) => id !== "my") : ["my", "activity"]);
    assert.doesNotMatch(markup, /사내 저장소|바로가기|서비스 계정 연결|보안 관제|도구 이용 동의/);
    if (admin) {
      for (const label of ["운영", "MCP 수명주기", "사람·기기", "처리함", "호출·감사", "도입 심사", "MCP 서버", "연결 통제", "종료·폐기", "사용자", "엔드포인트", "정책"]) assert.match(markup, new RegExp(label));
      assert.deepEqual([...markup.matchAll(/class="group"[^>]*>([^<]+)</g)].map((m) => m[1]), ["운영", "MCP 수명주기", "사람·기기", "정책"]);
    } else {
      assert.match(markup, /내 MCP/); assert.match(markup, /내 호출/);
    }
  }
});

test("처리함은 15초마다 다시 읽되 서랍이 열려 있으면 건너뛴다", async () => {
  const ui = build(true);
  ui.setCurrent({ page: "inbox", arg: "", query: new URLSearchParams() });
  const out = await ui.ROUTES.inbox("", "", new URLSearchParams());
  assert.match(String(out.html), /처리함/);
  out.after();
  assert.equal(ui.timers.size, 1);
  ui.context.routed = 0;
  vm.runInContext("route = () => { routed += 1; };", ui.context);
  const tick = [...ui.timers.values()][0];
  tick();
  assert.equal(ui.context.routed, 1);
  ui.node("#drawer").classList.contains = () => true;
  tick();
  assert.equal(ui.context.routed, 1);
  ui.setCurrent({ page: "activity", arg: "", query: new URLSearchParams() });
  tick();
  assert.equal(ui.context.routed, 1);
});

test("호출 추이·판정 분포 차트를 누르면 같은 조건에 시각·판정을 더해 다시 조회한다", () => {
  const ui = build(true);
  Object.assign(ui.context.charts, { DECISION_LABEL: { Allow: "허용", Alert: "경보", Restrict: "제한", Approval: "승인 대기", Block: "차단" }, color: () => "#000",
    donut: (items) => ({ items }), decisionColumns: (_categories, _series, options) => ({ onClick: options?.onClick }) });
  ui.setCurrent({ page: "activity", arg: "", query: new URLSearchParams("t=live") });
  ui.setFeed({ page: 3, analysis: { bucket: "hour", series: [{ at: "2026-11-14T05:00:00Z", decision: "Block", n: 2 }, { at: "2026-11-14T07:00:00Z", decision: "Allow", n: 1 }] } });
  ui.context.routed = 0;
  vm.runInContext("route = () => { routed += 1; };", ui.context);
  const built = ui.feedCharts();
  built["c-calls-trend"]().onClick({ dataIndex: 0, seriesName: "차단" });
  const filters = ui.analysisState().filters;
  assert.equal(filters.decision, "Block");
  assert.equal(filters.since, "2026-11-14T05:00:00.000Z"); assert.equal(filters.until, "2026-11-14T06:00:00.000Z");
  assert.equal(ui.analysisState().page, 1);
  const mix = built["c-decision-mix"]();
  assert.deepEqual(Array.from(mix.items, (item) => item.value), [1, 0, 0, 0, 2]);
  mix.onClick({ name: "허용" });
  assert.equal(filters.decision, "Allow");
  assert.equal(ui.context.routed, 2);
});

test("대시보드 차트 이동 주소의 시간·판정·서버·정책 조건이 호출 목록과 분석 조회에 실린다", async () => {
  const ui = build(true);
  const query = new URLSearchParams({ since: "2026-11-14T05:00:00.000Z", until: "2026-11-14T06:00:00.000Z", decision: "Block", server: "files", policy: "P-CONSENT-001" });
  ui.setCurrent({ page: "activity", arg: "", query });
  const out = await ui.ROUTES.activity("", "", query);
  for (const prefix of ["/gw/activity?", "/gw/activity/analysis?"]) {
    const params = new URL(ui.calls.find((url) => url.startsWith(prefix)), "http://test").searchParams;
    for (const [key, value] of query) assert.equal(params.get(key), value, `${prefix}${key}`);
  }
  const body = String(out.html.tabs[0].body);
  assert.match(body, /value="Block"|<option value="Block" selected/); assert.match(body, /value="P-CONSENT-001"/); assert.match(body, /feed-advanced" open/);
  assert.equal(ui.analysisState().filters.decision, "Block");
});

test("사용자 메뉴는 내 MCP와 PC 연결 설정과 승인된 MCP 저장소를 한 곳에 둔다", () => {
  const ui = build(true);
  vm.runInContext('viewer.name = "관리자"; viewer.role_label = "관리자"; viewer.kit = {}; viewer.git_url = "https://git.example.test/org";', ui.context);
  ui.renderNav("overview");
  const menu = ui.node("#app-identity").innerHTML;
  assert.match(menu, /user-menu/); assert.match(menu, /href="#\/my"/); assert.match(menu, /data-act="pc-kit"/); assert.match(menu, /승인된 MCP 저장소/);
  const staff = build(false);
  vm.runInContext('viewer.name = "직원"; viewer.role_label = "직원";', staff.context);
  staff.renderNav("my");
  assert.doesNotMatch(staff.node("#app-identity").innerHTML, /user-menu/);
});

test("처리함 배지는 대기 전체, 도입 심사·종료·연결 통제 배지는 각자의 건수다", async () => {
  const consents = { consents: [
    { status: "PENDING", server_id: "a" }, { status: "PENDING", server_id: "a" },
    { status: "PENDING", server_id: "b" }, { status: "GRANTED", server_id: "c" }] };
  const ui = build(true, { "/api/consents": consents,
    "/approvals": { approvals: [{ id: "a1", requested_by: "u", server_id: "s", tool: "t", created_at: "2026-11-01T00:00:00Z", expires_at: "2099-01-01T00:00:00Z" }], history: [], total: 1, page_size: 30 },
    "/api/mcp-requests": { requests: [{ id: 7, status: "HOLD", display_name: "x", created_at: "2026-11-01T00:00:00Z" }] },
    "/gw/overview": { servers: [], workstations: [], pending_approvals: 1, intake_actions: 2, unresolved_execution: 0, termination: { overdue: 3 }, execution: {}, series: [], flows: [], top_policies: [] } });
  await ui.refreshBadges();
  const nav = ui.node("#nav").innerHTML;
  assert.match(nav, /href="#\/inbox"[^]*?<span class="count">2<\/span>/);
  assert.match(nav, /href="#\/intake"[^]*?<span class="count">2<\/span>/);
  assert.match(nav, /href="#\/termination"[^]*?<span class="count">3<\/span>/);
  assert.match(nav, /href="#\/connections"[^]*?<span class="count">4<\/span>/);
  assert.doesNotMatch(nav.split('href="#/overview"')[1].split("</a>")[0], /count/);
  const staff = build(false, { "/api/consents": consents });
  await staff.refreshBadges();
  assert.match(staff.node("#nav").innerHTML, /href="#\/my"[^]*?<span class="count">2<\/span>/);
});

test("옛 주소 네 종류와 세부 탭·필터를 새 위치로 보낸다", () => {
  const ui = build();
  for (const [page, tab, target, nextTab] of [
    ["overview", "planes", "servers", "items"],
    ["overview", "traffic", "activity", "live"],
    ["audit", "", "activity", "live"], ["audit", "incidents", "activity", "incidents"],
    ["audit", "siem", "activity", "audit"], ["activity", "events", "activity", "live"], ["activity", "siem", "activity", "audit"],
    ["activity", "incidents", "activity", "incidents"], ["activity", "alerts", "activity", "alerts"],
    ["security", "", "activity", "alerts"], ["security", "integration", "activity", "audit"], ["security", "incidents", "activity", "incidents"],
    ["security", "alerts", "activity", "alerts"], ["consent", "history", "my", "consent"], ["coverage", "", "servers", "items"],
    ["coverage", "devices", "endpoints", "devices"], ["coverage", "shadow", "endpoints", "shadow"],
    ["coverage", "vendor", "servers", "vendor"], ["sbom-impact", "", "servers", "servers"], ["intake", "impact", "servers", "servers"],
    ["servers", "shadow", "endpoints", "shadow"],
    ["servers", "contract", "servers", "servers"],
    ["people", "devices", "endpoints", "devices"], ["people", "managed", "endpoints", "managed"],
    ["approvals", "", "inbox", null], ["approvals", "queue", "inbox", null], ["overview", "approvals", "inbox", null],
    ["approvals", "unsent", "inbox", null], ["activity", "unsent", "inbox", null], ["overview", "unsent", "inbox", null],
    ["approvals", "history", "inbox", null], ["activity", "approval-history", "inbox", null],
    ["approvals", "consent", "my", "consent"],
    ["policy", "capabilities", "servers", "capabilities"],
  ]) {
    const at = { page, arg: "", query: new URLSearchParams({ t: tab, q: "a & b", before: "42" }) };
    const out = ui.canonicalRoute(at);
    assert.equal(out.page, target); assert.equal(out.query.get("t"), nextTab);
    assert.equal(out.query.get("q"), "a & b"); assert.equal(out.query.get("before"), "42");
    assert.equal(at.query.get("t"), tab);
    if (page === "sbom-impact" || (page === "intake" && tab === "impact")) assert.equal(out.query.get("impact"), "1");
    if ((page === "activity" && tab === "approval-history") || (page === "approvals" && tab === "history")) assert.equal(out.query.get("view"), "history");
    if (page !== "approvals" && tab === "unsent") assert.equal(out.query.get("f"), "execution");
  }
  for (const page of ["activity", "toString", "__proto__"]) {
    const at = { page, query: new URLSearchParams() }; assert.equal(ui.canonicalRoute(at), at);
  }
  const consent = { page: "consent", query: new URLSearchParams("server=files&tool=read") };
  for (const admin of [true, false]) {
    const moved = build(admin).canonicalRoute(consent);
    assert.equal(moved.page, "my"); assert.equal(moved.query.get("t"), "consent");
    assert.equal(moved.query.get("server"), "files"); assert.equal(moved.query.get("tool"), "read");
  }
  const draft = build(false).canonicalRoute({ page: "intake", arg: "", query: new URLSearchParams("t=new&name=x") });
  assert.equal(draft.page, "my"); assert.equal(draft.query.get("t"), "new"); assert.equal(draft.query.get("name"), "x");
  assert.equal(build(false).canonicalRoute({ page: "intake", arg: "", query: new URLSearchParams() }).query.get("t"), "available");
  assert.doesNotMatch(source, /#\/(?:audit|sbom-impact)(?:[?"`/])/);
});

test("직원에게 감사·동의 관리·공급망 탭과 관리자 조회를 추가하지 않는다", async () => {
  const ui = build(false);
  const activity = await ui.ROUTES.activity("", "events", new URLSearchParams("t=events"));
  assert.deepEqual(Array.from(activity.html.tabs, (item) => item.key), ["live", "stats"]);
  const mine = await ui.ROUTES.my("", "history", new URLSearchParams());
  assert.deepEqual(Array.from(mine.html.tabs, (item) => item.key), ["available", "consent", "mine", "new"]);
  assert.equal(mine.html.active, "available");
  assert.ok(ui.calls.every((path) => !/audit|supply-chain|integrations|approvals/.test(path)));
});

test("관리자 통합 탭은 기존 데이터와 필터·작업 버튼을 유지한다", async () => {
  const ui = build(true, { "/api/supply-chain/impact": { counts: { affected: 1, unaffected: 0, unknown: 0, no_data: 0 } } });
  const activity = await ui.ROUTES.activity("", "events", new URLSearchParams("t=events&principal=alice&before=12"));
  assert.deepEqual(Array.from(activity.html.tabs, (item) => item.key), ["live", "stats", "tools", "alerts", "incidents", "audit"]);
  assert.ok(ui.calls.includes("/gw/endpoint/tool-events?limit=100"));
  assert.ok(ui.calls.every((url) => url !== "/approvals"));
  assert.match(String(activity.html.tabs.find((item) => item.key === "audit").body), /audit-verify[^]*audit-retention[^]*audit-export/);
  assert.doesNotMatch(String(activity.html.tabs[0].body), /audit-verify|audit-export/);
  for (const url of ["/gw/audit/siem", "/gw/audit/incidents", "/gw/audit/retention"]) assert.ok(ui.calls.includes(url), url);
  assert.match(String(activity.html.head), /관제 전달 미전달 1건/);
  assert.ok(ui.calls.every((url) => !url.startsWith("/gw/audit/events?")));
  const selected = new URL(ui.calls.find((url) => url.startsWith("/gw/activity?")), "https://console.invalid").searchParams;
  assert.equal(selected.get("principal"), "alice"); assert.equal(selected.get("before"), "12");
  let rendered = 0, live = 0;
  ui.activityHooks(() => rendered++, () => live++); activity.after();
  assert.equal(rendered, 1); assert.equal(live, 1);
  assert.equal(ui.ROUTES.approvals, undefined);
  assert.equal(ui.ROUTES.consent, undefined);
  assert.equal(ui.ROUTES.security, undefined);
  const consent = await ui.ROUTES.my("", "consent", new URLSearchParams());
  const consentBody = String(consent.html.tabs.find((item) => item.key === "consent").body);
  assert.match(consentBody, /확인할 요청 없음/);
  assert.match(consentBody, /동의 기록/);
  const servers = await ui.ROUTES.servers("", "servers", new URLSearchParams());
  assert.deepEqual(Array.from(servers.html.tabs, (item) => item.key), ["servers", "tools", "capabilities", "items", "vendor"]);
  assert.doesNotMatch(String(servers.html.head), /통제 범위/);
  assert.match(String(servers.html.head), /AI 연결 관리/);
  assert.equal(ui.ROUTES.coverage, undefined);
  const people = await ui.ROUTES.endpoints("", "devices");
  const devices = people.html.tabs.find((item) => item.key === "devices");
  assert.deepEqual(Array.from(people.html.tabs, (item) => item.key), ["devices", "shadow", "managed"]);
  assert.match(String(people.html.tabs[1].body), /엔드포인트 MCP 설정[^]*엔드포인트 수신기[^]*관측 수집 상태[^]*엔드포인트 차단/);
  assert.match(String(devices.body), /새 PC 활성화[^]*통제 점검[^]*엔드포인트 MCP 설정/);
  const serversWithImpact = await ui.ROUTES.servers("", "servers", new URLSearchParams("impact=1&package=alpha&range=%3E%3D1.0.0"));
  assert.equal(serversWithImpact.html.tabs.length, 5);
  assert.match(String(serversWithImpact.html.tabs[0].body), /server-impact[^]*open[^]*공급망 영향 조회[^]*value="alpha"[^]*sbom-impact-stop/);
  const intake = await ui.ROUTES.intake("", "", new URLSearchParams());
  assert.deepEqual(Array.from(intake.html.tabs, (t) => t.key), ["list", "requests", "new", "approved"]);
});

test("MCP 서버에 계약 상태와 확인 시각을 통합하고 상세의 승인본 갱신을 유지한다", async () => {
  const ui = build(true, {"/gw/registry": {servers:[{id:"docs",display_name:"Docs",status:"DRIFT",status_reason:"도구 정의 변경",last_seen_at:"2026-11-01T00:00:00Z",lifecycle:"OPERATING"}],tools:[],registrations:{},usage_relationships:[]}});
  const result = await ui.ROUTES.servers("docs", "servers", new URLSearchParams());
  assert.deepEqual(Array.from(result.html.tabs, (t) => t.label), ["MCP 서버", "도구", "접근 권한", "연결 통제 현황", "기본 기능 및 커넥터"]);
  assert.match(String(result.html.tabs[0].body), /마지막 확인[^]*도구 정의 변경/);
  let detail;
  ui.policyDrawer((title, controls, tabs) => { detail = {controls:String(controls),tabs}; });
  result.after();
  assert.match(detail.controls, /approve-contract[^]*승인본 갱신/);
  assert.match(detail.controls, /도구 정의 변경/);
  assert.match(String(detail.tabs[0].body), /마지막 확인/);
  assert.doesNotMatch(String(result.html.head), /catalog-refresh|registry-export|connector-policy/);
  assert.match(String(result.html.tabs[0].body), /catalog-refresh[^]*도구 정의 다시 확인[^]*data-registry-export[^]*도입 승인 등록부 내보내기[^]*value="csv"[^]*value="json"/);
  assert.doesNotMatch(String(result.html.tabs[0].body), /connector-policy/);
  assert.match(String(result.html.tabs.find((t) => t.key === "vendor").body), /connector-policy[^]*커넥터 설정 내보내기/);
});

test("대시보드는 호출 승인 탭에서만 목록을 표시하고 각 관리 작업으로의 이동을 제공한다", async () => {
  const approvals = Array.from({ length: 7 }, (_, i) => ({ id: `call-${i}`, server_id: "docs", tool: "read",
    requested_by: "<img src=x>", created_at: "2026-10-31T00:00:00Z", expires_at: "2026-11-01T00:00:00Z", own: i === 0 }));
  const ui = build(true, { "/approvals": { approvals, history: [] },
    "/api/signup-requests": { requests: [{ status: "pending" }, { status: "approved" }] } });
  ui.inventory.agents.push({ managed_state: "pending", policy_hash: "hash" },
    { managed_state: "quarantined" }, { managed_state: "pending", status: "revoked", policy_hash: "hash" });
  Object.assign(ui.responses["/gw/overview"], { unresolved_execution: 305,
    termination: { action_required: 9, overdue: 3 },
    execution: { tool_calls: 20, executed: 12, blocked: 6, unknown: 2 } });
  const out = await ui.ROUTES.overview("", "approvals");
  assert.equal(out.html.active, "approvals");
  const summary = String(out.html.tabs.find((t) => t.key === "summary").body);
  const queue = String(out.html.tabs.find((t) => t.key === "approvals").body);
  assert.match(String(out.html.kpis), /data-act="dash-range" data-range="24h" aria-pressed="true"/);
  for (const label of ["호출", "차단 비율", "처리할 일", "경보", "미적용", "점검 필요 서버"]) assert.match(summary, new RegExp(`<div class="label">${label}</div>`));
  assert.match(summary, /href="#\/overview\?t=approvals"><div class="label">처리할 일<\/div><div class="value">323<\/div>/);
  assert.match(summary, /<td>실행 여부 확인<\/td><td>305건<\/td>/);
  assert.match(summary, /<td>종료 처리<\/td><td>9건<\/td>/);
  assert.doesNotMatch(summary, /오늘 도구 호출|실행 확인 필요|종료 기한 초과|도구 이용 동의/);
  assert.equal((summary.match(/<tr[^>]+data-act="approval"/g) || []).length, 0);
  assert.equal((queue.match(/<tr[^>]+data-act="approval"/g) || []).length, 7);
  assert.doesNotMatch(summary, /호출 승인 요청|approval-preview/);
  assert.equal((summary.match(/<tr class="clickable"[^>]+data-act="goto"/g) || []).length, 5);
  assert.match(summary, /<td>호출 승인<\/td><td>7건<\/td><td class="num">/);
  assert.match(queue, /&lt;img/);
  assert.doesNotMatch(queue, /data-act="approve" data-id="call-0"/);
  assert.doesNotMatch(queue, /data-act="approve"|data-act="reject"/);
  assert.match(queue, /data-act="approval" data-id="call-1">검토/);
  assert.doesNotMatch(queue, /intent-resolve|consent-decide/);
});

test("MCP 점검 목록은 대시보드와 같은 세 상태만 표시한다", async () => {
  const servers = ["READY", "DISABLED", "ERROR", "DRIFT", "PENDING"].map((status) => ({ id: status, display_name: status, status }));
  const ui = build(true, { "/gw/registry": { servers, tools: [], registrations: {} } });
  ui.responses["/gw/overview"].servers = servers;
  const overview = await ui.ROUTES.overview("", "summary");
  assert.match(String(overview.html.tabs[0].body), /attention=required"><div class="label">점검 필요 서버<\/div><div class="value">3<small class="of">\/ 5<\/small><\/div>/);
  const result = await ui.ROUTES.servers("", "servers", new URLSearchParams("attention=required"));
  const body = String(result.html.tabs[0].body);
  assert.equal(result.html.tabs[0].n, 3);
  for (const status of ["ERROR", "DRIFT", "PENDING"]) assert.ok(body.includes(`#/servers/${status}`));
  for (const status of ["READY", "DISABLED"]) assert.ok(!body.includes(`#/servers/${status}`));
  assert.match(body, /href="#\/servers\?t=servers">전체 보기/);
});

test("통제 분포는 AI 연결 관리에서만 표시하고 그래프 선택을 연결 필터로 전달한다", async () => {
  const ui = build(true, { "/api/integrations": { devices: [], items: [
    { key: "gateway:docs", class: "gateway_mcp", name: "Docs", state: "gateway_enforced" },
    { key: "vendor:a", item_key: "vendor", class: "vendor_native_connector", name: "Vendor", state: "observed_only" },
    { key: "vendor:b", item_key: "vendor", class: "vendor_native_connector", name: "Vendor", state: "bypass_possible" },
  ] } });
  const overview = await ui.ROUTES.overview("", "summary");
  assert.deepEqual(Array.from(overview.html.tabs, (t) => t.key), ["summary", "approvals", "unsent", "latency"]);
  assert.doesNotMatch(String(overview.html.tabs[0].body), /조직 통제 의존 경로|c-connections-matrix/);
  assert.equal(overview.charts["c-ov-matrix"], undefined);
  assert.match(String(overview.html.tabs[0].body), /<td>연결 통제 점검<\/td><td>1건<\/td>/);
  assert.match(String(overview.html.tabs[0].body), /data-href="#\/servers\?t=items&amp;state=bypass_possible"/);
  const result = await ui.ROUTES.servers("", "items", new URLSearchParams());
  const body = String(result.html.tabs.find((t) => t.key === "items").body);
  assert.match(body, /연결 유형별 통제 현황[^]*연결 항목 수[^]*연결별 통제 상태/);
  assert.match(body, /id="c-connections-matrix"/);
  let captured;
  ui.context.charts.color = (tone) => tone;
  ui.context.charts.stacked = (labels, series, options) => { captured = { labels, series, options }; };
  result.charts["c-connections-matrix"]();
  assert.equal(captured.series[5].data[2], 1);
  assert.equal(captured.series.reduce((sum, s) => sum + s.data.reduce((a, b) => a + b, 0), 0), 2);
  captured.options.onClick({ dataIndex: 2, seriesIndex: 5 });
  assert.equal(ui.context.location.hash, "#/servers?t=items&class=vendor_native_connector&state=bypass_possible");
});

test("호출 승인 전체 건수와 페이지는 요약에 목록을 중복 표시하지 않는다", async () => {
  const row = (id) => ({ id, server_id: "docs", tool: "read", summary: "<img src=x>", reason: "검토 필요" });
  const ui = build(true, {
    "/approvals": { approvals: Array.from({ length: 30 }, (_, i) => row(`first-${i}`)), history: [], total: 65, page: 1, page_size: 30 },
    "/approvals?page=3": { approvals: Array.from({ length: 5 }, (_, i) => row(`last-${i}`)), history: [], total: 65, page: 3, page_size: 30 },
  });
  const out = await ui.ROUTES.overview("", "approvals", new URLSearchParams("t=approvals&approval_page=3"));
  const full = out.html.tabs.find((t) => t.key === "approvals");
  const preview = String(out.html.tabs.find((t) => t.key === "summary").body);
  assert.equal(full.n, 65);
  assert.match(String(full.body), /approval_page=2/);
  assert.doesNotMatch(String(full.body), /approval_page=4|first-0/);
  assert.match(String(full.body), /last-4/);
  assert.doesNotMatch(preview, /first-4|first-5|last-0|호출 승인 요청/);
  assert.match(String(full.body), /&lt;img/);
  assert.match(String(full.body), /승인 사유/);
  assert.doesNotMatch(preview, /<th>승인 사유<\/th>|<th>하네스<\/th>/);
});

test("통합 호출 분석은 목록과 같은 기간 및 필터를 쓰고 과거 엔드포인트도 표시한다", async () => {
  const ui = build();
  const query = new URLSearchParams({ t: "stats", since: "2026-10-30T00:00:00Z", until: "2026-10-31T00:00:00Z", event_kind: "tools/call", server: "docs" });
  const suffix = new URLSearchParams({ server: "docs", since: "2026-10-30T00:00:00.000Z", until: "2026-10-31T00:00:00.000Z", event_kind: "tools/call" }).toString();
  ui.responses[`/gw/activity/analysis?${suffix}`] = { total: 2, series: [], servers: [], people: [], responses: [],
    policies: [{ key: "P-1", Block: 1, Alert: 0 }],
    endpoints: [{ key: "<retired>", total: 1, Block: 1 }, { key: "", total: 1, Allow: 1 }],
    flows: [{ harness: "codex", server: "docs", decision: "Block", n: 1 }] };
  const out = await ui.ROUTES.activity("", "stats", query);
  const stats = String(out.html.tabs.find((t) => t.key === "stats").body);
  assert.match(stats, /data-filter="since"/);
  assert.match(stats, /data-filter="event_kind"/);
  assert.match(stats, /정책별 차단 및 경보/);
  assert.match(stats, /&lt;retired&gt;/); assert.match(stats, /엔드포인트 미확인/);
  assert.doesNotMatch(stats, /통제 상태|최근 하네스/);
  assert.doesNotMatch(stats, /하네스별 호출 판정|c-harness-outcomes/);
  const sections = ["호출 추이", "정책별 차단 및 경보", "서버별 호출 판정", "엔드포인트별 호출", "사용자별 호출 판정", "응답 처리"];
  for (let i = 1; i < sections.length; i++) assert.ok(stats.indexOf(sections[i - 1]) < stats.indexOf(sections[i]));
  const listRequest = new URL(ui.calls.find((p) => p.startsWith("/gw/activity?")), "http://test");
  const analysisRequest = new URL(ui.calls.find((p) => p.startsWith("/gw/activity/analysis?")), "http://test");
  for (const key of ["since", "until", "event_kind", "server"]) assert.equal(listRequest.searchParams.get(key), analysisRequest.searchParams.get(key));
  assert.equal(ui.analysisState().analysis.total, 2);
});

test("호출 분석 기본 범위와 기간 전환은 목록과 공유하고 주소에 보존한다", async () => {
  const ui = build(false);
  const query = new URLSearchParams("t=stats");
  ui.setCurrent({ page: "activity", query });
  await ui.ROUTES.activity("", "stats", query);
  assert.equal(ui.analysisState().filters.event_kind, "tools/call");
  assert.ok(Date.now() - new Date(ui.analysisState().filters.since).getTime() >= 86400000);
  ui.analysisHooks();
  ui.ACTIONS["feed-window"]({ dataset: { hours: "0" } });
  assert.equal(ui.analysisState().filters.since, "");
  assert.equal(ui.analysisState().filters.event_kind, "tools/call");
  ui.calls.length = 0;
  await ui.ROUTES.activity("", "stats", new URLSearchParams("t=stats&since=&event_kind=tools%2Fcall"));
  assert.ok(!new URL(ui.calls.find((p) => p.startsWith("/gw/activity?")), "http://test").searchParams.has("since"));
  ui.ACTIONS["feed-reset"]();
  assert.ok(ui.analysisState().filters.since);
  assert.equal(ui.analysisState().page, 1);
});

test("통합 분석 새로고침은 표도 갱신하고 이전 필터의 늦은 응답은 적용하지 않는다", async () => {
  const ui = build();
  const query = new URLSearchParams("t=stats&since=&event_kind=tools%2Fcall");
  ui.setCurrent({ page: "activity", query });
  await ui.ROUTES.activity("", "stats", query);
  ui.context.charts.redraw = () => {};
  const url = "/gw/activity/analysis?event_kind=tools%2Fcall";
  ui.responses[url] = { total: 1, endpoints: [{ key: "historic", total: 1, Block: 1 }] };
  await ui.ACTIONS["analysis-refresh"]();
  assert.match(ui.node("#analysis-endpoints").innerHTML, /historic/);
  assert.equal(ui.analysisState().analysis.total, 1);
  ui.responses[url] = () => {
    ui.analysisState().filters.server = "new-filter";
    return { total: 999, endpoints: [] };
  };
  await ui.ACTIONS["analysis-refresh"]();
  assert.equal(ui.analysisState().analysis.total, 1);
  assert.match(ui.node("#analysis-endpoints").innerHTML, /historic/);
});

test("최근 차단 미리보기와 이동 링크는 선택한 기간과 서버의 도구 호출 범위다", async () => {
  const ui = build();
  const out = await ui.ROUTES.overview("", "summary", new URLSearchParams("range=7d&server=docs"));
  const request = new URL(ui.calls.find((p) => p.startsWith("/gw/activity?")), "http://test").searchParams;
  const body = String(out.html.tabs[0].body);
  const href = body.match(/href="([^"]+)">호출 기록/)[1].replaceAll("&amp;", "&");
  const target = new URL(href.slice(1), "http://test").searchParams;
  for (const key of ["since", "until", "decision", "event_kind", "server"]) assert.equal(request.get(key), target.get(key));
  assert.equal(request.get("limit"), "10");
  assert.equal(request.get("decision"), "Block");
  assert.equal(request.get("server"), "docs");
  assert.equal(request.get("event_kind"), "tools/call");
  assert.equal(new Date(request.get("until")) - new Date(request.get("since")), 7 * 86400000);
});

test("대시보드 기간은 직전 같은 기간과 비교하고 분석 조회에 같은 조건을 쓴다", async () => {
  const ui = build();
  await ui.ROUTES.overview("", "summary", new URLSearchParams("range=30d"));
  const analyses = ui.calls.filter((p) => p.startsWith("/gw/activity/analysis?")).map((p) => new URL(p, "http://test").searchParams);
  assert.equal(analyses.length, 2);
  const [now, before] = analyses;
  assert.equal(new Date(now.get("until")) - new Date(now.get("since")), 30 * 86400000);
  assert.equal(before.get("until"), now.get("since"));
  assert.equal(new Date(before.get("until")) - new Date(before.get("since")), 30 * 86400000);
  assert.equal(now.get("event_kind"), "tools/call");
  const alerts = ui.calls.filter((p) => p.startsWith("/gw/audit/alerts?")).map((p) => new URL(p, "http://test").searchParams);
  assert.equal(alerts[1].get("until"), alerts[0].get("since"));
});

test("대시보드 카드는 전기간 증감을 보이고 작은 기준값은 이전 값으로만 표시한다", async () => {
  const rows = (n, blocked) => ({ total: n, bucket: "hour", series: [{ at: "2026-11-14T01:00:00", decision: "Allow", n: n - blocked }, { at: "2026-11-14T01:00:00", decision: "Block", n: blocked }] });
  const ui = build();
  let first = true;
  const real = ui.context.fetch;
  ui.context.fetch = async (url, options) => {
    if (url.startsWith("/gw/activity/analysis?")) { const out = first ? rows(200, 20) : rows(100, 5); first = false; return { ok: true, status: 200, headers: { get: () => null }, json: async () => out }; }
    if (url.startsWith("/gw/audit/alerts?limit=6")) return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({ alerts: [], total: 3 }) };
    if (url.startsWith("/gw/audit/alerts?limit=1")) return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({ alerts: [], total: 2 }) };
    return real(url, options);
  };
  const body = String((await ui.ROUTES.overview("", "summary")).html.tabs[0].body);
  assert.match(body, /<div class="label">호출<\/div><div class="value">200<\/div><div class="foot"><span class="delta ">▲ 100%<\/span><span class="base">전기간/);
  assert.match(body, /<div class="label">차단 비율<\/div><div class="value">10%<\/div><div class="foot"><span class="delta bad">▲ 5%p<\/span>/);
  assert.match(body, /<div class="label">경보<\/div><div class="value">3<\/div><div class="foot"><span class="delta">이전 2<\/span>/);
});

test("대시보드 차트 6종은 판정·서버·정책·사용자·엔드포인트 조건이 걸린 호출 기록으로 이동한다", async () => {
  const analysis = { total: 30, bucket: "hour",
    series: [{ at: "2026-11-14T01:00:00", decision: "Allow", n: 20 }, { at: "2026-11-14T02:00:00", decision: "Block", n: 10 }],
    servers: [{ key: "docs", total: 30, Allow: 20, Block: 10 }], people: [{ key: "홍길동", total: 30 }],
    policies: [{ key: "P-RATE-001", total: 10, Block: 10, Alert: 0 }], endpoints: [{ key: "ep-1", total: 30 }] };
  const ui = build(true, { "/gw/policy/ledger": { policies: [{ policy_id: "P-RATE-001", name: "호출 횟수 상한" }] } });
  const real = ui.context.fetch;
  ui.context.fetch = async (url, options) => url.startsWith("/gw/activity/analysis?")
    ? { ok: true, status: 200, headers: { get: () => null }, json: async () => analysis } : real(url, options);
  const out = await ui.ROUTES.overview("", "summary");
  assert.deepEqual(Object.keys(out.charts), ["c-dash-trend", "c-dash-donut", "c-dash-policies", "c-dash-servers", "c-dash-violations", "c-dash-people", "c-dash-endpoints"]);
  const charts = ui.context.charts;
  Object.assign(charts, { color: (d) => d, decisionColumns: (labels, rows, options) => ({ labels, rows, ...options }), donut: (items, options) => ({ items, ...options }),
    bars: (items, options) => ({ items, ...options }), lines: (labels, series, options) => ({ labels, series, ...options }) });
  const go = (id, event) => { const option = out.charts[id](); option.onClick(event); return ui.context.location.hash; };
  const hash = go("c-dash-trend", { dataIndex: 1, seriesName: "차단" });
  assert.match(hash, /^#\/activity\?/);
  assert.match(hash, /decision=Block/);
  assert.match(hash, /event_kind=tools%2Fcall/);
  assert.match(go("c-dash-donut", { name: "차단" }), /decision=Block/);
  assert.equal(go("c-dash-policies", { dataIndex: 0 }), "#/policy?detail_kind=policy&detail_id=P-RATE-001");
  assert.equal(go("c-dash-servers", { dataIndex: 0 }), "#/servers/docs");
  assert.match(go("c-dash-people", { dataIndex: 0 }), /person=%ED%99%8D%EA%B8%B8%EB%8F%99/);
  assert.match(go("c-dash-endpoints", { dataIndex: 0 }), /endpoint=ep-1/);
  const violations = out.charts["c-dash-violations"]();
  assert.deepEqual(Array.from(violations.series[0].data), [0, 10]);
  assert.match(go("c-dash-violations", { dataIndex: 1 }), /since=2026-11-1[34]T\d\d%3A00%3A00\.000Z/);
  assert.equal(out.charts["c-dash-policies"]().items[0].name, "호출 횟수 상한");
});

test("대시보드 상태 줄은 정책 엔진 일치와 관제 전달 상태를 조회 결과대로 보이고 실패를 정상으로 숨기지 않는다", async () => {
  const state = async (extra) => String((await build(true, extra).ROUTES.overview("", "summary")).html.head);
  const ok = await state({ "/gw/policy/ledger": { policies: [], deployment: { rules_match: true, data_match: true } }, "/gw/audit/siem": { pending: 0, retrying: 0, last_delivered: new Date().toISOString() } });
  assert.match(ok, /정책 엔진 일치/);
  assert.match(ok, /관제 전달/);
  const mismatch = await state({ "/gw/policy/ledger": { policies: [], deployment: { rules_match: true, data_match: false } }, "/gw/audit/siem": { pending: 4, retrying: 1 } });
  assert.match(mismatch, /정책 엔진 불일치/);
  assert.match(mismatch, /관제 미전달 4/);
  const none = await state({ "/gw/audit/siem": { pending: 0, retrying: 0, last_delivered: null } });
  assert.match(none, /정책 엔진 확인 불가/);
  assert.match(none, /관제 설정 안 됨/);
  const failed = await state({ "/gw/audit/siem": new Error("실패"), "/gw/policy/ledger": new Error("실패") });
  assert.match(failed, /관제 확인 불가/);
  assert.doesNotMatch(failed, /관제 설정 안 됨|정책 엔진 일치/);
});

test("대시보드 갱신은 카드와 처리 목록을 바꾸고 검토와 화면 이동을 보존한다", async () => {
  const ui = build();
  await ui.ROUTES.overview("", "summary");
  ui.setCurrent({ page: "overview", query: new URLSearchParams() });
  ui.responses["/gw/overview"].unresolved_execution = 12;
  ui.responses["/gw/overview"].enforcement = "enforce";
  ui.responses["/api/signup-requests?status=pending"] = { requests: [], pending_total: 321 };
  ui.startDashboardRefresh();
  assert.equal(ui.timers.size, 1);
  await ui.refreshDashboard();
  assert.match(ui.node("#dashboard-summary").innerHTML, /처리할 일<\/div><div class="value">333/);
  assert.match(ui.node("#dashboard-summary").innerHTML, /<td>가입 승인<\/td>|<td>실행 여부 확인<\/td><td>12건/);
  assert.match(ui.node("#view .page-head .status").innerHTML, /집행 모드/);
  const reads = ui.calls.length;
  ui.node("#dialog").open = true;
  await ui.refreshDashboard(); assert.equal(ui.calls.length, reads);
  ui.node("#dialog").open = false;
  ui.responses["/gw/overview"] = () => { ui.node("#drawer").classList.contains = () => true; return { execution: { tool_calls: 99 } }; };
  await ui.refreshDashboard();
  assert.doesNotMatch(ui.node("#dashboard-summary").innerHTML, />99</);
  ui.node("#drawer").classList.contains = () => false;
  ui.responses["/gw/overview"] = () => { ui.stopDashboardRefresh(); return { execution: { tool_calls: 99 } }; };
  await ui.refreshDashboard();
  assert.equal(ui.timers.size, 0);
  assert.doesNotMatch(ui.node("#dashboard-summary").innerHTML, />99</);
});

test("대시보드 갱신 실패는 기존 값을 유지하고 복구 때 경고를 지운다", async () => {
  const ui = build();
  ui.setCurrent({ page: "overview", query: new URLSearchParams() });
  await ui.refreshDashboard();
  const previous = ui.node("#dashboard-summary").innerHTML;
  ui.responses["/gw/overview"] = new Error("offline");
  await ui.refreshDashboard();
  assert.equal(ui.node("#dashboard-summary").innerHTML, previous);
  assert.match(ui.node("#dashboard-refresh-status").innerHTML, /갱신 실패/);
  ui.responses["/gw/overview"] = { execution: {}, servers: [{ id: "a", status: "ERROR" }] };
  await ui.refreshDashboard();
  assert.equal(ui.node("#dashboard-refresh-status").innerHTML, "");
  assert.match(ui.node("#dashboard-summary").innerHTML, /점검 필요 서버<\/div><div class="value">1<small class="of">/);
});

test("가입 승인 전체 건수는 페이지와 무관하고 대기 필터의 나머지 페이지로 이동한다", async () => {
  const ui = build(true, { "/api/signup-requests?status=pending": { requests: [], pending_total: 321, total: 321, page: 1, page_size: 100 },
    "/api/signup-requests?status=pending&page=2": { requests: [{ id: "older", status: "pending", username: "old-request" }], pending_total: 321, total: 321, page: 2, page_size: 100 } });
  const overview = await ui.ROUTES.overview("", "summary");
  assert.match(String(overview.html.tabs[0].body), /처리할 일<\/div><div class="value">321<\/div>/);
  const people = await ui.ROUTES.people("", "signups", new URLSearchParams("signup_status=pending&signup_page=2"));
  const tab = people.html.tabs.find((t) => t.key === "signups");
  assert.equal(tab.n, 321);
  assert.match(String(tab.body), /old-request/);
  assert.match(String(tab.body), /signup_status=pending&amp;signup_page=3/);
  assert.match(String(tab.body), /signup-approve" data-id="older"/);
});

test("실행 확인 전체 건수와 200건 이후 페이지의 처리 버튼을 유지한다", async () => {
  const ui = build(true, { "/gw/dispatch-intents?page=2": { rows: [{ request_id: "old-intent", server_id: "docs", tool_name: "read", action: "r" }], total: 305, page: 2, page_size: 200 } });
  const out = await ui.ROUTES.overview("", "unsent", new URLSearchParams("intent_page=2"));
  const tab = out.html.tabs.find((t) => t.key === "unsent");
  assert.equal(tab.n, 305);
  assert.match(String(tab.body), /#\/overview\?[^"<]*intent_page=1/);
  assert.doesNotMatch(String(tab.body), /intent_page=3/);
  assert.match(String(tab.body), /data-act="intent-resolve" data-id="old-intent"/);
});

test("성능 탭은 호출 시간과 엔드포인트 연결 측정을 분리하고 표본과 기간을 표시한다", async () => {
  const lat = { calls: 10, dispatched: 6, total: { p50: 100, p95: 200 }, gateway: { p50: 20, p95: 40 }, upstream: { p50: 80, p95: 160 },
    checked_at: "2026-10-31T00:00:00Z", window_start: "2026-10-30T00:00:00Z", window_end: "2026-10-31T00:00:00Z",
    stages: [{ stage: "policy", n: 10, p50: 2, p95: 5 }], servers: [{ server_id: "docs", n: 6, p50: 80, p95: 160, failed: 1 }] };
  const ui = build(true, { "/gw/latency": lat, "/gw/endpoint/network-quality": {
    summary: { p50_ms: 99999, p95_ms: 999999 }, devices: [
      { endpoint_id: "fresh", state: "fresh", rtt_p50_ms: 12, rtt_p95_ms: 18, jitter_ms: 2, failure_pct: 0, probes: 6 },
      { endpoint_id: "stale", state: "stale", rtt_p50_ms: 8888, rtt_p95_ms: 9999, probes: 6 },
      { endpoint_id: "unmeasured", state: "unknown" },
      { endpoint_id: "failed", state: "fresh", rtt_p50_ms: null, rtt_p95_ms: null, failure_pct: 100, probes: 6 },
    ] } });
  const out = await ui.ROUTES.overview("", "latency");
  const tab = out.html.tabs.find((t) => t.key === "latency"), body = String(tab.body);
  assert.equal(tab.label, "성능");
  assert.match(body, /호출 처리 성능[^]*전체 처리[^]*100 ms[^]*200 ms/);
  assert.match(body, /정책 판정<\/td><td class="num">10/);
  assert.match(body, /95백분위 높은 순, 최대 12개/);
  assert.doesNotMatch(body, /99999|MCP 서버 응답|엔드포인트 왕복/);
  assert.match(body, /엔드포인트 → 게이트웨이 통신[^]*scope="colgroup" colspan="3">연결 시간/);
  assert.match(body, /scope="colgroup" colspan="2">점검<\/th><th scope="colgroup" colspan="2">측정/);
  assert.match(body, />중앙값<\/span>[^]*>P95<\/span>[^]*>변동<\/span>/);
  const stale = body.split("<tr>").find((row) => row.includes('title="stale"'));
  assert.match(stale, /오래됨/); assert.doesNotMatch(stale, /8888|8\.9 s|9999/);
  assert.match(body, /미측정/); assert.match(body, /100%[^]*측정 실패/);
  const href = body.match(/data-href="([^"]+)"/)[1].replaceAll("&amp;", "&");
  const query = new URL(href.slice(1), "http://test").searchParams;
  assert.equal(query.get("since"), lat.window_start); assert.equal(query.get("until"), lat.window_end);
  assert.equal(query.get("event_kind"), "tools/call");
});

test("성능 조회 실패는 측정 없음으로 표시하지 않고 두 데이터 조회는 독립적이다", async () => {
  const failed = build(true, { "/gw/latency": new Error("unavailable"), "/gw/endpoint/network-quality": { devices: [{ endpoint_id: "available", state: "fresh", rtt_p50_ms: 0, rtt_p95_ms: 0, failure_pct: 0 }] } });
  const out = await failed.ROUTES.overview("", "latency");
  const body = String(out.html.tabs.find((t) => t.key === "latency").body);
  assert.match(body, /note bad">조회 실패/); assert.doesNotMatch(body, /측정된 호출 없음/);
  assert.match(body, /available/); assert.match(body, /0 ms/);
  const empty = build(true, { "/gw/latency": { calls: 0 }, "/gw/endpoint/network-quality": new Error("unavailable") });
  const result = await empty.ROUTES.overview("", "latency");
  const emptyBody = String(result.html.tabs.find((t) => t.key === "latency").body);
  assert.match(emptyBody, /측정된 호출 없음/); assert.match(emptyBody, /엔드포인트 → 게이트웨이 통신[^]*조회 실패/);
  assert.doesNotMatch(emptyBody, /측정 대상 엔드포인트 없음/);
});

test("승인 상세에서만 실행 버튼을 제공하고 본인 요청과 취소는 실행하지 않는다", async () => {
  const ui = build(true, { "/approvals": { approvals: [
    { id: "own", server_id: "docs", tool: "read", own: true },
    { id: "other", server_id: "docs", tool: "read", reason: "범위 확인" },
  ], history: [] }, "/approvals/other/approve": { decision: "Allow" } });
  await ui.ROUTES.overview("", "approvals");
  let detail, asked;
  ui.policyDrawer((title, controls, tabs) => { detail = { controls: String(controls), tabs }; });
  await ui.ACTIONS.approval({ dataset: { id: "own" } });
  assert.match(detail.controls, /본인 요청/); assert.doesNotMatch(detail.controls, /data-act="approve"/);
  await ui.ACTIONS.approval({ dataset: { id: "other" } });
  assert.match(detail.controls, /data-act="approve"/);
  assert.deepEqual(Array.from(detail.tabs, (t) => t.key), ["request", "args", "policy"]);
  ui.approvalActions(async (options) => { asked = options; return null; });
  await ui.ACTIONS.approve({ dataset: { id: "other" } });
  assert.equal(asked.confirm, "승인");
  assert.match(String(asked.fields), /name="window_minutes"/);
  assert.ok(!ui.calls.includes("/approvals/other/approve"));
  ui.approvalActions(async () => new Map());
  await ui.ACTIONS.approve({ dataset: { id: "own" } });
  assert.ok(!ui.calls.includes("/approvals/own/approve"));
  await ui.ACTIONS.approve({ dataset: { id: "other" } });
  assert.equal(ui.calls.filter((url) => url === "/approvals/other/approve").length, 1);
});

test("승인 목록 자동 갱신은 검토와 확인창 및 화면 이동을 방해하지 않는다", async () => {
  const ui = build();
  await ui.ROUTES.overview("", "approvals");
  ui.setCurrent({ page: "overview", query: new URLSearchParams("t=approvals") });
  ui.responses["/approvals"] = { approvals: [{ id: "new", server_id: "docs", tool: "read" }], history: [], total: 1 };
  ui.startApprovalRefresh(); assert.equal(ui.timers.size, 1);
  await ui.refreshApprovalLists();
  assert.equal(ui.approvalState().total, 1);
  assert.match(ui.node("#approval-queue").innerHTML, /data-id="new"/);
  const reads = ui.calls.length;
  ui.node("#drawer").classList.contains = () => true;
  await ui.refreshApprovalLists(); assert.equal(ui.calls.length, reads);
  ui.node("#drawer").classList.contains = () => false;
  ui.node("#dialog").open = true;
  await ui.refreshApprovalLists(); assert.equal(ui.calls.length, reads);
  ui.node("#dialog").open = false;
  ui.responses["/approvals"] = () => { ui.node("#drawer").classList.contains = () => true; return { approvals: [], history: [], total: 0 }; };
  await ui.refreshApprovalLists(); assert.equal(ui.approvalState().total, 1);
  ui.node("#drawer").classList.contains = () => false;
  ui.responses["/approvals"] = () => { ui.stopApprovalRefresh(); return { approvals: [], history: [], total: 0 }; };
  await ui.refreshApprovalLists();
  assert.equal(ui.approvalState().total, 1); assert.equal(ui.timers.size, 0);
});

test("중대 영향 호출은 상세 검토와 기존 증빙 확인을 거쳐 승인한다", async () => {
  const explanation = { impact_domains: [], arguments: { string: 1 }, summary: "범위 검토" };
  const ui = build(true, { "/approvals": { approvals: [{ id: "impact", explanation, own: false }], history: [] },
    "/gw/approvals/impact/evidence": { explanation, events: [], evidence_sha256: "evidence-proof" },
    "/gw/approvals/impact/approve": { decision: "Allow" } });
  await ui.ROUTES.overview("", "approvals");
  let controls, asked;
  ui.policyDrawer((title, body) => { controls = String(body); });
  await ui.ACTIONS.approval({ dataset: { id: "impact" } });
  assert.match(controls, /data-act="approve"/);
  ui.approvalActions(async (options) => { asked = options; return new Map([["confirmed", "on"]]); });
  await ui.ACTIONS.approve({ dataset: { id: "impact" } });
  assert.match(String(asked.fields), /name="confirmed" required/);
  const request = ui.requests.find((r) => r.url === "/gw/approvals/impact/approve");
  assert.equal(request.method, "POST");
  assert.deepEqual(JSON.parse(request.body), { evidence_sha256: "evidence-proof", reason: "scope_confirmed", window_minutes: 30 });
});

test("승인 목록 갱신 실패를 빈 목록으로 숨기지 않고 복구하며 빈 마지막 페이지를 되돌린다", async () => {
  const ui = build(true, { "/approvals": { approvals: [], history: [], total: 31, page: 1 },
    "/approvals?page=2": { approvals: [{ id: "last", server_id: "docs", tool: "read" }], history: [], total: 31, page: 2 } });
  await ui.ROUTES.overview("", "approvals", new URLSearchParams("approval_page=2"));
  const query = new URLSearchParams("t=approvals&approval_page=2");
  ui.setCurrent({ page: "overview", query });
  ui.responses["/approvals"] = new Error("offline");
  await ui.refreshApprovalLists();
  assert.equal(ui.approvalState().failed, true);
  assert.match(ui.node("#approval-queue").innerHTML, /갱신 실패[^]*data-id="last"/);
  ui.responses["/approvals"] = { approvals: [], history: [], total: 0, page: 1 };
  ui.responses["/approvals?page=2"] = { approvals: [], history: [], total: 0, page: 2 };
  await ui.refreshApprovalLists();
  assert.equal(ui.approvalState().failed, false);
  assert.equal(ui.approvalState().page, 1);
  assert.equal(query.get("approval_page"), "1");
});

test("종료 조치 필터와 페이지 이동을 서버에 전달하고 기한 초과 필터를 제공한다", async () => {
  const ui = build(true, { "/gw/termination/relationships": { relationships: [] },
    "/gw/termination/cases?attention=required&page=2": { cases: [], summary: {}, page: 2, page_size: 50, total: 101 },
    "/gw/termination/cases?attention=overdue": { cases: [], summary: {}, page: 1, page_size: 50, total: 0 } });
  const result = await ui.ROUTES.termination("", "cases", new URLSearchParams("attention=required&page=2"));
  const cases = result.html.tabs.find((t) => t.key === "cases");
  assert.equal(cases.n, 101);
  assert.deepEqual(Array.from(result.html.tabs, (t) => t.label), ["종료 대상", "종료 처리"]);
  assert.match(String(cases.body), /종료 조치 필요/);
  assert.match(String(cases.body), /attention=required&amp;page=1/);
  assert.match(String(cases.body), /attention=required&amp;page=3/);
  const overdue = await ui.ROUTES.termination("", "cases", new URLSearchParams("attention=overdue"));
  assert.match(String(overdue.html.tabs.find((t) => t.key === "cases").body), /종료 기한 초과/);
  assert.ok(ui.calls.includes("/gw/termination/cases?attention=overdue"));
});

test("종료 현황은 사유와 기한 및 자원과 다음 조치를 모으고 이전 자원 탭을 연결한다", async () => {
  const criteria = Object.fromEntries(["C1","C2","C3","C4"].map((key) => [key,{met:false,gaps:["제공자 확인 필요"]}]));
  const data = {case:{id:"case",engagement_label:"Docs 종료",status:"ASSESSED",grade:"T3",reason:"계약 종료",provider:"Provider",opened_at:"2026-11-01T00:00:00Z",cutover_at:"2026-11-01T00:00:00Z",due_at:"2026-11-15T00:00:00Z",overdue:true,allowed_resources:["/docs"],criteria},
    targets:[{id:"target",label:"제공자 자격",status:"UNVERIFIABLE",kind:"server-held-credential",holder:"provider",discovered_by:"provider-disclosure",criteria}],evidence:[],activity:{unknown:1},endpoint_residue:1,
    timeline:[{kind:"opened",at:"2026-11-01T00:00:00Z",actor:"Admin",detail:"계약 종료"}]};
  const ui = build(true,{"/gw/termination/cases/case":data});
  const out = await ui.ROUTES.termination("case", "scope");
  assert.equal(out.html.active,"verdict");
  assert.deepEqual(Array.from(out.html.tabs, (t) => t.label),["종료 현황","회수 대상","증거"]);
  const overview = String(out.html.tabs[0].body);
  assert.match(overview,/종료 사유[^]*계약 종료[^]*처리 기한[^]*기한 초과[^]*허용 자원[^]*\/docs/);
  assert.match(overview,/data-act="target" data-id="target">대상 범위 확인/);
  assert.match(overview,/처리 이력[^]*현재 보존된 기록[^]*Admin/);
  assert.ok(ui.requests.every((r) => !r.method || r.method === "GET"));
});

test("판단 불가 종결은 잔여 상태와 미완료 절차를 유지하고 자동 조치를 제공하지 않는다", async () => {
  const ui = build(true,{"/gw/termination/cases/closed":{case:{id:"closed",engagement_label:"종결",status:"CLOSED",grade:"T3",criteria:{},risk_acceptance_note:"제공자 확인 대기",risk_accepted_by:"Admin",closed_at:"2026-11-01T00:00:00Z"},
    targets:[{id:"pending",label:"미회수 자격",status:"OUTSTANDING"},{id:"unknown",label:"미확인 자격",status:"UNVERIFIABLE"}],evidence:[],activity:{},endpoint_residue:2,timeline:[]}});
  const out = await ui.ROUTES.termination("closed", "");
  const body = String(out.html.tabs[0].body), head = String(out.html.head);
  assert.match(body,/종결 후 잔여 상태[^]*미회수[^]*확인 불가[^]*제공자 확인 대기/);
  assert.match(body,/종결 후 확인 항목/);
  assert.doesNotMatch(body,/data-act="collect"|data-act="assess"|data-act="close-case"/);
  assert.match(head,/class="step\s+gap"/);
  assert.ok((head.match(/class="step done/g)||[]).length<7);
});

test("실행 확인과 승인 처리 이력은 대시보드에 모으고 상세와 번복을 유지한다", async () => {
  const ui = build(true, { "/approvals": { approvals: [], history: [{ id: "past", requested_by: "alice",
    server_id: "docs", tool: "read", status: "EXECUTED", explanation: {}, can_revoke: true }] },
    "/gw/dispatch-intents": { rows: [{ request_id: "uncertain", server_id: "docs", tool_name: "read", action: "r" }] } });
  const out = await ui.ROUTES.overview("", "unsent", new URLSearchParams());
  assert.equal(out.html.active, "unsent");
  const unsent = String(out.html.tabs.find((t) => t.key === "unsent").body);
  assert.match(unsent, /data-act="intent-resolve" data-id="uncertain" data-outcome="not_executed"/);
  assert.match(unsent, /data-outcome="executed"/);
  const activity = await ui.ROUTES.activity("", "approval-history", new URLSearchParams());
  assert.ok(activity.html.tabs.every((t) => !["unsent", "approval-history"].includes(t.key)));
  const overview = await ui.ROUTES.overview("", "approvals", new URLSearchParams("approval_view=history"));
  const history = String(overview.html.tabs.find((t) => t.key === "approvals").body);
  assert.match(history, /승인 대기[^]*처리 이력[^]*승인 처리 이력/);
  assert.doesNotMatch(history, /호출 승인 요청/);
  assert.match(history, /data-act="approval" data-id="past"/);
  assert.match(history, /data-act="approval-revoke" data-id="past"/);
  assert.doesNotMatch(history, /consent-decide|확인할 요청 없음/);
});

test("승인 이력 갱신은 선택한 보기를 보존하고 실패를 빈 이력으로 덮지 않는다", async () => {
  const ui = build();
  const query = new URLSearchParams("t=approvals&approval_view=history");
  const out = await ui.ROUTES.overview("", "approvals", query);
  assert.match(String(out.html.tabs.find((t) => t.key === "approvals").body), /처리 이력 없음/);
  ui.setCurrent({page:"overview", query});
  ui.responses["/approvals"] = {approvals:[],history:[{id:"expired", requested_by:"Alice",server_id:"docs",tool:"read",status:"EXPIRED"}]};
  await ui.refreshApprovalLists(true);
  assert.match(ui.node("#approval-queue").innerHTML, /Alice/);
  assert.doesNotMatch(ui.node("#approval-queue").innerHTML, /호출 승인 요청/);
  ui.responses["/approvals"] = new Error("unavailable");
  await ui.refreshApprovalLists(true);
  assert.match(ui.node("#approval-queue").innerHTML, /Alice[^]*갱신 실패|갱신 실패[^]*Alice/);
});

test("접근 권한은 AI 연결 관리에서만 조회하고 정책은 기존 목록과 집행 모드를 유지한다", async () => {
  const ui = build(true, { "/gw/policy/matrix": {
    capabilities: [{ id: "permission-1", principals: ["alice"], servers: ["docs"], actions: ["r", "w"], server_actions:{docs:["r"]}, path_roots: ["/docs"], tables:["public.products"], tools:["read"], valid_until: null }],
    runtime_envelopes: [{ server_id: "docs", principals: ["*"], tools: { read_file: "r" }, valid_until: null }],
  } });
  const connections = await ui.ROUTES.servers("", "capabilities", new URLSearchParams());
  const access = connections.html.tabs.find((tab) => tab.key === "capabilities");
  assert.equal(access.label, "접근 권한");
  assert.equal(access.n, 2);
  assert.match(String(access.body), /permission-1[^]*alice[^]*docs[^]*\/docs[^]*read_file/);
  assert.match(String(access.body), /권한 출처[^]*허용 행위[^]*허용 자원[^]*허용 도구/);
  assert.match(String(access.body), /개별 접근 권한[^]*docs: 읽기[^]*public.products[^]*도입 승인/);
  assert.doesNotMatch(String(access.body), /쓰기/);
  ui.calls.length = 0;
  const policy = await ui.ROUTES.policy("", "");
  assert.equal(policy.html.active, "organization");
  assert.deepEqual(Array.from(policy.html.tabs, (tab) => tab.key), ["organization", "ledger"]);
  assert.match(String(policy.html.head), /관찰 모드로 전환/);
  assert.ok(!ui.calls.includes("/gw/policy/matrix"));
});

test("커넥터 전체 설정과 개별 항목을 분리하고 전체 차단 표시를 유지한다", async () => {
  const ui = build(true, {"/api/connectors": {summary:{pending:0,expired:0},
    builtins:[{key:"all",label:"전체 커넥터",kind:"connector",harness:"claude",state:"denied"}],
    items:[{key:"claude:connector:docs",names:["Docs"],kinds:["connector"],harness:"claude",builtin:true,state:"approved",active_pcs:2,people:1}]}});
  const out = await ui.ROUTES.servers("", "vendor", new URLSearchParams());
  const body = String(out.html.tabs.find((t) => t.key === "vendor").body);
  assert.match(body, /커넥터 전체 사용 설정[^]*개별 커넥터[^]*Docs/);
  assert.match(body, /승인 상태[^]*통제 적용 상태/);
  assert.match(body, /전체 차단/);
  assert.match(body, /data-key="all" data-decision="reset"/);
  assert.match(body, /data-key="claude:connector:docs"/);
});

test("연결 통제 상세에서 해당 추가 연결의 승인 관리로 이동한다", async () => {
  const key = "claude:host:docs.example";
  const ui = build(true, {
    "/api/integrations": {items:[{key:"reported",item_key:key,name:"Docs",class:"vendor_native_connector",state:"observed_only"},
      {key:"unknown",name:"Unknown",class:"shadow_or_unknown",state:"unknown_not_enrolled"}],devices:[],summary:{devices:{bypass_possible:0}}},
    "/api/connectors": {items:[{key,names:["Docs"],kinds:["plugin"],harness:"claude",builtin:false,state:"pending",holders:[]}],summary:{pending:1,expired:0}}
  });
  const out = await ui.ROUTES.servers("", "items", new URLSearchParams());
  assert.match(String(out.html.tabs.find((t) => t.key === "items").body), /연결별 통제 상태/);
  assert.match(String(out.html.tabs.find((t) => t.key === "vendor").body), /추가 연결 승인 관리/);
  let controls;
  ui.policyDrawer((title, content) => { controls = String(content); });
  await ui.ACTIONS.integration({dataset:{key}});
  const query = new URLSearchParams({t:"vendor",connector:key});
  assert.ok(controls.includes(("#/servers?" + query).replaceAll("&", "&amp;")));
  const target = await ui.ROUTES.servers("", "vendor", query);
  target.after();
  assert.match(controls, /connector-decide[^]*data-key="claude:host:docs.example"/);
  await ui.ACTIONS.integration({dataset:{key:"unknown"}});
  assert.doesNotMatch(controls, /승인 관리/);
  assert.ok(ui.requests.every((r) => !r.method || r.method === "GET"));
});

const POLICIES = [
  { id: "POL-E-17", name: "<img src=x>", stage: "실행", title: "반복 조회·대량 추출 탐지와 중단", group: "E-F", group_title: "호출량·이상 행위 제한", mode: "auto", priority: "P1",
    content: "<script>bad</script>", condition: "조건", pass_condition: "통과", block_condition: "차단", required_evidence: "증빙", runtime_rule_ids: ["P-RATE-001", "MISSING-001"] },
  { id: "POL-E-19", name: "MCP Server", stage: "실행", title: "서버 계정에 필요한 권한만 부여", group: "E-A", group_title: "호출 권한 판정", mode: "manual", priority: "P2",
    content: "내용", condition: "조건", pass_condition: "권한 범위를 대조한다", required_evidence: "권한표", runtime_rule_ids: [] },
  { id: "POL-I-09", name: "MCP Server", stage: "도입 검토", title: "외부 제공자의 자료 보관·재사용·삭제 조건 확인", group: "I-D", group_title: "로컬 실행·외부 제공자 조건", mode: "auto", priority: "P2",
    content: "내용", condition: "조건", runtime_rule_ids: ["P-RESIDENCY-001"] },
  { id: "POL-R-16", name: "MCP Server", stage: "등록 및 연결", title: "원격 연결은 암호화 통신만 사용", group: "R-D", group_title: "통신 암호화·비밀 보관·요청 출처", mode: "feature", priority: "P3",
    content: "내용", condition: "조건", runtime_rule_ids: [] },
];
const RULES = [{ policy_id: "P-RATE-001", name: "호출 횟수 상한", status: "운영", monitor_behavior: "eligible", enforced_by: "opa", outcome: "차단", recent: { count: 5 } },
  { policy_id: "P-RESIDENCY-001", name: "위치 규칙", status: "중지", monitor_behavior: "eligible", enforced_by: "opa", recent: { count: 0 } }];
const policyScreen = (extra = {}) => build(true, { "/gw/policy/ledger": { policies: RULES, source_state: "loaded", checked_at: "2026-10-31T01:00:00Z",
  deployment: { rules_match: true, data_match: false }, organization: { source_state: "available", summary: {}, policies: POLICIES } },
  "/gw/policy/activity?hours=24": { rows: [{ policy_id: "P-RATE-001", decision: "Block", n: 3 }, { policy_id: "P-RATE-001", decision: "Alert", n: 1 }, { policy_id: "P-RATE-001", decision: "Allow", n: 6 }],
    previous: [{ decision: "Block", n: 2 }] }, ...extra });

test("정책 화면은 제목·단계 묶음·집행 방식·상태·최근 판정을 보이고 개발 구현 상태와 한계는 보이지 않는다", async () => {
  const out = await policyScreen().ROUTES.policy("", "");
  assert.equal(out.html.active, "organization");
  assert.deepEqual(Array.from(out.html.tabs, (tab) => tab.key), ["organization", "ledger"]);
  const body = String(out.html.tabs[0].body);
  assert.match(body, /반복 조회·대량 추출 탐지와 중단/);
  assert.match(body, /<b>도입 검토<\/b> 로컬 실행·외부 제공자 조건/);
  assert.ok(body.indexOf("로컬 실행·외부 제공자 조건") < body.indexOf("통신 암호화·비밀 보관·요청 출처") && body.indexOf("통신 암호화") < body.indexOf("호출 권한 판정"));
  assert.match(body, /data-id="POL-E-17"[^]*?<td>P1<\/td><td><span class="chip brand">자동 집행<\/span><\/td>\s*<td><span class="chip allow">켜짐<\/span><\/td>/);
  assert.match(body, /data-id="POL-E-19"[^]*?<span class="chip alert">수동 점검<\/span><\/td>\s*<td><span class="muted">—<\/span><\/td>/);
  assert.match(body, /data-id="POL-I-09"[^]*?<span class="chip outline">꺼짐<\/span>/);
  assert.match(body, /data-id="POL-R-16"[^]*?<span class="chip outline">제품 기능<\/span>/);
  assert.match(body, /aria-label="차단 3 · 경보 1"|<title>[^<]*차단 3[^<]*<\/title>/);
  assert.match(body, /<span class="num">10<\/span>/);
  assert.match(body, /최근 24시간/);
  assert.doesNotMatch(body, /구현 상태|<th>한계<\/th>|부분 구현|미구현|권한표 대조/);
  assert.ok(body.indexOf('data-id="POL-E-19"') < body.indexOf('data-id="POL-E-17"'));
  assert.ok(!body.includes("<img"));
  assert.match(String(out.html.head), /집행 모드|관찰 모드로 전환/);
  assert.match(String(out.html.head), /정책 엔진 불일치/);
  assert.deepEqual(Object.keys(out.charts), ["c-policy-stage", "c-policy-top", "c-policy-trend"]);
});

test("정책 카드는 집행 방식별 수와 기간 내 차단·경보·승인 요청 건수를 전기간과 비교해 보이고 수동 점검 카드는 필터로 이동한다", async () => {
  const body = String((await policyScreen().ROUTES.policy("", "")).html.tabs[0].body);
  assert.match(body, /href="#\/policy\?mode=auto"><div class="label">자동 집행 정책<\/div><div class="value">2<small class="of">\/ 4<\/small>/);
  assert.match(body, /href="#\/policy\?mode=feature"><div class="label">제품 기능으로 충족<\/div><div class="value">1<small class="of">\/ 4<\/small>/);
  assert.match(body, /class="kpi alert" href="#\/policy\?mode=manual"><div class="label">수동 점검 필요<\/div><div class="value">1<small class="of">\/ 4<\/small>/);
  assert.match(body, /<div class="label">차단·경보·승인 요청<\/div><div class="value">4<\/div><div class="foot"><span class="delta">이전 2<\/span>/);
});

test("정책 필터는 주소의 집행 방식·단계·판정 여부를 표에 반영하고 일치하지 않는 묶음은 숨긴다", async () => {
  const hidden = (markup, id) => new RegExp(`data-id="${id}"[^>]*hidden`).test(markup);
  const manual = String((await policyScreen().ROUTES.policy("", "", new URLSearchParams("mode=manual"))).html.tabs[0].body);
  assert.ok(!hidden(manual, "POL-E-19"));
  for (const id of ["POL-E-17", "POL-I-09", "POL-R-16"]) assert.ok(hidden(manual, id), id);
  assert.match(manual, /<tbody data-group="I-D" hidden>/);
  assert.match(manual, /<option value="manual" selected>수동 점검<\/option>/);
  const has = String((await policyScreen().ROUTES.policy("", "", new URLSearchParams("has=1&q=반복"))).html.tabs[0].body);
  assert.ok(!hidden(has, "POL-E-17"));
  assert.ok(hidden(has, "POL-E-19"));
  const stage = String((await policyScreen().ROUTES.policy("", "", new URLSearchParams("stage=도입"))).html.tabs[0].body);
  assert.ok(!hidden(stage, "POL-I-09"));
  assert.ok(hidden(stage, "POL-E-17"));
});

test("정책 상태는 관찰 모드에서 전환 가능한 규칙만 보고 전용으로 보이고 항상 켜짐 규칙은 잠금으로 보인다", async () => {
  const rules = [{ policy_id: "P-RATE-001", name: "호출 횟수 상한", status: "운영", monitor_behavior: "eligible" },
    { policy_id: "MCP-CATALOG-001", name: "계약 검사", status: "운영", monitor_behavior: "protected" }];
  const policies = [{ ...POLICIES[0], runtime_rule_ids: ["P-RATE-001"] }, { ...POLICIES[0], id: "POL-O-01", runtime_rule_ids: ["MCP-CATALOG-001"] }];
  const ui = policyScreen({ "/gw/enforcement": { enforcement: "monitor" },
    "/gw/policy/ledger": { policies: rules, source_state: "loaded", organization: { source_state: "available", policies } } });
  const body = String((await ui.ROUTES.policy("", "")).html.tabs[0].body);
  assert.match(body, /data-id="POL-E-17"[^]*?<span class="chip alert">보고 전용<\/span>/);
  assert.match(body, /data-id="POL-O-01"[^]*?<span class="chip allow">항상 켜짐<\/span>/);
  assert.match(String((await ui.ROUTES.policy("", "")).html.head), /집행 모드로 전환/);
});

test("정책 상세는 운영 현황·규칙·정의를 보이고 수동 점검 정책에만 점검 탭을 둔다", async () => {
  const ui = policyScreen();
  await ui.ROUTES.policy("", "");
  let detail;
  ui.policyDrawer((title, header, tabs) => { detail = { title, header: String(header), tabs }; });
  ui.ACTIONS["organization-policy"]({ dataset: { id: "POL-E-17" } });
  assert.deepEqual(Array.from(detail.tabs, (tab) => tab.key), ["status", "rules", "definition"]);
  assert.match(detail.header, /반복 조회·대량 추출 탐지와 중단/);
  assert.match(String(detail.tabs[0].body), /<dt>판정<\/dt><dd>10<\/dd><dt>허용<\/dt><dd>6<\/dd><dt>경보<\/dt><dd>1<\/dd><dt>차단<\/dt><dd>3<\/dd>/);
  assert.match(String(detail.tabs[0].body), /policy=P-RATE-001/);
  assert.match(String(detail.tabs[1].body), /data-act="policy" data-id="P-RATE-001"/);
  assert.doesNotMatch(String(detail.tabs[1].body), /MISSING-001/);
  assert.match(String(detail.tabs[2].body), /&lt;script&gt;/);
  assert.doesNotMatch(JSON.stringify(detail.tabs.map((tab) => String(tab.body))), /구현 상태|한계|코드 위치|pac\.py/);
  ui.ACTIONS["organization-policy"]({ dataset: { id: "POL-E-19" } });
  assert.deepEqual(Array.from(detail.tabs, (tab) => tab.key), ["status", "rules", "definition", "manual"]);
  assert.match(String(detail.tabs[3].body), /권한 범위를 대조한다[^]*권한표/);
  ui.ACTIONS["organization-policy"]({ dataset: { id: "POL-R-16" } });
  assert.match(String(detail.tabs[1].body), /운영 대응 규칙 없음/);
});

test("정책 조회 실패와 기록 없음은 집행 성공이나 정상 빈 목록으로 표시하지 않는다", async () => {
  const unavailable = build(true, { "/gw/policy/ledger": { policies: [], source_state: "unavailable", deployment: null, organization: { source_state: "unavailable", policies: [] } } });
  const failed = await unavailable.ROUTES.policy("", "ledger");
  assert.match(String(failed.html.tabs.find((tab) => tab.key === "ledger").body), /정책 원본 조회 실패/);
  assert.doesNotMatch(String(failed.html.tabs.find((tab) => tab.key === "ledger").body), /등록된 정책 없음/);
  assert.match(String(failed.html.tabs[0].body), /조직 정책 원본 조회 실패/);
  assert.doesNotMatch(String(failed.html.tabs[0].body), /등록된 조직 정책 없음/);
  assert.match(String(failed.html.head), /정책 엔진 확인 불가/);
  const unverified = build(true, { "/gw/policy/ledger": { policies: [{ policy_id: "P-2", name: "두 번째", status: "운영",
    enforced_by: "untrusted", recent: { count: 0 }, requirement_ids: ["POL-D-09"] }], source_state: "loaded", deployment: {} } });
  const body = String((await unverified.ROUTES.policy("", "ledger")).html.tabs.find((tab) => tab.key === "ledger").body);
  assert.match(body, /기록 없음[^]*매핑 미확인/);
  assert.doesNotMatch(body, /untrusted|POL-D-09|집행 중/);
  const noActivity = policyScreen({ "/gw/policy/activity?hours=24": new Error("실패") });
  const rows = String((await noActivity.ROUTES.policy("", "")).html.tabs[0].body);
  assert.doesNotMatch(rows, /<span class="num">/);
  assert.match(rows, /<div class="label">차단·경보·승인 요청<\/div><div class="value">—<\/div>/);
});

test("정책 운영 규칙 탭은 규칙 서랍 연결과 정책 ID 표시를 유지한다", async () => {
  const policy = { policy_id: "P-1", name: "<img src=x>", status: "운영", enforced_by: "opa", outcome: "차단",
    purpose: "목적", scope: "<script>bad</script>", condition: "조건", enforcement: "거부", monitor_behavior: "protected",
    requirement_ids: ["REQ-03"], pol_ids: ["POL-I-01", "REQ-03", "POL-I-01"], recent: { count: 2, last_seen_at: "2026-10-31T00:00:00Z" } };
  const ui = build(true, { "/gw/policy/ledger": { policies: [policy], source_state: "loaded", checked_at: "2026-10-31T01:00:00Z", record_window_hours: 24 } });
  const out = await ui.ROUTES.policy("", "ledger");
  const body = String(out.html.tabs.find((tab) => tab.key === "ledger").body);
  assert.match(body, /등록 상태[^]*최근 24시간 판정[^]*운영[^]*기록 있음[^]*POL-I-01/);
  assert.doesNotMatch(body, /정책 로드 상태|룰셋 일치 여부/);
  assert.ok(body.includes("&lt;img") && !body.includes("<img") && !body.includes("REQ-03"));
  let detail;
  ui.policyDrawer((title, actions, tabs) => { detail = { title, actions: String(actions), tabs }; });
  ui.ACTIONS.policy({ dataset: { id: "P-1" } });
  assert.deepEqual(Array.from(detail.tabs, (tab) => tab.key), ["definition", "evidence", "mapping"]);
  assert.match(String(detail.tabs[0].body), /&lt;script&gt;/);
  assert.match(String(detail.tabs[1].body), /관찰 모드에서도 차단 유지/);
  assert.doesNotMatch(String(detail.tabs[1].body), /집행 경로 시험|미수행/);
  assert.match(detail.actions, /policy=P-1[^]*since=2026-10-30T01%3A00%3A00.000Z/);
});

test("MCP 설정 다음 페이지는 사용자 화면의 전체 범위와 서버의 미등록 범위를 보존한다", async () => {
  const ui = build();
  ui.setCurrent({ page: "servers", arg: "", query: new URLSearchParams("entries_cursor=&entries_cursor=42&entries_page=1") });
  ui.responses["/gw/endpoint/inventory/entries?limit=50&cursor=42"] = { rows: [], next_cursor: null };
  ui.responses["/gw/endpoint/inventory/entries?limit=50&cursor=42&classification=shadow%2Cretired-residue"] = { rows: [], next_cursor: null };
  await ui.covPage(ui.inventory, "entries", ""); await ui.covPage(ui.inventory, "entries");
  assert.equal(ui.calls.length, 2);
  assert.ok(!ui.calls[0].includes("classification")); assert.match(ui.calls[1], /classification=shadow%2Cretired-residue/);
});

test("전체 설정과 발견 항목의 페이지 커서는 독립적이다", async () => {
  const ui = build();
  ui.setCurrent({ page: "endpoints", arg: "", query: new URLSearchParams("full_entries_cursor=&full_entries_cursor=all-2&full_entries_page=1&entries_cursor=&entries_cursor=shadow-2&entries_page=1") });
  ui.responses["/gw/endpoint/inventory/entries?limit=50&cursor=all-2"] = { rows: [], next_cursor: "all-3" };
  ui.responses["/gw/endpoint/inventory/entries?limit=50&cursor=shadow-2&classification=shadow%2Cretired-residue"] = { rows: [], next_cursor: "shadow-3" };
  await ui.ROUTES.endpoints("", "shadow");
  assert.equal(ui.covPaging.full_entries.next, "all-3");
  assert.equal(ui.covPaging.entries.next, "shadow-3");
});

test("도입 신청 타이머는 기존 탭에서 갱신하고 새 신청은 보존한다", async () => {
  const ui = build(); let refreshed = 0;
  ui.refreshHook(async () => { refreshed++; });
  const intake = await ui.ROUTES.intake("", "list"); intake.after();
  const tick = [...ui.timers.values()][0];
  for (const tab of ["list", "approved", "new"]) {
    ui.context.location.hash = `#/intake?t=${tab}`; tick();
  }
  assert.equal(refreshed, 2);
  ui.stopIntake(); assert.equal(ui.timers.size, 0);
});

test("도입 신청은 역할별 탭 순서와 기본 탭을 적용하고 직접 선택은 유지한다", async () => {
  for (const admin of [true, false]) {
    const ui = build(admin);
    const out = await ui.ROUTES.intake("", "");
    const order = admin ? ["list", "requests", "new", "approved"] : ["approved", "new", "list"];
    assert.deepEqual(Array.from(out.html.tabs, (t) => t.key), order);
    assert.equal(out.html.active, order[0]);
    const selected = await ui.ROUTES.intake("", "new");
    assert.equal(selected.html.active, "new");
  }
});

test("사용 가능한 MCP 상세와 주소 복사는 현재 이용 가능 여부를 다시 확인한다", async () => {
  const server = {server_id:"docs",display_name:"Docs",purpose:"문서 검색",connection_url:"/mcp/docs/",tools:[{name:"search",action:"r",purpose:"문서 조회",scope_reviewed:true}]};
  const ui = build(false, {"/api/approved-mcp":{servers:[server]}});
  ui.context.URL = URL; ui.context.location.origin = "https://console.example";
  const copied = [];
  ui.context.navigator = {clipboard:{writeText:async (value) => copied.push(value)}};
  ui.approvalActions(async () => null);
  let detail;
  ui.policyDrawer((title, controls, tabs) => {detail={title,controls:String(controls),tabs};});
  const out = await ui.ROUTES.intake("", "approved");
  const tab = out.html.tabs.find((t) => t.key === "approved");
  assert.equal(tab.label, "사용 가능한 MCP");
  assert.match(String(tab.body), /<header>[^]*class="panel-shortcut" href="#\/intake\?t=new"[^]*<\/header>/);
  assert.match(String(tab.body), /data-list-search="available-mcp"[^]*이름 또는 기능 검색/);
  await ui.ACTIONS["available-mcp"]({dataset:{id:"docs"}});
  assert.equal(detail.title, "Docs");
  assert.match(String(detail.tabs.find((t) => t.key === "tools").body), /search[^]*읽기/);
  await ui.ACTIONS["available-mcp-copy"]({dataset:{id:"docs"}});
  assert.deepEqual(copied,["https://console.example/mcp/docs/"]);
  ui.responses["/api/approved-mcp"] = {servers:[]};
  await ui.ACTIONS["available-mcp-copy"]({dataset:{id:"docs"}});
  assert.equal(copied.length,1);
  assert.ok(ui.requests.every((r) => !r.method || r.method === "GET"));
});

test("감사 데이터 조회 실패를 정상 빈 목록으로 숨기지 않는다", async () => {
  const ui = build(true, { "/gw/audit/siem": new Error("관제 조회 실패") });
  const result = await ui.ROUTES.activity("", "audit", new URLSearchParams());
  assert.match(String(result.html.head), /관제 전달 조회 실패/);
  ui.responses["/gw/audit/incidents"] = new Error("사고 조회 실패");
  const failed = await ui.ROUTES.activity("", "incidents", new URLSearchParams());
  const incidents = String(failed.html.tabs.find((tab) => tab.key === "incidents").body);
  assert.match(incidents, /조회 실패/);
  assert.doesNotMatch(incidents, /사고 기록 없음/);
  ui.responses["/gw/audit/alerts?limit=200"] = new Error("경보 조회 실패");
  const alertFailed = String((await ui.ROUTES.activity("", "alerts", new URLSearchParams())).html.tabs.find((tab) => tab.key === "alerts").body);
  assert.match(alertFailed, /role="alert">조회 실패/);
  assert.doesNotMatch(alertFailed, /경보 없음/);
  ui.responses["/gw/audit/retention"] = new Error("보존 조회 실패");
  const retention = String((await ui.ROUTES.activity("", "audit", new URLSearchParams())).html.tabs.find((tab) => tab.key === "audit").body);
  assert.match(retention, /role="alert">조회 실패/);
});

test("호출·감사는 관제 전달 상태를 상단 칩 하나로 보이고 설정이 없으면 숫자를 내지 않는다", async () => {
  const ui = build(true, { "/gw/audit/siem": { configured: false, pending: 9, retrying: 0 } });
  const off = String((await ui.ROUTES.activity("", "live", new URLSearchParams())).html.head);
  assert.match(off, /관제 전달 설정 안 됨/); assert.doesNotMatch(off, /9/);
  ui.responses["/gw/audit/siem"] = { configured: true, pending: 0, retrying: 0, last_delivered: new Date().toISOString() };
  assert.match(String((await ui.ROUTES.activity("", "live", new URLSearchParams())).html.head), /관제 전달 정상/);
  assert.doesNotMatch(String((await build(false).ROUTES.activity("", "live", new URLSearchParams())).html.head), /관제 전달/);
});

test("사고 보고는 기한 표를 유지하고 감사 증빙은 무결성·보존·내보내기 세 영역이다", async () => {
  const ui = build(true, {"/gw/audit/incidents": {timer_status:"정상",incidents:[{id:"case-1",title:"사고",detected_at:"2026-11-01T00:00:00Z",
      deadlines:[{jurisdiction_name:"관할",stage_name:"단계",due_at:"2026-11-02T00:00:00Z",remaining_seconds:3600,status:"임박"}]}]}});
  const out = await ui.ROUTES.activity("", "audit", new URLSearchParams());
  assert.equal(out.html.active, "audit");
  assert.match(String(out.html.tabs.find((t) => t.key === "incidents").body), /data-act="incident-evidence" data-id="case-1"[^]*임박/);
  const audit = String(out.html.tabs.find((t) => t.key === "audit").body);
  assert.match(audit, /무결성[^]*지금 검증[^]*보존 기간[^]*366일[^]*EU[^]*184일[^]*내보내기[^]*data-filter="since"[^]*data-filter="until"[^]*data-filter="policy"/);
  assert.doesNotMatch(audit, /SIEM|보안 관제 전달/);
  const employee = build(false);
  const result = await employee.ROUTES.activity("", "audit", new URLSearchParams());
  assert.deepEqual(Array.from(result.html.tabs, (t) => t.key), ["live", "stats"]);
  assert.ok(employee.calls.every((url) => !url.includes("audit/") || url.startsWith("/gw/activity")));
});

test("경보는 신규·확인 상태와 관련 호출 링크를 보이고 모두 확인은 읽음으로 기록한다", async () => {
  const storage = new Map();
  const alerts = [{ id: 5, kind: "new-tool", created_at: "2026-11-01T10:00:00Z", evidence: { server_id: "docs", added: ["x"] } },
    { id: 2, kind: "call-burst", created_at: "2026-11-01T09:00:00Z", evidence: { server_id: "files", reason: "급증" } }];
  const ui = build(true, { "/gw/audit/alerts?limit=200": { alerts, unread_count: 2, last_24h: 2 } });
  Object.assign(ui.context.localStorage, { getItem: (k) => storage.get(k) || null, setItem: (k, v) => storage.set(k, v) });
  ui.markAlertsSeen([{ id: 2 }]);
  const tab = String((await ui.ROUTES.activity("", "alerts", new URLSearchParams())).html.tabs.find((x) => x.key === "alerts").body);
  assert.equal((tab.match(/data-act="alert-detail"/g) || []).length, 2);
  assert.match(tab, /신규/); assert.match(tab, /확인/); assert.match(tab, /data-act="alerts-ack-all"/);
  const fresh = String((await ui.ROUTES.activity("", "alerts", new URLSearchParams("alert_state=new"))).html.tabs.find((x) => x.key === "alerts").body);
  assert.equal((fresh.match(/data-act="alert-detail"/g) || []).length, 1);
  const link = ui.context.alertCallsHref(alerts[0]);
  assert.match(link, /^#\/activity\?since=/); assert.match(link, /server=docs/);
  assert.equal(ui.context.alertCallsHref({ created_at: "2026-11-01T10:00:00Z", evidence: {} }), "");
});

test("호출 증빙은 현재 필터와 다음 페이지를 유지하고 직원에게 제공하지 않는다", async () => {
  const ui = build();
  const query = new URLSearchParams({t:"live", person:"Alice", principal:"alice", endpoint:"pc-1", policy:"POL-", q:"needle", trace_id:"trace", before:"99", since:"2026-10-30T00:00:00Z", until:"2026-10-31T00:00:00Z", event_kind:"tools/call"});
  ui.setCurrent({page:"activity", query});
  await ui.ROUTES.activity("", "live", query);
  let saved = 0;
  ui.evidenceSaver(() => saved++);
  const first = new URLSearchParams(ui.calls.find((url) => url.startsWith("/gw/activity?")).split("?")[1]);
  for (const key of ["limit", "page", "after"]) first.delete(key);
  first.set("view", "calls"); first.set("limit", "500");
  ui.responses["/gw/audit/export?" + first] = {manifest:{count:500}, payload:{has_more:true,next_before:42,verification:{intact:true}}};
  await ui.ACTIONS["audit-export"]();
  assert.equal(saved, 1); assert.equal(ui.node("#audit-export-next").hidden, false);
  first.set("before", "42");
  ui.responses["/gw/audit/export?" + first] = {manifest:{count:2}, payload:{has_more:false,next_before:null,verification:{intact:true}}};
  await ui.ACTIONS["audit-export-next"]();
  assert.equal(saved, 2); assert.equal(ui.node("#audit-export-next").hidden, true);
  ui.analysisState().filters.policy = "different";
  await ui.ACTIONS["audit-export-next"]();
  assert.equal(saved, 2);
  const employee = build(false);
  const result = await employee.ROUTES.activity("", "live", new URLSearchParams());
  assert.doesNotMatch(String(result.html.tabs[0].body), /audit-export|audit-verify|관제 전달/);
  await employee.ACTIONS["audit-export"]();
  assert.ok(employee.calls.every((url) => !url.includes("audit/")));
});

test("새 신청이 검색보다 먼저이며 직행 값과 첫 필드 포커스를 보존한다", async () => {
  for (const source of ["https://github.com/org/repo", "https://example.test/mcp"]) {
    const ui = build();
    const query = new URLSearchParams({ name: '<서버 "A">', purpose: "공개 문서 검색 목적", source, asked: "request-1" });
    const out = await ui.ROUTES.intake("", "new", query);
    const markup = String(out.html.tabs.find((item) => item.key === "new").body);
    assert.ok(markup.indexOf('data-form="intake"') < markup.indexOf("<details"));
    assert.match(markup, /<details class="panel"><summary>기존 신청 검색<\/summary>/);
    assert.doesNotMatch(markup, /<details[^>]*\bopen\b/);
    assert.match(markup, /name="display_name"[^>]*value="&lt;서버 &quot;A&quot;&gt;"/);
    assert.match(markup, /공개 문서 검색 목적/);
    assert.match(markup, /name="endpoint_request_id" value="request-1"/);
    const addressField = source.includes("github.com") ? "repository_url" : "endpoint_url";
    assert.ok(markup.includes(`name="${addressField}" aria-invalid="false" aria-describedby="intake-${addressField}-error" type="url" maxlength="${addressField === "repository_url" ? 300 : 500}" placeholder="${addressField === "repository_url" ? "https://github.com/org/repo" : "https://…/mcp"}" value="${source}"`));
    assert.match(markup, /value="streamable-http"[^>]*>웹 연결/);
    assert.match(markup, /value="stdio"[^>]*>프로세스 연결/);
    assert.match(markup, /value="sse"[^>]*>이벤트 스트림/);
    let focused = 0;
    ui.node('[data-form="intake"] [name="display_name"]').focus = () => focused++;
    out.after(); assert.equal(focused, 1); ui.stopIntake();
  }
});

const overviewData = { servers: [], workstations: [], execution: {}, flows: [], series: [], top_policies: [], termination: {} };
test("처리할 일은 도입 요청·미등록 MCP 건수를 보이고 도구 이용 동의는 관리자 대시보드에 두지 않는다", async () => {
  const ui = build(true, {
    "/gw/overview": { ...overviewData, pending_approvals: 0, endpoint_requests: 3, workstations: [{ endpoint_id: "pc-1", shadow: 2 }, { endpoint_id: "pc-2", shadow: 0 }] },
    "/api/consents": { consents: [{ status: "PENDING", server_id: "a" }, { status: "PENDING", server_id: "a" }, { status: "GRANTED", server_id: "b" }] },
  });
  const markup = String((await ui.ROUTES.overview()).html.tabs[0].body);
  assert.match(markup, /data-href="#\/intake\?t=requests"><td>엔드포인트 도입 요청<\/td><td>3건<\/td>/);
  assert.match(markup, /href="#\/endpoints\?t=shadow"><div class="label">미적용<\/div><div class="value">1<small class="of">\/ 1<\/small><\/div><div class="foot"><span class="delta">미등록 1 · 미적용 0<\/span>/);
  assert.doesNotMatch(markup, /도구 이용 동의|#\/consent/);
});

test("조회 실패와 누락된 대시보드 값은 0건이 되지 않는다", async () => {
  const ui = build(true, { "/gw/overview": overviewData });
  const real = ui.context.fetch;
  ui.context.fetch = async (url, options) => url.startsWith("/gw/audit/alerts?") || url.startsWith("/gw/activity/analysis?")
    ? { ok: false, status: 500, headers: { get: () => null }, json: async () => ({ detail: "실패" }) } : real(url, options);
  const out = (await ui.ROUTES.overview()).html;
  const markup = String(out.tabs[0].body);
  assert.match(markup, /<div class="label">호출<\/div><div class="value">—<\/div>/);
  assert.match(markup, /<div class="label">차단 비율<\/div><div class="value">—<\/div>/);
  assert.match(markup, /<div class="label">경보<\/div><div class="value">—<\/div>/);
  assert.doesNotMatch(markup, /경보 없음/);
});

test("사용 기한은 실제 날짜로 계산하고 없거나 잘못된 날짜는 대시로 보인다", () => {
  const ui = build();
  vm.runInContext("Date.now = () => 1800000000000", ui.context);
  const at = (offset) => ({ valid_until: new Date(1800000000000 + offset).toISOString() });
  assert.match(String(ui.validityChip(at(90 * 86400000))), />90일 남음</);
  assert.match(String(ui.validityChip(at(1))), />1일 남음</);
  for (const value of [at(0), at(-1), { ...at(-86400000), risk_review: true }]) assert.match(String(ui.validityChip(value)), />만료</);
  for (const value of [null, {}, { valid_until: "invalid" }]) assert.equal(String(ui.validityChip(value)).replace(/<[^>]*>/g, ""), "—");
});

test("미등록 MCP는 혼합 합계 없이 설정·수신기·차단 건수를 분리한다", async () => {
  const ui = build();
  Object.assign(ui.inventory.pages.entries, { total: 7 });
  Object.assign(ui.inventory.pages.listeners, { total: 3 });
  Object.assign(ui.inventory.pages.os_events, { total: 0 });
  const shadow = (await ui.ROUTES.endpoints("", "shadow", new URLSearchParams())).html.tabs.find((item) => item.key === "shadow");
  assert.equal(shadow.n, undefined);
  const markup = String(shadow.body);
  for (const [label, value] of [["설정 기록", 7], ["수신기 관측", 3], ["엔드포인트 차단", 0]]) assert.ok(markup.includes(`<dt>${label}</dt><dd>${value}</dd>`));
  assert.match(markup, /표시 서버 0개/);
  const items = (await ui.ROUTES.servers("", "items", new URLSearchParams())).html.tabs.find((item) => item.key === "items");
  assert.match(String(items.body), /항목 없음/);
  const filtered = (await ui.ROUTES.servers("", "items", new URLSearchParams("q=missing"))).html.tabs.find((item) => item.key === "items");
  assert.match(String(filtered.body), /조건에 맞는 결과 없음/);
});

test("도구 출력 크기·정책 판정·업무 결과를 분리하고 경보 표시 범위를 밝힌다", async () => {
  const ui = build(true, {
    "/gw/policy/ledger": { policies: [{ policy_id: "P-ALLOW", name: "승인 범위 허용" }] },
    "/gw/audit/alerts?limit=200": { alerts: [{ id: 1, created_at: "2020-01-01", kind: "policy-self-test-failed", evidence: { policy_id: "P-ALLOW" } }], last_24h: 0 },
    "/gw/endpoint/tool-events?limit=100": { total: 3, rows: [
      { decision: "Allow", policy_id: "P-ALLOW", failed: true, input_bytes: 0, output_bytes: 4096 },
      { decision: "Allow", failed: false, output_bytes: 0 },
      { failed: false, outcome_axes: { task: "<未確認>" } },
    ] },
  });
  const out = (await ui.ROUTES.activity("", "tools", new URLSearchParams())).html;
  const tools = String(out.tabs.find((item) => item.key === "tools").body);
  const security = out;
  assert.match(tools, /<th>게이트웨이 판정<\/th><th>도구 실행<\/th><th>업무 결과<\/th>/);
  assert.match(tools, /<th class="num">출력 크기<\/th>/);
  assert.match(tools, /승인 범위 허용/);
  assert.match(tools, /도구 오류/);
  assert.match(tools, /4\.0 KB/);
  assert.match(tools, /0 B/);
  assert.doesNotMatch(tools, /업무 성공/);
  assert.match(tools, /&lt;未確認&gt;/);
  const alerts = security.tabs.find((item) => item.key === "alerts");
  assert.match(String(alerts.body), /정책 점검 실패[^]*승인 범위 허용[^]*<td class="num">1<\/td>/);
  assert.equal(ui.policyLabel("P-ALLOW"), "승인 범위 허용");
  assert.equal(ui.policyLabel("unknown"), "unknown");
});

test("상하 페이지 제어는 같은 상태를 표시하고 빈 호출의 실패·조건·정상 상태를 구분한다", async () => {
  const ui = build(false);
  const out = await ui.ROUTES.activity("", "live", new URLSearchParams());
  const markup = String(out.html.tabs[0].body);
  assert.equal((markup.match(/data-feed-pager/g) || []).length, 2);
  const pagers = [{}, {}];
  ui.context.document.querySelectorAll = (selector) => selector === "[data-feed-pager]" ? pagers : [];
  ui.setFeed({ page: 2, pageSize: 50, filteredTotal: 101, analysis: { series: [], responses: [], servers: [], people: [] } }); ui.renderFeed();
  assert.equal(pagers[0].innerHTML, pagers[1].innerHTML);
  assert.match(pagers[0].innerHTML, /<span>2 \/ 3<\/span>/);
  assert.match(pagers[0].innerHTML, /data-page="1"/);
  assert.match(pagers[1].innerHTML, /data-page="3"/);
  ui.renderFeedStatus(); assert.match(ui.node("#feed-empty").innerHTML, /호출 없음/);
  ui.setFeed({ query: "missing" }); ui.renderFeedStatus();
  assert.match(ui.node("#feed-empty").innerHTML, /조건에 맞는 결과 없음/);
  assert.match(ui.node("#feed-empty").innerHTML, /조건 초기화/);
  ui.setFeed({ failing: true }); ui.renderFeedStatus();
  assert.match(ui.node("#feed-empty").innerHTML, /role="alert">조회 실패/);
  assert.doesNotMatch(ui.node("#feed-empty").innerHTML, /조건 초기화/);
  ui.setFeed({ failing: false, query: "" }); ui.renderFeedStatus();
  assert.match(ui.node("#feed-empty").innerHTML, /호출 없음/);
});

test("검토 종료는 대상 확인 취소 시 쓰기를 보내지 않는다", async () => {
  const ui = build(); const prompts = [];
  ui.context.ask = async (value) => { prompts.push(value); return null; };
  const el = { dataset: { id: "id/1", name: "<서버>", account: "직원", endpoint: "PC-1" } };
  await ui.ACTIONS["endpoint-request-close"](el);
  assert.equal(ui.calls.length, 0);
  assert.match(String(prompts[0].fields), /&lt;서버&gt;[^]*PC-1[^]*도입 요청 검토 종료/);
  assert.equal(prompts[0].confirm, "검토 종료");
  ui.context.ask = async () => new FormData();
  ui.setCurrent({ page: "intake" }); ui.context.location.hash = "#/intake?t=list";
  ui.refreshHook(async () => {}); ui.context.toast = () => {}; ui.context.refreshBadges = () => {};
  ui.responses["/gw/endpoint/requests/id%2F1/close"] = { closed: true };
  await ui.ACTIONS["endpoint-request-close"](el);
  assert.deepEqual(ui.calls, ["/gw/endpoint/requests/id%2F1/close"]);
});

test("표는 한글 상태·서버명과 시각을 보존하고 주소·해시만 강제 줄바꿈한다", () => {
  const css = readFileSync(new URL("../gateway/app/agent_static/console.css", import.meta.url), "utf8");
  // A long id without the address/hash class still breaks instead of widening the table; Hangul words stay whole.
  assert.match(css, /table\.data td\{[^}]*word-break:keep-all;overflow-wrap:break-word/);
  assert.match(css, /table\.data \.chip\{word-break:keep-all;overflow-wrap:normal/);
  assert.match(css, /\.nowrap\{white-space:nowrap;font-variant-numeric:tabular-nums/);
  assert.match(css, /table\.data \.address,table\.data \.hash\{word-break:normal;overflow-wrap:anywhere/);
});

test("기존 신청 검색은 실패와 복구를 구분하고 늦은 실패가 새 결과를 덮지 않는다", async () => {
  const ui = build(); let tick, rejectFirst;
  ui.context.setTimeout = (fn) => { tick = fn; };
  ui.context.clearTimeout = () => {};
  const input = { value: "first", isConnected: true, matches: () => true };
  const branch = source.slice(source.indexOf('  if (event.target.matches("[data-catalog-search]")) {'), source.indexOf('  if (event.target.matches("[data-coverage-search]")) {'));
  vm.runInContext(`globalThis.searchInput = (event) => { ${branch} };`, ui.context);
  ui.context.api = () => new Promise((resolve, reject) => { rejectFirst = reject; });
  ui.context.searchInput({ target: input }); const first = tick();
  input.value = "second";
  ui.context.api = async () => ({ query: "second", requests: [], registry: [{ display_name: "두 번째 결과" }] });
  ui.context.searchInput({ target: input }); await tick();
  const latest = ui.node("#catalog-results").innerHTML;
  rejectFirst(new Error("실패")); await first;
  assert.equal(ui.node("#catalog-results").innerHTML, latest);
  assert.match(latest, /두 번째 결과/);
  ui.context.api = async () => { throw new Error("실패"); };
  ui.context.searchInput({ target: input }); await tick();
  assert.match(ui.node("#catalog-results").innerHTML, /조회 실패/);
  ui.context.api = async () => ({ query: "second", requests: [], registry: [] });
  ui.context.searchInput({ target: input }); await tick();
  assert.match(ui.node("#catalog-results").innerHTML, /조건에 맞는 결과 없음/);
  assert.doesNotMatch(ui.node("#catalog-results").innerHTML, /조회 실패/);
});
