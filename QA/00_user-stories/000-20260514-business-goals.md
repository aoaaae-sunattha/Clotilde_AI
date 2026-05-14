# Business Goals — Clotilde
**Version:** 1.0
**Author:** Business Goals Agent (AI-assisted)
**Date:** 2026-05-14
**Input:** CLAUDE.md · readme.md · QA_Master_Plan_Claire_AmexGBT.docx · CLOTILDE_QA_COVERAGE_ANALYSIS.md
**Status:** Confirmed — Ready for PM/PO Story Writing (Step 001)

---

## Primary Business Objective

Clotilde will simulate Claire (AmexGBT's AI travel assistant) as a Telegram bot so that QA Engineers can demonstrate all 5 pillars of AI travel system quality and the 12 QA Master Plan sections in an interview context, with a working system that proves test coverage.

---

## Business Goals

| Goal ID | Goal Name | Description | Success Metric | Priority |
|---------|-----------|-------------|----------------|----------|
| BG-01 | Flight Booking Pipeline | End-to-end flight search → policy check → confirm → PNR written to bookings.json | PNR generated on 100% of confirmed bookings; no duplicate PNRs | P0 |
| BG-02 | Policy Compliance Engine | Budget caps, cabin class rules, and preferred airline ranking enforced at API level before results displayed | test_policy.js 100% pass; is_compliant field correct on every result | P0 |
| BG-03 | NLU Quality (IRA) | Intent recognition accuracy measurable via golden dataset regression | run_tests.js ≥ 80% accuracy; FGR ≥ 90% on price grounding | P0 |
| BG-04 | Human Escalation Handoff | escalate_to_human triggered correctly with full context packet delivered to agent | Escalation fires on all humanAgentTriggers; context packet contains full history | P1 |
| BG-05 | Approval Workflow | Out-of-policy bookings route to justification → manager approve/reject → PNR on approval | Approval flow completes end-to-end; rejected booking does not generate PNR | P1 |
| BG-06 | Notification Delivery | 17 Telegram notification types delivered reliably to correct chat_id | notify.js sends correct payload; chat_registry.json resolves employee_id → chat_id | P1 |
| BG-07 | Hotel Booking Pipeline | Hotel search → compliance flag → confirm → reference written to bookings.json | Hotel reference generated on confirm; is_compliant correct per city cap | P1 |
| BG-08 | Admin Management | admin.js REPL allows list/update/notify operations on bookings | All 4 admin tools callable; correct booking records returned | P2 |
| BG-09 | Multi-channel Support | Slack/Teams channel integration | Deferred — Telegram only for MVP | P2 |
| BG-10 | Live GDS Integration | Duffel live search + graceful fallback to mock on error | Duffel fallback fires on API failure; mock results returned within 2s | P2 |

---

## Key User Outcomes

| Persona | What they want | What success looks like | Business Goal(s) |
|---------|---------------|------------------------|-----------------|
| Operations / Staff | Book a compliant economy flight via Telegram | PNR confirmed, no policy violation, booking in bookings.json | BG-01, BG-02 |
| Manager / Senior | Search flights and approve team bookings | Approval flow routes correctly, manager receives Telegram notification | BG-05, BG-06 |
| Director / VP | Business class travel + view pending approvals | Business class allowed for their role; approval buttons functional | BG-02, BG-05 |
| Admin (HR / Ops) | Manage all bookings and send disruption alerts | admin.js lists/updates bookings; notify.js delivers 17 notification types | BG-06, BG-08 |
| QA Engineer (Interviewer audience) | See 5-pillar QA coverage demonstrated live | run_tests.js + test_policy.js both run green; escalation + approval demoed | BG-01–BG-07 |

---

## Critical Flows — P0 (Must Not Fail)

| Flow ID | Flow Name | Entry Point | Exit Condition | Business Goal |
|---------|-----------|-------------|----------------|---------------|
| F-01 | Role Selection | /start command in Telegram | Role confirmed, traveler profile loaded, chat_id registered | BG-01, BG-02 |
| F-02 | Flight Search | User sends flight intent message | search_flights called with valid IATA codes + date; results displayed with policy flags | BG-01, BG-03 |
| F-03 | Policy Compliance Check | Flight/hotel result returned by mock | is_compliant and is_preferred fields correct per policy.js rules | BG-02 |
| F-04 | Booking Confirm | User clicks Confirm button | PNR generated (6-char), booking written to bookings.json, confirmation sent | BG-01 |
| F-05 | NLU Regression | node run_tests.js executed | ≥ 80% accuracy on 15 golden dataset cases; FGR section passes | BG-03 |
| F-06 | Policy Boundary Test | node test_policy.js executed | 100% of 41 boundary tests pass | BG-02 |
| F-07 | Human Escalation | User sends escalation trigger word (lost, visa, medical…) | escalate_to_human tool called; context packet built; user offered human agent | BG-04 |
| F-08 | Approval Workflow | Out-of-policy option selected + confirmed | Justification collected, approval record written, manager notified, approve/reject buttons functional | BG-05 |

---

## Out of Scope (This Release)

| Area | Reason |
|------|--------|
| Playwright E2E (web browser) | No web interface — Telegram bot only; Node.js + Axios API tests substitute |
| Slack / MS Teams channel | Not implemented; deferred to BG-09 future sprint |
| Workday HR sync | travelers.yml static profiles; live HR sync deferred |
| SAP Concur webhook | bookings.json local store; Concur integration deferred |
| Okta / Azure AD SSO | Bot token auth only for MVP |
| Performance / load tests (k6) | Future sprint — no k6 infrastructure |
| Visual regression testing | No web UI to screenshot |
| Rescheduling workflow | Not implemented in v3.0; noted in CLOTILDE_QA_COVERAGE_ANALYSIS.md |
| Traveler-initiated cancellation | Admin-only cancel in v3.0; traveler flow deferred |
| Currency conversion | Fixed THB pricing; FX conversion deferred |

---

## Traceability Forward

Every user story in Step 001 must reference at least one BG-ID from this table.
Every test case in Phase 2 must trace to at least one BG-ID via a story.
Test cases with no BG trace are out of scope.

**Active BG-IDs for this pipeline run:** BG-01, BG-02, BG-03, BG-04, BG-05, BG-06, BG-07
**Deferred (P2):** BG-08, BG-09, BG-10

---

*Business Goals Agent v1.0 | Agentic QA Pipeline v3.0 | 2026-05-14*
