# E2E Manual Test Cases — EP-05 Approval Workflow
**Stories:** US-018, US-019, US-020, US-021
**Date:** 2026-05-14
**Author:** QA (AI-assisted)
**Layer:** L5 Manual Telegram (end-to-end via live Telegram bot)
**Test runner:** Telegram app (mobile or desktop)
**Status:** Ready for Execution — Sprint S1c

---

## Test Environment

| Item | Value |
|------|-------|
| Bot | @ClotildeBot (dev/test instance) |
| Runtime | Node.js ≥18 running `Index.js` |
| Required env | `TELEGRAM_BOT_TOKEN` + `GEMINI_API_KEY` in `.env` |
| Two Telegram accounts | Traveler (Staff) + Approver (VP-004) |
| Required state | VP-004 must have completed `/start` to register chat_id in `chat_registry.json` |
| Reset between tests | Truncate `bookings.json` and `approvals.json`; `/reset` both accounts |

**BLOCKING RISK:** Tests E2E-053 through E2E-061 depend on `approvals.json` being implemented. If not implemented, mark as BLOCKED and raise Dev ticket.

---

## E2E-052 — In-policy confirm: immediate PNR, no justification asked

**Story:** US-021 AC-1, AC-2
**Priority:** P0

**Steps:**
1. [Traveler] `/start` → Staff role.
2. Send: `"Flight from Bangkok to Singapore on June 1"`
3. Tap `Confirm` on an `IN-POLICY` flight.
4. Read bot reply.

**Expected Result:**
- Bot does NOT ask for justification
- PNR displayed immediately in the same message
- `bookings.json` contains `status: CONFIRMED` record

**Pass Criteria:** PNR in chat; CONFIRMED in bookings.json; no justification prompt.

---

## E2E-053 — In-policy confirm: no approval record created

**Story:** US-021 AC-3
**Priority:** P0

**Precondition:** Continue from E2E-052.

**Steps:**
1. After in-policy confirm, inspect `approvals.json` (if it exists).

**Expected Result:**
- No approval record for this booking in `approvals.json`

**Pass Criteria:** No approval record; CONDITIONAL on approvals.json existing.

---

## E2E-054 — Out-of-policy flight confirm: justification prompt (no PNR)

**Story:** US-018 AC-1
**Priority:** P0

**Steps:**
1. [Traveler] `/start` → Staff role.
2. Request BKK→LHR (long-haul) flight.
3. Tap `Confirm` on an `OUT-OF-POLICY` flight.
4. Read bot reply.

**Expected Result:**
- Bot asks for business justification text
- No PNR displayed
- `bookings.json` has no new CONFIRMED record

**Pass Criteria:** Justification prompt shown; no PNR.

---

## E2E-055 — Justification submitted: PENDING record, VP-004 notified

**Story:** US-018 AC-2, AC-3
**Priority:** P0

**Precondition:** Continue from E2E-054 (bot awaiting justification). VP-004 registered in chat_registry.json.

**Steps:**
1. [Traveler] Send: `"Required for executive client meeting in London"`
2. Read traveler chat — bot confirms receipt.
3. [VP-004] Check Telegram for approval notification.
4. Inspect `approvals.json` for PENDING record.

**Expected Result:**
- Traveler chat: confirmation of justification received
- VP-004 chat: message with booking details, price, and justification text
- VP-004 message has Approve and Reject inline buttons
- `approvals.json`: record with `status: PENDING` and justification text

**Pass Criteria:** VP notified with buttons; PENDING record.

---

## E2E-056 — VP taps Approve: PNR generated, traveler notified

**Story:** US-018 AC-4
**Priority:** P0

**Precondition:** Continue from E2E-055 (VP-004 has approval notification).

**Steps:**
1. [VP-004] Tap the `Approve` button.
2. [Traveler] Read bot reply.
3. Inspect `bookings.json`.

**Expected Result:**
- [Traveler] Receives booking confirmation with PNR
- `bookings.json`: new record with `status: CONFIRMED` and the PNR
- `approvals.json`: record updated to `APPROVED`

**Pass Criteria:** PNR in traveler chat; CONFIRMED in bookings.json.

---

## E2E-057 — VP taps Reject: rejection reason prompted

**Story:** US-019 AC-1
**Priority:** P0

**Precondition:** VP-004 has an approval notification with Approve/Reject buttons.

**Steps:**
1. [VP-004] Tap the `Reject` button.
2. [VP-004] Read bot reply.

**Expected Result:**
- Bot prompts VP-004 to type a rejection reason
- `approvals.json` record is NOT updated yet (still PENDING)

**Pass Criteria:** Rejection reason prompt shown; record not yet updated.

---

## E2E-058 — VP submits rejection reason: record REJECTED, traveler notified

**Story:** US-019 AC-2, AC-3, AC-4
**Priority:** P0

**Precondition:** Continue from E2E-057 (VP-004 awaiting reason input).

**Steps:**
1. [VP-004] Send: `"Cheaper alternative available; please rebook economy"`
2. [Traveler] Read bot reply.
3. Inspect `bookings.json` and `approvals.json`.

**Expected Result:**
- `approvals.json`: status updated to `REJECTED`; rejection reason stored
- [Traveler] Receives rejection notification with the rejection reason
- No PNR in traveler rejection message
- `bookings.json`: no `CONFIRMED` record for this trip

**Pass Criteria:** REJECTED record; traveler notified with reason; no PNR.

---

## E2E-059 — VP sends empty rejection reason: re-prompt

**Story:** US-019 edge case
**Priority:** P0

**Precondition:** VP-004 tapped Reject and bot is awaiting rejection reason.

**Steps:**
1. [VP-004] Send: `"   "` (whitespace only).
2. Read bot reply.

**Expected Result:**
- Bot asks again for rejection reason
- No REJECTED record created for empty/whitespace reason

**Pass Criteria:** Re-prompt sent; no premature record update.

---

## E2E-060 — VP-004 as traveler: no Approve/Reject button, escalationContact shown

**Story:** US-020 AC-2
**Priority:** P0

**Steps:**
1. [VP-004] `/start` → VP/C-Suite role.
2. Request an OUT-OF-POLICY flight (e.g. BKK→LHR exceeding cap).
3. Tap `Confirm` on the OUT-OF-POLICY result.
4. Send justification: `"Required for board meeting"`
5. Read bot reply.

**Expected Result:**
- Bot asks for justification (AC-2)
- Justification stored as PENDING
- Bot does NOT show Approve/Reject buttons in VP-004's chat
- Bot message includes `POLICY.escalationContact` email/contact
- No PNR generated

**Pass Criteria:** No approval buttons; escalationContact shown; no PNR.

---

## E2E-061 — Non-VP books OOP: approval notification goes to VP-004 only

**Story:** US-020 AC-3
**Priority:** P0

**Precondition:** Staff user is NOT VP-004. VP-004 registered in chat_registry.json.

**Steps:**
1. [Staff] `/start` → Staff role.
2. Submit out-of-policy booking with justification.
3. [VP-004] Check for approval notification.
4. [Staff] Confirm no approval notification in their own chat.

**Expected Result:**
- VP-004 receives approval notification
- Staff traveler does NOT receive approval notification
- Approval notification sent to VP-004's chat_id only

**Pass Criteria:** VP-004 gets notification; traveler does not.

---

## E2E-062 — is_compliant null treated as OOP: justification required

**Story:** US-021 edge case / US-027 edge case
**Priority:** P1

**Precondition:** Modify getMockHotels to return a hotel with a foreign-currency price (triggering null compliance). Restore after test.

**Steps:**
1. [Staff] Search for hotels in a city with the modified mock.
2. Tap Confirm on the null-compliance hotel.
3. Read bot reply.

**Expected Result:**
- Bot asks for justification (null treated as non-compliant)
- No hotel reference code generated

**Pass Criteria:** Justification prompt shown for null-compliance hotel.

---

## Summary

| Test ID | Story | AC | Priority | Accounts |
|---------|-------|----|---------:|---------|
| E2E-052 | US-021 | AC-1/2 | P0 | Traveler |
| E2E-053 | US-021 | AC-3 | P0 | Traveler + file |
| E2E-054 | US-018 | AC-1 | P0 | Traveler |
| E2E-055 | US-018 | AC-2/3 | P0 | Traveler + VP-004 |
| E2E-056 | US-018 | AC-4 | P0 | VP-004 + Traveler |
| E2E-057 | US-019 | AC-1 | P0 | VP-004 |
| E2E-058 | US-019 | AC-2/3/4 | P0 | VP-004 + Traveler |
| E2E-059 | US-019 | EC | P0 | VP-004 |
| E2E-060 | US-020 | AC-2 | P0 | VP-004 as traveler |
| E2E-061 | US-020 | AC-3 | P0 | Staff + VP-004 |
| E2E-062 | US-021/027 | EC | P1 | Traveler |

**Total: 11 E2E tests** (10 P0, 1 P1)

---

## Two-Account Test Setup

Tests E2E-055 through E2E-061 require two Telegram accounts active simultaneously:
- **Account A (Traveler):** Staff role — submits bookings
- **Account B (VP-004):** VP/C-Suite role — receives and acts on approval notifications

VP-004 must be registered: ensure VP-004 has run `/start` and selected VP role before these tests.
