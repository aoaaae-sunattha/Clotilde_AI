# COMP Manual Test Cases — EP-01 Flight Booking Pipeline
**Stories:** US-001, US-002, US-003, US-004
**Date:** 2026-05-14
**Author:** QA (AI-assisted)
**Layer:** L2 Component (module + script assertions; no UI)
**Test runner:** Direct module calls + node script execution
**Status:** Ready for Execution — Sprint S1a

---

## Test Environment

| Item | Value |
|------|-------|
| Runtime | Node.js ≥18 |
| Required files | `Index.js`, `duffel.js`, `mock_inventory.js`, `prompt.js`, `policy.js` |
| Required env | `GEMINI_API_KEY` (for agent.js integration); `TELEGRAM_BOT_TOKEN` not needed for pure component |
| Reset required | Truncate `bookings.json` to `[]` between tests |

---

## COMP-040 — search_flights returns is_compliant and is_preferred per result

**Story:** US-001 AC-1
**Priority:** P0

**Steps:**
1. In Node.js REPL or script:
   ```js
   const { getMockFlights } = require('./mock_inventory');
   const results = getMockFlights('BKK', 'SIN', '2026-06-01', 'Y');
   results.forEach(r => {
     console.log(r.airline_code, 'is_compliant:', r.is_compliant, 'is_preferred:', r.is_preferred);
   });
   ```
2. Inspect output.

**Expected Result:**
- Every result has `is_compliant` field (boolean)
- Every result has `is_preferred` field (boolean or false if not preferred)

**Pass Criteria:** No undefined values for either field on any result.

---

## COMP-041 — PNR format: 6-character alphanumeric

**Story:** US-001 AC-2
**Priority:** P0

**Steps:**
1. Review PNR generation function in `Index.js`.
2. Confirm the generated PNR matches `/^[A-Z0-9]{6}$/` pattern.
3. Generate 10 PNRs and verify format.

**Expected Result:**
- All 10 PNRs are exactly 6 characters
- All characters are alphanumeric (A-Z, 0-9)

**Pass Criteria:** All 10 match the pattern.

---

## COMP-042 — Booking record in bookings.json has correct structure

**Story:** US-001 AC-3
**Priority:** P0

**Precondition:** Clean `bookings.json` (empty array).

**Steps:**
1. Simulate a booking_confirm for a Staff user (can be done via direct Index.js call or by reading the write logic).
2. Read `bookings.json` after confirm.
3. Inspect the record.

**Expected Result:**
- Record contains: `pnr`, `employee_id`, `type: "flight"`, `status: "CONFIRMED"`
- Exactly one record for this booking

**Pass Criteria:** All fields present; exactly one record.

---

## COMP-043 — Idempotency guard blocks second booking_confirm

**Story:** US-004 AC-1 / US-001 AC-4
**Priority:** P0

**Steps:**
1. In `Index.js`, trace the `booking_confirm` handler.
2. Confirm that `session.bookingInProgress` is set to `true` at handler entry.
3. Confirm that if `session.bookingInProgress === true` on re-entry, handler returns early.
4. Confirm bookings.json is not written a second time.

**Expected Result:**
- Guard flag present and checked before any write operation
- Early return on duplicate confirm

**Pass Criteria:** Code path confirms guard; static analysis.

---

## COMP-044 — Console WARNING logged on duplicate confirm

**Story:** US-004 AC-2
**Priority:** P0

**Steps:**
1. Trace the duplicate confirm path in `Index.js`.
2. Confirm a `console.warn()` or similar call exists with text indicating duplicate confirm blocked.

**Expected Result:**
- WARNING text contains "duplicate" or "blocked" or equivalent
- Logged via `console.warn` or `console.log` with a WARNING prefix

**Pass Criteria:** Warning log statement present in duplicate confirm path.

---

## COMP-045 — Duffel error triggers getMockFlights fallback

**Story:** US-003 AC-1
**Priority:** P0

**Steps:**
1. Review `duffel.js` error handling.
2. Confirm try/catch around Duffel API call.
3. Confirm catch block calls `getMockFlights` or equivalent fallback.

**Expected Result:**
- Error is caught (not thrown to caller)
- `getMockFlights` call is in the catch block or error handling path

**Pass Criteria:** Catch block with mock fallback present in duffel.js.

---

## COMP-046 — Duffel error: no raw error/stack trace returned to caller

**Story:** US-003 AC-2
**Priority:** P0

**Steps:**
1. Trace the return value of `duffel.js` on error.
2. Confirm the returned value is the mock flight array, not an Error object or string containing "Error".

**Expected Result:**
- Caller receives mock flight results, not an error object
- No error message string in the results array

**Pass Criteria:** Return type is array of flight objects.

---

## COMP-047 — Slot-filling: search_flights not called when date missing

**Story:** US-002 AC-1
**Priority:** P0

**Steps:**
1. Review `agent.js` system prompt or function calling logic.
2. Confirm `search_flights` requires all 3 parameters (origin, destination, date).
3. Confirm that when date is missing, agent.js or Gemini prompts for date rather than calling search_flights with undefined date.

**Expected Result:**
- search_flights is NOT called with an undefined or null date parameter
- Missing-date path results in a clarifying question

**Pass Criteria:** search_flights call requires all 3 params; static/code review check.

**Notes:** Runtime verification in E2E-039.

---

## COMP-048 — bookings.json exactly one record after confirmed booking

**Story:** US-001 AC-3 / US-004 AC-3
**Priority:** P0

**Precondition:** Clean bookings.json.

**Steps:**
1. Trace full booking_confirm path (compliant option, Staff role).
2. After one successful confirm, count records in bookings.json.

**Expected Result:**
- Exactly 1 record
- PNR is unique (not a duplicate of any prior booking in the array)

**Pass Criteria:** Record count = 1; PNR present.

---

## COMP-049 — Duffel fallback timing: mock results available ≤ 2s after error

**Story:** US-003 AC-3
**Priority:** P1

**Steps:**
1. In a test script, mock Duffel to reject after 500ms (simulate timeout).
2. Record timestamp before call; record timestamp when mock results returned.
3. Assert delta ≤ 2000ms.

**Expected Result:** Total time from Duffel failure to mock results ≤ 2 seconds.

**Pass Criteria:** Delta ≤ 2000ms.

**Notes:** Approximate; network and CI variance may affect this. Document as informational if flaky.

---

## Summary

| Test ID | Story | AC | Priority | Type |
|---------|-------|----|---------:|------|
| COMP-040 | US-001 | AC-1 | P0 | Field presence |
| COMP-041 | US-001 | AC-2 | P0 | PNR format |
| COMP-042 | US-001 | AC-3 | P0 | Record structure |
| COMP-043 | US-004 | AC-1 | P0 | Static: guard flag |
| COMP-044 | US-004 | AC-2 | P0 | Static: warning log |
| COMP-045 | US-003 | AC-1 | P0 | Static: catch + fallback |
| COMP-046 | US-003 | AC-2 | P0 | Static: no error in return |
| COMP-047 | US-002 | AC-1 | P0 | Static: param guard |
| COMP-048 | US-001/004 | AC-3 | P0 | Single record |
| COMP-049 | US-003 | AC-3 | P1 | Timing |

**Total: 10 COMP tests** (9 P0, 1 P1)
