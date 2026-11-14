# MINT 관리자 콘솔 재설계 — 레퍼런스 조사 (11-14)

조사 방식: 공식 문서·제품 페이지·docs 안의 스크린샷 캡션을 WebFetch/WebSearch로 읽었고, 스킬 저장소는 `git clone --depth 1`로 받아 실제 파일을 읽었습니다. 코드는 고치지 않았습니다.

**신뢰도 표기**: [확인] = 공식 문서에 UI 서술이 있음 / [부분] = 개념·기능만 있고 화면 배치는 불명 / [마케팅] = 제품 소개 페이지·제3자 글뿐. 문서에 없는 것은 추측하지 않고 「미확인」으로 적었습니다. 로그인 뒤 화면(Wiz·Falcon·Lasso·Prompt Security)은 공개 자료로 화면 단위 확인이 불가능했습니다.

---

## 0. 먼저 — MINT 현재 콘솔의 수치 (비교 기준)

`research/d2sf_2026/src/mint-release/.../agent_static/console.css`(릴리스 사본, 최신 main과 다를 수 있음)에서 읽은 값입니다.

| 항목 | 현재 값 | 비고 |
|---|---|---|
| 기본 글자 | 15.75px (xs 13.5 / sm 14.58) | 레퍼런스 대부분은 14px 기준 |
| 표 행 | td 12px 16px → 행 약 48px, `.compact`는 8px → 약 40px | Carbon lg(48)와 같음. 밀도는 보통 수준 |
| 패널 | header 18/20px, body 16/20/20px, 그리드 gap 20px | 카드 안 여백이 레퍼런스(16px)보다 큼 |
| 본문 여백 | `.main` padding 28px 32px, max-width 1600 | |
| KPI | padding 16px, 값 33.75px, 6열 | 숫자만 큼, 추세 없음 |
| 차트 | `charts.mjs` 159줄 + ECharts 번들. stacked·donut·bars·sankey 있음 | 도구는 이미 있음 → 대시보드에 안 쓰고 있는 것이 문제 |

결론: 부품(ECharts, 결정 5색 토큰, 다크 모드)은 갖춰져 있고, **대시보드 구성(무엇을 어떤 차트로)과 화면 역할 정의가 비어 있는 것**이 원인입니다.

---

## A. 레퍼런스 콘솔 분석

### A-1. 제품별 요약 (14개)

| # | 제품 | 신뢰도 | (1) 메뉴 구조(IA) | (2) 첫 화면 | (3) 요청/로그 목록·상세 | (4) 정책 화면 | (5) 승인/검토 | (6) 밀도·색 |
|---|---|---|---|---|---|---|---|---|
| 1 | **TrueFoundry AI Gateway** (LLM+MCP 게이트웨이, MINT와 가장 가까움) | [확인] | AI Gateway → Metrics(탭 5: Overview·Models·MCP·Agents·Guardrails), Monitor → Requests, 레지스트리/MCP/예산/속도 제한 | Overview: 카드(총 지출·요청량·성공률·한도로 차단된 요청·guardrail 활동) + **Usage Directory 표**(사용자·팀·가상 계정·에이전트별, 지출순). 모든 탭 공통: 시간 범위·필터 바·새로고침 | 요청 열기 → trace(guardrail·모델 호출·외부 호출 span). 표 행 클릭 → 팀 상세(지출·한도·구성원) | Guardrails 탭: 카드(평가·flagged·mutated·blocked·추가 지연) + 시간별 결과 차트 + **guardrail 표(검사 수·flagged·mutated·blocked·failed·지연 분위)** + 「guardrail에 걸리는 사람·앱」 순위 표 | 문서에 승인 화면 서술 없음(미확인) | 카드→추세 차트→표의 반복. MCP 탭: 호출량(서버·도구·메서드·호출자로 쌓기, 성공/실패 분리)·서버 확장 시 도구, P50/P90/P99 |
| 2 | **Kong Konnect AI Gateway / Advanced Analytics** | [확인]·일부 [부분] | AI view → Gateways, Observability(Overview·Explorer·Custom Dashboards·Requests), AI Cost Management(Dashboard·Events debugger·My Usage) | 내장 Overview: LLM p95 지연·요청 수·토큰(전체/캐시)·오류율·비용, 상위 소비자(모델·제공자·사용자·MCP 서버), 비용 대 요청 수, 모델별 오류율·지연, MCP 메서드 호출·실패 | Explorer 차트에서 시간 구간 드래그 → **View requests**로 같은 필터의 요청 목록. Events debugger: 이벤트별 비용·토큰·사용자·모델 | 정책(AI Prompt Guard·Sanitizer·Rate Limiting 등)은 엔티티에 붙이는 형태. 대시보드에 정책·guardrail 전용 보기는 없음(문서 명시) | 미확인 | Explorer: 데이터셋 전환(API/LLM/플랫폼), 상대·사용자 지정 시간, 그룹 기준 최대 10여 종(모델·MCP 서버·에이전트·소비자·상태 코드·MCP 도구 등), 보고서로 저장, CSV |
| 3 | **Portkey** | [확인] | AI Gateway(라우팅·캐시·폴백·예산) / Observability(Logs·Analytics·Traces·Filters·Metadata·Feedback) / Prompt Library / Guardrails | Analytics 탭: Overview(비용·토큰·평균 지연·요청량·사용자·상위 모델), Users, Errors(오류율 + 게이트웨이가 구한 요청 수), Cache(절감), Feedback, Summary(차원 선택 표: 요청·비용·지연·성공률·평균 토큰·마지막 사용) | 시간순 목록(시간·유형·LLM·토큰·비용·**Status: 캐시/재시도/폴백/로드밸런스**). 행 클릭 → 우측 패널(요청·응답 원문, Config ID, Replay, Feedback). 로그마다 공유 URL | Guardrails 페이지에서 Create → 오른쪽 사이드바에서 검사 추가. 동작: Async·Deny(차단 446/통과 진행 246)·Sequential·성공/실패 피드백. Config에 붙여야 활성 | 미확인 | 로그 상세 「Feedback & Guardrails」 탭에 검사별 통과/실패·지연 |
| 4 | **Cloudflare AI Gateway** | [확인]·[부분] | AI → AI Gateway → 게이트웨이 선택(Dashboard·Logs·Settings·Guardrails 등) | 5개 지표: 요청·토큰·비용(제공자별)·오류·캐시 응답 비율, 시간 필터(차트 종류는 문서에 없음) | 로그: 프롬프트·응답·제공자·시각·상태·토큰·비용·지속·User agent, DLP 일치 시 Action(FLAG/BLOCK)·정책·프로파일·항목 ID·요청/응답 구분. Settings > Logs에서 수집 on/off | Guardrails: 켜기/끄기 → **평가 범위(프롬프트/응답/둘 다)** → 위험 범주별 **flag / block / ignore**. 그림 캡션: flag는 주황, block은 빨강 | 해당 없음 | 상태색 의미를 (주황=경고, 빨강=차단)로 고정 |
| 5 | **Datadog LLM Observability** | [확인]·일부 [부분] | LLM Observability → Traces·Patterns(주제 군집)·Insights·Evaluations·Security, 기본 대시보드 Operational Insights | Operational Insights: 총 trace/span·성공/오류율, 모델 사용 **도넛**, 입력/출력 토큰 평균, 토큰(프롬프트·캐시·완료·합계) 추세, 발동한 모니터 | trace 목록 → 측면 패널에 **플레임 그래프**, span 선택 시 입출력 메시지, Evaluations 탭(환각 검사 근거·설명). 검색창에 쿼리(모델·사용자·오류·토큰 수) | Security: 민감 정보 자동 스캔·마스킹, 프롬프트 인젝션 탐지(전용 정책 편집기는 미확인) | 미확인 | 지표 카드 + 시계열 + 분포. 고밀도 운영 화면 |
| 6 | **Microsoft Entra ID 조건부 액세스** (정책 화면의 모범) | [확인] 스크린샷 캡션까지 | Entra ID → Conditional Access → **Overview · Coverage · Policies · Insights and reporting**(+ What if) | Overview: 사용 중 vs 보고 전용 정책 수, 에이전트·사용자 활동, 앱, 장치, 보안 경고와 제안 | 로그인 로그의 정책 평가 결과. Insights 워크북 하단에 사용자별 로그인 상세 | Policies 목록(필터·What if·새로 만들기). 정책 상태 **On / Report-only / Off**. Insights 워크북: 상단 매개변수(정책 선택, 시간 4시간~90일, 사용자, 앱, 데이터 보기 사용자/로그인) → **영향 요약 타일 5개(Total·Success·Failure·User action required·Not applied)** → 조건별(장치 상태·플랫폼·클라이언트 앱·위치·앱·로그인 위험) 분해. 타일 클릭 = 필터 | 「User action required」(MFA 같은 상호작용 필요) 상태가 별도 존재. Optimization Agent가 정책 변경을 제안하고 한 번에 적용 | Coverage 탭: 지난 7일 정책이 적용된/안 된 앱 요약 |
| 7 | **Lakera Guard** | [확인] 개념, UI [부분] | platform.lakera.ai: Projects, Policies, 분석 | 탐지 패턴 분석, **Policy Impact Simulator**(과거 트래픽으로 민감도 레벨별 flag 비율 비교) | API가 guardrail별 breakdown 반환. 대시보드 표시 방식은 미확인 | 정책 = 켜는 guardrail 집합(프롬프트 방어·데이터 유출·콘텐츠·악성 링크·에이전트 행동). 민감도 L1(관대)~L4(편집증), 프로젝트 모드 **Detect / Enforce**(Detect는 막지 않고 관찰만) | 미확인 | 미확인 |
| 8 | **Docker MCP Toolkit / Catalog** | [부분] | Catalog / Profiles(서버 묶음) / Clients / OAuth / Server Configuration | 없음(설정 중심). 카탈로그 탐색→프로필에 추가 | 문서에 로그 화면 없음 | 정책 개념은 약함. 프로필 단위로 서버 구성. OAuth 탭은 인증된 서비스 목록 + Revoke | 해당 없음 | 카드 목록 + 한 번 클릭 연결(Connect) |
| 9 | **Pomerium (MCP 게이트웨이)** | [부분] | 라우트 포털(서버별 연결/해제/상태), 정책 파일 | 문서에 대시보드 서술 없음 | 모든 도구 호출을 메서드·도구 이름·인자로 기록. 보기 화면은 미확인 | 정책은 PPL 코드. `mcp_tool` 조건으로 도구 이름(정확·접두·접미·목록) 허용/거부, 사용자·그룹 조건과 결합 | 사용자별·라우트별 **연결 상태** 관리 | (MINT 정책을 「사람 + 도구 이름」 두 축으로 보이는 근거) |
| 10 | **LiteLLM Admin UI** (MINT 기반 구성요소) | [부분] | Virtual Keys / Models / Teams·Organizations / Internal Users / Usage / Logs / Guardrails / AI Hub | Usage 상세는 문서 서술 없음 | Logs: 요청별 지출·토큰·키·팀, 키 별칭 필터, 로그 **드로어**(비용 상세·오류 상세·guardrail 패널), 도구 제공/호출 표시 | Guardrails는 문서 링크만(화면 서술 없음) | 미확인 | 미확인 |
| 11 | **Wiz** | [마케팅]+제3자 UX 분석 | 한 콘솔에 posture·code·detection·exposure·AI. Security Graph(탐색 계층), Issues(조치 단위), Findings, Threats, 규칙(Controls) 표 | 역할별(경영진·운영·감사) 대시보드 | 5단계 점진 공개: 대시보드→Issue 목록→Issue 상세→리소스 상세→원본 데이터 | 규칙/컨트롤 표: 이름·**Issues 수**·프로젝트 열(제3자 분석) | Issue를 담당자에 배정, Jira·Slack 연동, SLA 추적 | 위험 맥락으로 심각도 상향(노출+민감 데이터) |
| 12 | **CrowdStrike Falcon** | [마케팅]·[부분] | 사이드바 Endpoint security → Activity dashboard 등, Next-Gen SIEM | 탐지 대시보드(연결된 시각화 묶음), Detection Coverage 대시보드 | 탐지 → See details | 탐지 분류(관리형·사용자 지정·예약·상관 규칙) | 미확인 | 리뷰 사이트에서 「화면이 많고 복잡」이라는 평 (피해야 할 사례) |
| 13 | **Lasso Security** | [마케팅] | 상용 플랫폼의 단일 대시보드(전체 MCP 한눈에). 오픈소스 게이트웨이는 UI 없음 | 미확인 | 오픈소스는 guardrail별 로컬 로그 | 플러그인: PII 마스킹·토큰/비밀 마스킹·프롬프트 인젝션·유해 콘텐츠·자연어 사용자 지정 정책, 동작 block/alert/sanitize | 미확인 | 미확인 |
| 14 | **Prompt Security (SentinelOne)** | [마케팅] | 한 콘솔 안에 엔드포인트·클라우드·ID와 같이 있음 | 「조직 내 GenAI 사용」, **Shadow AI 애플리케이션 표**, 활성 MCP 서버·사용자·도구 카드 | 미확인 | 역할 기반 정책(누가·어떻게·어떤 데이터), 브라우저 확장으로 먼저 사용 지도화 → 정책 적용 | MCP 서버 위험 점수화 + 감사 로그 | 미확인 |

> 요청 후보였던 「Cloudflare Zero Trust 대시보드」「Microsoft Defender」는 AI 게이트웨이·정책 화면 관점에서 Cloudflare AI Gateway와 Entra로 대표했습니다.

### A-2. 영역별 비교 (MINT 관점)

| 영역 | 레퍼런스에서 반복되는 형태 | 출처 제품 |
|---|---|---|
| 첫 화면 | **카드 4~6개 → 시계열 1~2개 → 「누가·무엇이」 순위 표**. 표가 전부인 첫 화면은 없음 | TrueFoundry, Kong, Portkey, Datadog |
| 화면 쪼개기 | 자원 종류별 탭(모델/MCP/에이전트/guardrail) + 모든 탭 공통 시간 범위·필터 바·새로고침 | TrueFoundry, Kong(데이터셋 전환), Portkey |
| 요청 상세 | 목록 유지 + **우측 패널/드로어**, 안에 요청·응답·정책 판정·trace | Portkey, LiteLLM, Datadog, TrueFoundry |
| 차트→목록 | 차트 구간 선택 → 같은 필터의 요청 목록 | Kong(View requests), Entra(타일 클릭 필터) |
| 정책 상태 | **켜짐 / 보고 전용 / 꺼짐** 3상태 + 적용 전 영향 시뮬레이션 | Entra, Lakera(Detect/Enforce, Simulator) |
| 정책 효과 | 정책(검사)별 **검사 수·flag·mutate·block·실패·지연** 표 + 「걸리는 사람·앱」 순위 | TrueFoundry Guardrails 탭 |
| 판정 색 | flag=주황, block=빨강으로 고정 | Cloudflare |
| 미적용 가시화 | 정책이 적용 안 된 앱/자산을 따로 보여줌, 미승인(shadow) 항목 표 | Entra Coverage, Prompt Security |
| 승인 흐름 | AI 게이트웨이 제품 문서에는 승인 큐 화면이 **없음**. 가까운 것: Entra 「User action required」, Wiz Issue 배정·SLA·Jira | Entra, Wiz |
| 밀도·색 | 중립 바탕 + 판정색 소수. 카드 평평·얇은 테두리. 14px 기준 | 아래 B·C 참고 |

### A-3. MINT가 가져올 패턴 Top 7

1. **대시보드 = 카드 → 차트 → 순위 표 3단.** 카드 4~6개(허용·경보·제한·승인 대기·차단 5결정 + 호출 수, 전기간 대비 증감), 결정별 시간 추이 누적 막대/선 1개(기존 `stacked`), 「누가·무엇이」 순위 2개(사용자/엔드포인트·MCP 서버/도구, 기존 `bars`), 결정 비율 도넛(`donut`). 한 화면에 1440×900으로 카드와 문제 영역이 스크롤 없이 보이게. (TrueFoundry Overview, Kong Overview, Datadog Operational Insights)
2. **모든 화면 공통 필터 바** — 시간 범위 + 검색 + 저장된 필터 + 새로고침을 맨 위에 고정, 바꾸면 그 화면의 카드·차트·표가 함께 바뀜. (TrueFoundry, Kong Explorer, Entra 매개변수 줄)
3. **차트와 카드는 클릭하면 필터된 호출 기록으로 간다.** 기존 `onClick` 옵션을 쓰고, 이동 시 시간·결정·서버 조건을 URL에 싣기. 「View requests」식 드릴스루. (Kong, Entra 타일)
4. **호출 기록 = 목록 + 우측 드로어.** 목록 열: 시각·사용자/엔드포인트·MCP 서버·도구·결정(색 칩)·정책 일치 수. 드로어: 요청·응답, 어떤 정책이 어떤 판정을 냈는지(검사별 통과/실패·지연), 흐름(sankey 재사용 가능). 모달로 가리지 않기. (Portkey 로그 패널, LiteLLM 드로어, TrueFoundry trace)
5. **정책 화면 = 정책 표(상태 3종 + 효과 수치)와 적용 전 영향 미리보기.** 열: 정책 이름·상태(켜짐/보고 전용/꺼짐)·최근 7일 검사·경보·제한·차단·승인 요청 수·예외 수·마지막 변경. 「보고 전용」으로 바꾸면 실제 차단 없이 영향 타일(허용·차단 예정·승인 필요·미적용)만 집계. 정책별 「걸리는 사용자·서버」 순위. (Entra, Lakera Detect/Enforce·Simulator, TrueFoundry Guardrails 표)
6. **미적용·미승인 가시화 화면 요소.** 엔드포인트: MINT 적용/미적용 PC 비율 도넛 + 미적용 목록. AI 연결/MCP 서버: 승인된 서버 vs 발견된 미승인(그림자) 서버 표. 첫 화면에도 「조치 필요」 카드로 올림. (Entra Coverage, Prompt Security Shadow AI)
7. **승인 대기는 큐 + 드로어, 승인/거절은 같은 무게의 두 버튼.** 큐 표: 요청자·도구·사유·대기 시간(SLA 초과 강조). 드로어에서 호출 맥락(인자 요약·정책·최근 이력)을 보고 결정. 레퍼런스 제품에 이 화면이 없으므로 MINT 고유 화면으로 설계 — 이 부분만 Wiz Issue(담당·SLA)와 b-end 스킬의 「승인/반려 모두 보조 버튼」 규칙에서 빌림. 화면 이름도 「이 화면이 무엇을 하는지」 한 줄이 아니라 **상단 카드(대기 N·평균 대기·오늘 처리)로** 존재 이유를 보이기.

(밀도·색 규칙은 C절 값으로 따로 정함. 소유자 지적 「페이지가 왜 있는지 모르겠다」는 위 1·5·6·7에서 각 화면에 **카드 3~4개로 그 화면의 질문 하나에 답**하게 하는 것으로 해결.)

### A-4. 출처 URL

- Cloudflare 로그: https://developers.cloudflare.com/ai-gateway/observability/logging/
- Cloudflare 지표 5종: https://developers.cloudflare.com/ai-gateway/observability/analytics/
- Cloudflare Guardrails 블로그: https://blog.cloudflare.com/guardrails-in-ai-gateway/
- Portkey 기능 개요: https://portkey.ai/docs/introduction/feature-overview
- Portkey Analytics: https://portkey.ai/docs/product/observability/analytics
- Portkey Logs: https://portkey.ai/docs/product/observability/logs
- Portkey Guardrails: https://portkey.ai/docs/product/guardrails
- TrueFoundry Metrics Dashboard: https://www.truefoundry.com/docs/ai-gateway/analytics
- TrueFoundry 개요: https://www.truefoundry.com/docs/gateway/intro-to-llm-gateway
- TrueFoundry 요청 로그·trace(블로그): https://www.truefoundry.com/blog/gateway-tracing-request-logs
- Kong AI Gateway: https://developer.konghq.com/ai-gateway/
- Kong Explorer: https://developer.konghq.com/advanced-analytics/explorer/
- Kong AI Management 관측: https://developer.konghq.com/ai-management/observability/
- Kong AI Cost Management: https://developer.konghq.com/ai-cost-management/analytics-and-debugging/
- Datadog LLM Observability: https://docs.datadoghq.com/llm_observability/ , https://docs.datadoghq.com/llm_observability/monitoring/
- Entra 조건부 액세스 개요: https://learn.microsoft.com/en-us/entra/identity/conditional-access/overview
- Entra Insights and reporting: https://learn.microsoft.com/en-us/entra/identity/conditional-access/howto-conditional-access-insights-reporting
- Lakera 정책: https://docs.lakera.ai/docs/policies
- Docker MCP Toolkit: https://docs.docker.com/ai/mcp-catalog-and-toolkit/toolkit/
- Pomerium MCP: https://www.pomerium.com/docs/capabilities/mcp
- LiteLLM UI: https://docs.litellm.ai/docs/proxy/ui , https://docs.litellm.ai/docs/proxy/ui_logs
- Wiz(제3자 UX 분석): https://aledlie.vercel.app/reports/wiz-io-security-explainability-ux , Security Graph 소개 https://wiz.io/lp/wiz-security-graph
- CrowdStrike(참고, 공식 화면 문서 접근 불가): https://www.crowdstrike.com/en-us/resources/data-sheets/falcon-next-gen-siem-detections/
- Lasso: https://github.com/lasso-security/mcp-gateway , https://www.lasso.security/blog/why-mcp-agents-are-the-next-cyber-battleground
- Prompt Security(SentinelOne): https://www.sentinelone.com/platform/securing-ai-prompt/

### A-5. 한계 (정직하게)

- 로그인 뒤 실제 화면(Wiz·Falcon·Lasso·Prompt Security·Lakera 대시보드)은 보지 못했고, 위 표의 해당 칸은 [마케팅]/제3자 서술입니다. 화면 캡처 수준의 확인이 필요하면 데모 영상(공개 YouTube)을 별도로 봐야 합니다.
- 승인 흐름은 조사한 AI 게이트웨이 제품 어디에도 문서화된 화면이 없었습니다. MINT 고유 설계로 가야 합니다.

---

## B. GitHub 디자인 스킬 조사

별 수는 11-14 기준 `gh api`로 읽은 값입니다(집계 사이트 수치와 다름). 클론은 모두 `C:/work/ref-design/` 아래.

### B-1. 후보 비교

| 저장소 | 별 | 최근 푸시 | 라이선스 | 성격 | 관리 콘솔 적합도 | 클론 경로 |
|---|---|---|---|---|---|---|
| anthropics/skills (`frontend-design`) | 194k | 11-14 | **Apache-2.0**(스킬 폴더 LICENSE.txt. 저장소 메타는 null) | 「남들과 구별되는 미적 방향」 | **낮음**. 랜딩·브랜딩 지향(워밍 크림+테라코타 같은 기본값 금지, 타이포·카피 지침). 대시보드 규칙 없음. SKILL.md 1개 72줄 | `C:/work/ref-design/anthropics_skills/skills/frontend-design` |
| nextlevelbuilder/ui-ux-pro-max-skill | 149k | 11-10 | MIT | 검색형 데이터셋 + `search.py`(표준 라이브러리 Python). 스타일 90·색상 193·폰트·UX 가이드라인 121·**차트 25종**·제품 유형 193(각 제품의 「Dashboard Style」 열)·스택 22종 | **중간**. 차트 선택표(`charts.csv`: 언제 쓰고/쓰지 말 것·데이터 양·접근성)와 UX 가이드라인은 유용. 그러나 `--design-system`은 SaaS에 Glassmorphism 같은 스타일을 권하므로 「조용한 콘솔」과 충돌 | `C:/work/ref-design/nextlevelbuilder_ui-ux-pro-max-skill` (스킬 본체 `src/ui-ux-pro-max/`) |
| Nutlope/hallmark | 55k | 11-11 | MIT | 「AI 티 나는 화면」 방지 규칙 16개(Floor) + 테마 50종 + `sloplint.mjs` 린트 | 낮음~중간. 웹사이트·신규 페이지용(「기존 디자인에는 쓰지 말 것」 명시). 린트·Floor 규칙(토큰·`:focus-visible`·reduced-motion)은 참고 가능 | `C:/work/ref-design/Nutlope_hallmark` |
| heydamir/unslop | 16k | 11-08 | CC-BY-4.0(표기 필수) | 「AI 티 나는 UI」를 9단계로 고치는 리드레스 | 중간. 정리 절차는 쓸만하나 대시보드 전용 아님 | `C:/work/ref-design/heydamir_unslop` |
| **abdiraimov-otabek/dashboard-design-skill** | 462 | 11-09 | MIT | **대시보드 전용**. 127개 대시보드 화면·Few·Tufte 등에서 정리. SKILL.md 본문 + references 9개(layout·tokens·components·perception·qa·snippets 등) | **높음** | `C:/work/ref-design/abdiraimov-otabek_dashboard-design-skill` |
| **Ludi-Herry/b-end-design-system-skill** | 90 | 11-10 | MIT | **B2B 관리 콘솔 전용**(중국어). 6종 페이지 골격(조회 목록·폼·상세·**지표 대시보드**·설정·오류), 컴포넌트 선택 「부정 기준」, 모달 vs 드로어 판정, 15개 점검표, `audit-design-rules.py`(.html/.tsx/.vue 검사, Python 표준) | **높음** | `C:/work/ref-design/Ludi-Herry_b-end-design-system-skill` |
| (참고) ComposioHQ/awesome-claude-skills, VoltAgent/awesome-agent-skills | 79k / 37k | | 없음 / MIT | 목록집 | 스킬 자체 아님 | `C:/work/ref-design/ComposioHQ_awesome-claude-skills`, `.../VoltAgent_awesome-claude-skills` |

별이 큰 것(anthropics, ui-ux-pro-max)과 이 일에 맞는 것(대시보드·B-end 전용)이 다릅니다. plugin87/ux-ui-agent-skills(3k)는 클론이 비어 제외했습니다.

### B-2. 핵심 두 개의 구조

**dashboard-design (MIT)**
- `skills/dashboard-design/SKILL.md`: 순서 지시 — ①화면이 답할 질문 1개와 숫자 3~6개·문제 규칙·행동 정의 → ②숫자마다 형태 선택(위치·길이/막대, 히트맵은 격자에만, 목표 대비는 bullet, 추세는 sparkline) → ③레이아웃(헤더→KPI 카드→주 보기→분해→상세, 1440×900에서 KPI와 문제 영역이 스크롤 없이) → ④토큰 정의(라이트·다크) → ⑤컴포넌트 패턴 → ⑥모든 상태(로딩·오래됨·오류·빈·표본 적음) → ⑦3개 폭 스크린샷 QA.
- 핵심 규칙: 「Quiet」(건강한 데이터는 회색·한 색, 문제만 따뜻한 색), 「Wordless」(문장은 툴팁·빈 화면에만), 모든 headline 숫자에 **비교 기준 1개**, 숫자 같은 곳은 같게(두 번 나오면 일치), 기본 14px·아이콘 16px, 표는 tabular-nums·우측 정렬, 이전 기간은 회색 점선.
- 레이아웃 수치: 와이드 화면에서 열을 늘리고 좁은 열 + 빈 여백 금지(1800px부터 최대 ~1640px, 패널 4열), KPI 2→3→5열, 패널 1→2→4열, 카드 행에서 한쪽이 반쯤 비면 구조를 바꿈(「빈 구멍 금지」), 카드 `border + p-6`, 행 높이 40~44px, 헤어라인 ~7.5%.
- `references/tokens.md`는 `:root` 토큰 + 다크 값 + `light-dark()` 방법이 일반 CSS로 그대로 적혀 있음. `snippets.md`는 React+Tailwind라 「일반 HTML이면 클래스를 같은 토큰의 CSS로 옮겨라」고 명시. `qa.md`는 알려진 합계 검증·문구 수 감사·3폭 스크린샷.
- 주의: SKILL.md 끝에 **제작자 홍보 서명 줄**을 출력하라는 지시가 있음(「한 번만, 완성 시」). 우리 결과물에는 넣지 않도록 SKILL.md에서 그 절을 지우고 설치할 것. 또 「House style」(회색 바탕 흰 카드·`#3e63dd`)은 기본값이며 프로젝트 디자인 시스템이 우선한다고 스스로 적음 → MINT 토큰이 이김.

**b-end-design-system (MIT)**
- `SKILL.md`(6단계 워크플로: 요구 분해→템플릿 매칭→골격 PageHeader→FilterPanel→DataSection→BulkActionBar→선택 판정→원자 규칙→15개 점검).
- 쓸 만한 규칙: **한 영역에 주 버튼 1개**, **승인/반려 모두 보조 버튼**(색으로 유도 금지), 상세는 모달이 아니라 **우측 드로어**(목록 맥락 유지), 입력 폼이 있는 모달은 바깥 클릭으로 닫히지 않게, 위험 작업은 「무엇을·되돌릴 수 없음」을 쓰는 확인창과 동사 버튼, Badge는 연한 배경+진한 글자·업무 의미 있는 문구, 카드 기본 평평(그림자 없음, 0.5px 얇은 테두리), 강조색 1개, **글자 크기 4단계 이하**, 표·지표 숫자 tabular-nums, 지표 대시보드는 KPI 3~4개 + 같은 기간·**전기간 회색 점선 비교 토글**, 차트는 질문에 답해야 하며 1MB 넘는 차트 라이브러리 금지, 폭별 대응(768 미만은 표를 카드 목록으로).
- `references/05-…` 「지표 대시보드」「조회 목록」 골격, `references/07-…` 점검표, `scripts/audit-design-rules.py`(정규식 규칙 기반 린트).
- 주의: 본문이 중국어. 규칙 일부는 Tailwind/React(`maskClosable`, `lucide-react`) 가정이며 `templates/*.tsx`는 우리 저장소에 맞지 않아 쓰지 않음. 린트는 정규식이라 전부를 대체하지 못함(문서가 스스로 밝힘).

**ui-ux-pro-max (MIT, 선택적 데이터 조회용)**
- 구조: `src/ui-ux-pro-max/data/*.csv`(charts·ux-guidelines·styles·colors 등) + `scripts/search.py`(`--domain chart|ux|style`, `--stack html-tailwind`, `--design-system [--persist]`). Windows는 `python`으로 실행. 클론에서 `python --version` = 3.12.10 확인.
- 사용 가능한 부분: `--domain chart "…"`로 차트 선택·쓰면 안 되는 경우·데이터량 기준, `--domain ux`로 접근성·상태 가이드. 스택 목록에 바닐라 JS/자체 CSS가 없고(html-tailwind가 가장 가까움) 프레임워크 규칙은 적용 불가.
- 사용하지 말 것: `--design-system` 자동 생성(SaaS = Glassmorphism 등 장식 지향). 

### B-3. 추천

**1순위: `abdiraimov-otabek/dashboard-design-skill`** (https://github.com/abdiraimov-otabek/dashboard-design-skill, MIT, 클론 `C:/work/ref-design/abdiraimov-otabek_dashboard-design-skill`)
이유: 소유자 지적 4가지(표뿐·그래프 없음·여백·화면 이유)에 직접 대응하는 유일한 스킬 — 「화면 1개 = 질문 1개」, 숫자별 차트 형태 선택, 한 화면 레이아웃, 「빈 구멍 금지」 규칙, 토큰 우선, 스크린샷 QA. 설명을 줄이는 「Wordless」는 소유자의 「설명 없는 탭·차트 UI」 기존 지시와 일치.

**2순위: `Ludi-Herry/b-end-design-system-skill`** (https://github.com/Ludi-Herry/b-end-design-system-skill, MIT, 클론 `C:/work/ref-design/Ludi-Herry_b-end-design-system-skill`)
이유: 승인·목록·드로어·정책 표·확인창 같은 **관리 콘솔의 비대시보드 화면**을 다루는 규칙이 있고, 린트 스크립트가 .html을 검사. 1순위가 대시보드만 다루는 빈틈을 채움.

**보조: ui-ux-pro-max `search.py`는 설치하지 않고 필요할 때 `--domain chart`만 조회**(149k 별로 인지도는 높으나 콘솔에 필요한 부분은 chart·ux 표뿐). anthropics `frontend-design`은 로그인·소개 페이지가 아니면 쓰지 말 것(「위험을 감수하는 미적 선택」 지시가 조용한 관리 콘솔과 어긋남).

### B-4. 이 저장소(바닐라 JS·자체 CSS·`charts.mjs`·프레임워크 없음)에 적용하는 구체 방법

1. **설치**: 두 스킬 폴더를 `.claude/skills/dashboard-design/`, `.claude/skills/b-end-design-system/`로 복사(SKILL.md + references만. `templates/*.tsx`, `snippets.md`의 Tailwind 부분은 제외). dashboard-design의 SKILL.md 「Sign-off」절 삭제. 두 SKILL.md 앞에 「이 저장소는 프레임워크가 없고 `console.css` 토큰이 우선, 차트는 `charts.mjs`(ECharts)만 쓴다」는 3줄 덧붙임(스킬이 「프로젝트 디자인 시스템이 이긴다」고 허용함).
2. **토큰 매핑**: 이미 있는 `--ink/--ink-2/--ink-3/--brand/--panel/--line/--allow/--alert/--restrict/--approval/--block`이 스킬의 `ink/muted/line/accent/…`에 대응. 신규 토큰은 **간격·행 높이·카드 그리드**만 추가: `--row-h:36px`(compact 32px), `--pad-card:16px`, `--gap:12px`, 기본 글자 14px/표 13px 단계(현재 15.75px 기준을 한 번에 낮추지 말고 대시보드 화면에서 먼저 14px 적용). 판정색은 flag=경보색, block=차단색으로 고정(Cloudflare 방식).
3. **화면마다 「질문 1개·숫자 3~6개·문제 규칙·행동」 표를 먼저 작성**(스킬 1단계). 이 표가 A-3의 Top 7과 합쳐져 화면별 설계서가 됨. 예: 대시보드 = 「오늘 MINT가 막은 것과 사람이 봐야 할 것은?」 → 카드(승인 대기·차단·경보·미적용 PC 수), 결정별 추이(`stacked`), 상위 서버/사용자(`bars`), 결정 비율(`donut`).
4. **차트 연결**: 새 차트 라이브러리 없이 `charts.mjs`의 `stacked/donut/bars/sankey`만 사용(b-end 스킬의 「무거운 차트 금지」와도 일치). KPI의 sparkline·bullet만 필요하면 인라인 SVG 20줄 이내로 `charts.mjs`에 `spark()`·`kpiBar()`를 추가(ECharts 인스턴스를 카드마다 만들지 않도록).
5. **검증 루프**: ①`python C:/…/b-end-design-system/scripts/audit-design-rules.py <console 폴더>`(스크립트는 스킬 설치 폴더 기준 절대 경로로 실행, 문서가 명시) ②dashboard-design의 `qa.md` 순서 — 알려진 합계 검증(고정 시드 데이터), 문구 수 감사, 1440×900·768·375 스크린샷 — 을 Playwright 또는 브라우저 스크린샷으로. 이미 쓰는 시험 절차(스크린샷 보고)와 결합.
6. **페이지 목적 문구는 화면 안에 넣지 않고** 상단 카드의 숫자와 빈 화면(empty state) 한 줄로만 표현(스킬의 Wordless 규칙). 소유자의 「페이지가 왜 있는지 모르겠다」는 문장 설명이 아니라 그 화면의 카드가 답하는 질문으로 풀기.

---

## C. 관리 콘솔 밀도·레이아웃 기준 수치

| 출처 | 값 | URL |
|---|---|---|
| **Carbon 데이터 표** | 행 높이 xs 24 / sm 32 / md 40 / **lg 48(기본)** / xl 64px. 열 좌우 padding 16px. 열 머리 14px 600, 행 글자 14px 400. 표 머리말 위 16px·아래 24px. 얼룩 줄(zebra)은 레이어 토큰 | https://carbondesignsystem.com/components/data-table/style/ |
| **Carbon 2x 그리드** | 중단점 320(4열)·672(8열)·1056(16열)·1312(16열)·1584(최대, 16열). 열 padding 16, 합계 gutter 32px, margin 0~24px. gutter 없는 그리드(밀접 콘텐츠)도 허용 | https://carbondesignsystem.com/elements/2x-grid/overview/ |
| **Carbon 대시보드 지침** | 수치 규칙은 없음. 질적 규칙: 중요한 데이터를 가장 크고 대비 높게, 위쪽 F 패턴, 필수 지표만, 한 데이터 집합은 한 색, 탐색형은 차트 레이아웃·범례 위치 통일, 필터/확대 시 연결 차트 갱신 | https://carbondesignsystem.com/data-visualization/dashboards/ |
| **Ant Design 표** | large(기본) 셀 padding 세로 16/가로 16, middle 12/8, small 8/8, 글자 모두 14px. small은 「모달 안에서만」. (행 높이는 문서에 없음. line-height 22px로 계산하면 약 54/46/38px) | https://ant.design/components/table |
| **Atlassian 간격 토큰** | 기준 8px: 2·4·6·**8**·12·16·20·24·32·40·48·64·80. 작은 값(0~8)은 아이콘-글자·배지·입력 내부, 중간(12~24)은 버튼·카드 항목, 큰 값(32~80)은 섹션 간 | https://atlassian.design/foundations/spacing |
| **Material 3 창 크기 클래스** | compact <600 / medium 600~839 / expanded 840~1199 / large 1200~1599 / extra-large ≥1600dp (large·extra-large는 데스크톱용으로 추가된 구간) | https://developer.android.com/develop/ui/compose/layouts/adaptive/use-window-size-classes |
| dashboard-design 스킬 | 기본 14px(조밀 표 13px), 보조 12~13px, KPI 값 28~32px, 패널 제목 15~16px, 카드 padding 24 + 내부 행 40~44px, 아이콘 16px, 헤어라인 ~7.5% 투명도, 와이드 화면 열 늘리기(1800px 이상 최대 ~1640) | 클론 `references/layout.md`, `tokens.md` |
| b-end 스킬 | 글자 4단계 이하, 한 영역 주 버튼 1개, 경계선 0.5px 계열, 카드 그림자 없음 | 클론 `SKILL.md` |

### MINT 권장값 (위 수치를 종합한 제안, 아직 검증 전)

| 항목 | 현재 | 권장 | 근거 |
|---|---|---|---|
| 표 행 높이 | ~48px | 기본 **36~40px**, 호출 기록처럼 많은 행은 compact 32px | Carbon md 40 / sm 32 |
| 표 셀 padding | 12×16 | 8~10×12 | Ant middle(12/8), small(8/8) |
| 카드/패널 padding | 18~20 | **16** | Carbon·Atlassian space.200 |
| 카드 간 gap | 20 | **12~16** | Atlassian 12~16, Carbon gutter 16+16 |
| KPI 카드 | 값만 33.75px | 값 28~32px + 전기간 증감 + 작은 추세선, 행당 4~6개 | dashboard-design, Portkey/TrueFoundry |
| 본문 여백 | 28/32 | 20/24 | Carbon margin 16~24 |
| 기본 글자 | 15.75 | 대시보드·표 14, 나머지 15 | 레퍼런스 전부 14px |
| 레이아웃 폭 | max 1600 | 대시보드만 와이드(최대 ~1640, 1800+에서 패널 4열) | dashboard-design |
| 조회 화면 구성 | | 헤더(제목+상태) → 필터 바(시간·검색·저장) → 카드 → 차트 → 표(+우측 드로어) | A절 공통 |

위 권장값은 레퍼런스 수치에 맞춘 제안이며, 적용 시 1440×900과 768에서 스크린샷으로 확인해야 합니다.
