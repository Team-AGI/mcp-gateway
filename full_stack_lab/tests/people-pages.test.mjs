import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import * as state from "../gateway/app/agent_static/console-state.mjs";

const source = readFileSync(new URL("../gateway/app/agent_static/console.js", import.meta.url), "utf8");
const agents = [
  { endpoint_id: "ep1", owner_token: "tok-a", owner_name: "가나", hostname: "pc-a", status: "active", managed_state: "active", last_seen_at: new Date().toISOString() },
  { endpoint_id: "ep2", owner_token: "tok-b", owner_name: "다라", hostname: "pc-b", status: "active", managed_state: "pending", last_seen_at: "2020-01-01T00:00:00Z", policy_hash: "h" },
];
function routes(provider = "local") {
  const calls = [];
  const context = vm.createContext({
    ...state, ROUTES: {}, peopleAccounts: [], URLSearchParams, Date,
    api: async (path) => {
      calls.push(path);
      if (path === "/api/signup-requests") return { requests: [{ id: "s1", username: "new", display_name: "신규", status: "pending", requested_at: "2026-11-01T00:00:00Z" }] };
      if (path === "/api/identity") return { provider, bindings: [] };
      if (path === "/api/accounts/deleted") return { accounts: [{ user_id: "gone", display_name: "삭제 사용자", role: "employee", status: "deleted", token: "tok-g" }] };
      return { accounts: [
        { user_id: "a", token: "tok-a", display_name: "가나", role: "employee", department: "개발", status: "active", email: "a@x" },
        { user_id: "b", token: "tok-b", display_name: "다라", role: "employee", department: "개발", status: "locked", email: "b@x" },
        { user_id: "c", token: "tok-c", display_name: "마바", role: "admin", department: "", status: "disabled", email: "c@x" }] };
    },
    gw: async (path) => {
      calls.push(path);
      if (path === "suspensions") return { suspensions: [{ id: 1, display_name: "가나", server_name: "docs", reason: "시험", suspended_at: "2026-11-01T00:00:00Z" }] };
      if (path === "overview") return { workstations: [{ endpoint_id: "ep1", harness: "claude", calls: 4 }] };
      if (path.startsWith("activity/analysis")) return { people: [{ key: "가나", total: 5, Block: 2 }, { key: "다라", total: 1, Block: 0 }] };
      return { agents, managed_events: [{ endpoint_id: "ep2", kind: "enrolled", observed_at: "2026-11-01T00:00:00Z" }], coverage: { reporting_recently: 1 }, settings: {} };
    },
    planes: async () => ({ devices: [{ endpoint_id: "ep1", checks: { protected_configs: true } }] }),
    viewer: { user_id: "root" }, current: { query: new URLSearchParams() },
    html: (strings, ...values) => strings.reduce((out, text, i) => out + text + (values[i] === undefined ? "" : [].concat(values[i]).join("")), ""),
    raw: (v) => v, chip: (tone, label) => `[${label}]`, panel: (title, body, options = {}) => `<panel ${title}>${options.tools || ""}${body}`, empty: (text) => text,
    kv: () => "", listToolbar: () => "", kpiStrip: (items) => JSON.stringify(items.map((x) => x.slice(0, 2))), head: (title) => title, page: (value) => value,
    rowMenu: (v) => v, chartBox: (id) => id, charts: { bars: (items) => items, color: (name) => name, donut: (items) => items },
    short: (v) => v, when: (v) => v, ago: (v) => v, NONE: "—", ROLE: { admin: "관리자", employee: "직원" }, PLATFORM: { windows: "Windows" },
    SIGNUP_STATUS: {}, MANAGED_EVENT: { enrolled: ["approval", "설치 보고"] }, MANAGED_MODE: {}, harnessLabel: (v) => v, managedEventDetail: () => "—",
    signupPendingTotal: (data) => data.requests.filter((r) => r.status === "pending").length, listPageNumber: () => 1, listPager: () => "",
    checksChip: () => "[점검]", entityRef: (v) => v, location: { hash: "" },
  });
  vm.runInContext(source.slice(source.indexOf("let peopleAccounts ="), source.indexOf("async function showEndpoint(")), context);
  return { context, calls };
}
const cards = (markup) => JSON.parse(markup.slice(0, markup.indexOf("]]") + 2));

test("user management answers who is active, stopped or waiting and keeps deleted users as a filter", async () => {
  for (const provider of ["local", "oidc"]) {
    const { context, calls } = routes(provider);
    const out = await context.ROUTES.people("", "devices", new URLSearchParams());
    assert.equal(out.html.head, "사용자");
    assert.equal(out.html.active, "accounts");
    assert.deepEqual(Array.from(out.html.tabs, (t) => t.key), ["accounts", "suspensions", "signups", ...(provider === "oidc" ? ["sso"] : [])]);
    assert.deepEqual(cards(out.html.kpis), [["전체 사용자", 3], ["활성", 1], ["이용 중지 중", 1], ["가입 대기", 1]]);
    assert.ok(calls.some((c) => c.startsWith("activity/analysis")));
    const body = String(out.html.tabs[0].body);
    assert.match(body, /삭제 사용자/); assert.match(body, /\[삭제됨\]/); assert.match(body, /data-act="account-restore"/);
    assert.match(body, /\[활성\]/); assert.match(body, /\[설치 보고\]/);
    assert.deepEqual(Object.keys(out.charts), ["c-people-departments", "c-people-blocked"]);
  }
});

test("the deleted filter leaves only deleted users and the PC stage links to the endpoint list", async () => {
  const { context } = routes();
  const out = await context.ROUTES.people("", "accounts", new URLSearchParams("status=deleted"));
  const body = String(out.html.tabs[0].body);
  assert.match(body, /삭제 사용자/); assert.doesNotMatch(body, /가나/);
  const all = String((await context.ROUTES.people("", "accounts", new URLSearchParams())).html.tabs[0].body);
  assert.match(all, /href="#\/endpoints\?t=devices&q=%EA%B0%80%EB%82%98"/);
});

test("endpoint management merges the two tables into one row per PC with silent and managed counts", async () => {
  const { context } = routes();
  const out = await context.ROUTES.endpoints("", "managed", new URLSearchParams());
  assert.equal(out.html.head, "엔드포인트");
  assert.equal(out.html.active, "managed");
  assert.deepEqual(Array.from(out.html.tabs, (t) => t.key), ["devices", "managed"]);
  assert.deepEqual(cards(out.html.kpis).map((x) => x[1]), [2, 1, 1, 0, 1]);
  const rows = String(out.html.tabs[0].body).match(/data-act="endpoint-device"/g) || [];
  assert.equal(rows.length, 2);
  const silent = String((await context.ROUTES.endpoints("", "devices", new URLSearchParams("silent=1"))).html.tabs[0].body);
  assert.match(silent, /pc-b/); assert.doesNotMatch(silent, /pc-a/);
});
