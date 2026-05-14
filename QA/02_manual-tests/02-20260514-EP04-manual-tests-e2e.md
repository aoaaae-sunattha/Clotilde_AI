# E2E Manual Test Cases — EP-04 Human Escalation & Handoff
**Stories:** US-015, US-016, US-017
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
| Required env | `TELEGRAM_BOT_TOKEN` + `GEMINI_API_KEY` + `AGENT_GROUP_CHAT_ID` (for AC-2 tests) |
| Reset between tests | `/reset` or restart `node Index.js` |
| Agent group | A Telegram group where the bot is a member (for context packet delivery) |

---

## E2E-042 — Trigger word "lost" activates escalation button

**Story:** US-015 AC-1
**Priority:** P0

**Steps:**
1. `/start` → Staff role.
2. Send: `"I lost my passport, I don't know what to do"`
3. Read bot reply.

**Expected Result:**
- Bot offers a "Connect me to a human agent" inline button
- `escalate_to_human` tool was called (visible in server console log)
- Bot does NOT also show flight search results

**Pass Criteria:** Escalation button present; no flight results.

---

## E2E-043 — Trigger word "emergency" activates escalation

**Story:** US-015 AC-1
**Priority:** P0

**Steps:**
1. `/start` → Staff role.
2. Send: `"There's a medical emergency on my flight"`
3. Read bot reply.

**Expected Result:**
- Escalation button offered
- No concurrent travel search

**Pass Criteria:** Escalation button present.

---

## E2E-044 — Tapping escalation button: session changes, context packet sent

**Story:** US-015 AC-2
**Priority:** P0

**Precondition:** `AGENT_GROUP_CHAT_ID` is set in `.env`. Bot is a member of that group.

**Steps:**
1. Trigger escalation (send "lost passport").
2. Tap "Connect me to a human agent" button.
3. Read bot reply in traveler chat.
4. Check the AGENT_GROUP_CHAT_ID group chat.

**Expected Result:**
- Bot acknowledges escalation in traveler chat
- Context packet message arrives in agent group chat containing: traveler name, employee ID, department, escalation reason

**Pass Criteria:** Context packet in agent group; acknowledgement in traveler chat.

---

## E2E-045 — Context packet contains full required fields

**Story:** US-016 AC-2
**Priority:** P0

**Precondition:** Escalation triggered after 2+ exchanges (history not empty).

**Steps:**
1. `/start` → Staff role.
2. Send a normal message: `"Book a flight to Singapore on June 1"`
3. Read results (creates history).
4. Send: `"I lost my ticket, this is an emergency"`
5. Tap escalation button.
6. Check agent group chat message.

**Expected Result:**
- Agent group message contains:
  - Traveler name
  - Employee ID
  - Department / role
  - Escalation reason
  - Prior conversation history (at least the flight inquiry)

**Pass Criteria:** All required fields visible in agent group message.

---

## E2E-046 — Context packet on first message: empty history handled

**Story:** US-016 AC-1 edge case
**Priority:** P0

**Steps:**
1. `/start` → Staff role.
2. Immediately send: `"Emergency, I need help now"` (first message after role selection).
3. Tap escalation button.
4. Check agent group.

**Expected Result:**
- Context packet sent with empty history array (or "No prior messages")
- Profile fields still present
- No crash

**Pass Criteria:** Packet sent with empty history; no crash.

---

## E2E-047 — Fallback: no AGENT_GROUP_CHAT_ID → escalationContact in traveler chat

**Story:** US-017 AC-1
**Priority:** P0

**Precondition:** Remove `AGENT_GROUP_CHAT_ID` from `.env`. Restart bot.

**Steps:**
1. `/start` → Staff role.
2. Send: `"I lost my passport"`
3. Tap escalation button.
4. Read bot reply in traveler chat.

**Expected Result:**
- Bot sends a message to the traveler containing `POLICY.escalationContact` (email/contact)
- No crash; no unhandled exception in server console

**Pass Criteria:** escalationContact in message; process alive.

---

## E2E-048 — Fallback: Telegram send failure → escalationContact still delivered

**Story:** US-017 AC-2
**Priority:** P0

**Precondition:** Set `AGENT_GROUP_CHAT_ID` to a group the bot is NOT a member of. Bot will fail to send to the group.

**Steps:**
1. `/start` → Staff role.
2. Send: `"I have a visa emergency"`
3. Tap escalation button.
4. Read traveler chat.
5. Check server console.

**Expected Result:**
- Telegram send failure logged in server console
- Traveler still receives escalationContact fallback message
- Bot process continues running (no crash)

**Pass Criteria:** Fallback delivered; process alive; error logged.

---

## E2E-049 — Bot remains operational after escalation fallback

**Story:** US-017 AC-3
**Priority:** P0

**Precondition:** Continue from E2E-047 or E2E-048 (fallback triggered).

**Steps:**
1. After escalation fallback, send a new travel message: `"Book a flight to Singapore June 10"`
2. Read bot reply.

**Expected Result:**
- Bot processes the new travel message normally
- Flight results returned
- No residual escalation state blocking normal use

**Pass Criteria:** Normal travel message handled after escalation fallback.

---

## E2E-050 — Trigger word in non-escalation context still offers button

**Story:** US-015 AC-1 edge case
**Priority:** P1

**Steps:**
1. `/start` → Staff role.
2. Send: `"I lost my luggage tag, nothing urgent"`
3. Read bot reply.

**Expected Result:**
- Bot still offers escalation button (trigger word detected regardless of context)
- User can choose not to tap it and continue normally

**Pass Criteria:** Escalation button offered; user can decline.

---

## E2E-051 — After escalation button offered: declining continues normal flow

**Story:** US-015 AC-1 (positive variant)
**Priority:** P1

**Steps:**
1. `/start` → Staff role.
2. Send: `"I lost my luggage tag"` → escalation button appears.
3. Do NOT tap the escalation button.
4. Send: `"Book me a flight to Singapore on June 5"`
5. Read reply.

**Expected Result:**
- Bot ignores the previous escalation state and processes the new travel intent
- Flight results returned for Singapore

**Pass Criteria:** Normal flow resumes after declining escalation.

---

## Summary

| Test ID | Story | AC | Priority | Channel |
|---------|-------|----|---------:|---------|
| E2E-042 | US-015 | AC-1 | P0 | Telegram |
| E2E-043 | US-015 | AC-1 | P0 | Telegram |
| E2E-044 | US-015 | AC-2 | P0 | Telegram + agent group |
| E2E-045 | US-016 | AC-2 | P0 | Telegram + agent group |
| E2E-046 | US-016 | AC-1 EC | P0 | Telegram + agent group |
| E2E-047 | US-017 | AC-1 | P0 | Telegram |
| E2E-048 | US-017 | AC-2 | P0 | Telegram |
| E2E-049 | US-017 | AC-3 | P0 | Telegram |
| E2E-050 | US-015 | AC-1 EC | P1 | Telegram |
| E2E-051 | US-015 | AC-1 | P1 | Telegram |

**Total: 10 E2E tests** (8 P0, 2 P1)

---

## Environment Notes

- E2E-044, E2E-045, E2E-046 require a real Telegram group with bot as member.
- E2E-047 requires removing `AGENT_GROUP_CHAT_ID` from `.env` and restarting bot.
- E2E-048 requires setting `AGENT_GROUP_CHAT_ID` to a group the bot is NOT in.
- Restore `.env` to standard config after each env-modification test.
