# User Story Draft — Clotilde
**Version:** 1.0 (Draft)
**Author:** PM/PO (AI-assisted)
**Date:** 2026-05-14
**Business Goals Reference:** 000-20260514-business-goals.md
**Status:** Draft — Awaiting BA Review (Step 002)

---

## Epic Index

| Epic ID | Epic Name | Business Goal(s) | Priority | Estimated Sprint | Story IDs |
|---------|-----------|-----------------|----------|-----------------|-----------|
| EP-01 | Flight Booking Pipeline | BG-01, BG-03 | P0 | S0 | US-001–US-004 |
| EP-02 | Policy Compliance Engine | BG-02 | P0 | S0 | US-005–US-009 |
| EP-03 | NLU & AI Quality | BG-03 | P0 | S0 | US-010–US-014 |
| EP-04 | Human Escalation & Handoff | BG-04 | P1 | S1 | US-015–US-017 |
| EP-05 | Approval Workflow | BG-05 | P1 | S1 | US-018–US-021 |
| EP-06 | Notification System | BG-06 | P1 | S1 | US-022–US-024 |
| EP-07 | Hotel Booking Pipeline | BG-07 | P1 | S2 | US-025–US-027 |

---

## Stories

---

### EP-01 — Flight Booking Pipeline

---
**Story ID:** US-001
**Epic:** EP-01 — Flight Booking Pipeline
**Persona:** Operations / Staff (standard employee)
**Priority:** P0
**Business Goal:** BG-01

**User Story:**
As a Staff employee, I want to search for and confirm a flight through the Telegram chat so that I receive a PNR and my booking is saved.

**Draft Acceptance Criteria:**
- AC-1: After selecting a role, I can send a flight intent message and receive a list of results.
- AC-2: When I confirm a selection, a 6-character alphanumeric PNR is generated and displayed.
- AC-3: The booking record appears in bookings.json with status CONFIRMED and correct employee_id.
- AC-4: If I confirm twice rapidly (double-tap), only one booking is created.

**Edge Cases to Explore:**
- What if Duffel API is down when the search is triggered?
- What if the user types "3" instead of using the button to select an option?
- What if the user sends a new message mid-booking flow?

**Out of Scope:**
- Rescheduling or cancelling the confirmed booking (deferred).
- Multi-passenger bookings.

---
**Story ID:** US-002
**Epic:** EP-01 — Flight Booking Pipeline
**Persona:** Operations / Staff
**Priority:** P0
**Business Goal:** BG-01, BG-03

**User Story:**
As a Staff employee, I want the bot to ask me for missing travel details before searching so that I don't get incorrect results from incomplete inputs.

**Draft Acceptance Criteria:**
- AC-1: If I say "Book a flight to Singapore" without a date, the bot asks for the missing date before calling search_flights.
- AC-2: The bot does not call search_flights until origin, destination, and date are all collected.
- AC-3: If I provide all details in one message, the bot searches immediately without asking again.

**Edge Cases to Explore:**
- What if the destination is a country name instead of a city (e.g. "France")?
- What if I say "next Friday" — does the bot clarify which date?
- What if I say "London" — does the bot ask which airport?

**Out of Scope:**
- Date parsing beyond one week ahead.
- Non-English input.

---
**Story ID:** US-003
**Epic:** EP-01 — Flight Booking Pipeline
**Persona:** Operations / Staff
**Priority:** P0
**Business Goal:** BG-01, BG-10

**User Story:**
As a Staff employee, I want the bot to still show me flight options even when the live API is unavailable so that my travel planning is not blocked by a system outage.

**Draft Acceptance Criteria:**
- AC-1: When Duffel API returns an error, the bot falls back to mock_inventory.js automatically.
- AC-2: The traveler receives flight results (from mock) without seeing a raw error message.
- AC-3: The fallback completes within 2 seconds of the Duffel failure.

**Edge Cases to Explore:**
- What if both Duffel and the mock are unreachable?
- What if Duffel returns a partial response?

**Out of Scope:**
- Live Duffel error types beyond timeout/exception (e.g. 401 auth errors — deferred).

---
**Story ID:** US-004
**Epic:** EP-01 — Flight Booking Pipeline
**Persona:** Operations / Staff
**Priority:** P1
**Business Goal:** BG-01

**User Story:**
As a Staff employee, I want protection against double-booking so that rapid button taps do not create duplicate PNRs for the same flight.

**Draft Acceptance Criteria:**
- AC-1: If booking_confirm is triggered while a booking is already in progress, the second trigger is silently blocked.
- AC-2: Only one booking record appears in bookings.json regardless of how many times confirm is tapped.
- AC-3: A warning is logged in the server console when a duplicate confirm is blocked.

**Edge Cases to Explore:**
- What if the network is slow and the first confirm appears to hang?

**Out of Scope:**
- Idempotency across bot restarts (in-memory session is lost on restart — deferred).

---

### EP-02 — Policy Compliance Engine

---
**Story ID:** US-005
**Epic:** EP-02 — Policy Compliance Engine
**Persona:** Operations / Staff
**Priority:** P0
**Business Goal:** BG-02

**User Story:**
As a Staff employee, I want to see clearly which flight options comply with company policy so that I do not accidentally book something that requires justification.

**Draft Acceptance Criteria:**
- AC-1: Every flight result includes an is_compliant field with a value of true or false.
- AC-2: In-policy results are labelled IN-POLICY or PREFERRED & IN-POLICY in the formatted output.
- AC-3: The preferred airline (Thai Airways) appears as the first result when available on the route.

**Edge Cases to Explore:**
- What if all returned flights are out of policy?
- What if the route has no preferred airline (e.g. domestic)?

**Out of Scope:**
- Currency conversion for non-THB routes (deferred).

---
**Story ID:** US-006
**Epic:** EP-02 — Policy Compliance Engine
**Persona:** Operations / Staff
**Priority:** P0
**Business Goal:** BG-02

**User Story:**
As a Staff employee, I want out-of-policy options to be clearly flagged so that I understand the cost before making a choice.

**Draft Acceptance Criteria:**
- AC-1: A flight priced above the applicable budget cap has is_compliant: false.
- AC-2: The formatted output labels it OUT-OF-POLICY with the rule that was violated.
- AC-3: The compliance_notes field states the exact amount over the cap.

**Edge Cases to Explore:**
- What if the price is exactly 1 THB over the cap?
- What if the policy cap for the city is not defined (falls to DEFAULT)?

**Out of Scope:**
- Blocking the out-of-policy option entirely (system allows with justification — not block).

---
**Story ID:** US-007
**Epic:** EP-02 — Policy Compliance Engine
**Persona:** QA Engineer (test automation)
**Priority:** P0
**Business Goal:** BG-02

**User Story:**
As a QA Engineer, I want automated boundary value tests that verify the compliance engine at exact policy limits so that any change to policy.js is immediately caught.

**Draft Acceptance Criteria:**
- AC-1: test_policy.js passes 100% when run against the unmodified policy.js.
- AC-2: A hotel priced at exactly the cap (e.g. BKK 4000 THB) is flagged is_compliant: true.
- AC-3: A hotel priced at cap+1 (4001 THB) is flagged is_compliant: false.
- AC-4: All 5 hotel cities (BKK, SIN, NYC, LON, TYO) are tested at their respective boundaries.

**Edge Cases to Explore:**
- What if policy.js is changed to add a new city without updating the test?

**Out of Scope:**
- Multi-currency boundary tests (non-THB comparisons deferred).

---
**Story ID:** US-008
**Epic:** EP-02 — Policy Compliance Engine
**Persona:** Operations / Staff
**Priority:** P0
**Business Goal:** BG-02

**User Story:**
As a Staff employee, I want the system to enforce my cabin class entitlement so that I cannot inadvertently book Business Class when I am only entitled to Economy.

**Draft Acceptance Criteria:**
- AC-1: When a Staff employee searches for Business Class, the system either returns Economy results or flags Business Class as out-of-policy.
- AC-2: When a Director searches, Business Class (C) results are returned as in-policy.
- AC-3: Cabin class entitlement is determined by the role selected at /start, not by the traveler's self-declared preference.

**Edge Cases to Explore:**
- What if a Staff user explicitly requests "First Class"?
- What if a VP requests Economy — is it allowed (downgrade)?

**Out of Scope:**
- Premium Economy (W) entitlement rules (not defined in current policy.js).

---
**Story ID:** US-009
**Epic:** EP-02 — Policy Compliance Engine
**Persona:** Operations / Staff
**Priority:** P0
**Business Goal:** BG-02, BG-05

**User Story:**
As a Staff employee, I want to be asked for a business justification when I select an out-of-policy option so that the booking can be reviewed by a manager rather than blocked outright.

**Draft Acceptance Criteria:**
- AC-1: When an out-of-policy option is confirmed, the bot asks for a business justification text before routing to approval.
- AC-2: The justification text is stored in the approval record in approvals.json.
- AC-3: The booking is not confirmed (no PNR) until the manager approves.

**Edge Cases to Explore:**
- What if the employee sends an empty justification?
- What if the approver (VP-004) is the one booking out-of-policy?

**Out of Scope:**
- Multiple levels of approval (one approver only in v3.0).

---

### EP-03 — NLU & AI Quality

---
**Story ID:** US-010
**Epic:** EP-03 — NLU & AI Quality
**Persona:** QA Engineer
**Priority:** P0
**Business Goal:** BG-03

**User Story:**
As a QA Engineer, I want an automated NLU regression suite so that any change to the system prompt or agent configuration is immediately validated against known test cases.

**Draft Acceptance Criteria:**
- AC-1: node run_tests.js executes all 15 golden dataset cases and exits with a pass/fail verdict.
- AC-2: Overall accuracy is displayed as a percentage; the verdict threshold is 80%.
- AC-3: Results are broken down by category (booking_standard, negation, ambiguity, etc.).
- AC-4: The FGR section runs after NLU tests and reports price grounding accuracy.

**Edge Cases to Explore:**
- What if the Gemini API is rate-limited during the test run?
- What if a new intent is added to agent.js but not covered in golden_dataset.js?

**Out of Scope:**
- Automated golden dataset expansion (manual review process).

---
**Story ID:** US-011
**Epic:** EP-03 — NLU & AI Quality
**Persona:** Operations / Staff
**Priority:** P0
**Business Goal:** BG-03

**User Story:**
As a Staff employee using informal language, I want the bot to correctly understand slang and non-standard phrasings so that I don't have to use formal phrasing to book travel.

**Draft Acceptance Criteria:**
- AC-1: "Grab a bird to BKK tomorrow" is classified as flight_booking with destination BKK.
- AC-2: "Reserve me a seat to Bangkok on June 10" maps to flight_booking, not a different intent.
- AC-3: Adding filler words ("Please book…" vs "Book…") does not change the intent or entities.

**Edge Cases to Explore:**
- What if slang is ambiguous and could mean multiple intents?
- What if the destination abbreviation is not a standard IATA code?

**Out of Scope:**
- Slang in non-English languages.

---
**Story ID:** US-012
**Epic:** EP-03 — NLU & AI Quality
**Persona:** Operations / Staff
**Priority:** P0
**Business Goal:** BG-03

**User Story:**
As a Staff employee, I want the bot to correctly handle negation in my messages so that saying "I do NOT want to fly to London" does not trigger a London flight search.

**Draft Acceptance Criteria:**
- AC-1: "I do NOT want to fly to London" does not produce a flight search to London.
- AC-2: The entity London (LON) does not appear as destination in the extracted entities.
- AC-3: "Do not book the hotel, just the flight to Paris" correctly books only a flight with destination CDG.

**Edge Cases to Explore:**
- What if the negation is ambiguous ("I don't really want London but maybe…")?

**Out of Scope:**
- Negation across multi-turn conversation (beyond current context window).

---
**Story ID:** US-013
**Epic:** EP-03 — NLU & AI Quality
**Persona:** QA Engineer
**Priority:** P0
**Business Goal:** BG-03

**User Story:**
As a QA Engineer, I want the FGR (Fact Grounding Rate) test to verify that prices displayed by the AI match the source mock payload so that hallucinated prices are immediately detected.

**Draft Acceptance Criteria:**
- AC-1: runFGRTests() in run_tests.js calls getMockFlights and getMockHotels and formats the results.
- AC-2: Every price in the formatted output matches the corresponding amount field in the source object.
- AC-3: The FGR verdict is printed with a pass/fail threshold of 90%.

**Edge Cases to Explore:**
- What if toLocaleString() formats numbers differently across Node.js versions (e.g. "4,200" vs "4200")?

**Out of Scope:**
- FGR testing against live Duffel prices (live prices change — deferred).

---
**Story ID:** US-014
**Epic:** EP-03 — NLU & AI Quality
**Persona:** Operations / Staff
**Priority:** P1
**Business Goal:** BG-03

**User Story:**
As a Staff employee, I want the bot to handle out-of-scope requests gracefully so that I receive a helpful response rather than an error or irrelevant travel booking.

**Draft Acceptance Criteria:**
- AC-1: "Order me a pizza" is classified as out_of_scope and receives a polite decline.
- AC-2: "What is the capital of France?" is handled gracefully without triggering a flight search.
- AC-3: The bot does not crash or return an empty message on out-of-scope input.

**Edge Cases to Explore:**
- What if out-of-scope input contains travel keywords ("deliver a package to London")?

**Out of Scope:**
- Building a general-purpose FAQ system.

---

### EP-04 — Human Escalation & Handoff

---
**Story ID:** US-015
**Epic:** EP-04 — Human Escalation & Handoff
**Persona:** Operations / Staff
**Priority:** P1
**Business Goal:** BG-04

**User Story:**
As a Staff employee in a difficult situation, I want to be connected to a human agent when I mention keywords like "lost", "visa", "medical", or "emergency" so that I get specialist help immediately.

**Draft Acceptance Criteria:**
- AC-1: Sending a message containing any word in POLICY.humanAgentTriggers causes escalate_to_human to be called.
- AC-2: The user is offered a "Connect me to a human agent" button.
- AC-3: If the user confirms escalation, the session mode changes to pending_claim or human.

**Edge Cases to Explore:**
- What if the trigger word appears in a non-escalation context ("I lost my luggage tag, not an emergency")?
- What if AGENT_GROUP_CHAT_ID is not set?

**Out of Scope:**
- Sentiment-based escalation (anger/frustration detection — deferred).

---
**Story ID:** US-016
**Epic:** EP-04 — Human Escalation & Handoff
**Persona:** Human Agent (travel support)
**Priority:** P1
**Business Goal:** BG-04

**User Story:**
As a human agent, I want to receive the full conversation history when a traveler is escalated so that I don't have to ask them to repeat what they already told the bot.

**Draft Acceptance Criteria:**
- AC-1: buildContextPacket() produces a structured packet including conversation history, traveler profile, and escalation reason.
- AC-2: The context packet is sent to AGENT_GROUP_CHAT_ID on escalation confirmation.
- AC-3: The escalation message in the agent group includes traveler name, employee ID, department, and reason.

**Edge Cases to Explore:**
- What if history is empty (escalation on first message)?
- What if the context packet exceeds Telegram's message character limit?

**Out of Scope:**
- Agent desktop integration (Telegram group is the substitute for MVP).

---
**Story ID:** US-017
**Epic:** EP-04 — Human Escalation & Handoff
**Persona:** Operations / Staff
**Priority:** P1
**Business Goal:** BG-04

**User Story:**
As a Staff employee, I want to receive an alternative contact option if no agent is available so that I am not left without support.

**Draft Acceptance Criteria:**
- AC-1: If AGENT_GROUP_CHAT_ID is not configured, the user receives a message with the escalationContact email.
- AC-2: If the group post fails (Telegram error), the user still receives the fallback contact message.
- AC-3: The bot does not crash when escalation to the group fails.

**Edge Cases to Explore:**
- What if the agent group is full or restricted?

**Out of Scope:**
- Queue wait time display (deferred).

---

### EP-05 — Approval Workflow

---
**Story ID:** US-018
**Epic:** EP-05 — Approval Workflow
**Persona:** Operations / Staff + VP/C-Suite (approver)
**Priority:** P1
**Business Goal:** BG-05

**User Story:**
As a Staff employee who selected an out-of-policy option, I want my booking to be sent for approval so that I can still travel if my manager agrees.

**Draft Acceptance Criteria:**
- AC-1: Confirming an out-of-policy flight/hotel triggers the justification request, not a PNR.
- AC-2: After justification is submitted, an approval record is written to approvals.json with status PENDING.
- AC-3: The VP/C-Suite approver receives a Telegram notification with booking details, price, and justification.
- AC-4: When the approver clicks Approve, a PNR is generated and the traveler is notified.

**Edge Cases to Explore:**
- What if the approver's chat_id is not in chat_registry.json?
- What if the VP approves their own out-of-policy booking?

**Out of Scope:**
- Approval expiry / TTL (deferred).
- Multi-step approval chain (one approver only).

---
**Story ID:** US-019
**Epic:** EP-05 — Approval Workflow
**Persona:** VP/C-Suite (approver)
**Priority:** P1
**Business Goal:** BG-05

**User Story:**
As a VP approver, I want to reject a booking request with a reason so that the traveler understands why it was denied and can resubmit.

**Draft Acceptance Criteria:**
- AC-1: Clicking Reject prompts the approver to type a rejection reason.
- AC-2: The rejection reason is stored in the approval record.
- AC-3: The traveler receives a rejection notification including the reason.
- AC-4: No PNR is generated for rejected bookings.

**Edge Cases to Explore:**
- What if the approver sends an empty rejection reason?
- What if the traveler has already cancelled the trip before the rejection arrives?

**Out of Scope:**
- Re-submission flow after rejection (traveler must start a new search).

---
**Story ID:** US-020
**Epic:** EP-05 — Approval Workflow
**Persona:** VP/C-Suite (approver)
**Priority:** P1
**Business Goal:** BG-05

**User Story:**
As a system, I want to prevent any employee from approving their own out-of-policy booking so that the approval process cannot be bypassed.

**Draft Acceptance Criteria:**
- AC-1: The approver is always VP-004 (Sarah Mitchell), regardless of what the traveler's profile says in the approver field.
- AC-2: If VP-004 books an out-of-policy option, the system does not route to self-approval (currently skips approval — to be reviewed).
- AC-3: The APPROVER_EMPLOYEE_ID constant in Index.js is the only place this is configured.

**Edge Cases to Explore:**
- What if VP-004 is the traveler?

**Out of Scope:**
- Dynamic approver routing based on org chart (deferred).

---
**Story ID:** US-021
**Epic:** EP-05 — Approval Workflow
**Persona:** Operations / Staff
**Priority:** P1
**Business Goal:** BG-05, BG-02

**User Story:**
As a Staff employee booking a compliant option, I want the booking to be confirmed immediately without requiring an approval so that in-policy travel is frictionless.

**Draft Acceptance Criteria:**
- AC-1: Confirming a flight/hotel with is_compliant: true does not trigger the justification flow.
- AC-2: A PNR is generated immediately for in-policy bookings.
- AC-3: No approval record is written to approvals.json for in-policy bookings.

**Edge Cases to Explore:**
- What if is_compliant is null (e.g. foreign currency price — manual review case)?

**Out of Scope:**
- Advance booking advance-notice rule enforcement (3-day minimum noted in policy.js — not yet wired to block).

---

### EP-06 — Notification System

---
**Story ID:** US-022
**Epic:** EP-06 — Notification System
**Persona:** Admin (HR / Operations)
**Priority:** P1
**Business Goal:** BG-06

**User Story:**
As an Admin, I want to send a notification to a specific employee by their employee_id so that I can alert them about booking changes, disruptions, or travel reminders.

**Draft Acceptance Criteria:**
- AC-1: notify.js resolves employee_id to chat_id using chat_registry.json.
- AC-2: The notification is delivered to the correct Telegram chat.
- AC-3: The correct notification template is used for the notification type (e.g. flight_delay, booking_confirmed).

**Edge Cases to Explore:**
- What if the employee_id is not in chat_registry.json?
- What if the chat_id is stale (employee has blocked the bot)?

**Out of Scope:**
- Batch notifications to all employees simultaneously (deferred).

---
**Story ID:** US-023
**Epic:** EP-06 — Notification System
**Persona:** Admin
**Priority:** P1
**Business Goal:** BG-06

**User Story:**
As an Admin, I want the notification system to handle unknown employee IDs gracefully so that a single bad record does not crash the entire notification run.

**Draft Acceptance Criteria:**
- AC-1: If the employee_id is not found in chat_registry.json, an error is logged with the missing ID.
- AC-2: The notify.js process exits with a non-zero code when the employee is not found.
- AC-3: The error message is human-readable (not a raw stack trace).

**Edge Cases to Explore:**
- What if chat_registry.json is malformed or missing?

**Out of Scope:**
- Auto-retry on Telegram API failure.

---
**Story ID:** US-024
**Epic:** EP-06 — Notification System
**Persona:** QA Engineer
**Priority:** P1
**Business Goal:** BG-06

**User Story:**
As a QA Engineer, I want to verify that all 17 notification types produce the correct payload structure so that travelers receive accurate information in every scenario.

**Draft Acceptance Criteria:**
- AC-1: Each of the 17 notification types in notify.js produces a non-empty Telegram message.
- AC-2: Notifications that include booking details reference the correct fields (PNR, flight_number, dates).
- AC-3: Notifications do not expose raw employee chat_id in the message body.

**Edge Cases to Explore:**
- What if optional fields (e.g. hotel_name) are missing from the notification data?

**Out of Scope:**
- Email or SMS notification delivery (Telegram only for MVP).

---

### EP-07 — Hotel Booking Pipeline

---
**Story ID:** US-025
**Epic:** EP-07 — Hotel Booking Pipeline
**Persona:** Operations / Staff
**Priority:** P1
**Business Goal:** BG-07

**User Story:**
As a Staff employee, I want to search for hotels in a city and see which options are within company policy so that I book the right accommodation without a policy violation.

**Draft Acceptance Criteria:**
- AC-1: Sending a hotel search intent triggers search_hotels and returns a list of options.
- AC-2: Each hotel result includes is_compliant based on the city's budget cap in policy.js.
- AC-3: Confirming a compliant hotel writes a booking record to bookings.json with a reference code.

**Edge Cases to Explore:**
- What if the city has no hotels in mock_inventory.js?
- What if check-in and check-out dates are not provided?

**Out of Scope:**
- Live hotel inventory (mock only for MVP).

---
**Story ID:** US-026
**Epic:** EP-07 — Hotel Booking Pipeline
**Persona:** QA Engineer
**Priority:** P1
**Business Goal:** BG-07, BG-02

**User Story:**
As a QA Engineer, I want the hotel budget cap boundary (exactly at cap) to be validated automatically so that a price change in mock_inventory.js is immediately caught.

**Draft Acceptance Criteria:**
- AC-1: test_policy.js verifies a BKK hotel at 4000 THB is flagged is_compliant: true.
- AC-2: test_policy.js verifies a BKK hotel at 4001 THB is flagged is_compliant: false.
- AC-3: All 5 city caps (BKK, SIN, NYC, LON, TYO) are covered with at, below, and above boundary tests.

**Edge Cases to Explore:**
- What if the cap currency and the hotel price currency differ?

**Out of Scope:**
- Dynamic pricing (mock prices are static for MVP).

---
**Story ID:** US-027
**Epic:** EP-07 — Hotel Booking Pipeline
**Persona:** Operations / Staff
**Priority:** P1
**Business Goal:** BG-07, BG-05

**User Story:**
As a Staff employee who selected an out-of-policy hotel, I want to be asked for justification so that I can still book with manager approval.

**Draft Acceptance Criteria:**
- AC-1: Confirming a hotel with is_compliant: false triggers the justification request (same as flight flow).
- AC-2: The approval record in approvals.json includes hotel_name, room_type, price_per_night, checkin, checkout.
- AC-3: No hotel reference is generated until the manager approves.

**Edge Cases to Explore:**
- What if is_compliant is null for a foreign-currency hotel?

**Out of Scope:**
- Hotel loyalty program integration.

---

## Coverage Matrix

| Story ID | Type | Business Goal | Priority | Status |
|----------|------|---------------|----------|--------|
| US-001 | Happy Path | BG-01 | P0 | Draft |
| US-002 | Error State (slot filling) | BG-01, BG-03 | P0 | Draft |
| US-003 | Recovery (API fallback) | BG-01, BG-10 | P0 | Draft |
| US-004 | Edge Case (idempotency) | BG-01 | P1 | Draft |
| US-005 | Happy Path | BG-02 | P0 | Draft |
| US-006 | Error State (compliance flag) | BG-02 | P0 | Draft |
| US-007 | Edge Case (boundary value) | BG-02 | P0 | Draft |
| US-008 | Error State (cabin class) | BG-02 | P0 | Draft |
| US-009 | Recovery (justification flow) | BG-02, BG-05 | P0 | Draft |
| US-010 | Happy Path (NLU suite) | BG-03 | P0 | Draft |
| US-011 | Edge Case (slang/synonyms) | BG-03 | P0 | Draft |
| US-012 | Edge Case (negation) | BG-03 | P0 | Draft |
| US-013 | Edge Case (FGR/hallucination) | BG-03 | P0 | Draft |
| US-014 | Error State (out-of-scope) | BG-03 | P1 | Draft |
| US-015 | Happy Path (escalation trigger) | BG-04 | P1 | Draft |
| US-016 | Happy Path (context handoff) | BG-04 | P1 | Draft |
| US-017 | Recovery (agent unavailable) | BG-04 | P1 | Draft |
| US-018 | Happy Path (approval flow) | BG-05 | P1 | Draft |
| US-019 | Error State (rejection) | BG-05 | P1 | Draft |
| US-020 | Security (self-approval block) | BG-05 | P1 | Draft |
| US-021 | Edge Case (in-policy skips approval) | BG-05, BG-02 | P1 | Draft |
| US-022 | Happy Path (notification delivery) | BG-06 | P1 | Draft |
| US-023 | Error State (unknown employee_id) | BG-06 | P1 | Draft |
| US-024 | Edge Case (all 17 notification types) | BG-06 | P1 | Draft |
| US-025 | Happy Path (hotel booking) | BG-07 | P1 | Draft |
| US-026 | Edge Case (hotel cap boundary) | BG-07, BG-02 | P1 | Draft |
| US-027 | Recovery (hotel out-of-policy) | BG-07, BG-05 | P1 | Draft |

---

## Coverage Summary

| Story Type | Count | Minimum Required | Status |
|---|---|---|---|
| Happy Path | 7 | 1 per core feature | ✅ |
| Error State / Negative | 7 | 1 per feature with error states | ✅ |
| Edge Case / Boundary | 9 | 1 per business rule with limits | ✅ |
| Security | 1 | 1 per security-sensitive feature | ✅ |
| Recovery | 3 | 1 per critical failure mode | ✅ |
| **Total** | **27** | | ✅ |

---

*PM/PO Story Writer v2.0 | Agentic QA Pipeline v3.0 | 2026-05-14*
