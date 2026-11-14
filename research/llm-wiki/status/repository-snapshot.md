# 저장소 코드 스냅샷

확인 시각: 2026-11-14T18:20:28+09:00

HEAD: `47c91a731389ac36fd6685b1b148b6586c6c7636` · 로컬 브랜치: `console-redesign`

로컬 코드 상태입니다. 배포·활성화·실기기 검증과 실험 성공을 증명하지 않습니다.

## 워킹 트리

```text
M .github/actions/compose-cache/index.cjs
 M .github/ci/compose-cache.test.cjs
 M VERSION
 M docs/ai/architecture/components.psv
 M endpoint-agent/install-windows.ps1
 M endpoint-agent/install.cmd
 M endpoint-agent/setup.ps1
 M endpoint-agent/tray.ps1
 M endpoint-agent/windows-common.ps1
 M endpoint-agent/windows-oneclick.ps1.in
 M endpoint-agent/windows-trust.ps1
 M endpoint-agent/windows-worker.ps1
 M full_stack_lab/field/console/file.caddy
 M full_stack_lab/field/console/none.caddy
 M full_stack_lab/field/console/tailscale.caddy
UU full_stack_lab/gateway/app/agent_service.py
M  full_stack_lab/gateway/app/agent_static/console-state.mjs
UU full_stack_lab/gateway/app/agent_static/console.css
UU full_stack_lab/gateway/app/agent_static/console.js
UU full_stack_lab/gateway/app/agent_static/i18n-en.mjs
A  full_stack_lab/gateway/app/agent_static/screens.mjs
M  full_stack_lab/gateway/app/endpoint_plane.py
M  full_stack_lab/gateway/app/main.py
M  full_stack_lab/tests/approved-mcp-console.test.mjs
UU full_stack_lab/tests/console-ia.test.mjs
M  full_stack_lab/tests/dev73_review2_check.py
M  full_stack_lab/tests/intake_d189_ui_check.mjs
M  full_stack_lab/tests/intake_one_click_ui_check.mjs
M  full_stack_lab/tests/local_run_presets_check.py
M  full_stack_lab/tests/notion-bugs-ui.test.mjs
M  full_stack_lab/tests/people-pages.test.mjs
M  full_stack_lab/tests/sbom_impact_check.py
A  full_stack_lab/tests/screens.test.mjs
UU full_stack_lab/tests/user_credential_check.py
 M research/collaboration-console/install-autostart.ps1
 M research/collaboration-console/run-console.ps1
 M research/collaboration-console/uninstall-autostart.ps1
 M research/llm-wiki/analysis/field-tls-d124/build-wiki.log
 M research/llm-wiki/analysis/field-tls-d124/capture-status.log
 M research/llm-wiki/analysis/field-tls-d124/check-wiki.log
 M research/llm-wiki/analysis/field-tls-d124/diff-whitespace.log
 M research/llm-wiki/analysis/field-tls-d124/kit-offline-regression.log
 M research/llm-wiki/analysis/field-tls-d124/map-threats.log
 M research/llm-wiki/analysis/field-tls-d124/merge-cached-diff-check.log
 M research/llm-wiki/analysis/field-tls-d124/merge-field-kit.log
 M research/llm-wiki/analysis/field-tls-d124/merge-open-endpoints.log
 M research/llm-wiki/analysis/field-tls-d124/merge-tls-unit.log
 M research/llm-wiki/analysis/field-tls-d124/merge-windows-kit.log
 M research/llm-wiki/analysis/field-tls-d124/open-endpoints.log
 M research/llm-wiki/analysis/field-tls-d124/tls-unit.log
 M research/llm-wiki/analysis/integration-cases.json
 M research/llm-wiki/analysis/kit-macos/checks.log
 M research/llm-wiki/analysis/local-endpoints-1021/binding-profile.apparmor
 M research/llm-wiki/analysis/real-env-20261020/e13/control-claude-cfg-145959.out
 M research/llm-wiki/analysis/real-env-20261020/e13/control-claude-fs-145744.out
 M research/llm-wiki/analysis/real-env-20261020/e13/control-claude-ghidra-145931.out
 M research/llm-wiki/analysis/real-env-20261020/e13/control-claude-git-145809.out
 M research/llm-wiki/analysis/real-env-20261020/e13/control-claude-pw-145902.out
 M research/llm-wiki/analysis/real-env-20261020/e13/control-claude-sqlite-145835.out
 M research/llm-wiki/analysis/real-env-20261020/e13/managed-claude-cfg-145054.out
 M research/llm-wiki/analysis/real-env-20261020/e13/managed-claude-fs-144647.out
 M research/llm-wiki/analysis/real-env-20261020/e13/managed-claude-fsx-145502.out
 M research/llm-wiki/analysis/real-env-20261020/e13/managed-claude-ghidra-145006.out
 M research/llm-wiki/analysis/real-env-20261020/e13/managed-claude-ghx-145548.out
 M research/llm-wiki/analysis/real-env-20261020/e13/managed-claude-git-144754.out
 M research/llm-wiki/analysis/real-env-20261020/e13/managed-claude-pw-144912.out
 M research/llm-wiki/analysis/real-env-20261020/e13/managed-claude-pwx-145637.out
 M research/llm-wiki/analysis/real-env-20261020/e13/managed-claude-sqlite-144834.out
 M research/llm-wiki/analysis/real-env-20261020/e13/managed-codex-cfg-145413.out
 M research/llm-wiki/analysis/real-env-20261020/e13/managed-codex-fs-145132.out
 M research/llm-wiki/analysis/real-env-20261020/e13/managed-codex-ghidra-145341.out
 M research/llm-wiki/analysis/real-env-20261020/e13/managed-codex-git-145203.out
 M research/llm-wiki/analysis/real-env-20261020/e13/managed-codex-pw-145309.out
 M research/llm-wiki/analysis/real-env-20261020/e13/managed-codex-sqlite-145238.out
 M research/llm-wiki/analysis/real-env-20261020/t3/t3-context7-run1.log
 M research/llm-wiki/analysis/real-env-20261020/t3/t3-context7.log
 M research/llm-wiki/analysis/requirements.json
 M research/llm-wiki/analysis/user-command-settings/new-tests.log
 M research/llm-wiki/analysis/user-command-settings/wiki-build.log
 M research/llm-wiki/analysis/user-command-settings/wiki-check.log
 M research/llm-wiki/catalogs/threats.json
 M research/llm-wiki/experiments/2026-10-20-latency-ab-context7-pj1-run1-aborted.csv
 M research/llm-wiki/experiments/2026-10-20-latency-ab-context7-pj1.csv
 M research/llm-wiki/experiments/local-tools/desktop/blender-requirements.lock
 M research/llm-wiki/experiments/local-tools/desktop/start-blender.ps1
 M research/llm-wiki/experiments/local-tools/desktop/stop-blender.ps1
 M research/llm-wiki/experiments/local-tools/reverse/run_probe.ps1
 M research/llm-wiki/integrations/lab/openbao/app-read.hcl
 M research/llm-wiki/integrations/lab/openbao/operator.hcl
 M research/llm-wiki/integrations/lab/openbao/requirements.lock
 M research/llm-wiki/integrations/lab/openbao/server.hcl
 M research/llm-wiki/status/reports/2026-10-14-risk-implementation.patch
```

## 주요 파일 바이트

| 파일 | SHA-256 |
| --- | --- |
| `full_stack_lab/gateway/app/core.py` | `49fe992647f0b3ade65e08256c3e732f2fba14fffa84f05cd3b80b58445c66a2` |
| `full_stack_lab/gateway/app/pac.py` | `2b8330a69b4c99794d31a3a88a38f650ba00ce0cee156501ab35b0fd5359ea1a` |
| `full_stack_lab/gateway/app/poisoning.py` | `20ed5c39e624d71308bf396dcaa1decdadc406404bf2565643c82fce7576dc74` |
| `full_stack_lab/gateway/app/idp.py` | `30b0e4aec24a40b1847bb23852651a60fe7c1f81cdef97690ea948e03901fd8f` |
| `full_stack_lab/gateway/app/privacy.py` | `fe7511a3482184faa983c9bcd89f0ef49376c8a3ffce8b8bf3c9495212ef25f3` |
| `full_stack_lab/gateway/app/secret_scan.py` | `6173e8e4db7337df6ab61d0f029a7ecd0bdd1fd2005c9cf1f63a69ce49084054` |
| `full_stack_lab/opa/pac15.rego` | `d63fd5d6d9f2cdf765b3e94e740c9f8916cf653f76ee0fae82689f2de46fa4fa` |
| `full_stack_lab/opa/decision.rego` | `b6fe334869e38016dd043489b2c3f63207adc5a54fbef199738517b815a9b904` |
| `endpoint-agent/bootstrap.py` | `807821b39386c188039493450833adf82fd8d5ba1a594f02054a30ceb0a99bf8` |
| `endpoint-agent/managed-linux.py` | `95157db8a92070113b7d5188933dbc3bb58b731b87819b58a7ea0f748522d653` |
| `endpoint-agent/enforce-linux.py` | `998f7ef1df87e9298e97cf42c483300d23787c506a05527b85e052f0ebb9e5c2` |
