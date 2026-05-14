# COMP Manual Test Cases — EP-04 Human Escalation & Handoff
**Stories:** US-015, US-016, US-017
**Date:** 2026-05-14
**Author:** QA (AI-assisted)
**Layer:** L2 Component (module + code review assertions; no UI)
**Test runner:** Direct module calls + static code path inspection
**Status:** Ready for Execution — Sprint S1c

---

## Test Environment

| Item | Value |
|------|-------|
| Runtime | Node.js ≥18 |
| Required files | `Index.js`, `prompt.js` (buildContextPacket), `policy.js` (humanAgentTriggers, escalationContact) |
| Required env | None for static checks; `TELEGRAM_BOT_TOKEN` for send path |

---

## COMP-050 — POLICY.humanAgentTriggers list exists and is non-empty

**Story:** US-015 AC-1
**Priority:** P0

**Steps:**
1. `const { POLICY } = require('./policy');`
2. `console.log(POLICY.humanAgentTriggers);`
3. Inspect output.

**Expected Result:**
- `POLICY.humanAgentTriggers` is a non-empty array
- Contains strings like "lost", "visa", "medical", "emergency"

**Pass Criteria:** Array with ≥4 string entries.

---

## COMP-051 — escalate_to_human tool is defined in agent.js tool list

**Story:** US-015 AC-1
**Priority:** P0

**Steps:**
1. Read `agent.js`.
2. Find the Gemini function-calling tool definitions.
3. Confirm `escalate_to_human` appears as a defined tool with a name and description.

**Expected Result:**
- `escalate_to_human` present in tool list
- Tool has name, description, and parameters defined

**Pass Criteria:** Tool definition found in agent.js.

---

## COMP-052 — buildContextPacket returns required fields

**Story:** US-016 AC-1
**Priority:** P0

**Steps:**
1. In REPL or script:
   ```js
   const { buildContextPacket } = require('./prompt');
   const mockHistory = [{ role: 'user', content: 'Book me a flight' }];
   const mockNlu = { intent: 'flight_booking' };
   const packet = buildContextPacket('12345', mockHistory, mockNlu);
   console.log(JSON.stringify(packet, null, 2));
   ```
2. Inspect packet structure.

**Expected Result:**
- Packet contains: `history` (array), `travelerProfile` (or equivalent containing name/employee_id/department/role), `escalationReason`

**Pass Criteria:** All three top-level fields present.

**Notes:** Field names may differ slightly (e.g. `profile` vs `travelerProfile`); check against AC-1 field list.

---

## COMP-053 — buildContextPacket with empty history: profile still present

**Story:** US-016 AC-1 edge case
**Priority:** P0

**Steps:**
1. Call `buildContextPacket('12345', [], null)` (empty history, no NLU result).
2. Inspect packet.

**Expected Result:**
- `history` is an empty array (not undefined/null)
- Profile fields still present (name, employee_id, department, role)

**Pass Criteria:** Empty history → still valid packet structure.

---

## COMP-054 — POLICY.escalationContact is a non-empty string

**Story:** US-017 AC-1 / AC-2
**Priority:** P0

**Steps:**
1. `const { POLICY } = require('./policy');`
2. `console.log(POLICY.escalationContact);`

**Expected Result:**
- `POLICY.escalationContact` is a non-empty string (email address or contact info)

**Pass Criteria:** Truthy string value; not undefined or empty.

---

## COMP-055 — Index.js handles missing AGENT_GROUP_CHAT_ID without crash

**Story:** US-017 AC-1
**Priority:** P0

**Steps:**
1. Read the escalation send path in `Index.js`.
2. Confirm there is a guard: `if (!AGENT_GROUP_CHAT_ID)` or equivalent.
3. Confirm the fallback path sends escalationContact to traveler, not a raw exception.

**Expected Result:**
- Null check on AGENT_GROUP_CHAT_ID present
- Fallback sends escalationContact message to traveler

**Pass Criteria:** Guard and fallback both present in code.

---

## COMP-056 — Index.js catches Telegram sendMessage failure and falls back

**Story:** US-017 AC-2
**Priority:** P0

**Steps:**
1. Read the escalation send block in `Index.js`.
2. Confirm the sendMessage call is wrapped in try/catch.
3. Confirm catch block sends escalationContact fallback to traveler.

**Expected Result:**
- try/catch around agent group sendMessage
- catch block has fallback message with escalationContact

**Pass Criteria:** try/catch with fallback present.

---

## COMP-057 — buildContextPacket message length check for 4096 limit

**Story:** US-016 AC-3
**Priority:** P1

**Steps:**
1. Generate a large history: 100 messages of 60 chars each (~6000 chars).
2. Call `buildContextPacket` with large history.
3. Serialize to string; check length.
4. Verify Index.js handles the split or truncation.

**Expected Result:**
- If packet > 4096 chars: Index.js splits into multiple messages OR truncates with indicator
- No crash when history is large

**Pass Criteria:** No crash; message length handling present.

**Notes:** If split is not implemented, flag as known gap; test passes as long as no crash.

---

## COMP-058 — Trigger word detection: "lost" in message activates escalation path

**Story:** US-015 AC-1 (code path check)
**Priority:** P0

**Steps:**
1. Read `agent.js` system prompt or function calling logic.
2. Confirm the system prompt references `POLICY.humanAgentTriggers` or equivalent word list.
3. Confirm `escalate_to_human` tool is called when trigger word present.

**Expected Result:**
- System prompt includes escalation trigger instructions
- Tool list includes `escalate_to_human`

**Pass Criteria:** Both present in agent.js.

---

## COMP-059 — Escalation does not trigger concurrent flight search

**Story:** US-015 AC-3
**Priority:** P0

**Steps:**
1. Read the escalation response path in agent.js.
2. Confirm that when `escalate_to_human` is the tool called, `search_flights` is NOT also called in the same agent turn.

**Expected Result:**
- Single tool call path: escalate_to_human OR search_flights (not both)

**Pass Criteria:** No concurrent tool call in escalation path.

---

## Summary

| Test ID | Story | AC | Priority | Type |
|---------|-------|----|---------:|------|
| COMP-050 | US-015 | AC-1 | P0 | Field exists |
| COMP-051 | US-015 | AC-1 | P0 | Tool definition |
| COMP-052 | US-016 | AC-1 | P0 | Packet structure |
| COMP-053 | US-016 | AC-1 EC | P0 | Empty history |
| COMP-054 | US-017 | AC-1/2 | P0 | escalationContact exists |
| COMP-055 | US-017 | AC-1 | P0 | Static: missing config guard |
| COMP-056 | US-017 | AC-2 | P0 | Static: catch + fallback |
| COMP-057 | US-016 | AC-3 | P1 | 4096-char limit |
| COMP-058 | US-015 | AC-1 | P0 | Static: system prompt |
| COMP-059 | US-015 | AC-3 | P0 | Static: no concurrent search |

**Total: 10 COMP tests** (9 P0, 1 P1)
