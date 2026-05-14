# Requirements Analysis — EP-06 Notification System
**Stories:** US-022, US-023, US-024
**Date:** 2026-05-14
**Author:** Requirements Analyst (AI-assisted)
**Source:** 002-20260514-CLOTILDE-final.md
**Test runner:** `node notify.js` (L4 CLI automation)
**Status:** Confirmed — Ready for Phase 2 (Sprint S1b)

---

## Pre-flight Check

- [x] File exists: `QA/00_user-stories/002-20260514-CLOTILDE-final.md`
- [x] Story summaries present for US-022 through US-024
- [x] All ACs written in Given/When/Then format
- [x] No contradictory ACs found

---

## US-022 — Notification Delivery

### Story Summary
Admin sends a notification to a specific employee by employee_id; notify.js resolves employee_id → chat_id from chat_registry.json and sends the correct template via Telegram.

### Acceptance Criteria (verbatim)
- **AC-1:** Given employee previously used /start and chat_id registered in `chat_registry.json`; When `node notify.js <type> --employee <employee_id>` executed; Then notify.js reads `chat_registry.json`, resolves employee_id → chat_id, sends Telegram message to that chat_id
- **AC-2:** Given notification sent to resolved chat_id; When Telegram API call completes; Then message delivered matches template for specified `<type>` AND contains required fields for that notification type
- **AC-3:** Given notify.js sends notification with booking details; When message body inspected; Then message includes PNR, flight_number or hotel_name, travel dates as applicable AND does NOT expose raw numeric chat_id in message text

### Edge Cases to Test
1. employee_id not in chat_registry.json — covered by US-023
2. chat_id stale (employee has blocked bot) — Telegram returns 403; notify.js logs error and exits non-zero

### Test Scope
- In scope: chat_registry.json resolution, template content per type, field presence (PNR/flight/dates), chat_id privacy (not in message body)
- Out of scope: batch notifications to all employees simultaneously

### Risk Areas
- 17 notification types — each has distinct required fields; missing field in template is silent unless test asserts each field
- TEST_MODE=true guard needed in notify.js for CLI automation (must not send live Telegram messages in CI)
- chat_id privacy: raw numeric chat_id must not appear in message body — easy to accidentally include in template string

---

## US-023 — Unknown Employee Handling

### Story Summary
notify.js handles unknown employee_id gracefully — logs readable error, exits non-zero, does not crash.

### Acceptance Criteria (verbatim)
- **AC-1:** Given employee_id not in `chat_registry.json`; When `node notify.js <type> --employee <unknown_id>` executed; Then notify.js logs error containing missing employee_id AND does NOT throw unhandled exception
- **AC-2:** Given lookup failed; When notify.js exits; Then exit code ≥ 1
- **AC-3:** Given lookup failure logged; When console output read; Then error message is human-readable (e.g. "Employee EMP-999 not found") AND does NOT contain raw JavaScript stack trace as primary output

### Edge Cases to Test
1. `chat_registry.json` file missing — notify.js catches file read error; exits non-zero with readable message
2. `chat_registry.json` malformed JSON — parse error caught; human-readable error logged

### Test Scope
- In scope: missing employee exit code, human-readable error message, no raw stack trace, missing file handling, malformed JSON handling
- Out of scope: auto-retry on Telegram API failure

### Risk Areas
- Error message format: if notify.js throws and Node.js prints the default stack trace, AC-3 fails — error must be caught and formatted
- Missing file vs missing employee_id are distinct error paths — both must be tested separately

---

## US-024 — 17 Notification Types Coverage

### Story Summary
All 17 notification types produce a non-empty, correctly structured Telegram message with no "undefined" or raw chat_id in the body.

### Acceptance Criteria (verbatim)
- **AC-1:** Given valid employee_id and valid notification type; When each of 17 types tested in sequence; Then every type produces non-empty Telegram message body (no empty string, no undefined)
- **AC-2:** Given notification type including booking details (booking_confirmed, flight_delay, etc.); When message rendered; Then message references correct fields — PNR if applicable, flight_number if applicable, dates if applicable — values not "undefined" or empty
- **AC-3:** Given any notification type sent; When message body inspected; Then raw numeric chat_id does NOT appear in message text body

### Edge Cases to Test
1. Optional fields (e.g. hotel_name) missing from notification data — renders with placeholder or omits cleanly (not "undefined")

### Test Scope
- In scope: all 17 notification types, non-empty body, field presence validation, undefined prevention, chat_id privacy
- Out of scope: email/SMS delivery (Telegram only for MVP)

### Risk Areas
- 17 types × multiple required fields = large assertion matrix; test must enumerate each type explicitly
- "undefined" in template: if notify.js uses `${data.field}` without defaulting and field is missing, "undefined" appears silently
- TEST_MODE=true guard critical: 17-type sweep in CI must not send 17 live Telegram messages

---

## Combined Risk Areas — EP-06

| Risk | Severity | Mitigation |
|------|----------|------------|
| TEST_MODE=true guard not implemented in notify.js | High | Verify before writing CLI-* tests; add guard if missing |
| 17 notification types not enumerated in codebase | Medium | Read top of notify.js for the type list before writing CLI-013 |
| "undefined" in template strings | Medium | CLI tests assert each required field is present and not the string "undefined" |
| chat_id privacy leak | Medium | CLI-014 asserts raw numeric chat_id absent from message body |
| Missing/malformed chat_registry.json path not caught | Medium | CLI-007/008 cover both file-missing and malformed-JSON paths |
