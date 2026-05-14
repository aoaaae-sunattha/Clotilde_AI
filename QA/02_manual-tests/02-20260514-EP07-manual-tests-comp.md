# COMP Manual Test Cases — EP-07 Hotel Booking Pipeline
**Stories:** US-025, US-026, US-027
**Date:** 2026-05-14
**Author:** QA (AI-assisted)
**Layer:** L2 Component (module + script assertions; no UI)
**Test runner:** `node test_policy.js` + direct module calls
**Status:** Ready for Execution — Sprint S1a

---

## Test Environment

| Item | Value |
|------|-------|
| Runtime | Node.js ≥18 |
| Required files | `policy.js`, `mock_inventory.js`, `prompt.js`, `test_policy.js`, `Index.js` |
| Required env | None for L1/module tests |
| Reset required | None for L1; truncate bookings.json + approvals.json for booking path |

---

## COMP-081 — getMockHotels returns non-empty list for known city

**Story:** US-025 AC-1
**Priority:** P0

**Steps:**
1. In REPL or script:
   ```js
   const { getMockHotels } = require('./mock_inventory');
   const results = getMockHotels('BKK', '2026-06-01', '2026-06-03');
   console.log('Count:', results.length, results[0]);
   ```

**Expected Result:**
- `results.length > 0`
- Each result has hotel name, price, city fields

**Pass Criteria:** Non-empty array returned for BKK.

---

## COMP-082 — Hotel results include is_compliant per POLICY.hotelBudgetCap

**Story:** US-025 AC-2
**Priority:** P0

**Steps:**
1. Call `getMockHotels('BKK', '2026-06-01', '2026-06-03')`.
2. For each result, inspect `is_compliant` and `price.amount`.
3. Verify: price ≤ 4000 THB → `is_compliant: true`; price > 4000 THB → `is_compliant: false`.

**Expected Result:**
- All hotels with price ≤ 4000 THB have `is_compliant: true`
- All hotels with price > 4000 THB have `is_compliant: false`

**Pass Criteria:** Compliance correctly computed for all BKK hotels.

---

## COMP-083 — Hotel compliance boundary: at cap (4000 THB) → true

**Story:** US-026 AC-1
**Priority:** P0

**Steps:**
1. Run `node test_policy.js`.
2. Find BKK hotel boundary tests in output.
3. Confirm 4000 THB → `is_compliant: true` PASS.

**Expected Result:** test_policy.js PASS for BKK at-cap hotel.

**Pass Criteria:** BKK cap test PASS.

---

## COMP-084 — Hotel compliance boundary: cap+1 (4001 THB) → false

**Story:** US-026 AC-2
**Priority:** P0

**Steps:**
1. Run `node test_policy.js`.
2. Find BKK cap+1 test in output.
3. Confirm 4001 THB → `is_compliant: false` PASS.

**Expected Result:** test_policy.js PASS for BKK cap+1 hotel.

**Pass Criteria:** PASS.

---

## COMP-085 — All 5 cities × 3 boundary tests pass in test_policy.js

**Story:** US-026 AC-3
**Priority:** P0

**Steps:**
1. Run `node test_policy.js`.
2. Count hotel boundary test PASSes: BKK, SIN, NYC, LON, TYO.
3. Each city must show 3 PASSes: cap-1, cap, cap+1.

**Expected Result:**
- 15 hotel boundary tests PASS (5 cities × 3)

**Pass Criteria:** 15/15 PASS.

---

## COMP-086 — Currency mismatch: hotelCompliance() returns null

**Story:** US-026 AC-3 edge case
**Priority:** P0

**Steps:**
1. Construct a hotel object with price in USD but city cap in THB (currency mismatch).
2. Call the hotel compliance function from `mock_inventory.js` or `policy.js`.
3. Confirm return value is `null`.

**Expected Result:** `null` returned for currency mismatch — not `true` or `false`.

**Pass Criteria:** Return value is `null`.

---

## COMP-087 — is_compliant: null treated as non-compliant in booking_confirm

**Story:** US-027 edge case / US-021 edge case
**Priority:** P0

**Steps:**
1. Read `booking_confirm` handler in `Index.js`.
2. Confirm compliance check is `!is_compliant` (falsy) not `=== false` (strict).
3. Confirm null → justification path.

**Expected Result:** Null compliance treated as non-compliant; justification required.

**Pass Criteria:** Falsy check in code.

---

## COMP-088 — Hotel booking record: type "hotel" and reference code in bookings.json

**Story:** US-025 AC-3
**Priority:** P0

**Steps:**
1. Trace the `booking_confirm` handler for in-policy hotel confirm in `Index.js`.
2. Confirm the written record has `type: "hotel"`.
3. Confirm a reference code field exists (not PNR — may be "ref" or "hotel_ref").

**Expected Result:**
- Record has `type: "hotel"`
- Reference code field present with a non-empty value
- `status: "CONFIRMED"`

**Pass Criteria:** type, reference, and status all present.

---

## COMP-089 — Hotel out-of-policy confirm: no reference code generated

**Story:** US-027 AC-1
**Priority:** P0

**Steps:**
1. Trace `booking_confirm` handler for `is_compliant: false` hotel.
2. Confirm: no hotel reference code generation in the non-compliant path.
3. Confirm: justification prompt issued.

**Expected Result:**
- No reference code in out-of-policy hotel path
- Justification prompt in the response

**Pass Criteria:** Reference code absent; justification prompt present.

---

## COMP-090 — Hotel approval record includes hotel-specific fields (CONDITIONAL)

**Story:** US-027 AC-2
**Priority:** P0

**Precondition:** approvals.json implemented. If not — SKIP and flag as BLOCKED.

**Steps:**
1. Trace the hotel approval record write in `Index.js`.
2. Confirm the record object includes all AC-2 fields:
   - `hotel_name`
   - `room_type`
   - `price_per_night`
   - `checkin`
   - `checkout`
   - `status: "PENDING"`

**Expected Result:** All 5 hotel-specific fields + status in record.

**Pass Criteria:** All fields present in write call.

---

## COMP-091 — getMockHotels: no-hotels-found city returns empty array (no crash)

**Story:** US-025 edge case
**Priority:** P1

**Steps:**
1. Call `getMockHotels('ZZZ', '2026-06-01', '2026-06-03')` (unknown city).
2. Confirm return value is an empty array, not an exception.

**Expected Result:**
- Returns `[]`
- No unhandled exception

**Pass Criteria:** Empty array returned; no crash.

---

## Summary

| Test ID | Story | AC | Priority | Type |
|---------|-------|----|---------:|------|
| COMP-081 | US-025 | AC-1 | P0 | Module: hotel list |
| COMP-082 | US-025 | AC-2 | P0 | Module: compliance flags |
| COMP-083 | US-026 | AC-1 | P0 | Script: at-cap |
| COMP-084 | US-026 | AC-2 | P0 | Script: cap+1 |
| COMP-085 | US-026 | AC-3 | P0 | Script: all cities |
| COMP-086 | US-026 | EC | P0 | Module: null on mismatch |
| COMP-087 | US-027/021 | EC | P0 | Static: null falsy |
| COMP-088 | US-025 | AC-3 | P0 | Static: hotel record type |
| COMP-089 | US-027 | AC-1 | P0 | Static: no ref on OOP |
| COMP-090 | US-027 | AC-2 | P0 | Static: hotel fields (CONDITIONAL) |
| COMP-091 | US-025 | EC | P1 | Module: empty city |

**Total: 11 COMP tests** (10 P0, 1 P1)

**CONDITIONAL tests** (COMP-090): depends on approvals.json implementation.
