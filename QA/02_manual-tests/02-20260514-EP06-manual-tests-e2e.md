# E2E Manual Test Cases — EP-06 Notification System
**Stories:** US-022, US-023, US-024
**Date:** 2026-05-14
**Author:** QA (AI-assisted)
**Layer:** L5 Manual Telegram (end-to-end via live Telegram bot) + terminal CLI
**Test runner:** `node notify.js` (real Telegram sends for L5)
**Status:** Ready for Execution — Sprint S1b

---

## Test Environment

| Item | Value |
|------|-------|
| Bot | @ClotildeBot (dev/test instance) |
| Runtime | Node.js ≥18 |
| Required env | `TELEGRAM_BOT_TOKEN` + `GEMINI_API_KEY` in `.env` |
| Required state | Target employee must have completed `/start` (chat_id registered) |
| Warning | L5 E2E tests send REAL Telegram messages — use a test employee account |

---

## E2E-063 — Known employee: notification delivered to Telegram

**Story:** US-022 AC-1, AC-2
**Priority:** P0

**Precondition:** EMP-001 (or test employee) has completed `/start`; chat_id in `chat_registry.json`.

**Steps:**
1. In terminal: `node notify.js booking_confirmed --employee EMP-001 --pnr TEST01 --flight TG401 --date 2026-06-01`
2. Open Telegram as the target employee.
3. Read the received message.

**Expected Result:**
- Message delivered to employee's Telegram
- Message contains: PNR "TEST01", flight "TG401", date "2026-06-01"
- Message body does NOT contain raw numeric chat_id

**Pass Criteria:** Message received; required fields present; no chat_id exposure.

---

## E2E-064 — flight_delay notification delivered and fields correct

**Story:** US-024 AC-1, AC-2
**Priority:** P0

**Steps:**
1. Run: `node notify.js flight_delay --employee EMP-001 --flight TG401 --delay "2 hours"`
2. Check employee's Telegram.

**Expected Result:**
- Message delivered
- Contains flight number "TG401" and delay info "2 hours"
- Non-empty body

**Pass Criteria:** Delivered with correct fields.

---

## E2E-065 — booking_cancelled notification: no PNR expected in body

**Story:** US-024 AC-2
**Priority:** P0

**Steps:**
1. Run: `node notify.js booking_cancelled --employee EMP-001 --flight TG401 --date 2026-06-01`
2. Check employee's Telegram.

**Expected Result:**
- Message delivered
- Body contains trip info but NOT a new PNR (cancelled booking has no active PNR)
- Non-empty body

**Pass Criteria:** Delivered; non-empty; no spurious PNR field.

---

## E2E-066 — Raw chat_id NOT in message body

**Story:** US-022 AC-3 / US-024 AC-3
**Priority:** P0

**Precondition:** Know the numeric chat_id of EMP-001 from `chat_registry.json` (e.g. 987654321).

**Steps:**
1. Run any notification for EMP-001.
2. Read the received Telegram message.
3. Search message text for the numeric string "987654321".

**Expected Result:**
- Numeric chat_id NOT visible in message body
- Name or employee_id may appear, but not the raw Telegram numeric ID

**Pass Criteria:** chat_id absent from message.

---

## E2E-067 — Unknown employee: non-zero exit, readable error in terminal

**Story:** US-023 AC-1, AC-2, AC-3
**Priority:** P0

**Steps:**
1. Run: `node notify.js booking_confirmed --employee EMP-999`
2. Read console output.
3. Check exit code: `echo $?`

**Expected Result:**
- Console shows human-readable error mentioning "EMP-999"
- No JavaScript stack trace as primary output
- Exit code ≥ 1

**Pass Criteria:** Exit 1; readable error; no stack trace.

---

## E2E-068 — Stale chat_id (bot blocked): error logged, exit non-zero

**Story:** US-022 edge case
**Priority:** P1

**Precondition:** Create a `chat_registry.json` entry with a chat_id where the bot has been blocked (e.g. use a known invalid chat_id like 1).

**Steps:**
1. Add entry: `{ "EMP-BLOCKED": 1 }` to `chat_registry.json`.
2. Run: `node notify.js booking_confirmed --employee EMP-BLOCKED --pnr TEST01`
3. Read output and exit code.
4. Remove the test entry afterward.

**Expected Result:**
- Telegram returns 403 (blocked) or similar error
- notify.js logs the error
- Exit code ≥ 1

**Pass Criteria:** Error logged; non-zero exit; no crash.

---

## E2E-069 — All 17 notification types deliver without crash

**Story:** US-024 AC-1
**Priority:** P0

**Precondition:** EMP-001 registered. Read notify.js top-of-file for the 17 type names.

**Steps:**
1. For each of the 17 notification types, run: `node notify.js <type> --employee EMP-001 [required args]`
2. Confirm each exits with code 0 and a message is delivered to EMP-001.

**Expected Result:**
- All 17 types exit code 0
- Each delivers a non-empty message to the employee's Telegram
- No type crashes or hangs

**Pass Criteria:** 17/17 successful deliveries.

**Notes:** This is a batch test. May take several minutes. Space runs 2+ seconds apart to avoid Telegram rate limiting.

---

## E2E-070 — Optional field absent: no "undefined" in delivered message

**Story:** US-024 edge case
**Priority:** P1

**Steps:**
1. Run a notification type that has optional fields (e.g. hotel_name) without providing that field.
2. Read the delivered Telegram message.
3. Search for the string "undefined".

**Expected Result:**
- "undefined" NOT present in message body
- Missing field either omitted cleanly or shows a placeholder

**Pass Criteria:** "undefined" absent.

---

## Summary

| Test ID | Story | AC | Priority | Channel |
|---------|-------|----|---------:|---------|
| E2E-063 | US-022 | AC-1/2 | P0 | Terminal + Telegram |
| E2E-064 | US-024 | AC-1/2 | P0 | Terminal + Telegram |
| E2E-065 | US-024 | AC-2 | P0 | Terminal + Telegram |
| E2E-066 | US-022/024 | AC-3 | P0 | Terminal + Telegram |
| E2E-067 | US-023 | AC-1/2/3 | P0 | Terminal |
| E2E-068 | US-022 | EC | P1 | Terminal |
| E2E-069 | US-024 | AC-1 | P0 | Terminal + Telegram |
| E2E-070 | US-024 | EC | P1 | Terminal + Telegram |

**Total: 8 E2E tests** (6 P0, 2 P1)

---

## Rate Limiting Note

Telegram has a rate limit of ~30 messages/second to the same chat. When running E2E-069 (17 types), space notifications at least 1 second apart to avoid 429 errors.
