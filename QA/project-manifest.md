# Project Manifest: Clotilde
**Created:** 2026-05-14
**Confirmed by:** PM/PO
**Pipeline version:** PIPELINE.md v3.0

---

## Project Metadata

- **App URL:** N/A — Telegram bot (no web URL; webhook endpoint via node-telegram-bot-api)
- **Auth method:** Bot token only (TELEGRAM_BOT_TOKEN in .env) — no user-facing auth
- **Project type:** Telegram Bot / API-only
- **Story source:** Local file — `QA/00_user-stories/002-20260514-CLOTILDE-final.md`
- **Notion linked:** No
- **Total stories:** 27 (12 P0 · 15 P1)
- **Total test IDs:** 82 (POL · NLU · FGR · INT · CLI · MAN)

---

## Active Pipeline for Clotilde

| Order | Skill File | Status | Notes |
|-------|-----------|--------|-------|
| 000 | 04_skill-selector.md | ✅ Complete | This file — confirmed 2026-05-14 |
| 001 | 09_read-user-story.md | ✅ Complete | 7 requirements files — 86 total ACs |
| 002 | 10_comp-manual-test-case.md | ✅ Complete | 91 COMP tests across EP-01–07 |
| 003 | 11_e2e-manual-test-case.md | ✅ Complete | 80 E2E tests across EP-01–07 |
| 004 | 12_exploratory-testing.md | ⚠️ Pending (manual gate) | 11 MAN scenarios; requires live bot — pre-merge only |
| 005 | node-integration-test.md | ✅ Complete | 82 INT tests passing (INT-001–089) |
| 006 | cli-automation.md | ✅ Complete | 15 CLI tests passing (CLI-001–015) |
| 007 | EX05_role-permission.md | ✅ Complete | 25 ROL tests · INT-086–089 in role-permission.test.js |
| 008 | 14_test-healer.md | ✅ Complete | 1 Type B (INT-014); 0 Type D · fix-proposals.md saved |
| 009 | 15_report-writer.md | ✅ Complete | SHIP WITH KNOWN ISSUES · 06-CLOTILDE-final-report.md |
| 010 | 16_git-commit.md | ✅ Complete | PR #1 merged to main — 2026-05-14 |

---

## Skipped Skills

| Skill | Reason |
|-------|--------|
| 13_test-generator.md (Playwright) | No web UI — Telegram bot only; replaced by node-integration-test + cli-automation |
| EX01_accessibility.md | No web UI to audit; Telegram renders its own interface |
| EX02_performance.md | No formal load-test SLA; 2s fallback timing covered by INT-023 |
| EX03_api-contract.md | Telegram webhook API coverage handled by L3 integration tests |
| EX04_visual-regression.md | No web UI to screenshot |
| EX07_mobile-viewport.md | No web UI; Telegram mobile handled by Telegram itself |
| EX08_test-data-manager.md | No SQL database; file reset handled by reset-test-data.js fixture |

---

## New Skills Pending Creation

| Skill ID | File | Spec Location | Trigger | Due Before |
|----------|------|--------------|---------|------------|
| NEW-L3 | `node-integration-test.md` | QA-MASTER-TEST-PLAN.md §6.1 | Telegram bot: no web UI for Playwright | S1 batch S1a |
| NEW-L4 | `cli-automation.md` | QA-MASTER-TEST-PLAN.md §6.2 | CLI script automation for notify.js | S1 batch S1b |

---

## Story Source Index

| Story ID | Epic | Priority | Status |
|----------|------|----------|--------|
| US-001 | EP-01 Flight Booking | P0 | Ready |
| US-002 | EP-01 Slot Filling | P0 | Ready |
| US-003 | EP-01 Duffel Fallback | P0 | Ready |
| US-004 | EP-01 Idempotency | P1 | Ready |
| US-005 | EP-02 Compliance Display | P0 | Ready |
| US-006 | EP-02 Out-of-Policy Flag | P0 | Ready |
| US-007 | EP-02 Boundary Tests | P0 | Ready |
| US-008 | EP-02 Cabin Class | P0 | Ready |
| US-009 | EP-02 Justification Flow | P0 | Ready |
| US-010 | EP-03 NLU Suite | P0 | Ready |
| US-011 | EP-03 Slang/Synonyms | P0 | Ready |
| US-012 | EP-03 Negation | P0 | Ready |
| US-013 | EP-03 FGR | P0 | Ready |
| US-014 | EP-03 Out-of-Scope | P1 | Ready |
| US-015 | EP-04 Escalation Trigger | P1 | Ready |
| US-016 | EP-04 Context Packet | P1 | Ready |
| US-017 | EP-04 Fallback Contact | P1 | Ready |
| US-018 | EP-05 Approval Flow | P1 | Ready |
| US-019 | EP-05 Rejection Flow | P1 | Ready |
| US-020 | EP-05 Self-Approval Block | P1 | Ready |
| US-021 | EP-05 In-Policy Skips | P1 | Ready |
| US-022 | EP-06 Notification Delivery | P1 | Ready |
| US-023 | EP-06 Unknown Employee | P1 | Ready |
| US-024 | EP-06 17 Notification Types | P1 | Ready |
| US-025 | EP-07 Hotel Booking | P1 | Ready |
| US-026 | EP-07 Hotel Cap Boundary | P1 | Ready |
| US-027 | EP-07 Hotel Out-of-Policy | P1 | Ready |

---

## Sprint → Skill Mapping

| Sprint | Batch | Skills Active | Stories |
|--------|-------|--------------|---------|
| S0 | S0 | test_policy.js · run_tests.js · 09 · 10 · 11 · 15 · 16 | US-005–013, US-026 |
| S1 | S1a | 09 · 10 · 11 · node-integration-test · 14 · 15 · 16 | US-001–004, US-009, US-017, US-020–021, US-025, US-027 |
| S1 | S1b | cli-automation · 14 · 15 · 16 | US-022–024 |
| S1 | S1c | 12 (manual Telegram) · EX-05 | US-014–016, US-018–019 |
| S2 | S2 | Manual demo · 15 · 16 | BG-08 admin demo |

---

## Key Decisions Made During Selection

- **Playwright SKIPPED:** No web URL exists for this Telegram bot. Node.js integration test skill replaces it entirely at L3.
- **EX-03 API contract SKIPPED:** Telegram webhook API is fully covered by L3 integration tests (INT-001 through INT-074); no separate API contract layer needed.
- **EX-05 role-permission ACTIVE:** 5 distinct roles with different cabin class entitlements, approval routing, and policy caps — role matrix testing is required.
- **EX-08 SKIPPED:** No SQL database; bookings.json and chat_registry.json reset via a lightweight Node.js fixture script instead.
- **L5 manual tests excluded from CI:** Live Telegram connection cannot run headlessly; MAN-* tests run manually before each PR merge.

---

*Project Manifest v1.0 | Agentic QA Pipeline v3.0 | Confirmed: 2026-05-14*
