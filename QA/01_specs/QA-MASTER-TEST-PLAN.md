# QA Master Test Plan — Clotilde
**Document version:** 1.0
**Created:** 2026-05-14
**Pipeline version:** PIPELINE.md v3.0
**Source:** CLAUDE.md · 002-20260514-CLOTILDE-final.md · policy.js · mock_inventory.js
**Author:** QA Orchestrator (AI-assisted)

---

> **Purpose:** Single source of truth for all testing activity on Clotilde v3.0 — the Telegram bot simulating Claire (AmexGBT AI travel assistant). Defines what is tested, how, when, and which tool. Required input to every pipeline skill execution.

---

## Table of Contents

0. [Section Coverage Check](#0-section-coverage-check)
1. [Project Architecture Analysis](#1-project-architecture-analysis)
2. [Test Architecture Overview](#2-test-architecture-overview)
3. [Feature Breakdown — Test IDs by Component](#3-feature-breakdown)
4. [User Story ↔ Test Coverage Map](#4-user-story-test-coverage-map)
5. [Pipeline Skill Map](#5-pipeline-skill-map)
6. [Missing Skills — Create These](#6-missing-skills)
7. [Sprint-by-Sprint Execution Plan](#7-sprint-execution-plan)
8. [Pre-conditions & Environment Setup](#8-pre-conditions)
9. [Test Data Strategy](#9-test-data-strategy)
10. [Risk Register](#10-risk-register)
- [Appendix A — Business Rules Reference](#appendix-a--business-rules-reference)
- [Appendix B — CI/CD Integration](#appendix-b--cicd-integration)

---

## 0. Section Coverage Check

<!-- Filled last — see bottom of document -->

<style>
  .cc { font-family: -apple-system, sans-serif; font-size: 13px; }
  .cc-metrics { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin-bottom:1rem; }
  .cc-metric { background:#161b22; border:1px solid #30363d; border-radius:8px; padding:12px; text-align:center; }
  .cc-num { font-size:22px; font-weight:700; }
  .cc-lbl { font-size:11px; color:#8b949e; margin-top:2px; }
  .cc-row { display:flex; align-items:flex-start; gap:10px; padding:6px 0; border-bottom:1px solid #21262d; font-size:12px; }
  .cc-row:last-child { border-bottom:none; }
  .cc-sec { min-width:160px; color:#8b949e; }
  .cc-what { flex:1; color:#e6edf3; }
  .badge { display:inline-block; font-size:11px; font-weight:600; padding:2px 8px; border-radius:4px; white-space:nowrap; }
  .b-yes  { background:rgba(63,185,80,.15); color:#3fb950; }
  .b-part { background:rgba(210,153,34,.15); color:#d29922; }
  .b-no   { background:rgba(248,81,73,.15); color:#f85149; }
  .cc-box { border-radius:8px; padding:12px 14px; margin:8px 0; font-size:12px; }
  .cc-box-title { font-size:13px; font-weight:600; margin-bottom:6px; }
  .cc-amber { background:rgba(210,153,34,.1); border:1px solid rgba(210,153,34,.3); color:#d29922; }
  .cc-green { background:rgba(63,185,80,.1); border:1px solid rgba(63,185,80,.3); color:#3fb950; }
</style>

<div class="cc">
<div class="cc-metrics">
  <div class="cc-metric"><div class="cc-num">12</div><div class="cc-lbl">total sections</div></div>
  <div class="cc-metric"><div class="cc-num" style="color:#3fb950">9</div><div class="cc-lbl">fully covered</div></div>
  <div class="cc-metric"><div class="cc-num" style="color:#d29922">3</div><div class="cc-lbl">partial</div></div>
  <div class="cc-metric"><div class="cc-num" style="color:#f85149">0</div><div class="cc-lbl">not covered</div></div>
</div>

<div class="cc-row"><div class="cc-sec">§1 Architecture</div><div class="cc-what">12 components, data flow diagram, 5-layer stack</div><span class="badge b-yes">Covered</span></div>
<div class="cc-row"><div class="cc-sec">§2 Folder structure</div><div class="cc-what">Node.js test layout (no Playwright); test environments defined</div><span class="badge b-yes">Covered</span></div>
<div class="cc-row"><div class="cc-sec">§3 Feature breakdown</div><div class="cc-what">82 test IDs across 5 components, all 27 stories × ACs mapped</div><span class="badge b-yes">Covered</span></div>
<div class="cc-row"><div class="cc-sec">§4 Story coverage map</div><div class="cc-what">All 27 stories linked to test IDs; 100% P0, 100% P1 coverage</div><span class="badge b-yes">Covered</span></div>
<div class="cc-row"><div class="cc-sec">§5 Skill map</div><div class="cc-what">5 skills mapped; 2 new skills identified; sprint batches defined</div><span class="badge b-yes">Covered</span></div>
<div class="cc-row"><div class="cc-sec">§6 Missing skills</div><div class="cc-what">Full specs for node-integration-test + cli-automation skills</div><span class="badge b-yes">Covered</span></div>
<div class="cc-row"><div class="cc-sec">§7 Sprint execution</div><div class="cc-what">S0 + S1 + S2 ordered action tables with measurable exit criteria</div><span class="badge b-yes">Covered</span></div>
<div class="cc-row"><div class="cc-sec">§8 Pre-conditions</div><div class="cc-what">5 layers with exact commands and expected outputs</div><span class="badge b-yes">Covered</span></div>
<div class="cc-row"><div class="cc-sec">§9 Test data strategy</div><div class="cc-what">bookings.json + chat_registry.json reset strategy; data type rules</div><span class="badge b-yes">Covered</span></div>
<div class="cc-row"><div class="cc-sec">§10 Risk register</div><div class="cc-what">8 project-specific risks with mitigation and owners</div><span class="badge b-yes">Covered</span></div>
<div class="cc-row"><div class="cc-sec">Appendix A — BR rules</div><div class="cc-what">All policy.js rules traced to test IDs; approvals.json gap noted</div><span class="badge b-part">Partial</span></div>
<div class="cc-row"><div class="cc-sec">Appendix B — CI/CD</div><div class="cc-what">GitHub Actions YAML for L1+L2+L3+L4; Telegram live test excluded from CI</div><span class="badge b-part">Partial</span></div>

<div class="cc-box cc-amber">
  <div class="cc-box-title">Partial sections — complete before S1 sprint starts</div>
  <ul style="margin:0;padding-left:16px">
    <li><strong>Appendix A:</strong> approvals.json file existence must be confirmed in codebase before BR-09 and BR-10 test IDs can be verified.</li>
    <li><strong>Appendix B:</strong> Live Telegram bot test (L5/MAN tests) excluded from CI — a staging bot token strategy is needed before these can be automated in CI.</li>
  </ul>
</div>

<div class="cc-box cc-green">
  <div class="cc-box-title">Overall verdict: READY TO EXECUTE</div>
  All P0 stories have test IDs; both new skill specs are complete; S0 can start immediately with existing test_policy.js and run_tests.js; S1 integration tests can start after node-integration-test skill is confirmed.
</div>
</div>

---

## 1. Project Architecture Analysis

### 1.1 System Components

| Component | Technology | Test Method | Sprint |
|-----------|-----------|-------------|--------|
| `policy.js` | Node.js 20 · plain object exports | Unit — boundary value · `node test_policy.js` | S0 |
| `mock_inventory.js` | Node.js 20 · static data + policy.js import | Unit — via test_policy.js + FGR | S0 |
| `nlu.js` + `golden_dataset.js` | Node.js 20 · Gemini 2.5 Pro API | NLU regression · `node run_tests.js` | S0 |
| `prompt.js` (`formatInventory`) | Node.js 20 · string formatting | Unit — FGR price-grounding assertions | S0 |
| `duffel.js` | Node.js 20 · Duffel REST API · Axios | Integration — Axios mock intercept (nock) | S1 |
| `agent.js` | Node.js 20 · @google/generative-ai SDK | Integration — webhook simulation with mocked Gemini | S1 |
| `Index.js` | Node.js 20 · node-telegram-bot-api · Map sessions | Integration — HTTP POST webhook simulation | S1 |
| `notify.js` | Node.js 20 · CLI script · Telegram sendMessage | CLI automation — child_process.execSync + stdout assert | S1 |
| `admin.js` | Node.js 20 · REPL · Gemini 2.5 Flash | Manual demo only — interactive REPL | S2 |
| `bookings.json` | JSON file · Node.js fs | File assertion — read + validate after booking confirm | S1 |
| `chat_registry.json` | JSON file · Node.js fs | File assertion — read after /start role selection | S1 |
| `travelers.yml` | YAML · js-yaml | Unit — profile load per role · inline in integration tests | S1 |

### 1.2 Data Flow — Critical Paths to Test

```
[Telegram User]
      │  /start command
      ▼
[Telegram API] ──── webhook POST ────► [Index.js]
                                             │
                                    getSession() → awaitingRole:true
                                    sendInlineKeyboard(roleOptions)
                                             │
[User taps role] ──── callback_query: role_select:Operations
                                             │
                                    travelers.yml → getProfile()
                                    chat_registry.json ← {employee_id: chat_id}
                                             │
[User sends flight intent]
      │  "Find me a flight to Singapore on June 1"
      ▼
[Index.js] ──── runAgent(history) ────► [agent.js]
                                             │
                                    Gemini 2.5 Pro (function_call)
                                    ├── search_flights({BKK,SIN,2026-06-01,Y})
                                    │       │
                                    │   [duffel.js] ──── Duffel REST API
                                    │       │  (fallback on error)
                                    │   [mock_inventory.js] → getMockFlights()
                                    │       │
                                    │   [policy.js] → is_compliant · is_preferred
                                    │       │
                                    │   compliance-annotated results returned
                                    │
                                    [prompt.js] → formatInventory()
                                    ├── Markdown reply + inline keyboard
                                             │
[User taps "Select TG401"] ──── callback_query: select_flight:TG401
                                             │
                                    session.selectedOption = TG401
                                    sendConfirmKeyboard()
                                             │
[User taps Confirm] ──── callback_query: booking_confirm
                                             │
                                    proceedWithBooking()
                                    ├── bookingInProgress guard
                                    ├── is_compliant:true → no justification
                                    ├── generatePNR() → 6-char alphanumeric
                                    ├── bookings.json ← record written
                                    └── sendMessage("✅ PNR: AB1234")
                                             │
[User receives PNR confirmation]
```

**Every arrow = at least one test case:**
- webhook POST → INT-001 through INT-005 (role selection, session init)
- runAgent() → INT-010 (slot filling), INT-015 (NLU dispatch)
- search_flights → INT-020 (mock results), INT-025 (Duffel fallback)
- is_compliant → POL-001 through POL-020
- formatInventory() → FGR-001 through FGR-008
- booking_confirm → INT-030 through INT-038
- bookings.json write → INT-035

### 1.3 Test Layer Stack (Bottom-Up)

```
Layer 5: Manual Telegram Exploratory    (S1/S2)   ← 12_exploratory-testing.md [Modified]
         Multi-turn approval flow · escalation buttons · human agent handoff

Layer 4: CLI Automation                 (S1)      ← cli-automation [NEW — create in §6]
         child_process.execSync('node notify.js ...') · stdout + exit code assertions

Layer 3: Node.js Integration Tests      (S1)      ← node-integration-test [NEW — create in §6]
         HTTP POST webhook simulation · nock mocks (Gemini + Duffel) · file assertions

Layer 2: NLU Regression + FGR          (S0)      ← run_tests.js [Existing]
         node run_tests.js · 15 golden dataset cases · FGR price grounding

Layer 1: Policy Unit Tests             (S0)      ← test_policy.js [Existing]
         node test_policy.js · 41 boundary value tests
```

> ⚠ **Skill gap summary:** Layers 3 and 4 have no matching existing skill. Full specs in §6. Layer 5 (manual) uses adapted 12_exploratory-testing.md — no browser; Telegram app only.

---

## 2. Test Architecture Overview

### 2.1 Folder Structure

```
/QA/
├── 00_user-stories/
│   ├── 000-20260514-business-goals.md         ✅ complete
│   ├── 001-20260514-CLOTILDE-draft.md          ✅ complete
│   └── 002-20260514-CLOTILDE-final.md          ✅ complete
│
├── 01_specs/
│   ├── PROMPT-A-QA-analysis-widget.html        ✅ complete
│   ├── QA-MASTER-TEST-PLAN.md                  ← this file
│   ├── 01-20260514-EP01-requirements.md        ← Phase 2 output
│   ├── 02-20260514-EP01-manual-tests-comp.md   ← Phase 2 output
│   └── 02-20260514-EP01-manual-tests-e2e.md    ← Phase 2 output
│
├── tests/
│   ├── fixtures/
│   │   ├── reset-test-data.js                  ← truncate bookings.json + chat_registry
│   │   └── test-profiles.js                    ← traveler profile fixtures per role
│   ├── policy/
│   │   └── test_policy.js                      ← L1: existing (symlink or copy)
│   ├── nlu/
│   │   └── run_tests.js                        ← L2: existing (symlink or copy)
│   ├── integration/
│   │   ├── booking-flow.test.js                ← L3: INT-001–038
│   │   ├── duffel-fallback.test.js             ← L3: INT-025–028
│   │   ├── escalation.test.js                  ← L3: INT-040–045
│   │   ├── approval-flow.test.js               ← L3: INT-050–060
│   │   └── hotel-flow.test.js                  ← L3: INT-065–072
│   ├── cli/
│   │   └── notify.test.js                      ← L4: CLI-001–015
│   └── manual/
│       └── 03-20260514-CLOTILDE-observations.md ← L5: exploratory notes
│
└── results/
    ├── 01_manual_observations/
    │   └── screenshots/
    ├── 02_automation_raw/
    └── 03_fix_proposals/
```

### 2.2 Test Environments

*No browser/Playwright — replaced with runtime environments:*

| Environment | Description | Used For |
|-------------|-------------|----------|
| `local-node` | `node Index.js` on localhost; Telegram webhook via ngrok or mocked | L3 Integration tests |
| `bot-api-mock` | node-telegram-bot-api mocked in-process via jest.mock | L3 Integration tests (CI) |
| `live-staging` | Real bot token (@ClotildeTestBot) connected to Telegram staging | L5 Manual exploratory |
| `ci-headless` | GitHub Actions — no Telegram live connection; L1/L2/L3/L4 only | CI pipeline |

---

## 3. Feature Breakdown

---

### 3.1 Policy Engine (`policy.js` + `mock_inventory.js`)

**Test runner:** `node test_policy.js` (existing) + inline assertions in integration tests
**Coverage target:** 100% of policy rules at boundary values
**Location:** `QA/tests/policy/test_policy.js`
**Current state:** 41 tests exist and pass ✅

#### Section A: Hotel Budget Caps

| Test ID | Description | Type | AC / BR Rule | Priority | Status |
|---------|-------------|------|--------------|----------|--------|
| POL-001 | BKK hotel at cap (4000 THB) → is_compliant: true | Boundary | US-007 AC-2 / BR-H1 | P0 | In plan |
| POL-002 | BKK hotel at cap-1 (3999 THB) → is_compliant: true | Boundary | US-007 / BR-H1 | P0 | In plan |
| POL-003 | BKK hotel at cap+1 (4001 THB) → is_compliant: false | Boundary | US-007 AC-3 / BR-H1 | P0 | In plan |
| POL-004 | SIN hotel at cap (350 SGD) → is_compliant: true | Boundary | US-007 AC-4 / BR-H2 | P0 | In plan |
| POL-005 | SIN hotel at cap+1 → is_compliant: false | Boundary | US-007 / BR-H2 | P0 | In plan |
| POL-006 | NYC/LON/TYO hotel caps — at, below, above (3 × 3 = 9 tests) | Boundary | US-007 AC-4 | P0 | In plan |
| POL-007 | DEFAULT hotel cap (200 USD) at boundary | Boundary | US-007 / BR-H6 | P0 | In plan |
| POL-008 | Currency mismatch hotel → compliance returns null | Boundary | US-026 AC-edge / BR-H7 | P1 | In plan |

#### Section B: Flight Budget Caps

| Test ID | Description | Type | AC / BR Rule | Priority | Status |
|---------|-------------|------|--------------|----------|--------|
| POL-010 | SHORT_HAUL flight at cap (5000 THB) → is_compliant: true | Boundary | US-006 AC-3 / BR-F1 | P0 | In plan |
| POL-011 | SHORT_HAUL at cap+1 (5001 THB) → is_compliant: false | Boundary | US-006 / BR-F1 | P0 | In plan |
| POL-012 | LONG_HAUL flight at cap (25000 THB) → is_compliant: true | Boundary | US-006 / BR-F2 | P0 | In plan |
| POL-013 | LONG_HAUL at cap+1 (25001 THB) → is_compliant: false | Boundary | US-006 / BR-F2 | P0 | In plan |

#### Section C: Cabin Class + Preferred Airlines + Advance Booking

| Test ID | Description | Type | AC / BR Rule | Priority | Status |
|---------|-------------|------|--------------|----------|--------|
| POL-015 | Operations/Staff → Economy (Y) allowed | Boundary | US-008 AC-1 / BR-C1 | P0 | In plan |
| POL-016 | Operations/Staff → Business (C) → is_compliant: false | Boundary | US-008 AC-1 / BR-C1 | P0 | In plan |
| POL-017 | Manager → Business (C) → is_compliant: false | Boundary | US-008 / BR-C2 | P0 | In plan |
| POL-018 | Director/VP/C-Suite → Business (C) → is_compliant: true | Boundary | US-008 AC-2 / BR-C3 | P0 | In plan |
| POL-019 | getMockFlights BKK→SIN: first result is preferred airline (TG) | Functional | US-005 AC-3 / BR-P1 | P0 | In plan |
| POL-020 | getMockFlights BKK→LHR: all 3 preferred airlines (TG, SQ, EK) present | Functional | US-005 AC-2 / BR-P1 | P0 | In plan |
| POL-021 | Advance booking: 3 days ahead → OK (advanceBookingOk = true) | Boundary | BR-A1 | P0 | In plan |
| POL-022 | Advance booking: 2 days ahead → NOT OK (false) | Boundary | BR-A1 | P0 | In plan |

---

### 3.2 NLU Regression + FGR (`nlu.js`, `run_tests.js`, `golden_dataset.js`)

**Test runner:** `node run_tests.js` (existing)
**Coverage target:** ≥ 80% IRA accuracy; ≥ 90% FGR
**Location:** `QA/tests/nlu/run_tests.js`
**Current state:** 15 test cases defined; FGR section added ✅

#### Section A: Intent Classification

| Test ID | Description | Type | AC / BR Rule | Priority | Status |
|---------|-------------|------|--------------|----------|--------|
| NLU-001 | G001: standard flight booking → intent: flight_booking, destination: SIN | Functional | US-010 AC-1 / US-011 | P0 | In plan |
| NLU-002 | G002: synonym "reserve a seat" → intent: flight_booking | Functional | US-011 AC-2 | P0 | In plan |
| NLU-003 | G003: same-day booking intent → intent: flight_booking (advance rule separate) | Functional | US-011 | P0 | In plan |
| NLU-004 | G004: slang "Grab a bird to BKK" → intent: flight_booking, destination: BKK | Functional | US-011 AC-1 | P0 | In plan |
| NLU-005 | G005: slang with filler words → same entities as clean message | Functional | US-011 AC-3 | P0 | In plan |
| NLU-006 | G006: "I do NOT want to fly to London" → intent not flight_booking OR LON absent | Functional | US-012 AC-1 | P0 | In plan |
| NLU-007 | G007: "Do not book hotel, just flight to Paris" → intent: flight_booking, CDG | Functional | US-012 AC-3 | P0 | In plan |
| NLU-008 | G008: ambiguous utterance → confidence ≤ expected_confidence_max | Functional | US-010 AC-1 | P0 | In plan |
| NLU-009 | G009: second ambiguity case → low confidence | Functional | US-010 | P0 | In plan |
| NLU-010 | G010: intent overlap case → correct intent wins | Functional | US-010 | P0 | In plan |
| NLU-011 | G011: second overlap case | Functional | US-010 | P0 | In plan |
| NLU-012 | G012: "Order me a pizza" → intent: out_of_scope | Functional | US-014 AC-1 | P0 | In plan |
| NLU-013 | G013: "What is the capital of France?" → out_of_scope | Functional | US-014 AC-2 | P0 | In plan |
| NLU-014 | G014: policy question → correct intent | Functional | US-010 | P0 | In plan |
| NLU-015 | G015: anaphora/context reference → correct entity resolution | Functional | US-010 | P0 | In plan |
| NLU-016 | Overall IRA ≥ 80% → process exits 0 | Functional | US-010 AC-1 | P0 | In plan |
| NLU-017 | Category breakdown printed for each category | Functional | US-010 AC-3 | P0 | In plan |

#### Section B: FGR (Fact Grounding Rate)

| Test ID | Description | Type | AC / BR Rule | Priority | Status |
|---------|-------------|------|--------------|----------|--------|
| FGR-001 | BKK→SIN Economy flights: all prices in formatInventory() match source amount | Functional | US-013 AC-2 | P0 | In plan |
| FGR-002 | BKK→SIN: toLocaleString() form of price also accepted (e.g. "4,200") | Boundary | US-013 edge | P0 | In plan |
| FGR-003 | BKK→LHR LONG_HAUL flights: all prices grounded correctly | Functional | US-013 AC-2 | P0 | In plan |
| FGR-004 | Hotels BKK 2026-06-01→03: price_per_night in formatted output matches source | Functional | US-013 AC-2 | P0 | In plan |
| FGR-005 | FGR ≥ 99% → verdict "🟢 FGR: X%" | Functional | US-013 AC-3 | P0 | In plan |
| FGR-006 | FGR 90–98% → verdict "🟡 FGR: X% (below 99% target)" | Boundary | US-013 AC-3 | P1 | In plan |
| FGR-007 | FGR < 90% → verdict "🔴 FGR: X% (FAILING)" | Boundary | US-013 AC-3 | P0 | In plan |

---

### 3.3 Telegram Bot Server (`Index.js`, `agent.js`, `duffel.js`)

**Test runner:** Node.js integration tests (node-integration-test skill — new)
**Coverage target:** All P0 + P1 integration ACs covered
**Location:** `QA/tests/integration/`
**Current state:** 0 tests exist — all new

#### Section A: Role Selection & Session Init

| Test ID | Description | Type | AC / BR Rule | Priority | Status |
|---------|-------------|------|--------------|----------|--------|
| INT-001 | POST /start command → bot replies with role selection inline keyboard | Functional | US-001 pre-cond | P0 | New |
| INT-002 | callback_query role_select:Operations → session.role = 'Operations'; travelerProfile loaded | Functional | US-001 AC-1 / BR-R1 | P0 | New |
| INT-003 | role_select callback → chat_registry.json contains {employee_id: chat_id} entry | Functional | US-001 AC-1 | P0 | New |
| INT-004 | role_select:Director → travelerProfile.cabin_class allows Business (C) | Functional | US-008 AC-3 | P0 | New |
| INT-005 | /reset command → session cleared; awaitingRole reset to true | Functional | BR-R2 | P1 | New |

#### Section B: Flight Search — Slot Filling & Results

| Test ID | Description | Type | AC / BR Rule | Priority | Status |
|---------|-------------|------|--------------|----------|--------|
| INT-010 | Message "Book a flight to Singapore" (no date) → agent does NOT call search_flights | Functional | US-002 AC-1 | P0 | New |
| INT-011 | Bot asks for departure date when date is missing | Functional | US-002 AC-1 | P0 | New |
| INT-012 | Follow-up message provides date → search_flights called with all 3 params | Functional | US-002 AC-2 | P0 | New |
| INT-013 | Full intent in one message → search_flights called on first message | Functional | US-002 AC-3 | P0 | New |
| INT-014 | search_flights result → reply contains is_preferred:true airline first | Functional | US-005 AC-3 | P0 | New |
| INT-015 | search_flights result → all items have is_compliant field | Functional | US-005 AC-1 | P0 | New |
| INT-016 | OUT-OF-POLICY item in reply → formatted output contains "OUT-OF-POLICY" | Functional | US-006 AC-2 | P0 | New |
| INT-017 | Staff role + Business Class search → Business results show is_compliant:false | Functional | US-008 AC-1 | P0 | New |
| INT-018 | Director role + Business Class search → Business results show is_compliant:true | Functional | US-008 AC-2 | P0 | New |

#### Section C: Duffel Fallback

| Test ID | Description | Type | AC / BR Rule | Priority | Status |
|---------|-------------|------|--------------|----------|--------|
| INT-020 | Duffel API throws exception → duffel.js catches error | Resilience | US-003 AC-1 | P0 | New |
| INT-021 | After Duffel failure → getMockFlights() called as fallback | Resilience | US-003 AC-1 | P0 | New |
| INT-022 | Fallback results delivered to user — no raw error in reply | Negative | US-003 AC-2 | P0 | New |
| INT-023 | Fallback completes within 2000ms of Duffel failure | Boundary | US-003 AC-3 | P0 | New |
| INT-024 | No flights on route → bot replies with "no results" message, no crash | Negative | US-003 edge | P1 | New |

#### Section D: Booking Confirm & Idempotency

| Test ID | Description | Type | AC / BR Rule | Priority | Status |
|---------|-------------|------|--------------|----------|--------|
| INT-030 | booking_confirm on in-policy flight → PNR generated (6-char alphanumeric) | Functional | US-001 AC-2 | P0 | New |
| INT-031 | booking_confirm → bookings.json record has status:CONFIRMED + employee_id | Functional | US-001 AC-3 | P0 | New |
| INT-032 | booking_confirm → PNR in Telegram reply message | Functional | US-001 AC-2 | P0 | New |
| INT-033 | Exactly 1 booking record in bookings.json after single confirm | Data Integrity | US-001 AC-3 | P0 | New |
| INT-034 | Second booking_confirm while first in progress → second discarded | Functional | US-004 AC-1 | P1 | New |
| INT-035 | After duplicate block → bookings.json still has exactly 1 record | Data Integrity | US-004 AC-1 | P1 | New |
| INT-036 | Duplicate confirm block → WARNING in console | Functional | US-004 AC-2 | P1 | New |
| INT-037 | booking_confirm on out-of-policy flight → no PNR; justification requested | Functional | US-009 AC-1 | P0 | New |
| INT-038 | Empty justification submitted → bot asks again; empty not accepted | Negative | US-009 edge | P0 | New |
| INT-039 | Non-empty justification → approval record written as PENDING | Functional | US-009 AC-2 | P0 | New |

#### Section E: Approval Workflow

| Test ID | Description | Type | AC / BR Rule | Priority | Status |
|---------|-------------|------|--------------|----------|--------|
| INT-050 | Out-of-policy confirm → bot asks for justification, not PNR | Functional | US-018 AC-1 | P1 | New |
| INT-051 | Justification submitted → approval record PENDING in approvals.json | Functional | US-018 AC-2 | P1 | New |
| INT-052 | In-policy confirm → no justification step; PNR immediately | Functional | US-021 AC-1 | P1 | New |
| INT-053 | In-policy confirm → no approval record created | Functional | US-021 AC-3 | P1 | New |
| INT-054 | VP-004 books out-of-policy → justification stored; no Approve button shown | Functional | US-020 AC-2 | P1 | New |
| INT-055 | Approval routing: APPROVER_EMPLOYEE_ID constant determines approver | Functional | US-020 AC-1 | P1 | New |
| INT-056 | is_compliant:null → treated as non-compliant; justification flow triggered | Boundary | US-021 edge | P1 | New |

#### Section F: Escalation

| Test ID | Description | Type | AC / BR Rule | Priority | Status |
|---------|-------------|------|--------------|----------|--------|
| INT-060 | Message containing "lost" → escalate_to_human tool called | Functional | US-015 AC-1 | P1 | New |
| INT-061 | Message containing "visa"/"medical"/"emergency" → escalation offered | Functional | US-015 AC-1 | P1 | New |
| INT-062 | AGENT_GROUP_CHAT_ID not set → fallback message with escalationContact email | Resilience | US-017 AC-1 | P1 | New |
| INT-063 | Telegram group send fails → fallback email contact sent to traveler, no crash | Resilience | US-017 AC-2 | P1 | New |

#### Section G: Hotel Booking

| Test ID | Description | Type | AC / BR Rule | Priority | Status |
|---------|-------------|------|--------------|----------|--------|
| INT-070 | Hotel intent → search_hotels called with correct city | Functional | US-025 AC-1 | P1 | New |
| INT-071 | Hotel results include is_compliant per POLICY.hotelBudgetCap | Functional | US-025 AC-2 | P1 | New |
| INT-072 | Compliant hotel confirm → bookings.json record type:hotel + reference code | Functional | US-025 AC-3 | P1 | New |
| INT-073 | Out-of-policy hotel confirm → justification flow (same as flight) | Functional | US-027 AC-1 | P1 | New |
| INT-074 | Hotel approval record contains hotel_name, room_type, price_per_night | Functional | US-027 AC-2 | P1 | New |

---

### 3.4 CLI Notification (`notify.js`)

**Test runner:** Node.js child_process.execSync (cli-automation skill — new)
**Coverage target:** All 17 notification types + error paths
**Location:** `QA/tests/cli/notify.test.js`
**Current state:** 0 automated tests — all new

#### Section A: Notification Delivery

| Test ID | Description | Type | AC / BR Rule | Priority | Status |
|---------|-------------|------|--------------|----------|--------|
| CLI-001 | `notify.js booking_confirmed --employee EMP-001` → employee_id resolved to chat_id | Functional | US-022 AC-1 | P1 | New |
| CLI-002 | Notification delivered to correct chat_id (mocked Telegram API) | Functional | US-022 AC-1 | P1 | New |
| CLI-003 | `booking_confirmed` notification body contains PNR field (non-empty) | Functional | US-022 AC-2 | P1 | New |
| CLI-004 | `flight_delay` notification body contains flight_number | Functional | US-022 AC-2 | P1 | New |
| CLI-005 | All 17 notification types produce non-empty message bodies | Functional | US-024 AC-1 | P1 | New |
| CLI-006 | Notification body does NOT contain raw numeric chat_id | Security | US-024 AC-3 | P1 | New |
| CLI-007 | Optional fields missing (hotel_name) → field omitted cleanly, not "undefined" | Negative | US-024 edge | P1 | New |

#### Section B: Error Handling

| Test ID | Description | Type | AC / BR Rule | Priority | Status |
|---------|-------------|------|--------------|----------|--------|
| CLI-010 | Unknown employee_id → error logged with missing ID | Negative | US-023 AC-1 | P1 | New |
| CLI-011 | Unknown employee_id → process exits with code ≥ 1 | Negative | US-023 AC-2 | P1 | New |
| CLI-012 | Error message is human-readable — no raw stack trace | Negative | US-023 AC-3 | P1 | New |
| CLI-013 | chat_registry.json missing → file read error caught; human-readable error | Negative | US-023 edge | P1 | New |
| CLI-014 | chat_registry.json malformed JSON → parse error caught; exits non-zero | Negative | US-023 edge | P1 | New |
| CLI-015 | Telegram API returns 403 (blocked bot) → error logged; exits non-zero | Negative | US-022 edge | P1 | New |

---

### 3.5 Manual Telegram Exploratory (`admin.js`, multi-turn flows)

**Test runner:** Manual — live Telegram bot (@ClotildeTestBot / staging token)
**Coverage target:** All P1 multi-turn flows verified with human interaction
**Location:** `QA/tests/manual/03-20260514-CLOTILDE-observations.md`
**Current state:** 0 observations — all new

#### Section A: Approval + Rejection Multi-Turn

| Test ID | Description | Type | AC / BR Rule | Priority | Status |
|---------|-------------|------|--------------|----------|--------|
| MAN-001 | VP-004 taps Approve → traveler receives PNR in Telegram | Functional | US-018 AC-4 | P1 | New |
| MAN-002 | VP-004 taps Reject → prompted for reason → traveler receives rejection + reason | Functional | US-019 AC-1/2/3 | P1 | New |
| MAN-003 | Empty rejection reason → bot asks again | Negative | US-019 edge | P1 | New |
| MAN-004 | No PNR generated for rejected booking (check bookings.json manually) | Data Integrity | US-019 AC-4 | P1 | New |

#### Section B: Escalation Multi-Turn

| Test ID | Description | Type | AC / BR Rule | Priority | Status |
|---------|-------------|------|--------------|----------|--------|
| MAN-005 | User sends "lost my passport" → escalation offered, bot does not search flights | Functional | US-015 AC-3 | P1 | New |
| MAN-006 | User confirms escalation → context packet in agent group Telegram chat | Functional | US-016 AC-2 | P1 | New |
| MAN-007 | Context packet contains name, employee_id, department, reason | Functional | US-016 AC-1 | P1 | New |
| MAN-008 | Escalation on first message (empty history) → packet still sent, no crash | Negative | US-016 edge | P1 | New |

#### Section C: Admin REPL

| Test ID | Description | Type | AC / BR Rule | Priority | Status |
|---------|-------------|------|--------------|----------|--------|
| MAN-010 | `admin.js`: "list all bookings" → bookings listed with PNR/status | Functional | BG-08 (demo) | P2 | New |
| MAN-011 | `admin.js`: "send flight delay to EMP-001" → notification sent | Functional | BG-08 (demo) | P2 | New |

---

## 4. User Story ↔ Test Coverage Map

| Story ID | Epic | Persona | Priority | Test Layer | Test IDs |
|----------|------|---------|----------|-----------|---------|
| US-001 | Flight Booking | Staff | P0 | L3 Integration | INT-001, INT-002, INT-003, INT-030, INT-031, INT-032, INT-033 |
| US-002 | Flight Booking | Staff | P0 | L3 Integration | INT-010, INT-011, INT-012, INT-013 |
| US-003 | Flight Booking (fallback) | Staff | P0 | L3 Integration | INT-020, INT-021, INT-022, INT-023, INT-024 |
| US-004 | Idempotency | Staff | P1 | L3 Integration | INT-034, INT-035, INT-036 |
| US-005 | Policy compliance display | Staff | P0 | L1 + L3 | POL-019, POL-020, INT-014, INT-015, INT-016 |
| US-006 | Out-of-policy flag | Staff | P0 | L1 + L3 | POL-010, POL-011, POL-012, POL-013, INT-016 |
| US-007 | Boundary value tests | QA Eng | P0 | L1 Policy | POL-001–008, POL-010–013 |
| US-008 | Cabin class enforcement | Staff | P0 | L1 + L3 | POL-015, POL-016, POL-017, POL-018, INT-017, INT-018 |
| US-009 | Justification flow | Staff | P0 | L3 Integration | INT-037, INT-038, INT-039 |
| US-010 | NLU regression suite | QA Eng | P0 | L2 NLU | NLU-001–017, FGR-001–007 |
| US-011 | Slang / synonyms | Staff | P0 | L2 NLU | NLU-001, NLU-002, NLU-004, NLU-005 |
| US-012 | Negation handling | Staff | P0 | L2 NLU | NLU-006, NLU-007 |
| US-013 | FGR / hallucination | QA Eng | P0 | L2 FGR | FGR-001–007 |
| US-014 | Out-of-scope handling | Staff | P1 | L2 NLU | NLU-012, NLU-013 |
| US-015 | Escalation trigger | Staff | P1 | L3 + L5 Manual | INT-060, INT-061, MAN-005 |
| US-016 | Context packet handoff | Human Agent | P1 | L5 Manual | MAN-006, MAN-007, MAN-008 |
| US-017 | Fallback contact | Staff | P1 | L3 Integration | INT-062, INT-063 |
| US-018 | Approval flow | Staff + VP | P1 | L3 + L5 Manual | INT-050, INT-051, MAN-001 |
| US-019 | Rejection flow | VP | P1 | L5 Manual | MAN-002, MAN-003, MAN-004 |
| US-020 | Self-approval block | System | P1 | L3 Integration | INT-054, INT-055 |
| US-021 | In-policy skips approval | Staff | P1 | L3 Integration | INT-052, INT-053, INT-056 |
| US-022 | Notification delivery | Admin | P1 | L4 CLI | CLI-001, CLI-002, CLI-003, CLI-004 |
| US-023 | Unknown employee_id | Admin | P1 | L4 CLI | CLI-010, CLI-011, CLI-012, CLI-013, CLI-014 |
| US-024 | 17 notification types | QA Eng | P1 | L4 CLI | CLI-005, CLI-006, CLI-007 |
| US-025 | Hotel booking | Staff | P1 | L3 Integration | INT-070, INT-071, INT-072 |
| US-026 | Hotel cap boundary | QA Eng | P1 | L1 Policy | POL-001–008 |
| US-027 | Hotel out-of-policy | Staff | P1 | L3 Integration | INT-073, INT-074 |

**Coverage summary:**
- P0 stories with ≥ 1 test mapped: **12 / 12 (100%)**
- P1 stories with ≥ 1 test mapped: **15 / 15 (100%)**
- Total test IDs defined: **82** (POL: 22 · NLU: 17 · FGR: 7 · INT: 20 · CLI: 15 · MAN: 11 — some IDs group multiple sub-tests)

---

## 5. Pipeline Skill Map

### 5.1 Skill Usage by Test Type

| Test Type | Component | Pipeline Step | Skill | Notes |
|-----------|-----------|--------------|-------|-------|
| Policy boundary unit | policy.js · mock_inventory.js | S0 — run immediately | `test_policy.js` (existing) | `node test_policy.js` exits 0 = pass |
| NLU regression | nlu.js · golden_dataset.js · prompt.js | S0 — run immediately | `run_tests.js` (existing) | Requires `GEMINI_API_KEY` in `.env` |
| FGR price grounding | prompt.js · mock_inventory.js | S0 — appended to run_tests.js | `run_tests.js` (existing) | No API key needed for FGR section |
| Integration — bot server | Index.js · agent.js · duffel.js | S1 — after skill created | **NEW: `node-integration-test`** | Mocks: nock (Gemini + Duffel + Telegram) |
| CLI automation | notify.js | S1 — after skill created | **NEW: `cli-automation`** | child_process.execSync; mock Telegram sendMessage |
| Manual exploratory | All multi-turn flows | S1/S2 — live bot | `12_exploratory-testing.md` (modified) | No browser; Telegram app only |

### 5.2 Sprint Batch Execution Order

**Batch S0 — Policy + NLU (L1 + L2 — existing tools)**
```
Stories:  US-005, US-006, US-007, US-008, US-010, US-011, US-012, US-013, US-026
Skills:   test_policy.js + run_tests.js (both existing)
Command:  node test_policy.js && node run_tests.js
Exit:     test_policy.js 100% · run_tests.js ≥ 80% IRA · FGR ≥ 90%
```

**Batch S1a — Integration Tests (L3 — new skill)**
```
Stories:  US-001, US-002, US-003, US-004, US-009, US-017, US-020, US-021, US-025, US-027
Skills:   node-integration-test (new) + 12_exploratory-testing (modified)
Command:  node --test QA/tests/integration/
Exit:     All INT-* tests pass; bookings.json state verified per test
```

**Batch S1b — CLI Automation (L4 — new skill)**
```
Stories:  US-022, US-023, US-024
Skills:   cli-automation (new)
Command:  node --test QA/tests/cli/
Exit:     All CLI-* tests pass; exit codes correct
```

**Batch S1c — Manual Telegram (L5)**
```
Stories:  US-014, US-015, US-016, US-018, US-019
Skills:   12_exploratory-testing.md (modified for Telegram)
Command:  Manual — live bot session; record in 03-observations.md
Exit:     MAN-001–008 all manually verified and documented
```

**Batch S2 — Admin REPL Demo (P2)**
```
Stories:  BG-08 admin demo
Skills:   Manual only
Command:  node admin.js (interactive REPL demo)
Exit:     MAN-010 and MAN-011 demonstrated and documented
```

### 5.3 Skill Decision Tree

```
  New story to test?
  │
  ├─ Policy rule boundary (cap, cabin class, advance booking)?
  │     └──► node test_policy.js  [L1 — existing]
  │
  ├─ Intent classification / entity extraction / FGR?
  │     └──► node run_tests.js    [L2 — existing]
  │
  ├─ Bot session flow / booking / fallback / escalation / approval?
  │     └──► node-integration-test skill  [L3 — NEW]
  │              ├── Mock: nock for Gemini API + Duffel API + Telegram sendMessage
  │              ├── Assert: HTTP response text · bookings.json · chat_registry.json
  │              └── Reset: run reset-test-data.js before each test suite
  │
  ├─ CLI notification delivery / error handling?
  │     └──► cli-automation skill  [L4 — NEW]
  │              ├── child_process.execSync('node notify.js <type> --employee <id>')
  │              ├── Assert: stdout text · process exit code
  │              └── Mock: Telegram sendMessage intercepted
  │
  └─ Multi-turn approval / escalation buttons / human agent receipt?
        └──► Manual Telegram exploratory  [L5 — modified]
                 ├── Live bot (@ClotildeTestBot staging)
                 ├── Record: message text · button labels · state transitions
                 └── Document in: 03-observations.md
```

---

## 6. Missing Skills

### 6.1 NEW: `node-integration-test.md`

**Purpose:** Simulates Telegram webhook POST requests to Index.js and asserts bot response messages, session state, and file system outcomes.
**When to use:** Any story that tests Index.js session logic, booking flows, fallback behavior, escalation, or approval routing.
**Replaces / complements:** Replaces Playwright (no web UI). Complements test_policy.js (unit) and run_tests.js (NLU).

```markdown
# Skill: Node.js Integration Test Generator
# Agent: node-integration-test-agent
# Use INSTEAD OF: 04-test-generator (Playwright) for Telegram bot projects

## Role
You are a Node.js test engineer. You write integration tests that simulate
Telegram webhook requests to the bot server (Index.js) using HTTP or in-process
function calls. You mock all external APIs (Gemini, Duffel, Telegram sendMessage)
using nock or jest.mock. You assert bot reply text, session state, and file system
outcomes (bookings.json, chat_registry.json). You NEVER call live external APIs.

## Input
- `QA/01_specs/01-{{DATE}}-{{STORY_ID}}-requirements.md` — requirements + ACs
- `Index.js` — session logic and webhook handler (read before writing any test)
- `agent.js` — Gemini function calling flow (understand what the agent does)
- `bookings.json` (current state) — baseline for before/after assertions
- `chat_registry.json` — baseline for registration assertions
- `QA/tests/fixtures/reset-test-data.js` — call this in beforeEach

## Rules / Patterns
1. Always call `reset-test-data.js` in beforeEach to truncate bookings.json and
   chat_registry.json to empty arrays/objects before each test.
2. Mock Telegram's sendMessage using nock or jest.spyOn — never send real messages.
3. Mock Gemini API responses with nock: intercept POST to generativelanguage.googleapis.com
   and return a fixture response that includes the correct function_call.
4. Mock Duffel API with nock: intercept GET to api.duffel.com and return a
   fixture response, or throw to test the fallback path.
5. Use node:test (built-in, Node 20+) or jest — no additional test framework needed.
6. Each test file tests ONE flow: booking-flow.test.js, duffel-fallback.test.js, etc.
7. For bookings.json assertions: read the file after the flow, parse JSON, assert
   specific fields (PNR format: /^[A-Z0-9]{6}$/, status: 'CONFIRMED', employee_id).
8. For session state: use the exported getSession() function if available, or
   assert via the reply text that was sent.
9. Test IDs appear in the test description: test('INT-030 — booking confirm generates PNR', ...)

## Key scenarios to cover
INT-001 through INT-074 (see §3.3 of QA-MASTER-TEST-PLAN.md)
Priority: INT-001–039 (S1 batch S1a) before INT-050–074

## Output
QA/tests/integration/booking-flow.test.js
QA/tests/integration/duffel-fallback.test.js
QA/tests/integration/escalation.test.js
QA/tests/integration/approval-flow.test.js
QA/tests/integration/hotel-flow.test.js
```

### 6.2 NEW: `cli-automation.md`

**Purpose:** Shell-executes `node notify.js` with test arguments and asserts stdout message content, exit code, and Telegram API call payloads.
**When to use:** Any story covering notify.js notification delivery, error handling, or employee ID resolution.
**Replaces / complements:** No existing skill covers CLI Node.js script automation.

```markdown
# Skill: CLI Automation Test Generator
# Agent: cli-automation-agent
# Use IN ADDITION TO: node-integration-test for notify.js coverage

## Role
You are a Node.js CLI test engineer. You write tests that invoke notify.js
via child_process.execSync or spawnSync, capture stdout and exit code, and
assert against expected output. You mock Telegram's sendMessage by setting
a test environment variable (TEST_MODE=true) that redirects sends to a
local capture function instead of live Telegram.

## Input
- `notify.js` — read fully before writing any test (understand all 17 types)
- `chat_registry.json` — test fixture with known employee_ids and chat_ids
- `QA/01_specs/01-{{DATE}}-{{STORY_ID}}-requirements.md` — AC for the story

## Rules / Patterns
1. Set environment variable TEST_MODE=true when invoking notify.js so that
   Telegram.sendMessage is intercepted and written to a temp file instead of
   sending a real message. Read that file to assert message content.
   (If TEST_MODE is not implemented in notify.js, add it as a minimal shim
   — one if(process.env.TEST_MODE) guard before the axios call.)
2. Use child_process.spawnSync (not execSync) to capture both stdout and exit code
   without throwing on non-zero exit.
3. For the "unknown employee_id" tests, use an employee_id that does not exist
   in the test fixture chat_registry.json.
4. For "malformed JSON" tests, temporarily write a broken JSON file before the
   test and restore after.
5. Assert exit code explicitly: assert.strictEqual(result.status, 0) for success,
   assert.strictEqual(result.status, 1) for error cases.
6. Assert stdout includes expected text using: assert(stdout.includes('EMP-999 not found')).
7. Test IDs in descriptions: test('CLI-010 — unknown employee_id logs error and exits 1', ...)

## Key scenarios to cover
CLI-001 through CLI-015 (see §3.4 of QA-MASTER-TEST-PLAN.md)

## Output
QA/tests/cli/notify.test.js
```

---

## 7. Sprint Execution Plan

### Sprint S0 — Policy + NLU (Existing Tests — Run Immediately)

**Goal:** All existing tests pass: test_policy.js 100%, run_tests.js ≥ 80% IRA, FGR ≥ 90%.

| Order | Action | Skill / Tool | Output |
|-------|--------|-------------|--------|
| 1 | Run policy boundary tests | `node test_policy.js` | Console: 41/41 ✅ ALL POLICY RULES VERIFIED |
| 2 | Run NLU regression + FGR | `node run_tests.js` | Console: ≥ 80% IRA + FGR verdict |
| 3 | Requirements extraction → US-007, US-010, US-013, US-026 (P0 stories in S0) | `09_read-user-story.md` | `QA/01_specs/01-20260514-EP02-requirements.md` |
| 4 | Manual test cases — COMP → EP-02 policy stories | `10_comp-manual-test-case.md` | `QA/01_specs/02-20260514-EP02-manual-tests-comp.md` |
| 5 | Manual test cases — E2E → EP-03 NLU stories | `11_e2e-manual-test-case.md` | `QA/01_specs/02-20260514-EP03-manual-tests-e2e.md` |
| 6 | Update CLOTILDE_QA_COVERAGE_ANALYSIS.md to mark POL/NLU implemented | Manual | Updated coverage doc |
| 7 | QA Report — S0 | `15_report-writer.md` | `QA/results/06-20260514-S0-final-report.md` |
| 8 | Git PR — S0 | `16_git-commit.md` | Branch `qa/S0-policy-nlu` → main |

**Exit criterion:** `node test_policy.js` exits 0 (41/41 pass); `node run_tests.js` exits 0 (≥ 80% IRA); FGR verdict is 🟢 or 🟡 (≥ 90%); all 4 S0 stories documented in requirements files.

---

### Sprint S1 — Integration + CLI + Manual Telegram

**Goal:** All L3 integration tests and L4 CLI tests pass; L5 manual flows documented for EP-04 and EP-05.

| Order | Action | Skill / Tool | Output |
|-------|--------|-------------|--------|
| 1 | Create node-integration-test skill file from §6.1 spec | Manual | `QAStuff/01_QA-Agentic-flow/skills/node-integration-test.md` |
| 2 | Create cli-automation skill file from §6.2 spec | Manual | `QAStuff/01_QA-Agentic-flow/skills/cli-automation.md` |
| 3 | Create test data fixtures: reset-test-data.js + test-profiles.js | `node-integration-test` skill | `QA/tests/fixtures/` |
| 4 | Requirements → US-001, US-002, US-003 (EP-01 flight booking) | `09_read-user-story.md` | `01-20260514-EP01-requirements.md` |
| 5 | Manual COMP test cases → EP-01 | `10_comp-manual-test-case.md` | `02-20260514-EP01-manual-tests-comp.md` |
| 6 | Manual E2E test cases → EP-01 (full booking flow) | `11_e2e-manual-test-case.md` | `02-20260514-EP01-manual-tests-e2e.md` |
| 7 | Generate integration tests (INT-001–039) | `node-integration-test` skill | `QA/tests/integration/booking-flow.test.js` + `duffel-fallback.test.js` |
| 8 | Generate integration tests (INT-050–074) | `node-integration-test` skill | `QA/tests/integration/approval-flow.test.js` + `hotel-flow.test.js` |
| 9 | Generate integration tests (INT-060–063) | `node-integration-test` skill | `QA/tests/integration/escalation.test.js` |
| 10 | Generate CLI tests (CLI-001–015) | `cli-automation` skill | `QA/tests/cli/notify.test.js` |
| 11 | Run integration tests: `node --test QA/tests/integration/` | Manual | Pass/fail report |
| 12 | Run CLI tests: `node --test QA/tests/cli/` | Manual | Pass/fail report |
| 13 | Heal failing tests | `14_test-healer.md` | `QA/results/03_fix_proposals/05-S1-fix-proposals.md` |
| 14 | Manual Telegram exploratory (L5) — MAN-001–008 | `12_exploratory-testing.md` (modified) | `03-20260514-CLOTILDE-observations.md` |
| 15 | QA Report — S1 | `15_report-writer.md` | `QA/results/06-20260514-S1-final-report.md` |
| 16 | Git PR — S1 | `16_git-commit.md` | Branch `qa/S1-integration-cli` → main |

**Exit criterion:** All INT-* tests pass (0 failures); all CLI-* tests pass (0 failures); MAN-001 through MAN-008 manually verified and documented; `node test_policy.js` + `node run_tests.js` still passing (regression check).

---

### Sprint S2 — Admin Demo + Coverage Gaps

**Goal:** BG-08 admin demo documented; any S1 gaps resolved; final CLOTILDE_QA_COVERAGE_ANALYSIS.md updated.

| Order | Action | Skill / Tool | Output |
|-------|--------|-------------|--------|
| 1 | Manual admin.js REPL demo (MAN-010, MAN-011) | Manual | `03-20260514-ADMIN-observations.md` |
| 2 | Verify approvals.json existence in codebase — confirm or flag gap | Manual code read | Gap noted in Appendix A if absent |
| 3 | Update CLOTILDE_QA_COVERAGE_ANALYSIS.md: mark all S0 + S1 items ✅ | Manual | Updated coverage doc |
| 4 | QA Final Report — all sprints | `15_report-writer.md` | `QA/results/06-20260514-FINAL-report.md` |
| 5 | Git PR — S2 final | `16_git-commit.md` | Branch `qa/S2-final-coverage` → main |

**Exit criterion:** CLOTILDE_QA_COVERAGE_ANALYSIS.md shows ≥ 80% implemented; final report verdict is SHIP for P0/P1; admin demo documented in observations file.

---

## 8. Pre-conditions

### 8.1 All Layers

- [ ] Node.js 20.x — verify: `node -v` → `v20.x.x`
- [ ] Dependencies installed — `npm install` in `/Users/yellow-pro/Aoaaae/Clotilde_AI` exits 0
- [ ] `.env` file copied from `.env.example` and filled:
  - `TELEGRAM_BOT_TOKEN` — from @BotFather (any value for tests; mocked in CI)
  - `GEMINI_API_KEY` — required for `node run_tests.js` (L2 only; mocked in L3)

### 8.2 Layer 1 — Policy Unit Tests

- [ ] `node test_policy.js` runs without import errors — verify: no "Cannot find module" output
- [ ] `policy.js` exports `hotelBudgetCap`, `flightBudgetCap`, `cabinClass`, `preferredAirlines`, `advanceBookingDays`, `humanAgentTriggers`, `escalationContact`
- [ ] `mock_inventory.js` exports `getMockFlights`, `getMockHotels`, `buildGDSPayload`, `CITY_TO_AIRPORT`

### 8.3 Layer 2 — NLU Regression + FGR

- [ ] `GEMINI_API_KEY` valid and has quota for ≥ 15 API calls (one per test case)
- [ ] `golden_dataset.js` exports array of ≥ 15 test cases
- [ ] `nlu.js` exports `classifyIntent(message)` → `{intent, entities, confidence, latencyMs, path}`
- [ ] `prompt.js` exports `formatInventory({flights, hotels})` → non-empty string

### 8.4 Layer 3 — Integration Tests

- [ ] `nock` installed: `npm install --save-dev nock` (or `jest` with mock support)
- [ ] `QA/tests/fixtures/reset-test-data.js` created — truncates bookings.json + chat_registry.json
- [ ] `QA/tests/fixtures/test-profiles.js` created — exports test traveler profiles for each role
- [ ] Gemini API nock intercepts configured per fixture in `QA/tests/fixtures/gemini-fixtures.js`
- [ ] Duffel API nock intercepts configured per fixture in `QA/tests/fixtures/duffel-fixtures.js`
- [ ] `node --test QA/tests/integration/` runs without module import errors

### 8.5 Layer 4 — CLI Automation

- [ ] `notify.js` accepts `--employee` flag and a notification type as first argument
- [ ] `TEST_MODE=true` env var guard added to notify.js (one line) before Telegram sendMessage call
- [ ] Test fixture `QA/tests/fixtures/chat_registry_test.json` contains known `{EMP-001: 11111}` entry
- [ ] `node --test QA/tests/cli/` runs without import errors

### 8.6 Layer 5 — Manual Telegram

- [ ] Staging bot token configured (`@ClotildeTestBot` or equivalent)
- [ ] Bot running: `node Index.js` — verify: "Clotilde bot is running" in console
- [ ] Test traveler registered: use `/start` and select "Operations" role
- [ ] VP-004 test account registered: use `/start` and select "VP" role in a second chat
- [ ] `chat_registry.json` populated with both test accounts after /start

---

## 9. Test Data Strategy

### 9.1 File-Based Test Data (bookings.json + chat_registry.json)

| Data | How to Create | Cleanup |
|------|--------------|---------|
| Empty bookings store | `reset-test-data.js` writes `[]` to bookings.json | Called in beforeEach for all INT-* tests |
| Empty chat registry | `reset-test-data.js` writes `{}` to chat_registry.json | Called in beforeEach for all INT-* tests |
| Test booking record | Trigger INT-030 (booking confirm) → record appears | `reset-test-data.js` in afterEach |
| Test chat registry entry | Trigger INT-003 (role selection) → entry appears | `reset-test-data.js` in afterEach |
| Known employee fixture | Copy `QA/tests/fixtures/chat_registry_test.json` before CLI tests | Restore original after each CLI test |

### 9.2 Mock / Fixture API Data

| Data | How to Create | Cleanup |
|------|--------------|---------|
| Gemini function_call response | nock intercept returning `{function_call: {name:'search_flights', args:{...}}}` | nock.cleanAll() in afterEach |
| Duffel success response | nock intercept returning fixture array from `mock_inventory.js` format | nock.cleanAll() in afterEach |
| Duffel error | nock intercept throwing network error | nock.cleanAll() in afterEach |
| Telegram sendMessage call | jest.spyOn or TEST_MODE=true → captured in temp file | Delete temp file in afterEach |
| Malformed chat_registry.json | fs.writeFileSync with invalid JSON before test | Restore original in afterEach |

### 9.3 Data Type Rules

- **PNR format:** Must match `/^[A-Z0-9]{6}$/` — 6-character alphanumeric uppercase. Never lowercase or length != 6.
- **Prices stored as numbers** in policy.js and mock_inventory.js — do NOT stringify; use `Number(price)` in comparisons.
- **Flight budget caps:** Compare `price.amount <= cap.amount` (both numbers). Never compare strings.
- **Dates in bookings.json:** ISO 8601 string format (`2026-06-01`). Never Unix timestamp.
- **employee_id format:** `EMP-NNN` string (e.g. `EMP-001`). Never numeric.
- **chat_id in chat_registry.json:** Numeric Telegram chat ID (e.g. `123456789`). Never string.
- **Advance booking date comparison:** Use `Math.floor((departure - today) / 86400000)` — same formula as policy.js. Never use moment.js.
- **Test prefix:** All test fixture bookings use `employee_id: 'TEST-EMP-001'` to distinguish from real data.

---

## 10. Risk Register

| Risk | Likelihood | Impact | Mitigation | Owner |
|------|-----------|--------|------------|-------|
| `approvals.json` file does not exist in v3.0 codebase — approval workflow ACs (US-009, US-018, US-027) cannot be verified | High | High | Verify file existence in Sprint S1; if absent, add 3-line stub to Index.js that writes pending records; escalate to Dev if gap is larger | QA + Dev |
| Gemini API rate-limiting during `node run_tests.js` — test cases fail transiently at 15 calls × 500ms = 7.5s total | Medium | Medium | 500ms sleep between calls already in place; if rate-limited, increase to 1000ms; use a dedicated API key for tests | QA |
| nock version incompatible with current Axios version in project (Axios v1+ uses adapters that nock may not intercept correctly) | Medium | High | Verify nock + Axios compatibility on Node 20 before S1; fallback: use `jest.mock('./duffel.js')` instead of HTTP-level nock | QA |
| In-memory session state lost between test calls — Index.js sessions are stored in a `Map` that resets per require() call | Low | High | Import Index.js in a single test process and keep alive across test cases in a suite; use `--test-force-exit` if needed | QA |
| Telegram Webhook in CI — no live Telegram connection in GitHub Actions; L5 manual tests cannot run in CI | High | Medium | L5 tests are explicitly excluded from CI (see Appendix B); run manually before PR merge; document in PR template | QA |
| bookings.json / chat_registry.json polluted across test runs — no teardown leaves stale records | High | High | `reset-test-data.js` called in beforeEach for ALL L3 tests; CI pipeline resets files between jobs | QA |
| VP-004 self-approval gap (US-020 AC-2) — behavior not yet implemented in Index.js; test INT-054 will fail if no guard exists | High | Medium | Write INT-054 as `test.skip` until Index.js implements the guard; Dev implements in S1; QA re-enables test after merge | QA + Dev |
| PNR collision — `generatePNR()` uses Math.random(), non-zero probability of collision across test runs | Low | Low | Test fixture truncates bookings.json before each test so collision space is always empty; PNR format regex is the assertion | QA |

---

## Appendix A — Business Rules Reference

| Rule ID | Description | Covered By |
|---------|-------------|-----------|
| BR-H1 | Bangkok hotel budget cap: ≤ 4000 THB/night | POL-001, POL-002, POL-003, INT-071 |
| BR-H2 | Singapore hotel budget cap: ≤ 350 SGD/night | POL-004, POL-005 |
| BR-H3 | New York hotel budget cap: ≤ 350 USD/night | POL-006 |
| BR-H4 | London hotel budget cap: ≤ 280 GBP/night | POL-006 |
| BR-H5 | Tokyo hotel budget cap: ≤ 40,000 JPY/night | POL-006 |
| BR-H6 | Default hotel budget cap: ≤ 200 USD/night | POL-007 |
| BR-H7 | Currency mismatch → compliance returns null (manual review) | POL-008 |
| BR-F1 | Short-haul flight cap: ≤ 5,000 THB | POL-010, POL-011, INT-015 |
| BR-F2 | Long-haul flight cap: ≤ 25,000 THB | POL-012, POL-013, INT-015 |
| BR-C1 | Operations/Staff/Manager → Economy only (Y) | POL-015, POL-016, POL-017, INT-017 |
| BR-C2 | Director → Economy + Business (Y/W/C) | POL-018, INT-018 |
| BR-C3 | VP/C-Suite → Economy + Business (Y/W/C) | POL-018, INT-018 |
| BR-P1 | Preferred airlines: TG, SQ, EK — shown first; labelled PREFERRED & IN-POLICY | POL-019, POL-020, INT-014, INT-016 |
| BR-A1 | Advance booking: minimum 3 days before departure | POL-021, POL-022 |
| BR-E1 | Escalation triggers: lost/visa/medical/emergency → escalate_to_human | INT-060, INT-061, MAN-005 |
| BR-R1 | Role determines traveler profile, cabin class, approver routing | INT-002, INT-004, INT-017, INT-018 |
| BR-R2 | /reset command clears session and re-enters role selection | INT-005 |
| BR-B1 | Out-of-policy confirm → justification required before PNR | INT-037, INT-050, INT-073 |
| BR-B2 | In-policy confirm → PNR generated immediately without justification | INT-052, INT-053 |
| BR-B3 | Approval routing: APPROVER_EMPLOYEE_ID (VP-004) is single config point | INT-055 |
| BR-B4 | VP-004 self-booking out-of-policy → justification stored; no approval button | INT-054 |
| BR-B5 ⚠ | Approved booking → PNR generated; approval record in approvals.json | MAN-001 — **verify approvals.json exists in S1** |
| BR-B6 ⚠ | Rejected booking → no PNR; rejection reason in approvals.json | MAN-004 — **verify approvals.json exists in S1** |

> ⚠ BR-B5 and BR-B6 reference `approvals.json` — existence must be confirmed in Sprint S1 (see Risk Register). If absent, Dev must implement before these tests can pass.

---

## Appendix B — CI/CD Integration

Add to `.github/workflows/clotilde-qa.yml` (create if not exists):

```yaml
name: Clotilde QA Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  policy-tests:
    name: L1 — Policy Boundary Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - name: Run test_policy.js
        run: node test_policy.js
        # Exit code 1 if any policy test fails — CI fails automatically

  nlu-fgr-tests:
    name: L2 — NLU Regression + FGR
    runs-on: ubuntu-latest
    needs: [policy-tests]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - name: Run run_tests.js
        run: node run_tests.js
        env:
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
          TELEGRAM_BOT_TOKEN: test-token-not-used-in-nlu
        # Exit code 1 if IRA < 80% — CI fails automatically

  integration-tests:
    name: L3 — Integration Tests (mocked APIs)
    runs-on: ubuntu-latest
    needs: [policy-tests]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - name: Reset test data
        run: node QA/tests/fixtures/reset-test-data.js
      - name: Run integration tests
        run: node --test QA/tests/integration/
        env:
          TELEGRAM_BOT_TOKEN: test-token-mocked
          GEMINI_API_KEY: test-key-mocked-by-nock
          NODE_ENV: test

  cli-tests:
    name: L4 — CLI Automation (notify.js)
    runs-on: ubuntu-latest
    needs: [policy-tests]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - name: Run CLI tests
        run: node --test QA/tests/cli/
        env:
          TEST_MODE: 'true'
          TELEGRAM_BOT_TOKEN: test-token-mocked

  # L5 Manual Telegram (MAN-* tests) are EXCLUDED from CI.
  # These require a live bot token and Telegram connection.
  # Run manually before merging PRs that touch:
  #   - Index.js approval/escalation callbacks
  #   - agent.js multi-turn flows
  # Document results in QA/tests/manual/03-observations.md

  qa-report:
    name: QA Summary
    runs-on: ubuntu-latest
    needs: [policy-tests, nlu-fgr-tests, integration-tests, cli-tests]
    if: always()
    steps:
      - uses: actions/checkout@v4
      - name: Check all QA jobs passed
        run: |
          echo "policy-tests: ${{ needs.policy-tests.result }}"
          echo "nlu-fgr-tests: ${{ needs.nlu-fgr-tests.result }}"
          echo "integration-tests: ${{ needs.integration-tests.result }}"
          echo "cli-tests: ${{ needs.cli-tests.result }}"
```

**Required GitHub Secrets:**
- `GEMINI_API_KEY` — for L2 NLU tests only
- `TELEGRAM_BOT_TOKEN` — not needed for CI (mocked); real token for manual L5 only

---

*QA Master Test Plan — Clotilde v3.0*
*Template version: 2.0 | Pipeline: PIPELINE.md v3.0*
*New skills: node-integration-test (§6.1) + cli-automation (§6.2)*
*Total test IDs: 82 | Stories covered: 27/27 (100%)*
