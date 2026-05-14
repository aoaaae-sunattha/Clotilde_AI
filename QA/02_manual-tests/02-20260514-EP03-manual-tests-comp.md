# COMP Manual Test Cases — EP-03 NLU & AI Quality
**Stories:** US-010, US-011, US-012, US-013, US-014
**Date:** 2026-05-14
**Author:** QA (AI-assisted)
**Layer:** L2 Component (script execution + output assertion; no UI)
**Test runner:** `node run_tests.js`
**Status:** Ready for Execution — Sprint S0

---

## Test Environment

| Item | Value |
|------|-------|
| Runtime | Node.js ≥18 |
| Required env | `GEMINI_API_KEY` in `.env` |
| Required files | `run_tests.js`, `golden_dataset.js`, `mock_inventory.js`, `prompt.js` |
| Reset required | None — no file writes |
| Network | Gemini API live call required for NLU tests |

---

## COMP-022 — run_tests.js exits 0 when accuracy ≥ 80%

**Story:** US-010 AC-1
**Priority:** P0

**Precondition:** Valid `GEMINI_API_KEY` in `.env`. Unmodified `golden_dataset.js`.

**Steps:**
1. Run: `node run_tests.js`
2. Observe exit code: `echo $?`
3. Read console output.

**Expected Result:**
- All 15 golden dataset cases execute
- A verdict line is printed
- Exit code is `0` (accuracy ≥ 80%)

**Pass Criteria:** Exit 0 + verdict line present.

---

## COMP-023 — Verdict label is "ACCEPTABLE" when accuracy ≥ 80%

**Story:** US-010 AC-2
**Priority:** P0

**Precondition:** Same as COMP-022.

**Steps:**
1. Run `node run_tests.js`.
2. Scan console output for verdict label.

**Expected Result:**
- Output contains `"ACCEPTABLE"` when accuracy ≥ 80%
- OR `"NEEDS WORK"` when 60% ≤ accuracy < 80%
- OR `"FAILING"` when accuracy < 60%
- Accuracy percentage is displayed numerically

**Pass Criteria:** One of the three verdict labels present; accuracy % displayed.

---

## COMP-024 — Per-category breakdown bars printed

**Story:** US-010 AC-3
**Priority:** P0

**Steps:**
1. Run `node run_tests.js`.
2. Inspect output for breakdown section.
3. Confirm each test category (booking_standard, negation, ambiguity, out_of_scope, etc.) has a percentage bar.

**Expected Result:**
- Breakdown section present
- Each category listed with pass %
- No category missing from breakdown

**Pass Criteria:** All categories shown.

---

## COMP-025 — FGR section runs after NLU and prints verdict

**Story:** US-010 AC-4
**Priority:** P0

**Steps:**
1. Run `node run_tests.js`.
2. Confirm `runFGRTests()` executes (look for "FGR:" in output).
3. Confirm no exception thrown.

**Expected Result:**
- FGR percentage printed (e.g. "FGR: 100%")
- No crash between NLU section and FGR section

**Pass Criteria:** "FGR:" present in output; process exits cleanly.

---

## COMP-026 — Golden dataset G004 slang: "Grab a bird to BKK"

**Story:** US-011 AC-1
**Priority:** P0

**Precondition:** Test case G004 exists in `golden_dataset.js` with utterance "Grab a bird to BKK tomorrow".

**Steps:**
1. Run `node run_tests.js`.
2. Find the output line for G004.

**Expected Result:**
- G004 shows PASS
- Intent classified as `flight_booking`
- Destination entity is `BKK`

**Pass Criteria:** G004 PASS.

---

## COMP-027 — Synonym test: "Reserve me a seat to Bangkok"

**Story:** US-011 AC-2
**Priority:** P0

**Precondition:** Corresponding golden dataset entry exists.

**Steps:**
1. Run `node run_tests.js`.
2. Find the output line for the "Reserve me a seat" test case.

**Expected Result:**
- Intent: `flight_booking`
- Destination: `BKK` or `Bangkok`

**Pass Criteria:** PASS.

---

## COMP-028 — Filler words do not affect entity extraction

**Story:** US-011 AC-3
**Priority:** P0

**Precondition:** Golden dataset includes "Please can you book a flight to Singapore on June 1".

**Steps:**
1. Run `node run_tests.js`.
2. Find result for this utterance.
3. Confirm intent and destination match the baseline (same as "book a flight to Singapore June 1").

**Expected Result:**
- Intent: `flight_booking`
- Destination: `SIN` or `Singapore`

**Pass Criteria:** PASS.

---

## COMP-029 — Negation G006: "I do NOT want to fly to London"

**Story:** US-012 AC-1
**Priority:** P0

**Precondition:** G006 exists in golden_dataset.js.

**Steps:**
1. Run `node run_tests.js`.
2. Find G006 result.

**Expected Result:**
- G006 shows PASS
- intent is NOT `flight_booking` OR destination does NOT contain `LON`/`London`

**Pass Criteria:** G006 PASS.

---

## COMP-030 — Negation G006: no search_flights call with destination LON

**Story:** US-012 AC-2
**Priority:** P0

**Steps:**
1. In `run_tests.js` test harness, confirm the G006 evaluation path does not trigger `getMockFlights` with `destination: 'LON'`.
2. Inspect test harness implementation for any travel tool call guard.

**Expected Result:** No `search_flights` fired for negation test.

**Pass Criteria:** Static / harness-level assertion that tool calls are not made during NLU-only tests.

---

## COMP-031 — Partial negation: "Do not book hotel, just flight to Paris"

**Story:** US-012 AC-3
**Priority:** P0

**Precondition:** Golden dataset includes this utterance.

**Steps:**
1. Run `node run_tests.js`.
2. Find result for "Do not book the hotel, just the flight to Paris".

**Expected Result:**
- Intent: `flight_booking`
- Destination: `CDG` or `Paris`
- No hotel search triggered

**Pass Criteria:** PASS.

---

## COMP-032 — FGR: getMockFlights called for BKK→SIN

**Story:** US-013 AC-1
**Priority:** P0

**Steps:**
1. Run `node run_tests.js`.
2. In FGR section output, confirm `getMockFlights('BKK','SIN','2026-06-01','Y')` was called.
3. Confirm `getMockHotels('BKK','2026-06-01','2026-06-03')` was called.

**Expected Result:** Both mock data sources called; items formatted via `formatInventory()`.

**Pass Criteria:** No error in FGR section; mock call evidence in output.

---

## COMP-033 — FGR: price in formatted output matches source amount

**Story:** US-013 AC-2
**Priority:** P0

**Steps:**
1. In a test script or REPL:
   ```js
   const { getMockFlights } = require('./mock_inventory');
   const { formatInventory } = require('./prompt');
   const flights = getMockFlights('BKK','SIN','2026-06-01','Y');
   flights.forEach(f => {
     const out = formatInventory([f]);
     const priceStr = String(f.price.amount);
     const priceLocale = f.price.amount.toLocaleString();
     const match = out.includes(priceStr) || out.includes(priceLocale);
     console.log(f.airline_code, match ? 'PASS' : 'FAIL');
   });
   ```
2. All flights must show PASS.

**Expected Result:** Every flight's price string is present in formatInventory() output.

**Pass Criteria:** Zero FAIL lines.

---

## COMP-034 — FGR ≥ 99%: green verdict

**Story:** US-013 AC-3
**Priority:** P0

**Steps:**
1. Run `node run_tests.js`.
2. Find the FGR verdict line.

**Expected Result:**
- If FGR ≥ 99%: output contains `"🟢"` and `"FGR:"` on same line
- If FGR ≥ 90% <99%: output contains `"🟡"` and `"below 99% target"`
- If FGR < 90%: output contains `"🔴"` and `"FAILING"`

**Pass Criteria:** Verdict label correctly reflects FGR %. Baseline target: 🟢 (99%+).

---

## COMP-035 — FGR: toLocaleString locale variant accepted

**Story:** US-013 AC-2 edge case
**Priority:** P1

**Steps:**
1. In FGR test, verify the price check accepts both `"4200"` and `"4,200"` as valid.
2. Inspect `run_tests.js` FGR assertion logic.

**Expected Result:** Either format is accepted; no FAIL due to locale difference.

**Pass Criteria:** FGR test logic includes both forms.

---

## COMP-036 — Out-of-scope G012: "Order me a pizza"

**Story:** US-014 AC-1
**Priority:** P0

**Precondition:** G012 exists in golden_dataset.js with utterance "Order me a pizza".

**Steps:**
1. Run `node run_tests.js`.
2. Find G012 result.

**Expected Result:**
- G012 shows PASS
- Intent: `out_of_scope`
- No `search_flights` or `search_hotels` called

**Pass Criteria:** G012 PASS.

---

## COMP-037 — Out-of-scope: capital of France — no exception

**Story:** US-014 AC-2
**Priority:** P0

**Precondition:** Golden dataset includes "What is the capital of France?" or equivalent.

**Steps:**
1. Run `node run_tests.js`.
2. Find result for this utterance.

**Expected Result:**
- Non-empty bot response returned
- Process does not throw unhandled exception
- No travel tool function called

**Pass Criteria:** PASS + process continues after this test case.

---

## COMP-038 — Travel keyword in OOS context: "deliver a package to London"

**Story:** US-014 AC-3
**Priority:** P0

**Precondition:** Golden dataset includes this utterance.

**Steps:**
1. Run `node run_tests.js`.
2. Find result for "deliver a package to London".

**Expected Result:**
- Intent is NOT `flight_booking`
- No `search_flights` call with destination London

**Pass Criteria:** PASS.

---

## COMP-039 — run_tests.js exits 1 when accuracy < 80%

**Story:** US-010 AC-1 (inverse/regression detection)
**Priority:** P1

**Precondition:** Temporarily corrupt one golden dataset entry to force a fail majority. Restore immediately after.

**Steps:**
1. In `golden_dataset.js`, change 4+ expected intents to wrong values.
2. Run `node run_tests.js`.
3. Check exit code: `echo $?` should be `1`.
4. Restore golden_dataset.js.

**Expected Result:**
- Exit code `1`
- Output contains `"FAILING"` or `"NEEDS WORK"` depending on degraded accuracy

**Pass Criteria:** Exit 1 when accuracy drops below threshold.

**Notes:** This is a regression-detection test. Restore file immediately after running.

---

## Summary

| Test ID | Story | AC | Priority | Type |
|---------|-------|----|---------:|------|
| COMP-022 | US-010 | AC-1 | P0 | Script execution |
| COMP-023 | US-010 | AC-2 | P0 | Verdict label |
| COMP-024 | US-010 | AC-3 | P0 | Breakdown output |
| COMP-025 | US-010 | AC-4 | P0 | FGR integration |
| COMP-026 | US-011 | AC-1 | P0 | Slang G004 |
| COMP-027 | US-011 | AC-2 | P0 | Synonym |
| COMP-028 | US-011 | AC-3 | P0 | Filler words |
| COMP-029 | US-012 | AC-1 | P0 | Negation G006 |
| COMP-030 | US-012 | AC-2 | P0 | No tool call on negation |
| COMP-031 | US-012 | AC-3 | P0 | Partial negation |
| COMP-032 | US-013 | AC-1 | P0 | FGR mock calls |
| COMP-033 | US-013 | AC-2 | P0 | Price string match |
| COMP-034 | US-013 | AC-3 | P0 | FGR verdict |
| COMP-035 | US-013 | AC-2 EC | P1 | Locale variant |
| COMP-036 | US-014 | AC-1 | P0 | OOS G012 |
| COMP-037 | US-014 | AC-2 | P0 | OOS no exception |
| COMP-038 | US-014 | AC-3 | P0 | Travel keyword in OOS |
| COMP-039 | US-010 | AC-1 inv. | P1 | Exit 1 regression |

**Total: 18 COMP tests** (15 P0, 3 P1)
