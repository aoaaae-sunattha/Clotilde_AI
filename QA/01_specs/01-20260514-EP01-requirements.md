# Requirements Analysis — EP-01 Flight Booking Pipeline
**Stories:** US-001, US-002, US-003, US-004
**Date:** 2026-05-14
**Author:** Requirements Analyst (AI-assisted)
**Source:** 002-20260514-CLOTILDE-final.md
**Test runner:** `node Index.js` (L3 integration) + Telegram manual (L5)
**Status:** Confirmed — Ready for Phase 2 (Sprint S1a)

---

## Pre-flight Check

- [x] File exists: `QA/00_user-stories/002-20260514-CLOTILDE-final.md`
- [x] Story summaries present for US-001 through US-004
- [x] All ACs written in Given/When/Then format
- [x] No contradictory ACs found
- [x] GAP-01 resolved: BG-10 reference removed; Duffel fallback is implementation detail of BG-01
- [x] GAP-06 resolved: "silently blocked" → console WARNING observable output

---

## US-001 — Flight Booking Confirm + PNR

### Story Summary
Staff employee searches for a flight, confirms it, receives a 6-character PNR, and the booking is saved to bookings.json.

### Acceptance Criteria (verbatim)
- **AC-1:** Given role selected and traveler profile loaded; When user sends flight intent with origin/destination/date; Then `search_flights` called AND results include `is_compliant` and `is_preferred` per item
- **AC-2:** Given user taps Confirm on selected flight; When `booking_confirm` callback fires for first time; Then 6-char alphanumeric PNR generated AND displayed in chat AND `bookings.json` written with `status: CONFIRMED` and correct `employee_id`
- **AC-3:** Given booking confirmed; When `bookings.json` queried; Then exactly one record with matching PNR, employee_id, type: flight
- **AC-4:** Given first `booking_confirm` being processed; When second `booking_confirm` fires for same session; Then second discarded AND only one record in `bookings.json` AND WARNING written to server console

### Edge Cases to Test
1. Duffel API timeout before mock fallback attempted
2. User types "3" as text instead of tapping inline keyboard button
3. User sends new intent while confirmation keyboard still visible

### Test Scope
- In scope: PNR format (6-char alphanumeric), bookings.json record structure, idempotency guard (AC-4), is_compliant/is_preferred presence
- Out of scope: rescheduling/cancelling, multi-passenger bookings

### Risk Areas
- AC-4 overlaps with US-004; US-001 tests full E2E flow, US-004 tests guard in isolation — both kept
- PNR generation uniqueness not formally specified — assume random; duplicate PNR collision is theoretically possible but not testable at unit level
- `session.bookingInProgress` is in-memory — lost on bot restart; AC-4 does not survive restarts

---

## US-002 — Slot Filling (Missing Parameters)

### Story Summary
Bot asks for missing travel details (date, city) before calling search_flights so incomplete inputs don't produce wrong results.

### Acceptance Criteria (verbatim)
- **AC-1:** Given role selected; user sends flight request with destination but no date; When agent processes; Then `search_flights` NOT called AND bot asks for missing departure date
- **AC-2:** Given user provides date in response to clarifying question; When agent has origin/destination/date; Then `search_flights` called immediately AND results returned
- **AC-3:** Given user sends message with all three fields (origin + destination + date); When agent processes; Then `search_flights` called on first message without clarifying question

### Edge Cases to Test
1. Destination is country name ("France") — bot resolves to city or asks which city
2. Date expressed as relative ("next Friday") — bot clarifies calendar date
3. City name ambiguous for airport disambiguation ("London" → LHR vs LGW)

### Test Scope
- In scope: slot-filling dialog, search_flights call guard (AC-1), immediate search when all slots filled (AC-3)
- Out of scope: relative date parsing beyond one week, non-English input

### Risk Areas
- Slot-filling is Gemini-driven (system prompt); not deterministic — L5 manual tests are primary coverage
- "London" disambiguation: if bot picks LHR without asking, AC edge case 3 is silently wrong

---

## US-003 — Duffel Fallback to Mock

### Story Summary
Bot falls back to mock inventory when Duffel API is unavailable, returning results within 2 seconds without showing a raw error to the user.

### Acceptance Criteria (verbatim)
- **AC-1:** Given Duffel returns error/exception; When `search_flights` triggered; Then `duffel.js` catches error AND `getMockFlights` called as fallback AND results returned
- **AC-2:** Given mock fallback used; When user receives results; Then non-empty flight list AND no raw error/stack trace/"Error" visible to user
- **AC-3:** Given Duffel failed; When mock results delivered; Then time from Duffel failure to results displayed ≤ 2 seconds

### Edge Cases to Test
1. Both Duffel and mock return empty results (no flights for route)
2. Duffel returns partial response (non-fatal — system handles gracefully)

### Test Scope
- In scope: error catch in duffel.js, getMockFlights fallback call, timing (≤2s), no visible error to user
- Out of scope: Duffel-specific 401 auth errors

### Risk Areas
- 2-second timing AC-3: difficult to assert precisely in L3 integration test; use timestamp delta + approximate threshold
- nock mock for Duffel must simulate timeout/rejection (not just HTTP 500) to trigger the catch block in duffel.js

---

## US-004 — Idempotency / Double-Book Guard

### Story Summary
Rapid double-tap of Confirm button does not create duplicate PNRs; second callback is blocked with a console WARNING.

### Acceptance Criteria (verbatim)
- **AC-1:** Given `session.bookingInProgress === true`; When second `booking_confirm` fires same session; Then second callback returns immediately AND no new record added to `bookings.json`
- **AC-2:** Given duplicate confirm blocked; When server console inspected; Then WARNING log contains text indicating duplicate confirm blocked
- **AC-3:** Given first booking confirm completes; When `bookings.json` read; Then exactly one record with single unique PNR for traveler session

### Edge Cases to Test
1. Network slow and first confirm hangs >3 seconds — flag must remain true throughout; second tap must still be blocked

### Test Scope
- In scope: bookingInProgress flag mechanism, WARNING log output, single-record assertion in bookings.json
- Out of scope: idempotency across bot restarts (session in-memory only)

### Risk Areas
- `session.bookingInProgress` is set and cleared in Index.js — test must simulate simultaneous callbacks to race the flag
- Observable: "no new record" assertion requires reading bookings.json after both callbacks fire

---

## Combined Risk Areas — EP-01

| Risk | Severity | Mitigation |
|------|----------|------------|
| Gemini slot-filling non-deterministic | High | L3 integration uses nock to mock Gemini; L5 manual tests cover real Gemini |
| 2-second fallback timing (US-003 AC-3) | Medium | Assert time delta in L3; document as approximate in test |
| Duplicate-callback race condition (US-004) | Medium | L3 integration: fire two simultaneous webhook POSTs; assert single record |
| bookings.json write race on double-confirm | Medium | test must clean bookings.json in beforeEach |
