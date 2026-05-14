# Requirements Analysis — EP-03 NLU & AI Quality
**Stories:** US-010, US-011, US-012, US-013, US-014
**Date:** 2026-05-14
**Author:** Requirements Analyst (AI-assisted)
**Source:** 002-20260514-CLOTILDE-final.md
**Test runner:** `node run_tests.js` (L1+L2 combined) + manual Telegram (L5)
**Status:** Confirmed — Ready for Phase 2

---

## Pre-flight Check

- [x] File exists: `QA/00_user-stories/002-20260514-CLOTILDE-final.md`
- [x] Story summaries present for US-010 through US-014
- [x] All ACs written in Given/When/Then format
- [x] No contradictory ACs found
- [x] GAP-05 resolved: FGR threshold confirmed (≥99% green, ≥90% yellow, <90% red; exit 0 if ≥90%)

---

## US-010 — NLU Regression Suite

### Story Summary
QA Engineer can run an automated NLU regression suite against the golden dataset so that any change to the system prompt or agent configuration is immediately validated.

### Acceptance Criteria (verbatim)
- **AC-1:** Given project configured with valid `GEMINI_API_KEY`; When `node run_tests.js` executed; Then all 15 golden dataset test cases execute AND verdict line printed AND exits code 0 if accuracy ≥ 80%, code 1 if below
- **AC-2:** Given `run_tests.js` completes; When console output read; Then overall accuracy % displayed AND verdict label is "ACCEPTABLE" (≥80%), "NEEDS WORK" (≥60%), or "FAILING" (<60%)
- **AC-3:** Given at least one test case per category; When breakdown section printed; Then each category has a pass percentage bar displayed
- **AC-4:** Given NLU section completes; When FGR section runs immediately after; Then `runFGRTests()` executes without error AND prints "FGR: X%"

### Edge Cases to Test
1. Gemini API rate-limited during run — runner waits 500ms between cases; rate-limited case counted as fail in accuracy
2. New intent added to `agent.js` but not in `golden_dataset.js` — existing tests still run; coverage gap is separate tracking concern
3. `GEMINI_API_KEY` missing or invalid — process must exit with clear error, not hang

### Test Scope
- In scope: run_tests.js execution, exit codes (0/1), accuracy thresholds, verdict labels, FGR integration
- Out of scope: golden dataset expansion (manual review only), live Duffel price regression

### Risk Areas
- IRA threshold 80% — if Gemini model changes between runs, accuracy may drop without code change
- `run_tests.js` and `test_policy.js` both must run in CI; sequencing matters (policy first, then NLU)

### Open Questions
| ❓ Question | 📌 Assumed | 👤 Owner | ⚠ Risk |
|---|---|---|---|
| Does `run_tests.js` call `test_policy.js` internally? | No — they are independent scripts | Dev | Test order in CI YAML must be explicit |

---

## US-011 — Slang & Synonyms

### Story Summary
Staff employee using informal language gets correct intent and entity extraction without needing to use formal phrasing.

### Acceptance Criteria (verbatim)
- **AC-1:** Given golden dataset G004 utterance "Grab a bird to BKK tomorrow"; When `classifyIntent()` processes; Then `intent` is `flight_booking` AND `entities.destination` is `BKK`
- **AC-2:** Given utterance "Reserve me a seat to Bangkok on June 10"; When `classifyIntent()` processes; Then `intent` is `flight_booking` AND `entities.destination` is `BKK` or `Bangkok`
- **AC-3:** Given message with filler words ("Please can you book a flight to Singapore on June 1"); When `classifyIntent()` processes; Then `intent` is `flight_booking` AND entities identical to same message without filler words

### Edge Cases to Test
1. Slang is ambiguous (could mean multiple intents) — bot asks for clarification or picks highest-confidence intent
2. Destination abbreviation not a standard IATA code — bot asks for clarification
3. Utterance contains two destination hints ("London or Paris?") — one destination extracted, not both

### Test Scope
- In scope: golden dataset slang cases G004+, entity extraction accuracy, destination normalisation
- Out of scope: slang in non-English languages

### Risk Areas
- `classifyIntent()` is implemented via Gemini system prompt — slang handling depends on model version; no deterministic code path to assert
- "BKK" may be extracted as "Bangkok" rather than "BKK" — AC-2 allows either; AC-1 requires "BKK" specifically

### Open Questions
| ❓ Question | 📌 Assumed | 👤 Owner | ⚠ Risk |
|---|---|---|---|
| Is `classifyIntent()` a standalone function or called inside `agent.js`? | Called inside agent.js; NLU test invokes run_tests.js golden dataset harness | Dev | Cannot unit-test in isolation without mocking Gemini |

---

## US-012 — Negation Handling

### Story Summary
Staff employee saying "I do NOT want to fly to London" does not trigger a London flight search.

### Acceptance Criteria (verbatim)
- **AC-1:** Given golden dataset G006 utterance "I do NOT want to fly to London"; When `classifyIntent()` processes; Then `intent` is NOT `flight_booking` OR `entities.destination` does NOT contain `LON` or `London`
- **AC-2:** Given negation test resolves to non-flight-booking intent; When bot responds; Then no `search_flights` call is made with `destination: LON`
- **AC-3:** Given utterance "Do not book the hotel, just the flight to Paris"; When `classifyIntent()` processes; Then `intent` is `flight_booking` AND `entities.destination` is `CDG` or `Paris` AND no hotel search triggered

### Edge Cases to Test
1. Ambiguous negation ("I don't really want London but maybe…") — low-confidence result expected; confidence ceiling test applies
2. Double negation ("I don't NOT want to go to Paris") — intent ambiguous; either flight_booking or clarification_needed acceptable
3. Negation keyword in city name — no real cases exist but defensive check

### Test Scope
- In scope: negation detection via golden dataset G006+, AC-3 partial negation (negate hotel, keep flight)
- Out of scope: negation across multi-turn conversation beyond current context window

### Risk Areas
- Gemini may inconsistently classify negation across API calls — golden dataset harness runs once per execution; flaky results possible
- AC-1 uses OR logic — test passes if either condition is true; both should be asserted separately for thoroughness

---

## US-013 — Fact Grounding Rate (FGR)

### Story Summary
QA Engineer can verify that prices displayed by the AI exactly match the source mock payload, detecting hallucinated prices immediately.

### Acceptance Criteria (verbatim)
- **AC-1:** Given `run_tests.js` completes NLU section; When `runFGRTests()` executes; Then `getMockFlights('BKK','SIN','2026-06-01','Y')` and `getMockHotels('BKK','2026-06-01','2026-06-03')` called AND each result formatted via `formatInventory()`
- **AC-2:** Given each formatted inventory item compared to source object; When `formatInventory()` called on single flight object; Then output contains `String(flight.price.amount)` OR `flight.price.amount.toLocaleString()` — any mismatch is FAIL
- **AC-3:** Given all items checked; When FGR % calculated (passed/total×100); Then ≥99% → "🟢 FGR: X%"; ≥90% <99% → "🟡 FGR: X% (below 99% target)"; <90% → "🔴 FGR: X% (FAILING)"

### Edge Cases to Test
1. `toLocaleString()` formats differently across Node.js versions ("4,200" vs "4200") — both forms must be accepted as passing
2. Price is 0 — `String(0)` is "0"; `toLocaleString()` is "0"; both must match and pass
3. `formatInventory()` truncates price (e.g. shows only integer) — if source is 4200.50 and output is "4200", should FAIL

### Test Scope
- In scope: FGR computation from mock payloads, formatInventory() price string matching, verdict labels and thresholds
- Out of scope: FGR against live Duffel prices (live prices change)

### Risk Areas
- FGR threshold 90% exit-0 — if `formatInventory()` changes price format, FGR drops silently; only caught if <90%
- `formatInventory()` is in `prompt.js` — any change to formatting logic could break FGR without a test failure at the policy layer

---

## US-014 — Out-of-Scope Graceful Handling

### Story Summary
Staff employee gets a helpful decline response (not an error or travel booking) when their message is outside travel scope.

### Acceptance Criteria (verbatim)
- **AC-1:** Given golden dataset G012 utterance "Order me a pizza"; When `classifyIntent()` processes; Then `intent` is `out_of_scope` AND bot replies with polite decline AND does NOT call `search_flights` or `search_hotels`
- **AC-2:** Given utterance "What is the capital of France?"; When agent processes; Then bot returns non-empty response AND process does not throw unhandled exception AND no travel tool function called
- **AC-3:** Given utterance containing travel keyword "deliver a package to London"; When `classifyIntent()` processes; Then `intent` is NOT `flight_booking` — travel keyword alone does not trigger flight search

### Edge Cases to Test
1. Out-of-scope input with destination city ("deliver a package to London") — covered by AC-3
2. Repeated out-of-scope messages — bot responds consistently, no accumulation of partial state
3. Out-of-scope message arrives while a booking is in progress — session state preserved; bot declines gracefully without wiping pendingOptions

### Test Scope
- In scope: golden dataset G012+, out_of_scope intent classification, no tool call assertion, process stability
- Out of scope: building a general-purpose FAQ/knowledge-base

### Risk Areas
- `out_of_scope` intent classification relies entirely on Gemini system prompt — cannot unit-test deterministically
- AC-2 "no travel tool function called" — in L5 manual test, this is verified via console.log inspection; in L3 integration test, verified via nock interceptor (no matching request fired)

---

## Combined Risk Areas — EP-03

| Risk | Severity | Mitigation |
|------|----------|------------|
| NLU tests non-deterministic (Gemini API) | High | Golden dataset harness runs sequentially with 500ms delay; single run per CI job |
| FGR threshold 90% may mask formatting regressions | Medium | Monitor FGR trend across sprints; alert if drops from 99% baseline |
| `classifyIntent()` not independently testable | Medium | All NLU tests go through run_tests.js golden dataset harness; no isolation possible |
| `toLocaleString()` locale variation in CI | Low | FGR test accepts both comma-formatted and plain number strings |
| US-014 AC-3 false negative risk | Medium | "deliver a package to London" — Gemini may extract flight intent; golden dataset case G012+ must explicitly include this pattern |
