import test from "node:test";
import assert from "node:assert/strict";
import { koInput, koPeriod, koStamp, koClock, parseKoStamp, remaining, executionView, nextStep, consentState, hostRows, purposePhrase, reportView, mixParts, baseline } from "../gateway/app/agent_static/dash.mjs";

test("한국식 24시간 표기는 KST 기준이며 입력 문자열을 같은 시각으로 되돌린다", () => {
  assert.equal(koInput("2026-11-13T09:28:00Z"), "2026.11.13 18:28");
  assert.equal(parseKoStamp("2026.11.13 18:28").toISOString(), "2026-11-13T09:28:00.000Z");
  assert.equal(parseKoStamp("2026-11-13 08:05").toISOString(), "2026-11-12T23:05:00.000Z");
  assert.equal(parseKoStamp("2026.13.40 25:00"), null);
  assert.equal(parseKoStamp("11/13/2026, 06:28 PM"), null);
  assert.equal(koPeriod("2026-11-13T09:28:00Z", "2026-11-14T09:28:00Z"), "2026.11.13 18:28 – 11.14 18:28 KST");
  assert.equal(koPeriod("2026-11-13T09:28:00Z", null), "2026.11.13 18:28 – 현재 KST");
  assert.equal(koPeriod("", null), "전체 기간");
  const now = Date.parse("2026-11-14T03:00:00Z");
  assert.equal(koStamp("2026-11-14T00:10:00Z", { now }), "09:10");
  assert.equal(koStamp("2026-11-13T00:10:00Z", { now }), "11.13 09:10");
  assert.equal(koStamp("2026-11-13T00:10:00Z", { now, full: true, seconds: true }), "2026.11.13 09:10:00");
  assert.equal(koClock(new Date("2026-11-14T10:05:09Z")), "19:05:09");
  assert.equal(koStamp("not a date"), "—");
});

test("사용 기한은 날짜와 남은 일수, 목적은 짧은 명사구로 줄인다", () => {
  const now = Date.parse("2026-11-13T12:00:00Z");
  assert.deepEqual({ ...remaining("2026-11-26T12:26:00Z", now) }, { days: 14, date: "11월 26일", soon: true });
  assert.equal(remaining("2027-01-30T00:00:00Z", now).soon, false);
  assert.equal(remaining("", now), null);
  assert.equal(purposePhrase("바이너리 정적 분석을 위해 사용합니다."), "바이너리 정적 분석");
  assert.equal(purposePhrase("웹 문서를 읽고 요약하는 데 사용합니다. 외부 전송은 없습니다."), "웹 문서를 읽고 요약하는 데");
  assert.equal(purposePhrase(""), "—");
  assert.ok(purposePhrase("가".repeat(60)).endsWith("…"));
});

test("실행 열은 실행됨·실행 안 됨·승인 대기·미확인만 쓰고 미확인을 따로 표시한다", () => {
  assert.deepEqual({ ...executionView({ decision: "Allow", outcome_axes: { execution: "실행됨" } }) }, { tone: "allow", label: "실행됨", unknown: false });
  assert.equal(executionView({ decision: "Block", outcome_axes: { execution: "실행 안 함" } }).label, "실행 안 됨");
  assert.equal(executionView({ decision: "Block", outcome_axes: { execution: "실행 미확인" } }).unknown, true);
  assert.equal(executionView({ decision: "Approval", outcome_axes: { execution: "실행 안 함" } }).label, "승인 대기");
  assert.equal(executionView({ decision: "Allow" }).label, "—");
});

test("직원 차단 사유에는 직원이 할 수 있는 다음 행동만 붙인다", () => {
  const consent = nextStep({ decision: "Block", policy_id: "P-CONSENT-001", server: "docs", tool: "read" }, "이용 동의 필요");
  assert.equal(consent.kind, "consent"); assert.equal(consent.label, "동의 검토");
  assert.equal(consent.href, "#/my?t=consent&server=docs&tool=read");
  assert.deepEqual({ ...nextStep({ decision: "Approval", policy_id: "P-X" }) }, { text: "관리자 승인 대기", kind: "detail", label: "요청 보기" });
  assert.equal(nextStep({ decision: "Block", policy_id: "P-X" }, "원격 서버 통신 실패").text, "원격 서버 통신 실패");
  assert.equal(nextStep({ decision: "Allow", outcome_axes: { execution: "실행됨" } }).kind, "none");
  assert.equal(nextStep({ decision: "Allow", outcome_axes: { execution: "미확인" } }).text, "실행 여부 확인 대기");
});

test("동의 상태는 필요·불필요·확인 불가를 구분하고 근거가 없으면 불필요로 단정하지 않는다", () => {
  const server = (tools) => ({ server_id: "docs", tools });
  const reviewed = (consent) => ({ name: "t", scope_reviewed: true, consent });
  assert.equal(consentState(server([reviewed(false)]), []), "none");
  assert.equal(consentState(server([reviewed(true)]), []), "before");
  assert.equal(consentState(server([{ name: "t", scope_reviewed: false }]), []), "unknown");
  assert.equal(consentState(server([{ name: "t", scope_reviewed: true }]), []), "unknown");
  assert.equal(consentState(server([]), []), "unknown");
  const rows = (status) => [{ server_id: "docs", status }];
  assert.equal(consentState(server([reviewed(true)]), rows("PENDING")), "pending");
  assert.equal(consentState(server([reviewed(true)]), rows("GRANTED")), "granted");
  assert.equal(consentState(server([reviewed(true)]), rows("DENIED")), "denied");
  assert.equal(consentState(server([reviewed(true)]), rows("REVOKED")), "revoked");
  assert.equal(consentState(server([reviewed(true)]), [{ server_id: "other", status: "GRANTED" }]), "before");
});

test("세션 ID는 사람이 알아보는 PC 이름으로 합치고 연결 못한 세션은 따로 센다", () => {
  const agents = [{ endpoint_id: "managed-aaa", hostname: "pj0", owner_name: "양승권" }, { endpoint_id: "managed-bbb", hostname: "pj0", owner_name: "양승권" }, { endpoint_id: "managed-ccc", hostname: "winvm" }];
  const rows = hostRows([{ key: "managed-aaa", total: 10 }, { key: "managed-bbb", total: 5 }, { key: "managed-ccc", total: 2 }, { key: "managed-zzz", total: 4 }, { other: true, total: 9 }], agents);
  assert.deepEqual(rows.map((r) => [r.name, r.value]), [["pj0 · 양승권", 15], ["winvm", 2], ["미연결 세션", 4]]);
  assert.ok(rows.every((r) => !r.name.includes("managed-")));
  assert.deepEqual(hostRows(null, null), []);
});

test("보고 지연·비교 기준·판정 비율", () => {
  const now = Date.parse("2026-11-14T00:30:00Z");
  assert.equal(reportView({ managed_state: "active", last_seen_at: "2026-11-14T00:25:00Z" }, now).delayed, false);
  assert.equal(reportView({ managed_state: "active", heartbeat_at: "2026-11-13T00:25:00Z" }, now).delayed, true);
  assert.equal(reportView({ managed_state: "active" }, now).delayed, true);
  assert.equal(reportView(undefined, now).state, "");
  assert.equal(baseline("7d"), "직전 7일"); assert.equal(baseline("custom"), "직전 같은 기간");
  const parts = mixParts({ Allow: 3, Block: 1 }, ["Allow", "Alert", "Block"]);
  assert.deepEqual(parts.map((p) => [p.key, p.value, p.pct]), [["Allow", 3, 75], ["Alert", 0, 0], ["Block", 1, 25]]);
});
