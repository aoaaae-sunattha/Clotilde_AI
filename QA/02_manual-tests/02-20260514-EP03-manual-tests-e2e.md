# E2E Manual Test Cases — EP-03 NLU & AI Quality
**Stories:** US-010, US-011, US-012, US-013, US-014
**Date:** 2026-05-14
**Author:** QA (AI-assisted)
**Layer:** L5 Manual Telegram (end-to-end via live Telegram bot) + terminal script assertions
**Test runner:** Telegram app + `node run_tests.js`
**Status:** Ready for Execution — Sprint S0

---

## Test Environment

| Item | Value |
|------|-------|
| Bot | @ClotildeBot (dev/test instance) |
| Runtime | Node.js ≥18 running `Index.js` |
| Required env | `TELEGRAM_BOT_TOKEN` + `GEMINI_API_KEY` in `.env` |
| Reset between tests | `/reset` or restart `Index.js` for Telegram tests |
| NLU script | `node run_tests.js` (separate from bot server) |

---

## E2E-018 — run_tests.js full execution: all 15 cases, exit 0

**Story:** US-010 AC-1
**Priority:** P0

**Precondition:** Valid `GEMINI_API_KEY`. Bot NOT required for this test.

**Steps:**
1. Run: `node run_tests.js`
2. Wait for completion.
3. Check exit code: `echo $?`

**Expected Result:**
- 15 golden dataset cases executed
- Verdict line printed
- Exit code: `0` (accuracy ≥ 80%)

**Pass Criteria:** Exit 0 + verdict line present.

---

## E2E-019 — run_tests.js: verdict label and accuracy % displayed

**Story:** US-010 AC-2
**Priority:** P0

**Steps:**
1. Run `node run_tests.js`.
2. Read full console output.

**Expected Result:**
- Accuracy percentage number displayed (e.g. "87%")
- Verdict label is exactly one of: `"ACCEPTABLE"`, `"NEEDS WORK"`, or `"FAILING"`
- Label matches the percentage range

**Pass Criteria:** Correct verdict label shown.

---

## E2E-020 — run_tests.js: category breakdown visible

**Story:** US-010 AC-3
**Priority:** P0

**Steps:**
1. Run `node run_tests.js`.
2. Scroll through output to the breakdown section.

**Expected Result:**
- Breakdown section lists each category
- Each has a pass bar or percentage
- No category is `undefined` or blank

**Pass Criteria:** All categories shown with data.

---

## E2E-021 — run_tests.js: FGR section follows NLU and prints result

**Story:** US-010 AC-4
**Priority:** P0

**Steps:**
1. Run `node run_tests.js`.
2. Look for `"FGR:"` line after NLU section.

**Expected Result:**
- FGR section follows NLU verdict
- FGR % printed
- No exception separates NLU and FGR sections

**Pass Criteria:** FGR line present; no crash.

---

## E2E-022 — Telegram slang: "Grab a bird to BKK tomorrow"

**Story:** US-011 AC-1
**Priority:** P0

**Precondition:** Bot running. Staff role.

**Steps:**
1. `/start` → Staff role.
2. Send: `"Grab a bird to BKK tomorrow"`
3. Read bot reply.

**Expected Result:**
- Bot searches for a Bangkok flight (not confused by "bird")
- Results are for BKK as destination
- Bot does not ask "What do you mean?" — it resolves the slang

**Pass Criteria:** Flight results for BKK displayed.

---

## E2E-023 — Telegram slang: "Reserve me a seat to Bangkok on June 10"

**Story:** US-011 AC-2
**Priority:** P0

**Steps:**
1. `/start` → Staff role.
2. Send: `"Reserve me a seat to Bangkok on June 10"`
3. Read reply.

**Expected Result:**
- Bot returns BKK flight results for June 10
- "Reserve" synonym accepted as flight booking intent

**Pass Criteria:** BKK flights shown for June 10.

---

## E2E-024 — Telegram filler words ignored: "Please can you book a flight to Singapore on June 1"

**Story:** US-011 AC-3
**Priority:** P0

**Steps:**
1. `/start` → Staff role.
2. Send: `"Please can you book a flight to Singapore on June 1"`
3. Observe results.

**Expected Result:**
- Bot returns SIN flight results for June 1
- Same results as sending `"Book a flight to Singapore June 1"` without filler words

**Pass Criteria:** SIN flights for June 1 shown.

---

## E2E-025 — Telegram negation: "I do NOT want to fly to London"

**Story:** US-012 AC-1 / AC-2
**Priority:** P0

**Steps:**
1. `/start` → Staff role.
2. Send: `"I do NOT want to fly to London"`
3. Observe bot reply.

**Expected Result:**
- Bot does NOT display London flight results
- Bot either asks for clarification or acknowledges it won't book London
- No `search_flights` result displayed for LON

**Pass Criteria:** No London flights shown.

---

## E2E-026 — Telegram partial negation: "Don't book hotel, just flight to Paris"

**Story:** US-012 AC-3
**Priority:** P0

**Steps:**
1. `/start` → Staff role.
2. Send: `"Do not book the hotel, just the flight to Paris"`
3. Read reply.

**Expected Result:**
- Bot returns Paris (CDG) flight results
- No hotel search is triggered or results shown
- Only flights listed

**Pass Criteria:** CDG flights shown; no hotels.

---

## E2E-027 — Telegram out-of-scope: "Order me a pizza"

**Story:** US-014 AC-1
**Priority:** P0

**Steps:**
1. `/start` → Staff role.
2. Send: `"Order me a pizza"`
3. Read reply.

**Expected Result:**
- Bot replies with a polite decline (e.g. "I can only help with travel bookings")
- No flight or hotel search results displayed
- No exception or crash
- Bot remains ready for next message

**Pass Criteria:** Polite decline; no travel results.

---

## E2E-028 — Telegram OOS: factual question — "What is the capital of France?"

**Story:** US-014 AC-2
**Priority:** P0

**Steps:**
1. `/start` → Staff role.
2. Send: `"What is the capital of France?"`
3. Read reply.

**Expected Result:**
- Bot returns a non-empty polite response
- No unhandled exception (bot still responds to next message)
- No `search_flights` or `search_hotels` triggered

**Pass Criteria:** Non-empty response; bot still alive after.

---

## E2E-029 — Telegram OOS with travel keyword: "Deliver a package to London"

**Story:** US-014 AC-3
**Priority:** P0

**Steps:**
1. `/start` → Staff role.
2. Send: `"Deliver a package to London"`
3. Read reply.

**Expected Result:**
- Bot does NOT display London flight results
- Intent classified as out_of_scope (not flight_booking) even with "London" in message
- Bot declines politely

**Pass Criteria:** No flight results for London.

---

## E2E-030 — OOS message during active booking flow does not wipe session

**Story:** US-014 AC-2 edge case
**Priority:** P1

**Steps:**
1. `/start` → Staff role.
2. Request a flight: `"Flight to Singapore June 1"` — wait for results.
3. Without tapping Confirm, send: `"What's the weather in London?"`
4. Read bot reply.
5. Attempt to tap Confirm on the previous flight result (if inline keyboard still visible).

**Expected Result:**
- Bot declines weather query politely
- Previous flight results / keyboard is still available (session not cleared)
- Tapping Confirm still works

**Pass Criteria:** OOS does not clear pending flight selection.

---

## E2E-031 — Repeated OOS messages: bot remains stable

**Story:** US-014 AC-2 edge case
**Priority:** P1

**Steps:**
1. `/start` → Staff role.
2. Send 3 out-of-scope messages in a row:
   - `"Order me a pizza"`
   - `"Who won the World Cup?"`
   - `"Tell me a joke"`
3. Send a valid travel message: `"Flight to Singapore tomorrow"`
4. Read reply.

**Expected Result:**
- All 3 OOS messages receive polite declines
- Valid travel message is then processed normally
- No crash or session corruption

**Pass Criteria:** Bot stable after repeated OOS; travel intent processed correctly.

---

## E2E-032 — FGR baseline: prices in Telegram match mock data

**Story:** US-013 AC-2 (E2E validation)
**Priority:** P0

**Steps:**
1. Run `node mock_inventory.js` or a quick REPL: print raw price for BKK→SIN TG flight.
2. `/start` → Staff role.
3. Send: `"Flight from Bangkok to Singapore on June 1"`
4. Read the formatted price for TG in the Telegram reply.
5. Compare price in Telegram with raw mock price.

**Expected Result:**
- Price shown in Telegram matches `String(price.amount)` or `toLocaleString()` of mock price
- No hallucinated or modified price

**Pass Criteria:** Telegram display price matches mock source price.

---

## Summary

| Test ID | Story | AC | Priority | Channel |
|---------|-------|----|---------:|---------|
| E2E-018 | US-010 | AC-1 | P0 | Terminal |
| E2E-019 | US-010 | AC-2 | P0 | Terminal |
| E2E-020 | US-010 | AC-3 | P0 | Terminal |
| E2E-021 | US-010 | AC-4 | P0 | Terminal |
| E2E-022 | US-011 | AC-1 | P0 | Telegram |
| E2E-023 | US-011 | AC-2 | P0 | Telegram |
| E2E-024 | US-011 | AC-3 | P0 | Telegram |
| E2E-025 | US-012 | AC-1/2 | P0 | Telegram |
| E2E-026 | US-012 | AC-3 | P0 | Telegram |
| E2E-027 | US-014 | AC-1 | P0 | Telegram |
| E2E-028 | US-014 | AC-2 | P0 | Telegram |
| E2E-029 | US-014 | AC-3 | P0 | Telegram |
| E2E-030 | US-014 | AC-2 EC | P1 | Telegram |
| E2E-031 | US-014 | AC-2 EC | P1 | Telegram |
| E2E-032 | US-013 | AC-2 | P0 | Telegram + mock |

**Total: 15 E2E tests** (12 P0, 3 P1)
