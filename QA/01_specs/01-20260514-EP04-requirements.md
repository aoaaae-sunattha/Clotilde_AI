# Requirements Analysis — EP-04 Human Escalation & Handoff
**Stories:** US-015, US-016, US-017
**Date:** 2026-05-14
**Author:** Requirements Analyst (AI-assisted)
**Source:** 002-20260514-CLOTILDE-final.md
**Test runner:** `node Index.js` (L3 integration) + Telegram manual (L5)
**Status:** Confirmed — Ready for Phase 2 (Sprint S1c)

---

## Pre-flight Check

- [x] File exists: `QA/00_user-stories/002-20260514-CLOTILDE-final.md`
- [x] Story summaries present for US-015 through US-017
- [x] All ACs written in Given/When/Then format
- [x] No contradictory ACs found
- [x] GAP-07 resolved: US-017 AC-1/AC-2 split into distinct trigger conditions (missing config vs send failure)

---

## US-015 — Escalation Trigger

### Story Summary
Staff employee mentioning a trigger keyword (lost, visa, medical, emergency) is offered a "Connect me to a human agent" inline button immediately.

### Acceptance Criteria (verbatim)
- **AC-1:** Given user message contains any word from `POLICY.humanAgentTriggers`; When agent processes; Then `escalate_to_human` tool called AND bot replies with "Connect me to a human agent" inline button
- **AC-2:** Given escalation button displayed; When user taps "Connect me to a human agent"; Then session mode changes to escalation-pending AND context packet sent to `AGENT_GROUP_CHAT_ID`
- **AC-3:** Given trigger word in message; When escalation offered; Then bot does NOT simultaneously process message as travel booking intent

### Edge Cases to Test
1. Trigger word in non-escalation context ("I lost my luggage tag, not an emergency") — escalation still offered; user can decline
2. `AGENT_GROUP_CHAT_ID` not set in `.env` — see US-017 fallback

### Test Scope
- In scope: trigger word detection, `escalate_to_human` call, inline button presence, no concurrent travel search
- Out of scope: sentiment-based escalation (anger/frustration detection)

### Risk Areas
- `POLICY.humanAgentTriggers` list: if word added to policy.js but not to golden test cases, trigger gap undetected
- "escalation-pending" session mode: not confirmed implemented in v3.0; verify in Index.js

---

## US-016 — Context Packet

### Story Summary
Human agent receives full conversation history, traveler profile, and escalation reason when a traveler is escalated.

### Acceptance Criteria (verbatim)
- **AC-1:** Given `escalate_to_human` called and user confirmed escalation; When `buildContextPacket(chatId, history, lastNluResult)` called; Then returned packet contains: conversation history (array), traveler profile (name, employee_id, department, role), and escalation reason
- **AC-2:** Given context packet built; When bot sends to `AGENT_GROUP_CHAT_ID`; Then message includes traveler name, employee ID, department, and escalation reason in body
- **AC-3:** Given escalation message sent; When message length checked; Then message ≤ 4096 chars OR split into multiple messages if longer

### Edge Cases to Test
1. History is empty (escalation on first message) — packet contains empty history array; profile fields still present
2. Context packet exceeds 4096 characters — message split (AC-3)

### Test Scope
- In scope: `buildContextPacket()` output structure, message delivery to agent group, 4096-char limit
- Out of scope: agent desktop integration (Telegram group is substitute for MVP)

### Risk Areas
- `buildContextPacket` is in `prompt.js` — function signature and output structure must match AC-1 field list
- 4096-char Telegram limit: split logic may not be implemented in v3.0; verify in Index.js

---

## US-017 — Fallback Contact (Escalation Failure)

### Story Summary
If no agent group is configured OR the send fails, bot provides traveler with `POLICY.escalationContact` email without crashing.

### Acceptance Criteria (verbatim)
- **AC-1:** Given `AGENT_GROUP_CHAT_ID` not set (undefined/empty); When `escalate_to_human` invoked and bot attempts to send context packet; Then bot sends traveler message containing `POLICY.escalationContact` email AND does NOT throw unhandled exception
- **AC-2:** Given `AGENT_GROUP_CHAT_ID` set but Telegram `sendMessage` call fails (e.g. bot not in group); When send error caught; Then bot still sends fallback message to traveler containing `POLICY.escalationContact` email AND process continues without crash
- **AC-3:** Given either fallback scenario (AC-1 or AC-2) occurred; When bot process inspected; Then process still running AND subsequent traveler messages handled normally

### Edge Cases to Test
1. Agent group restricted (Telegram error caught) — covered by AC-2
2. POLICY.escalationContact is undefined/empty — email field missing in fallback message (edge risk)

### Test Scope
- In scope: missing AGENT_GROUP_CHAT_ID path, Telegram API send failure path, escalationContact in message, process survival
- Out of scope: queue wait time display

### Risk Areas
- Two distinct failure modes (AC-1: missing config, AC-2: API failure) must each be tested independently in L3
- `POLICY.escalationContact` value must be defined in `policy.js` — verify it is a string, not undefined

---

## Combined Risk Areas — EP-04

| Risk | Severity | Mitigation |
|------|----------|------------|
| escalation-pending session mode not implemented | Medium | Verify Index.js handles escalation state before writing INT tests |
| buildContextPacket() field names may differ from ACs | Medium | Read prompt.js to confirm packet structure before writing AC-1 assertions |
| 4096-char message split may not be implemented | Low | If not implemented, flag as known gap; test asserts no crash on long history |
| POLICY.escalationContact undefined | Low | Read policy.js to confirm field exists before writing AC tests |
