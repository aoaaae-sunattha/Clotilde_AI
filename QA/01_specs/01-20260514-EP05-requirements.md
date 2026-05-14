# Requirements Analysis — EP-05 Approval Workflow
**Stories:** US-018, US-019, US-020, US-021
**Date:** 2026-05-14
**Author:** Requirements Analyst (AI-assisted)
**Source:** 002-20260514-CLOTILDE-final.md
**Test runner:** `node Index.js` (L3 integration) + Telegram manual (L5)
**Status:** Confirmed — Ready for Phase 2 (Sprint S1c)

---

## Pre-flight Check

- [x] File exists: `QA/00_user-stories/002-20260514-CLOTILDE-final.md`
- [x] Story summaries present for US-018 through US-021
- [x] All ACs written in Given/When/Then format
- [x] No contradictory ACs found
- [x] GAP-03 resolved: approvals.json acknowledged as unconfirmed; ACs written against observable outcomes
- [x] GAP-04 (US-020): RESOLVED — PM/PO decision 2026-05-14, option (b)

---

## US-018 — Approval Flow (Staff → VP)

### Story Summary
Staff employee's out-of-policy booking is held as PENDING; VP-004 receives Telegram approval request with Approve/Reject buttons; on Approve, PNR is generated and sent to traveler.

### Acceptance Criteria (verbatim)
- **AC-1:** Given user taps Confirm on `is_compliant: false` flight/hotel; When `booking_confirm` fires; Then bot asks for justification text AND does NOT generate PNR
- **AC-2:** Given user submits non-empty justification; When bot processes; Then approval record persisted with `PENDING` status AND record includes booking details and justification text AND VP-004's chat_id looked up in `chat_registry.json`
- **AC-3:** Given VP-004's chat_id found; When approval notification sent; Then VP-004 receives message with booking details, price, justification AND Approve + Reject inline buttons
- **AC-4:** Given VP-004 taps Approve; When `approve_booking` callback fires; Then PNR generated AND traveler's chat receives booking confirmation with PNR

### Edge Cases to Test
1. VP-004's chat_id not in `chat_registry.json` — approval notification fails; approval record still written as PENDING; see US-017 fallback pattern
2. VP-004 is the traveler — see US-020

### Test Scope
- In scope: justification prompt, PENDING record creation, VP notification (Approve/Reject buttons), PNR-on-approve
- Out of scope: approval expiry/TTL, multi-step approval chain

### Risk Areas
- `approvals.json` existence not confirmed in v3.0 (HIGH — mark INT tests with `.skip` until verified)
- `approve_booking` callback name must match Index.js implementation — verify before writing test
- VP-004 chat_id lookup requires chat_registry.json to have a VP-004 entry (test fixture must seed it)

---

## US-019 — Rejection Flow

### Story Summary
VP approver rejects booking with a typed reason; approval record updated to REJECTED; traveler receives rejection notification with reason; no PNR generated.

### Acceptance Criteria (verbatim)
- **AC-1:** Given VP-004 received approval notification; When VP-004 taps Reject; Then bot prompts VP-004 for rejection reason AND does NOT update record until reason submitted
- **AC-2:** Given VP-004 submits rejection reason; When bot processes; Then approval record status updated to `REJECTED` AND rejection reason stored in record
- **AC-3:** Given record set to `REJECTED`; When traveler's chat inspected; Then traveler receives rejection notification with rejection reason AND no PNR in message
- **AC-4:** Given booking rejected; When `bookings.json` inspected; Then no `CONFIRMED` record for this trip AND no PNR generated

### Edge Cases to Test
1. VP-004 sends empty rejection reason — bot asks again; empty not accepted
2. Traveler starts new search before rejection arrives — rejection notification still delivered to their chat

### Test Scope
- In scope: rejection reason prompt, REJECTED record status, traveler notification, no CONFIRMED record
- Out of scope: re-submission flow after rejection

### Risk Areas
- Same `approvals.json` risk as US-018 (HIGH)
- Traveler notification delivery depends on chat_id still being valid (bot not blocked)

---

## US-020 — Self-Approval Block (VP as Traveler)

### Story Summary
VP-004 booking out-of-policy cannot self-approve; justification stored as PENDING; no Approve/Reject button shown; VP-004 directed to contact travel desk.

### Acceptance Criteria (verbatim)
- **AC-1:** Given any out-of-policy booking; When approval routing runs; Then approver is determined by `APPROVER_EMPLOYEE_ID` constant in `Index.js` AND this is the single config point for approver identity
- **AC-2:** Given VP-004 (APPROVER_EMPLOYEE_ID) selects out-of-policy option for own travel; When `booking_confirm` fires; Then bot asks for justification AND stores justification record as `PENDING` AND does NOT display Approve/Reject button AND does NOT generate PNR AND informs VP-004 to contact travel desk via `POLICY.escalationContact`
- **AC-3:** Given non-VP employee books out-of-policy; When approval notification sent; Then delivered to VP-004's chat_id (from `APPROVER_EMPLOYEE_ID` via `chat_registry.json`) AND not to traveler themselves

### Edge Cases to Test
1. `APPROVER_EMPLOYEE_ID` constant not defined in Index.js — approval routing undefined; HIGH risk

### Test Scope
- In scope: APPROVER_EMPLOYEE_ID config, self-approval block (no Approve/Reject button), PENDING without PNR, escalationContact in message
- Out of scope: dynamic approver routing by org chart

### Risk Areas
- `APPROVER_EMPLOYEE_ID` may not be implemented in v3.0 — verify in Index.js before writing tests
- INT-054 should be marked `.skip` until implementation confirmed

---

## US-021 — In-Policy Skips Approval

### Story Summary
Compliant booking confirms immediately without justification or approval — PNR generated in same interaction.

### Acceptance Criteria (verbatim)
- **AC-1:** Given user taps Confirm on `is_compliant: true`; When `booking_confirm` fires; Then bot does NOT ask for justification AND proceeds directly to PNR generation
- **AC-2:** Given in-policy `booking_confirm` fired; When booking processed; Then PNR generated and returned to traveler in same interaction AND `bookings.json` contains `CONFIRMED` record
- **AC-3:** Given compliant booking confirmed; When approval store inspected; Then no approval record exists for this booking

### Edge Cases to Test
1. `is_compliant` is `null` (foreign-currency price — currency mismatch) — system must treat null as non-compliant; justification required (safe default)

### Test Scope
- In scope: no-justification path for compliant booking, PNR in same interaction, CONFIRMED in bookings.json, no approval record
- Out of scope: advance booking 3-day rule (in policy.js but not wired to block bookings in v3.0)

### Risk Areas
- `is_compliant: null` handling (US-021 edge case + US-027 edge case) — if not handled, null treated as truthy → compliance bypass
- No approval record assertion requires knowing the approval store name (HIGH — approvals.json unconfirmed)

---

## Combined Risk Areas — EP-05

| Risk | Severity | Mitigation |
|------|----------|------------|
| approvals.json not implemented | High | Mark INT-055–065 as .skip until verified; escalate to Dev Sprint S1 kickoff |
| APPROVER_EMPLOYEE_ID constant missing | High | Verify Index.js before writing US-020 INT tests |
| approve_booking callback name mismatch | Medium | Read Index.js callback_query handler map before test naming |
| is_compliant: null not handled | Medium | POL-021 (test_policy.js) + INT edge case covers this |
| VP chat_id not seeded in test fixture | Medium | reset-test-data.js must seed VP-004 in chat_registry.json |
