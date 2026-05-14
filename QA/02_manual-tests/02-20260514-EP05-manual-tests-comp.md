# COMP Manual Test Cases — EP-05 Approval Workflow
**Stories:** US-018, US-019, US-020, US-021
**Date:** 2026-05-14
**Author:** QA (AI-assisted)
**Layer:** L2 Component (code review + module assertions; no UI)
**Test runner:** Static code inspection + direct module calls
**Status:** Ready for Execution — Sprint S1c

---

## Test Environment

| Item | Value |
|------|-------|
| Runtime | Node.js ≥18 |
| Required files | `Index.js`, `policy.js`, `chat_registry.json` (seeded with VP-004) |
| Blocking risk | approvals.json not confirmed in v3.0 — mark affected tests as CONDITIONAL |
| Reset required | Truncate `bookings.json` and `approvals.json` between tests |

---

## COMP-060 — APPROVER_EMPLOYEE_ID constant exists in Index.js

**Story:** US-020 AC-1
**Priority:** P0

**Steps:**
1. Read `Index.js`.
2. Search for `APPROVER_EMPLOYEE_ID` constant.
3. Confirm it is defined as a string constant (not derived from user input).

**Expected Result:**
- `APPROVER_EMPLOYEE_ID` is a named constant in Index.js
- Value is a hardcoded employee ID string (e.g. "VP-004")

**Pass Criteria:** Constant found; static value.

**Notes:** If not found — HIGH RISK — flag to Dev immediately. US-020 AC-1 BLOCKED.

---

## COMP-061 — booking_confirm handler checks is_compliant before PNR generation

**Story:** US-018 AC-1 / US-021 AC-1
**Priority:** P0

**Steps:**
1. Read `booking_confirm` handler in `Index.js`.
2. Trace the `is_compliant` check.
3. Confirm: `if (!selectedOption.is_compliant)` → justification prompt; `if (selectedOption.is_compliant)` → PNR generation.

**Expected Result:**
- Explicit compliance check in handler
- Two distinct code paths: justification vs PNR

**Pass Criteria:** Both paths present in code.

---

## COMP-062 — is_compliant: null treated as non-compliant (safe default)

**Story:** US-021 edge case / US-027 edge case
**Priority:** P0

**Steps:**
1. Read `booking_confirm` handler.
2. Confirm the compliance check uses: `if (!selectedOption.is_compliant)` (falsy check) rather than `=== false` (strict false).
3. Confirm null → justification path (same as false).

**Expected Result:**
- Falsy check (null is falsy → justification required)
- NOT a strict `=== false` that would allow null through

**Pass Criteria:** Falsy check present; null goes to justification path.

---

## COMP-063 — Approval record structure: required fields (CONDITIONAL)

**Story:** US-018 AC-2
**Priority:** P0

**Precondition:** approvals.json implemented in v3.0. If not — SKIP and flag as BLOCKED.

**Steps:**
1. Trace the approval record write path in `Index.js`.
2. Confirm the record object includes: `status: 'PENDING'`, `justification`, booking details.

**Expected Result:**
- Record object written with `status: 'PENDING'`
- `justification` field populated from user's text
- Booking details included (PNR/reference, type, employee_id)

**Pass Criteria:** Required fields in record write call.

---

## COMP-064 — VP-004 chat_id lookup from chat_registry.json

**Story:** US-018 AC-2
**Priority:** P0

**Precondition:** `chat_registry.json` seeded with VP-004 entry: `{ "VP-004": 123456789 }`.

**Steps:**
1. Read `chat_registry.json` lookup logic in `Index.js`.
2. Confirm it resolves `APPROVER_EMPLOYEE_ID` → chat_id from the file.
3. Confirm the chat_id is used for the approval Telegram message, not hardcoded.

**Expected Result:**
- chat_registry.json is read at approval time
- VP-004 chat_id resolved dynamically from file

**Pass Criteria:** Dynamic lookup from file; not hardcoded chat_id.

---

## COMP-065 — Approval notification includes Approve + Reject buttons

**Story:** US-018 AC-3
**Priority:** P0

**Steps:**
1. Read the approval notification send path in `Index.js`.
2. Find the `reply_markup` or `inline_keyboard` definition.
3. Confirm both "Approve" and "Reject" buttons present in the keyboard.

**Expected Result:**
- `inline_keyboard` array contains at least 2 buttons
- One button callback_data contains "approve" (case-insensitive)
- One button callback_data contains "reject" (case-insensitive)

**Pass Criteria:** Both buttons defined in code.

---

## COMP-066 — Self-approval: VP-004 as traveler does NOT get Approve/Reject buttons

**Story:** US-020 AC-2
**Priority:** P0

**Steps:**
1. Read booking_confirm handler.
2. Find the self-approval detection: `if (session.employee_id === APPROVER_EMPLOYEE_ID)`.
3. Confirm the self-approval path does NOT send inline buttons to the traveler.
4. Confirm escalationContact is included in the message.

**Expected Result:**
- Self-approval check present
- No inline_keyboard in the VP-004 self-booking justification response
- POLICY.escalationContact referenced in the response message

**Pass Criteria:** Self-approval guard + no buttons + escalationContact.

---

## COMP-067 — Rejection: approval record updated to REJECTED with reason

**Story:** US-019 AC-2
**Priority:** P0

**Precondition:** approvals.json implemented. If not — CONDITIONAL/SKIP.

**Steps:**
1. Trace the rejection handler in `Index.js`.
2. Confirm `status` updated to `'REJECTED'`.
3. Confirm `rejection_reason` field written with VP-004's typed reason.

**Expected Result:**
- Record status changes from PENDING → REJECTED
- rejection_reason field populated

**Pass Criteria:** Both updates present in rejection handler.

---

## COMP-068 — In-policy confirm: no approval record created

**Story:** US-021 AC-3
**Priority:** P0

**Precondition:** approvals.json implemented. If not — CONDITIONAL/SKIP.

**Steps:**
1. Trace in-policy `booking_confirm` path.
2. Confirm no write to approvals.json occurs in this path.

**Expected Result:**
- Compliant booking path goes directly to PNR; no approval write

**Pass Criteria:** No approval write in compliant path.

---

## COMP-069 — approve_booking callback: PNR generated after VP approval

**Story:** US-018 AC-4
**Priority:** P0

**Steps:**
1. Read `approve_booking` callback handler in Index.js.
2. Confirm PNR generation occurs in this handler.
3. Confirm PNR is sent to the TRAVELER's chat_id (not VP-004's).

**Expected Result:**
- PNR generated in approve_booking handler
- Sent to original traveler chat_id from the approval record

**Pass Criteria:** PNR generation + traveler notification in handler.

---

## COMP-070 — Rejection: no CONFIRMED record in bookings.json

**Story:** US-019 AC-4
**Priority:** P0

**Steps:**
1. Trace rejection path in Index.js.
2. Confirm no bookings.json write with `status: CONFIRMED` occurs in rejection path.

**Expected Result:**
- Rejection handler does NOT write to bookings.json with CONFIRMED status
- No PNR is generated in rejection path

**Pass Criteria:** No CONFIRMED write in rejection path.

---

## Summary

| Test ID | Story | AC | Priority | Type |
|---------|-------|----|---------:|------|
| COMP-060 | US-020 | AC-1 | P0 | Static: constant |
| COMP-061 | US-018/021 | AC-1 | P0 | Static: compliance branch |
| COMP-062 | US-021 | EC | P0 | Static: null falsy check |
| COMP-063 | US-018 | AC-2 | P0 | Static: record fields (CONDITIONAL) |
| COMP-064 | US-018 | AC-2 | P0 | Static: dynamic lookup |
| COMP-065 | US-018 | AC-3 | P0 | Static: button definitions |
| COMP-066 | US-020 | AC-2 | P0 | Static: self-approval guard |
| COMP-067 | US-019 | AC-2 | P0 | Static: REJECTED update (CONDITIONAL) |
| COMP-068 | US-021 | AC-3 | P0 | Static: no approval write (CONDITIONAL) |
| COMP-069 | US-018 | AC-4 | P0 | Static: approve_booking PNR |
| COMP-070 | US-019 | AC-4 | P0 | Static: no CONFIRMED on reject |

**Total: 11 COMP tests** (11 P0)

**CONDITIONAL tests** (COMP-063, COMP-067, COMP-068): depend on approvals.json implementation. Mark as SKIP until Dev confirms implementation.
