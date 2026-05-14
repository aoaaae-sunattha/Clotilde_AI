# Requirements Analysis — EP-07 Hotel Booking Pipeline
**Stories:** US-025, US-026, US-027
**Date:** 2026-05-14
**Author:** Requirements Analyst (AI-assisted)
**Source:** 002-20260514-CLOTILDE-final.md
**Test runner:** `node test_policy.js` (L1) + `node Index.js` (L3) + Telegram manual (L5)
**Status:** Confirmed — Ready for Phase 2 (Sprint S1a)

---

## Pre-flight Check

- [x] File exists: `QA/00_user-stories/002-20260514-CLOTILDE-final.md`
- [x] Story summaries present for US-025 through US-027
- [x] All ACs written in Given/When/Then format
- [x] No contradictory ACs found

---

## US-025 — Hotel Booking (Search + Confirm)

### Story Summary
Staff employee searches for hotels in a city; results include compliance flags against city hotel cap; in-policy hotel can be confirmed and saves to bookings.json.

### Acceptance Criteria (verbatim)
- **AC-1:** Given user sends hotel search intent with city, check-in, and check-out date; When agent processes; Then `search_hotels` called with correct city AND returns non-empty hotel list
- **AC-2:** Given `getMockHotels` returns results; When compliance evaluated; Then each hotel includes `is_compliant` computed against city's budget cap from `POLICY.hotelBudgetCap`
- **AC-3:** Given user taps Confirm on `is_compliant: true` hotel; When `booking_confirm` fires; Then booking record written to `bookings.json` with `type: hotel`, reference code, and `status: CONFIRMED`

### Edge Cases to Test
1. City has no hotels in `mock_inventory.js` — bot replies "no results"; does not crash
2. Check-in or check-out dates not provided — bot asks for missing dates before calling `search_hotels`

### Test Scope
- In scope: `search_hotels` call, hotel compliance flags, bookings.json hotel record (type: hotel, reference code), no-hotels-found path
- Out of scope: live hotel inventory (mock only for MVP)

### Risk Areas
- Hotel reference code format not specified — assume 6-char like PNR; verify in Index.js
- `getMockHotels` city argument must match `CITY_TO_AIRPORT` map or city key in mock_inventory.js — "Chonburi" → UTP pattern may not apply to hotels
- Missing date slot-filling mirrors US-002 (flights); same Gemini non-determinism risk

---

## US-026 — Hotel Cap Boundary Tests

### Story Summary
test_policy.js validates hotel budget cap boundaries for all 5 cities (BKK, SIN, NYC, LON, TYO) at cap-1, cap, cap+1. Currency mismatch returns null.

### Acceptance Criteria (verbatim)
- **AC-1:** Given `test_policy.js` runs BKK hotel cap tests; When hotel priced at exactly 4000 THB evaluated; Then compliance returns `true` AND test passes
- **AC-2:** Given BKK cap+1 (4001 THB) evaluated; Then compliance returns `false` AND test passes
- **AC-3:** Given `test_policy.js` iterates all 5 cities; When BKK/SIN/NYC/LON/TYO tested at cap/cap-1/cap+1; Then all 15 city boundary tests pass

### Edge Cases to Test
1. Cap currency and hotel price currency differ — `hotelCompliance()` returns `null` (manual review case); test verifies null returned for currency mismatch input

### Test Scope
- In scope: 15 hotel boundary tests (3 per city × 5), currency mismatch null return
- Out of scope: dynamic pricing (mock prices are static)

### Risk Areas
- Currency mismatch → null: if null is not handled in Index.js, US-021 edge case and US-027 edge case are vulnerable to compliance bypass
- test_policy.js already covers hotel caps (shared with US-007); US-026 is the user-story anchor for hotel-specific caps

---

## US-027 — Hotel Out-of-Policy Justification

### Story Summary
Staff employee confirming an out-of-policy hotel is asked for justification; approval record includes hotel-specific fields (hotel_name, room_type, price_per_night, checkin, checkout).

### Acceptance Criteria (verbatim)
- **AC-1:** Given user taps Confirm on hotel with `is_compliant: false`; When `booking_confirm` fires; Then bot asks for justification AND does NOT generate hotel reference code
- **AC-2:** Given user submits hotel justification; When bot processes; Then approval record includes `hotel_name`, `room_type`, `price_per_night`, `checkin`, `checkout` AND status is `PENDING`
- **AC-3:** Given approval record PENDING; When `bookings.json` inspected; Then no `CONFIRMED` hotel record for this trip until manager's Approve fires

### Edge Cases to Test
1. `is_compliant` is `null` (foreign-currency price) — system treats null as non-compliant; justification flow triggered (same as US-021 edge case)

### Test Scope
- In scope: hotel-specific approval record fields (AC-2 field list), justification prompt for hotel, no reference code until approved
- Out of scope: hotel loyalty program integration

### Risk Areas
- Same approvals.json HIGH risk as US-009/018 — hotel-specific fields in approval record require approvals.json to be implemented
- AC-2 field list (hotel_name, room_type, price_per_night, checkin, checkout) — these must exist in mock hotel objects from getMockHotels; verify field names match

---

## Combined Risk Areas — EP-07

| Risk | Severity | Mitigation |
|------|----------|------------|
| approvals.json not implemented | High | Mark INT tests for US-027 as .skip; same Dev ticket as US-009/018 |
| is_compliant: null hotel compliance bypass | High | INT edge case + POL-021 must cover null path for hotels |
| Hotel reference code format undefined | Medium | Read Index.js hotel confirm handler before writing reference code assertion |
| getMockHotels field names differ from AC-2 list | Medium | Read mock_inventory.js getMockHotels return objects before writing US-027 AC-2 assertion |
| City name → hotel lookup (no CITY_TO_AIRPORT for hotels) | Low | Verify getMockHotels takes city name or IATA code as argument |
