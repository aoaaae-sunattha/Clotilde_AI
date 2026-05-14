# E2E Manual Test Cases — EP-01 Flight Booking Pipeline
**Stories:** US-001, US-002, US-003, US-004
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
| Reset between tests | `/reset` or restart `node Index.js` |
| Files to inspect | `bookings.json` |

---

## E2E-033 — Full flight booking: intent → results → confirm → PNR

**Story:** US-001 AC-1, AC-2, AC-3
**Priority:** P0

**Precondition:** Bot running. Staff role.

**Steps:**
1. Send `/start` → select "Staff / Operations".
2. Send: `"Book me a flight from Bangkok to Singapore on June 1"`
3. Read flight results list.
4. Tap `Confirm` on an IN-POLICY result.
5. Read bot reply.
6. Inspect `bookings.json`.

**Expected Result:**
- Step 3: Flight list displayed with compliance labels
- Step 5: PNR displayed (6-char alphanumeric, e.g. "TK7A9Z")
- Step 6: One record with `pnr`, `employee_id`, `type: "flight"`, `status: "CONFIRMED"`

**Pass Criteria:** PNR in chat; CONFIRMED record in bookings.json.

---

## E2E-034 — Slot-filling: bot asks for missing date

**Story:** US-002 AC-1, AC-2
**Priority:** P0

**Steps:**
1. `/start` → Staff role.
2. Send: `"Book me a flight to Singapore"` (no date).
3. Read bot reply (should ask for date).
4. Reply with: `"June 15"`
5. Read bot reply.

**Expected Result:**
- Step 3: Bot asks for departure date (not flight results)
- Step 5: Bot returns Singapore flight results for June 15

**Pass Criteria:** Clarification asked; results returned after date provided.

---

## E2E-035 — Full slot provided: no clarification, immediate results

**Story:** US-002 AC-3
**Priority:** P0

**Steps:**
1. `/start` → Staff role.
2. Send: `"Book me a flight from Bangkok to Singapore on June 10"`
3. Read bot reply immediately.

**Expected Result:**
- Bot returns flight results without asking any clarifying question
- No "What date?" message before results

**Pass Criteria:** Results on first message; no clarifying question.

---

## E2E-036 — Duffel fallback: bot returns results despite API being unavailable

**Story:** US-003 AC-1, AC-2, AC-3
**Priority:** P0

**Precondition:** Simulate Duffel failure by temporarily setting an invalid `DUFFEL_API_KEY` or blocking Duffel in `duffel.js`. Restart bot. (Alternatively: kill network to Duffel endpoint.)

**Steps:**
1. Configure Duffel to fail (invalid key or offline).
2. `/start` → Staff role.
3. Send: `"Flight from Bangkok to Singapore on June 1"` (with a valid date to trigger Duffel path).
4. Read bot reply.

**Expected Result:**
- Bot returns flight results (from mock fallback)
- No raw error message, stack trace, or "Error" visible in chat
- Results appear within ~2 seconds of sending message

**Pass Criteria:** Mock results displayed; no error visible; within 2s.

---

## E2E-037 — Double-tap confirm: only one PNR, one bookings.json record

**Story:** US-004 / US-001 AC-4
**Priority:** P0

**Precondition:** Bot running. Tester has a flight results list displayed.

**Steps:**
1. `/start` → Staff role.
2. Request BKK→SIN flight. Wait for results.
3. Tap `Confirm` on an IN-POLICY flight.
4. Immediately (within 1 second) tap `Confirm` again on the same result.
5. Wait for both to process.
6. Read bot reply; inspect `bookings.json`.

**Expected Result:**
- Bot displays one PNR (not two)
- `bookings.json` contains exactly one record for this session
- Server console shows a WARNING about duplicate confirm blocked

**Pass Criteria:** One PNR; one record; console WARNING.

**Notes:** May require physical device testing with fast double-tap. Or simulate via two parallel webhook calls in L3 integration test.

---

## E2E-038 — Destination as country name: bot asks for city

**Story:** US-002 AC-1 edge case
**Priority:** P1

**Steps:**
1. `/start` → Staff role.
2. Send: `"Book a flight to France"`
3. Read bot reply.

**Expected Result:**
- Bot asks which city in France (or resolves to Paris/CDG)
- No immediate search results for "France" as destination

**Pass Criteria:** City clarification or Paris resolution; no error.

---

## E2E-039 — Relative date: bot clarifies calendar date

**Story:** US-002 AC-1 edge case
**Priority:** P1

**Steps:**
1. `/start` → Staff role.
2. Send: `"Book me a flight to Singapore next Friday"`
3. Read bot reply.

**Expected Result:**
- Bot either resolves to the specific calendar date (e.g. "June 13") and confirms, OR asks for date clarification
- No search with undefined date

**Pass Criteria:** Specific date resolved or clarification asked.

---

## E2E-040 — New intent during active booking flow: session handles gracefully

**Story:** US-001 edge case
**Priority:** P1

**Steps:**
1. `/start` → Staff role.
2. Request BKK→SIN flight. Get results (keyboard still visible).
3. Without confirming, send: `"Actually, book me a flight to London instead"`
4. Read bot reply.

**Expected Result:**
- Bot processes new intent (London flight search)
- Previous BKK→SIN keyboard may be replaced or still visible
- No crash or unhandled exception

**Pass Criteria:** Bot responds to new intent; no crash.

---

## E2E-041 — Both Duffel and mock return empty: graceful no-results response

**Story:** US-003 edge case
**Priority:** P1

**Precondition:** Duffel failing. Temporarily modify getMockFlights to return `[]` for test route.

**Steps:**
1. Configure both to fail/return empty for a specific route.
2. Request that route.
3. Read bot reply.

**Expected Result:**
- Bot replies with a "no results found" type message
- No crash; no raw error

**Pass Criteria:** Graceful no-results message.

---

## Summary

| Test ID | Story | AC | Priority | Channel |
|---------|-------|----|---------:|---------|
| E2E-033 | US-001 | AC-1/2/3 | P0 | Telegram + file |
| E2E-034 | US-002 | AC-1/2 | P0 | Telegram |
| E2E-035 | US-002 | AC-3 | P0 | Telegram |
| E2E-036 | US-003 | AC-1/2/3 | P0 | Telegram |
| E2E-037 | US-004 | AC-1/2/3 | P0 | Telegram + file |
| E2E-038 | US-002 | EC | P1 | Telegram |
| E2E-039 | US-002 | EC | P1 | Telegram |
| E2E-040 | US-001 | EC | P1 | Telegram |
| E2E-041 | US-003 | EC | P1 | Telegram |

**Total: 9 E2E tests** (5 P0, 4 P1)
