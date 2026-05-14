# E2E Manual Test Cases — EP-07 Hotel Booking Pipeline
**Stories:** US-025, US-026, US-027
**Date:** 2026-05-14
**Author:** QA (AI-assisted)
**Layer:** L5 Manual Telegram (end-to-end via live Telegram bot)
**Test runner:** Telegram app (mobile or desktop)
**Status:** Ready for Execution — Sprint S1a

---

## Test Environment

| Item | Value |
|------|-------|
| Bot | @ClotildeBot (dev/test instance) |
| Runtime | Node.js ≥18 running `Index.js` |
| Required env | `TELEGRAM_BOT_TOKEN` + `GEMINI_API_KEY` in `.env` |
| Reset between tests | `/reset` or restart `node Index.js`; truncate `bookings.json` |
| Two accounts | Traveler (Staff) + VP-004 (Approver) for US-027 tests |

**BLOCKING RISK:** E2E-077 and E2E-078 depend on `approvals.json` being implemented. Mark as BLOCKED if not implemented.

---

## E2E-071 — Hotel search: results list with compliance labels

**Story:** US-025 AC-1, AC-2
**Priority:** P0

**Steps:**
1. `/start` → Staff role.
2. Send: `"Find me a hotel in Bangkok, checking in June 1 and out June 3"`
3. Read bot reply.

**Expected Result:**
- Bot returns a non-empty hotel list
- Each hotel has a compliance label: `IN-POLICY` or `OUT-OF-POLICY`
- Labels reflect the BKK hotel budget cap (4000 THB)

**Pass Criteria:** Hotel list displayed; all options labelled.

---

## E2E-072 — In-policy hotel confirm: reference code generated

**Story:** US-025 AC-3
**Priority:** P0

**Precondition:** Continue from E2E-071. An IN-POLICY hotel is available.

**Steps:**
1. Tap `Confirm` on an `IN-POLICY` hotel.
2. Read bot reply.
3. Inspect `bookings.json`.

**Expected Result:**
- Bot displays a booking reference code (not PNR — a hotel reference)
- `bookings.json` contains: `type: "hotel"`, reference code, `status: "CONFIRMED"`

**Pass Criteria:** Reference code in chat; CONFIRMED hotel record in bookings.json.

---

## E2E-073 — Hotel without dates: bot asks for check-in/out

**Story:** US-025 edge case
**Priority:** P0

**Steps:**
1. `/start` → Staff role.
2. Send: `"I need a hotel in Bangkok"` (no dates).
3. Read bot reply.

**Expected Result:**
- Bot asks for check-in date (and possibly check-out date)
- No hotel search results displayed before dates are provided

**Pass Criteria:** Date clarification asked; no premature hotel results.

---

## E2E-074 — Hotel in city with no mock inventory: graceful no-results

**Story:** US-025 edge case
**Priority:** P1

**Precondition:** Use a city that has no hotels in mock_inventory.js (e.g. a made-up city).

**Steps:**
1. `/start` → Staff role.
2. Send: `"Find a hotel in Zanzibar, June 1 to June 3"` (if not in mock).
3. Read bot reply.

**Expected Result:**
- Bot replies with a "no results" message (e.g. "No hotels found for that city")
- No crash; bot ready for next message

**Pass Criteria:** No-results message; no crash.

---

## E2E-075 — test_policy.js hotel boundaries: all 5 cities pass

**Story:** US-026 AC-3
**Priority:** P0

**Steps:**
1. Open terminal (bot NOT required).
2. Run: `node test_policy.js`
3. Read output for hotel boundary tests.

**Expected Result:**
- BKK: 3999 THB PASS, 4000 THB PASS, 4001 THB PASS (fail line)
- SIN, NYC, LON, TYO: equivalent 3 tests each PASS
- Total: 15/15 hotel boundary tests PASS

**Pass Criteria:** 15/15 PASS; exit code 0.

---

## E2E-076 — Out-of-policy hotel confirm: justification prompt (no reference code)

**Story:** US-027 AC-1
**Priority:** P0

**Steps:**
1. `/start` → Staff role.
2. Find a hotel marked `OUT-OF-POLICY` (price above city cap).
3. Tap `Confirm` on the OUT-OF-POLICY hotel.
4. Read bot reply.

**Expected Result:**
- Bot asks for business justification
- No hotel reference code displayed
- `bookings.json` has no new CONFIRMED hotel record

**Pass Criteria:** Justification prompt; no reference code.

---

## E2E-077 — Hotel justification: PENDING approval record with hotel fields

**Story:** US-027 AC-2
**Priority:** P0

**Precondition:** Continue from E2E-076 (bot awaiting justification). approvals.json implemented.

**Steps:**
1. Send: `"Client requires premium accommodation per our contract"`
2. Read bot reply.
3. Inspect `approvals.json`.

**Expected Result:**
- Bot confirms justification received
- `approvals.json` contains PENDING record with:
  - `hotel_name`
  - `room_type`
  - `price_per_night`
  - `checkin`
  - `checkout`
  - `status: "PENDING"`

**Pass Criteria:** All hotel fields in PENDING record.

**CONDITIONAL:** BLOCKED if approvals.json not implemented.

---

## E2E-078 — Hotel PENDING: no CONFIRMED record in bookings.json

**Story:** US-027 AC-3
**Priority:** P0

**Precondition:** Continue from E2E-077 (hotel justification submitted, PENDING).

**Steps:**
1. Inspect `bookings.json`.
2. Search for employee_id used in this session.

**Expected Result:**
- No `status: CONFIRMED` hotel record for this trip
- Record is absent or in PENDING/approval state

**Pass Criteria:** No CONFIRMED hotel record before VP approval.

**CONDITIONAL:** BLOCKED if approvals.json not implemented.

---

## E2E-079 — Currency mismatch hotel: null compliance → justification flow

**Story:** US-027 edge case / US-021 edge case
**Priority:** P1

**Precondition:** Modify getMockHotels to return a hotel with USD price in a THB-cap city. Restore after test.

**Steps:**
1. `/start` → Staff role.
2. Search for hotels in the modified city.
3. Tap Confirm on the USD-priced hotel.
4. Read bot reply.

**Expected Result:**
- Bot asks for justification (null compliance treated as non-compliant)
- No hotel reference code generated

**Pass Criteria:** Justification prompt shown for null-compliance hotel.

---

## E2E-080 — Hotel search: SIN hotels comply against SIN cap

**Story:** US-025 AC-2 (multi-city validation)
**Priority:** P1

**Steps:**
1. `/start` → Staff role.
2. Send: `"Find a hotel in Singapore, June 5 to June 7"`
3. Inspect compliance labels.

**Expected Result:**
- Hotels priced ≤ 350 SGD: `IN-POLICY`
- Hotels priced > 350 SGD: `OUT-OF-POLICY`

**Pass Criteria:** Correct labels per SIN hotel budget cap.

---

## Summary

| Test ID | Story | AC | Priority | Channel |
|---------|-------|----|---------:|---------|
| E2E-071 | US-025 | AC-1/2 | P0 | Telegram |
| E2E-072 | US-025 | AC-3 | P0 | Telegram + file |
| E2E-073 | US-025 | EC | P0 | Telegram |
| E2E-074 | US-025 | EC | P1 | Telegram |
| E2E-075 | US-026 | AC-3 | P0 | Terminal |
| E2E-076 | US-027 | AC-1 | P0 | Telegram |
| E2E-077 | US-027 | AC-2 | P0 | Telegram + file (CONDITIONAL) |
| E2E-078 | US-027 | AC-3 | P0 | file (CONDITIONAL) |
| E2E-079 | US-027/021 | EC | P1 | Telegram |
| E2E-080 | US-025 | AC-2 | P1 | Telegram |

**Total: 10 E2E tests** (7 P0, 3 P1)

---

## Blocking Risk

**E2E-077 and E2E-078** require `approvals.json` to be implemented in v3.0.
If not implemented: mark BLOCKED; raise Dev ticket; these tests cannot execute until implementation is confirmed.
