# COMP Manual Test Cases — EP-02 Policy Compliance Engine
**Stories:** US-005, US-006, US-007, US-008, US-009
**Date:** 2026-05-14
**Author:** QA (AI-assisted)
**Layer:** L2 Component (non-UI; node script + formatInventory() output assertions)
**Test runner:** `node test_policy.js` · `node run_tests.js` · direct module calls
**Status:** Ready for Execution — Sprint S0

---

## Test Environment

| Item | Value |
|------|-------|
| Runtime | Node.js ≥18 |
| Required files | `policy.js`, `mock_inventory.js`, `prompt.js` (formatInventory), `test_policy.js` |
| No `.env` needed | policy.js and mock_inventory.js have no API dependency |
| Reset required | None — no file writes in COMP tests |

---

## COMP-001 — IN-POLICY label present on compliant flight

**Story:** US-005 AC-1
**Priority:** P0

**Precondition:** `mock_inventory.js` and `prompt.js` are unmodified.

**Steps:**
1. In Node.js REPL or test script, call:
   ```js
   const { getMockFlights } = require('./mock_inventory');
   const { formatInventory } = require('./prompt');
   const results = getMockFlights('BKK', 'SIN', '2026-06-01', 'Y');
   const output = formatInventory(results);
   console.log(output);
   ```
2. Inspect each flight block in the output.

**Expected Result:**
- Every result object has `is_compliant: true` or `is_compliant: false`
- Formatted output contains the string `"IN-POLICY"` for compliant results
- Formatted output contains the string `"OUT-OF-POLICY"` for non-compliant results
- No flight block is missing a compliance label

**Pass Criteria:** All compliance labels present; no unlabelled result.

---

## COMP-002 — OUT-OF-POLICY label present on non-compliant flight

**Story:** US-006 AC-2
**Priority:** P0

**Precondition:** Route that produces an above-cap result. Use BKK→LHR (LONG_HAUL cap = 25000 THB).

**Steps:**
1. Call `getMockFlights('BKK', 'LHR', '2026-06-01', 'C')` (Business Class).
2. Call `formatInventory(results)` on the returned array.
3. Search the output string for `"OUT-OF-POLICY"`.

**Expected Result:**
- At least one result has `is_compliant: false`
- `formatInventory()` output contains `"OUT-OF-POLICY"` for that result
- No crash or exception thrown

**Pass Criteria:** Label "OUT-OF-POLICY" present in output.

---

## COMP-003 — Preferred airline labelled "PREFERRED & IN-POLICY"

**Story:** US-005 AC-2
**Priority:** P0

**Precondition:** Thai Airways (TG) operates BKK→SIN (REGIONAL route).

**Steps:**
1. Call `getMockFlights('BKK', 'SIN', '2026-06-01', 'Y')`.
2. Find the result where `airline_code === 'TG'`.
3. Call `formatInventory(results)`.
4. Check label for TG flight.

**Expected Result:**
- TG result has `is_preferred: true`
- `formatInventory()` output contains `"PREFERRED & IN-POLICY"` for TG flight
- TG flight appears first in the results list

**Pass Criteria:** Label correct AND TG is first in array.

---

## COMP-004 — First result is preferred airline (ordering)

**Story:** US-005 AC-3
**Priority:** P0

**Steps:**
1. Call `getMockFlights('BKK', 'SIN', '2026-06-01', 'Y')`.
2. Assert `results[0].is_preferred === true`.
3. Assert `results[0].airline_code` is in `POLICY.preferredAirlines`.

**Expected Result:**
- `results[0].is_preferred` is `true`
- `results[0].airline_code` matches a value in `['TG', 'SQ', 'EK']`

**Pass Criteria:** Both assertions pass.

---

## COMP-005 — is_compliant false when price exceeds SHORT_HAUL cap

**Story:** US-006 AC-1
**Priority:** P0

**Precondition:** SHORT_HAUL cap = 5000 THB. Use a domestic route (BKK→CNX).

**Steps:**
1. Call `getMockFlights('BKK', 'CNX', '2026-06-01', 'Y')`.
2. Find a flight with `price.amount > 5000`.
3. Assert `is_compliant === false` on that result.

**Expected Result:**
- All flights with `price.amount > 5000` have `is_compliant: false`
- All flights with `price.amount <= 5000` have `is_compliant: true`

**Pass Criteria:** is_compliant correctly reflects cap boundary.

---

## COMP-006 — is_compliant false when price exceeds LONG_HAUL cap

**Story:** US-006 AC-1
**Priority:** P0

**Precondition:** LONG_HAUL cap = 25000 THB. Use BKK→LHR.

**Steps:**
1. Call `getMockFlights('BKK', 'LHR', '2026-06-01', 'Y')`.
2. Find a flight with `price.amount > 25000`.
3. Assert `is_compliant === false`.

**Expected Result:** Flights above 25000 THB → `is_compliant: false`.

**Pass Criteria:** is_compliant correctly set.

---

## COMP-007 — Price exactly AT cap is compliant (boundary: ≤ not <)

**Story:** US-006 AC-3 (inverse — at-cap)
**Priority:** P0

**Steps:**
1. In `test_policy.js` or script, construct a mock hotel object:
   ```js
   const hotel = { price: { amount: 4000, currency: 'THB' }, city: 'BKK' };
   ```
2. Evaluate compliance against BKK hotel cap (4000 THB).
3. Assert `is_compliant === true`.

**Expected Result:** Price at exactly cap → `is_compliant: true`.

**Pass Criteria:** Boundary check uses `<=` (not `<`).

---

## COMP-008 — Price 1 THB above cap is non-compliant

**Story:** US-006 AC-3
**Priority:** P0

**Steps:**
1. Construct mock hotel: `{ price: { amount: 4001, currency: 'THB' }, city: 'BKK' }`.
2. Evaluate compliance.
3. Assert `is_compliant === false`.

**Expected Result:** Cap+1 → `is_compliant: false`.

**Pass Criteria:** Boundary strictly enforced.

---

## COMP-009 — test_policy.js exits 0 and prints 100% (unmodified)

**Story:** US-007 AC-1
**Priority:** P0

**Precondition:** `policy.js` is unmodified (original values).

**Steps:**
1. Run: `node test_policy.js`
2. Observe exit code: `echo $?`
3. Read console output.

**Expected Result:**
- Exit code: `0`
- Output contains: `"100%"` or `"ALL POLICY RULES VERIFIED"`

**Pass Criteria:** Exit 0 + verdict line.

---

## COMP-010 — BKK hotel boundary triple test (cap-1, cap, cap+1)

**Story:** US-007 AC-2 / AC-3
**Priority:** P0

**Steps:**
1. Run `node test_policy.js`.
2. Verify the following three BKK assertions in output:
   - 3999 THB → `is_compliant: true` (cap-1)
   - 4000 THB → `is_compliant: true` (cap)
   - 4001 THB → `is_compliant: false` (cap+1)

**Expected Result:** All three assertions logged as PASS.

**Pass Criteria:** No BKK boundary test fails.

---

## COMP-011 — All 5 cities + DEFAULT tested in test_policy.js

**Story:** US-007 AC-4
**Priority:** P0

**Steps:**
1. Run `node test_policy.js`.
2. Inspect output for each city: BKK, SIN, NYC, LON, TYO, DEFAULT.
3. Each city must show at least 3 PASS lines (cap-1, cap, cap+1).

**Expected Result:**
- 18 hotel boundary tests pass (5 cities + DEFAULT × 3)
- No city is missing from output

**Pass Criteria:** 18/18 hotel tests pass.

---

## COMP-012 — Staff role: Business Class is OUT-OF-POLICY

**Story:** US-008 AC-1
**Priority:** P0

**Precondition:** Call `getMockFlights` with a mock session role of "Staff".

**Steps:**
1. Call `getMockFlights('BKK', 'LHR', '2026-06-01', 'C')` (cabin = Business).
2. Pass session role "Staff" to compliance evaluation.
3. Check `is_compliant` on Business Class results.

**Expected Result:** All cabin_class "C" results → `is_compliant: false` for Staff role.

**Pass Criteria:** is_compliant: false on all Business Class flights for Staff.

---

## COMP-013 — Operations role: Business Class is OUT-OF-POLICY

**Story:** US-008 AC-1
**Priority:** P0

**Steps:**
1. Repeat COMP-012 with role "Operations".

**Expected Result:** Same as COMP-012 — Business Class OUT-OF-POLICY.

**Pass Criteria:** is_compliant: false.

---

## COMP-014 — Director role: Business Class is IN-POLICY

**Story:** US-008 AC-2
**Priority:** P0

**Steps:**
1. Call `getMockFlights('BKK', 'LHR', '2026-06-01', 'C')`.
2. Pass role "Director" to compliance evaluation.
3. Check `is_compliant` on Business Class results.

**Expected Result:** Business Class → `is_compliant: true` for Director.

**Pass Criteria:** is_compliant: true.

---

## COMP-015 — VP role: Business Class is IN-POLICY

**Story:** US-008 AC-2
**Priority:** P0

**Steps:** Repeat COMP-014 with role "VP".

**Expected Result:** `is_compliant: true`.

**Pass Criteria:** is_compliant: true.

---

## COMP-016 — Manager role: Business Class is OUT-OF-POLICY

**Story:** US-008 AC-1 (edge case — Manager is NOT Director+)
**Priority:** P0

**Steps:** Repeat COMP-012 with role "Manager".

**Expected Result:** Business Class → `is_compliant: false` for Manager.

**Pass Criteria:** is_compliant: false (Manager is not in the Director+ group).

---

## COMP-017 — Role source is session.role (not user message)

**Story:** US-008 AC-3
**Priority:** P0

**Precondition:** This is a code path check — verify in `mock_inventory.js` or compliance logic.

**Steps:**
1. Inspect the compliance evaluation function signature — confirm it accepts `role` as a parameter (not parsed from a message string).
2. Trace the call in `agent.js` or `Index.js` to confirm `session.role` is passed, not any user-provided string.

**Expected Result:** Compliance function receives role from `session.role` only.

**Pass Criteria:** No compliance path reads role from message text.

**Notes:** This is a code review / static analysis check, not a runtime assertion.

---

## COMP-018 — Out-of-policy confirm asks for justification (no PNR)

**Story:** US-009 AC-1
**Priority:** P0

**Precondition:** This is an integration-boundary check; component-level assertion via Index.js message handling.

**Steps:**
1. Review `Index.js` `booking_confirm` handler.
2. Confirm that when `selectedOption.is_compliant === false`, the bot sends a justification prompt.
3. Confirm that no PNR is generated at this step.

**Expected Result:**
- Justification message sent
- `generatePNR()` (or equivalent) NOT called when `is_compliant: false`

**Pass Criteria:** Code path shows PNR withheld; justification prompt issued.

**Notes:** Runtime verification in INT-055; this is a static check at component level.

---

## COMP-019 — Empty justification is rejected

**Story:** US-009 AC-1 (edge case)
**Priority:** P0

**Steps:**
1. In Index.js justification handler, trace the empty-string check.
2. Confirm `""` and `"   "` (whitespace-only) both trigger a re-prompt, not a PENDING record.

**Expected Result:**
- Empty string → re-prompt
- Whitespace-only → re-prompt

**Pass Criteria:** Both empty forms rejected at the code level.

**Notes:** Runtime verification in INT-058 (empty) and INT-059 (whitespace).

---

## COMP-020 — No preferred label on route with no preferred airline

**Story:** US-005 AC-2 (edge case — domestic BKK→CNX)
**Priority:** P1

**Steps:**
1. Call `getMockFlights('BKK', 'CNX', '2026-06-01', 'Y')`.
2. Check all results: none should have `is_preferred: true`.
3. Call `formatInventory(results)`.
4. Confirm output contains no `"PREFERRED"` label.

**Expected Result:** No PREFERRED label in domestic-only route output.

**Pass Criteria:** Label absent.

---

## COMP-021 — All-out-of-policy result set renders without crash

**Story:** US-005 edge case 1
**Priority:** P1

**Steps:**
1. Construct an array of 3 flight objects all with `is_compliant: false`.
2. Call `formatInventory(allOutOfPolicy)`.
3. Confirm output is a non-empty string.
4. Confirm output contains "OUT-OF-POLICY" for each item.
5. Confirm no exception thrown.

**Expected Result:** formatInventory renders correctly with all-OOP result set.

**Pass Criteria:** No crash; all labelled OUT-OF-POLICY.

---

## Summary

| Test ID | Story | AC | Priority | Type |
|---------|-------|----|---------:|------|
| COMP-001 | US-005 | AC-1 | P0 | Label presence |
| COMP-002 | US-006 | AC-2 | P0 | Label presence |
| COMP-003 | US-005 | AC-2 | P0 | Label text + position |
| COMP-004 | US-005 | AC-3 | P0 | Ordering |
| COMP-005 | US-006 | AC-1 | P0 | Boundary |
| COMP-006 | US-006 | AC-1 | P0 | Boundary |
| COMP-007 | US-006 | AC-3 inv. | P0 | Boundary ≤ |
| COMP-008 | US-006 | AC-3 | P0 | Boundary cap+1 |
| COMP-009 | US-007 | AC-1 | P0 | Script execution |
| COMP-010 | US-007 | AC-2/3 | P0 | Triple boundary |
| COMP-011 | US-007 | AC-4 | P0 | All cities |
| COMP-012 | US-008 | AC-1 | P0 | Role: Staff |
| COMP-013 | US-008 | AC-1 | P0 | Role: Operations |
| COMP-014 | US-008 | AC-2 | P0 | Role: Director |
| COMP-015 | US-008 | AC-2 | P0 | Role: VP |
| COMP-016 | US-008 | AC-1 | P0 | Role: Manager (not Director+) |
| COMP-017 | US-008 | AC-3 | P0 | Static: role source |
| COMP-018 | US-009 | AC-1 | P0 | Static: no PNR on OOP |
| COMP-019 | US-009 | AC-1 EC | P0 | Static: empty justification |
| COMP-020 | US-005 | EC-2 | P1 | No preferred on domestic |
| COMP-021 | US-005 | EC-1 | P1 | All-OOP renders |

**Total: 21 COMP tests** (19 P0, 2 P1)
