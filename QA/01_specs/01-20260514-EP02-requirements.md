# Requirements Analysis — EP-02 Policy Compliance Engine
**Stories:** US-005, US-006, US-007, US-008, US-009
**Date:** 2026-05-14
**Author:** Requirements Analyst (AI-assisted)
**Source:** 002-20260514-CLOTILDE-final.md
**Test runner:** `node test_policy.js` (L1) + `node Index.js` integration (L3)
**Status:** Confirmed — Ready for Phase 2

---

## Pre-flight Check

- [x] File exists: `QA/00_user-stories/002-20260514-CLOTILDE-final.md`
- [x] Story summaries present for US-005 through US-009
- [x] All ACs written in Given/When/Then format
- [x] No contradictory ACs found
- [x] Escalation US-020 resolved (option b confirmed)

---

## US-005 — Compliance Display

### Story Summary
Staff employee sees which flights comply with company policy so they don't accidentally choose a policy-violating option.

### Acceptance Criteria (verbatim)
- **AC-1:** Given search_flights returns results; When formatted output displayed; Then every result includes is_compliant (true/false) AND label "IN-POLICY" or "OUT-OF-POLICY"
- **AC-2:** Given preferred airline operates on the route; When result list displayed; Then preferred airline labelled "PREFERRED & IN-POLICY" AND appears first
- **AC-3:** Given route where Thai Airways operates (BKK→SIN); When getMockFlights returns results; Then first result has is_preferred:true AND airline_code matches POLICY.preferredAirlines

### Edge Cases to Test
1. All returned flights are out of policy — list renders without crashing; all labelled OUT-OF-POLICY
2. Route has no preferred airline (e.g. domestic BKK→CNX) — no PREFERRED label; results display normally
3. is_preferred field is missing on a result object — should not appear as PREFERRED (defensive check)

### Test Scope
- In scope: is_compliant field presence, label text in formatInventory() output, preferred airline ordering
- Out of scope: live Duffel prices (mock only), currency conversion

### Risk Areas
- formatInventory() label logic — if the field name changes in policy.js, all labels break silently
- Preferred airline ordering depends on getMockFlights sort — not explicitly sorted by code

### Open Questions
| ❓ Question | 📌 Assumed | 👤 Owner | ⚠ Risk |
|---|---|---|---|
| What label appears when is_compliant is null (currency mismatch)? | Assume "REQUIRES REVIEW" or no compliance label | Dev | Test may assert wrong label |

---

## US-006 — Out-of-Policy Flag

### Story Summary
Staff employee sees out-of-policy options clearly labelled so they understand the cost implication before choosing.

### Acceptance Criteria (verbatim)
- **AC-1:** Given flight price exceeds SHORT_HAUL or LONG_HAUL cap; When getMockFlights returns result; Then is_compliant: false on that object
- **AC-2:** Given flight with is_compliant:false in results; When formatInventory() formats results; Then output contains label "OUT-OF-POLICY"
- **AC-3:** Given flight priced exactly 1 THB above cap; When compliance evaluated; Then is_compliant: false

### Edge Cases to Test
1. Price exactly AT the cap (not above) — must be is_compliant: true (boundary: ≤ not <)
2. Price is 0 THB — unusual but possible in mock; should still evaluate correctly
3. Route type misidentified (SHORT_HAUL vs LONG_HAUL) — wrong cap applied

### Test Scope
- In scope: is_compliant computation at boundary values, OUT-OF-POLICY label in output
- Out of scope: blocking selection of out-of-policy options (system allows with justification)

### Risk Areas
- Route type (SHORT_HAUL vs LONG_HAUL) determination in mock_inventory.js — not exposed as a field; inferred from route

---

## US-007 — Automated Boundary Value Tests

### Story Summary
QA Engineer can run automated boundary tests against policy.js and get 100% pass confirmation.

### Acceptance Criteria (verbatim)
- **AC-1:** Given unmodified policy.js; When `node test_policy.js` executed; Then exits 0, 100% passed, "ALL POLICY RULES VERIFIED"
- **AC-2:** Given BKK hotel at exactly 4000 THB; When evaluated; Then is_compliant: true ✅
- **AC-3:** Given BKK hotel at 4001 THB (cap+1); When evaluated; Then is_compliant: false ✅
- **AC-4:** Given hotel cap triple test per city; When BKK/SIN/NYC/LON/TYO tested; Then all 15 city boundary tests pass

### Edge Cases to Test
1. policy.js modified to change BKK cap — test_policy.js must fail immediately (regression detection)
2. New city added to policy.js without updating test — existing tests still pass, new city not covered
3. test_policy.js run with Node.js version incompatibility

### Test Scope
- In scope: test_policy.js execution, exit codes, boundary value correctness, all 5 cities + DEFAULT
- Out of scope: multi-currency boundary tests

### Risk Areas
- test_policy.js is the source of truth for policy compliance — if it passes on wrong values, compliance is broken everywhere

---

## US-008 — Cabin Class Enforcement

### Story Summary
Staff employee cannot select Business Class; Directors and above can select Business Class without a compliance flag.

### Acceptance Criteria (verbatim)
- **AC-1:** Given Staff/Operations role; When Business Class (C) results returned; Then is_compliant: false
- **AC-2:** Given Director/VP/C-Suite role; When Business Class (C) results returned; Then is_compliant: true
- **AC-3:** Given compliance check executes; When role is read; Then role comes from session.role (set at /start), NOT from user message

### Edge Cases to Test
1. Manager searches for Business Class — Manager is NOT in the Director+ group; is_compliant: false
2. VP requests Economy (downgrade) — Economy IS in the allowed list for VP; is_compliant: true
3. Role is undefined (session not fully initialized) — defensive: treat as most restrictive (Economy only)

### Test Scope
- In scope: cabin class compliance per role, role source (session not user message)
- Out of scope: Premium Economy (W) entitlement (not defined in policy.js)

### Risk Areas
- POLICY.cabinClass role grouping — if role strings change in travelers.yml, compliance breaks silently

---

## US-009 — Justification Flow

### Story Summary
Staff employee selecting an out-of-policy option is asked for a business justification before routing to manager approval.

### Acceptance Criteria (verbatim)
- **AC-1:** Given user confirms flight/hotel with is_compliant:false; When booking_confirm fires; Then bot asks for justification AND does NOT generate PNR
- **AC-2:** Given user submits non-empty justification; When bot processes; Then approval record persisted as PENDING with justification text
- **AC-3:** Given approval record in PENDING status; When bookings.json inspected; Then no CONFIRMED record for this trip

### Edge Cases to Test
1. User sends empty string as justification — bot must ask again; empty not accepted
2. User sends whitespace-only justification ("   ") — should count as empty, re-prompt
3. Justification submitted then bot crashes — record may be partially written (data integrity risk)

### Test Scope
- In scope: justification request trigger, approval record creation, PNR withheld until approval
- Out of scope: multi-level approval chain, approval expiry/TTL

### Risk Areas
- approvals.json existence not confirmed in v3.0 codebase (HIGH — see Risk Register)
- Whitespace-only justification may pass the empty check in Index.js

---

## Combined Risk Areas — EP-02

| Risk | Severity | Mitigation |
|------|----------|------------|
| approvals.json not implemented | High | Verify in codebase before writing INT-* tests for US-009 |
| policy.js field name change breaks all compliance | High | test_policy.js covers this; run after every policy.js change |
| formatInventory() label text changes | Medium | COMP tests assert exact label strings; update if intentional |
| Role-to-cabin-class mapping array includes wrong role strings | Medium | POL-015–018 cover all 5 roles at boundary |
