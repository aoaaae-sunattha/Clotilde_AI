# COMP Manual Test Cases — EP-06 Notification System
**Stories:** US-022, US-023, US-024
**Date:** 2026-05-14
**Author:** QA (AI-assisted)
**Layer:** L2 Component (CLI script execution + output assertions)
**Test runner:** `node notify.js` with TEST_MODE=true
**Status:** Ready for Execution — Sprint S1b

---

## Test Environment

| Item | Value |
|------|-------|
| Runtime | Node.js ≥18 |
| Required files | `notify.js`, `chat_registry.json` (seeded) |
| Required env | `TEST_MODE=true` (suppresses live Telegram send); `TELEGRAM_BOT_TOKEN` not needed in TEST_MODE |
| Reset required | Restore `chat_registry.json` to seeded state between tests |

**CRITICAL PRE-CHECK:** Verify `notify.js` has a `TEST_MODE=true` guard that suppresses live Telegram API calls. If not implemented — implement before running any CLI/COMP tests for EP-06.

---

## COMP-071 — notify.js reads chat_registry.json and resolves employee_id

**Story:** US-022 AC-1
**Priority:** P0

**Precondition:** `chat_registry.json` contains `{ "EMP-001": 987654321 }`.

**Steps:**
1. Run: `TEST_MODE=true node notify.js booking_confirmed --employee EMP-001`
2. Read console output.

**Expected Result:**
- Output shows employee_id resolved to a chat_id
- No "not found" error
- In TEST_MODE: message content logged to console (not sent to Telegram)

**Pass Criteria:** Resolution succeeds; output logged.

---

## COMP-072 — booking_confirmed notification contains PNR and travel details

**Story:** US-022 AC-2 / US-024 AC-2
**Priority:** P0

**Precondition:** chat_registry.json seeded. TEST_MODE=true. Supply booking data via CLI flags or env.

**Steps:**
1. Run: `TEST_MODE=true node notify.js booking_confirmed --employee EMP-001 --pnr ABC123 --flight TG401 --date 2026-06-01`
2. Inspect logged message body.

**Expected Result:**
- Message body contains "ABC123" (PNR)
- Message body contains "TG401" (flight number)
- Message body contains "2026-06-01" (date)
- Message body does NOT contain raw numeric chat_id

**Pass Criteria:** All required fields present; chat_id absent.

---

## COMP-073 — flight_delay notification contains required fields

**Story:** US-024 AC-2
**Priority:** P0

**Steps:**
1. Run: `TEST_MODE=true node notify.js flight_delay --employee EMP-001 --flight TG401 --delay "2 hours"`
2. Inspect output.

**Expected Result:**
- Message body contains flight number and delay info
- Not empty or "undefined"

**Pass Criteria:** Non-empty message with required fields.

---

## COMP-074 — chat_id does NOT appear in message body

**Story:** US-022 AC-3 / US-024 AC-3
**Priority:** P0

**Precondition:** chat_registry.json seeded: `{ "EMP-001": 987654321 }`.

**Steps:**
1. Run any notification in TEST_MODE.
2. Search logged message body for the string "987654321".

**Expected Result:**
- "987654321" (numeric chat_id) NOT present in the message text body

**Pass Criteria:** chat_id absent from message body.

---

## COMP-075 — Unknown employee: non-zero exit code

**Story:** US-023 AC-2
**Priority:** P0

**Steps:**
1. Run: `TEST_MODE=true node notify.js booking_confirmed --employee EMP-999`
2. Check exit code: `echo $?`

**Expected Result:**
- Exit code ≥ 1

**Pass Criteria:** Exit code non-zero.

---

## COMP-076 — Unknown employee: human-readable error message

**Story:** US-023 AC-1 / AC-3
**Priority:** P0

**Steps:**
1. Run: `TEST_MODE=true node notify.js booking_confirmed --employee EMP-999`
2. Read console output.

**Expected Result:**
- Error message contains "EMP-999"
- Message is human-readable (e.g. "Employee EMP-999 not found in chat_registry.json")
- No raw JavaScript stack trace as primary output

**Pass Criteria:** Readable error with employee_id; no raw stack trace.

---

## COMP-077 — Missing chat_registry.json: error caught, exit non-zero

**Story:** US-023 AC-1 edge case
**Priority:** P0

**Precondition:** Temporarily rename or move `chat_registry.json`.

**Steps:**
1. Move `chat_registry.json` out of project root.
2. Run: `TEST_MODE=true node notify.js booking_confirmed --employee EMP-001`
3. Check exit code and output.
4. Restore `chat_registry.json`.

**Expected Result:**
- Exit code ≥ 1
- Human-readable error about missing file
- No crash/stack trace as primary output

**Pass Criteria:** Handled gracefully; non-zero exit.

---

## COMP-078 — Malformed chat_registry.json: parse error caught

**Story:** US-023 AC-1 edge case
**Priority:** P0

**Precondition:** Save current `chat_registry.json`. Replace with `{ invalid json`.

**Steps:**
1. Write malformed JSON to `chat_registry.json`.
2. Run: `TEST_MODE=true node notify.js booking_confirmed --employee EMP-001`
3. Check exit code and output.
4. Restore `chat_registry.json`.

**Expected Result:**
- Exit code ≥ 1
- Human-readable parse error message
- No raw stack trace as primary output

**Pass Criteria:** Parse error caught; readable message; non-zero exit.

---

## COMP-079 — All 17 notification types produce non-empty body

**Story:** US-024 AC-1
**Priority:** P0

**Steps:**
1. Read the notification type list from top of `notify.js`.
2. For each type, run: `TEST_MODE=true node notify.js <type> --employee EMP-001 [required args]`
3. Confirm each produces a non-empty logged message body.

**Expected Result:**
- All 17 types: message body is non-empty string
- No type produces `""` or `undefined`

**Pass Criteria:** 17/17 non-empty bodies.

**Notes:** Some types require additional CLI args (e.g. --pnr, --flight). Run with minimal valid args for each type.

---

## COMP-080 — Optional field missing: renders as placeholder (not "undefined")

**Story:** US-024 AC-1 edge case
**Priority:** P1

**Steps:**
1. Run a booking_confirmed notification without --hotel flag (if hotel_name is optional).
2. Inspect message body.

**Expected Result:**
- Message body does NOT contain the string "undefined"
- Missing field either omitted or shows a placeholder (e.g. "N/A")

**Pass Criteria:** "undefined" absent from message body.

---

## Summary

| Test ID | Story | AC | Priority | Type |
|---------|-------|----|---------:|------|
| COMP-071 | US-022 | AC-1 | P0 | CLI: resolution |
| COMP-072 | US-022/024 | AC-2 | P0 | CLI: field presence |
| COMP-073 | US-024 | AC-2 | P0 | CLI: flight_delay fields |
| COMP-074 | US-022/024 | AC-3 | P0 | CLI: no chat_id |
| COMP-075 | US-023 | AC-2 | P0 | CLI: exit code |
| COMP-076 | US-023 | AC-1/3 | P0 | CLI: readable error |
| COMP-077 | US-023 | EC | P0 | CLI: missing file |
| COMP-078 | US-023 | EC | P0 | CLI: malformed JSON |
| COMP-079 | US-024 | AC-1 | P0 | CLI: all 17 types |
| COMP-080 | US-024 | EC | P1 | CLI: no "undefined" |

**Total: 10 COMP tests** (9 P0, 1 P1)
