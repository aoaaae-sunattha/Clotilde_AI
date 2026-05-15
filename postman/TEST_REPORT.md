# Duffel API Test Report
## Clotilde Travel Bot — API Testing Coverage

**Project:** Clotilde AI Travel Bot  
**API Under Test:** [Duffel API v2](https://duffel.com/docs/api/v2/offers)  
**Collection:** `duffel_collection.json`  
**Environment:** `duffel_environment.json`  
**Total Test Cases:** 30 tests across 7 folders

---

## Test Summary

| Folder | Tests | Purpose |
|--------|-------|---------|
| 1 - Happy Path | 3 | Core flight search flow |
| 2 - Policy Compliance | 3 | Business travel rules validation |
| 3 - Negative Tests | 6 | Error handling |
| 4 - Cabin Class Coverage | 4 | All 4 IATA cabin codes |
| 5 - Response Schema Validation | 4 | Field mapping for `mapOffer()` |
| 6 - Preferred Airline & Long-Haul | 4 | Preferred airline detection + haul classification |
| 7 - Additional Negative Tests | 4 | Edge case error handling |

---

## Folder 1 — Happy Path

Tests the core search flow that mirrors exactly what `duffel.js` sends to the API.

### HP-01 | Search flights BKK→SIN Economy (valid date)
**Why:** Core `searchFlights()` call — validates the API accepts the exact request shape that `duffel.js` sends.

| # | Assertion |
|---|-----------|
| 1 | Status 201 Created |
| 2 | Response has data object |
| 3 | offer_request_id is present |
| 4 | At least 1 offer returned |
| 5 | Offers have total_amount |
| 6 | Offers have total_currency |
| 7 | Each offer has slices |
| 8 | Origin is BKK |
| 9 | Destination is SIN |
| 10 | Response time under 10s |

---

### HP-02 | Search flights BKK→NRT Business class (Director role)
**Why:** Tests `CABIN_TO_DUFFEL['C'] = 'business'` mapping. Director-level role in policy uses Business class.

| # | Assertion |
|---|-----------|
| 1 | Status 201 Created |
| 2 | Offers returned |
| 3 | Cabin class is business |
| 4 | Offers have required fields for compliance check |

---

### HP-03 | Get single offer by ID
**Why:** Validates offer retrieval by ID after a search — used when user selects a specific flight.

| # | Assertion |
|---|-----------|
| 1 | Status 200 OK |
| 2 | Offer ID matches saved ID |
| 3 | Offer has conditions (refund/change flags) |
| 4 | Offer has baggage info |

---

## Folder 2 — Policy Compliance Tests

Tests that the API returns the fields needed for Clotilde's compliance logic in `policy.js`.

### PC-01 | Preferred airline TG appears in results BKK→SIN
**Why:** `POLICY.preferredAirlines` marks TG (Thai Airways) as preferred. Bot sets `is_preferred: true` — tests that TG actually appears in API results.

| # | Assertion |
|---|-----------|
| 1 | Status 201 |
| 2 | Offers present |
| 3 | Airline data is present for compliance mapping (iata_code exists) |
| 4 | TG (Thai Airways) available — preferred partner |

---

### PC-02 | Short-haul flight has duration data (needed for cap logic)
**Why:** `parseDurationMinutes()` reads `slice.duration` to decide short vs long-haul budget cap. If missing, compliance check silently fails.

| # | Assertion |
|---|-----------|
| 1 | Status 201 |
| 2 | Slice has duration field (ISO 8601) |
| 3 | Duration is parseable to minutes |

---

### PC-03 | Refund and change conditions are returned
**Why:** `mapOffer()` reads `offer.conditions.refund_before_departure.allowed` and `change_before_departure.allowed`. These map to `refundable` and `changeable` flags shown to the traveler.

| # | Assertion |
|---|-----------|
| 1 | Status 201 |
| 2 | conditions field exists on offers |
| 3 | refund_before_departure field exists |
| 4 | change_before_departure field exists |
| 5 | refundable flag is boolean |

---

## Folder 3 — Negative Tests (Error Handling)

Tests that `duffel.js` error handler (`throw new Error('Duffel 4xx...')`) is triggered correctly by bad input.

### NEG-01 | Invalid origin airport code (XXX)
**Why:** Tests API returns 422 for unknown IATA code — triggers the `if (!res.ok)` error path in `duffel.js`.

| # | Assertion |
|---|-----------|
| 1 | Status is 4xx (client error) |
| 2 | Error response has errors array |
| 3 | Error message is descriptive (not empty) |

---

### NEG-02 | Past departure date
**Why:** API-level date validation — past dates should be rejected.

| # | Assertion |
|---|-----------|
| 1 | Status is 4xx for past date |
| 2 | Error is returned for past date |

---

### NEG-03 | Same origin and destination (BKK→BKK)
**Why:** Edge case — should return 4xx or 201 with 0 offers (not crash).

| # | Assertion |
|---|-----------|
| 1 | Status is 4xx OR 201 with 0 offers |

---

### NEG-04 | Empty passengers array
**Why:** Missing required field — tests API validation of the `passengers` property.

| # | Assertion |
|---|-----------|
| 1 | Status is 4xx for empty passengers |
| 2 | Error message mentions passengers |

---

### NEG-05 | Missing Authorization header (no token)
**Why:** Tests the `DUFFEL_API_KEY not set` error path — if env var is missing, request has no bearer token.

| # | Assertion |
|---|-----------|
| 1 | Status is 401 Unauthorized |
| 2 | Error body exists |

---

### NEG-06 | Missing required field (no departure_date)
**Why:** Required field validation — `slices[0].departure_date` is required by the API.

| # | Assertion |
|---|-----------|
| 1 | Status is 4xx for missing departure_date |
| 2 | Error references departure_date or slices |

---

## Folder 4 — Cabin Class Coverage

Tests all 4 IATA cabin codes mapped by `CABIN_TO_DUFFEL` in `duffel.js`.

| Code | Duffel Value | Test |
|------|-------------|------|
| Y | economy | CC-01 |
| W | premium_economy | CC-02 |
| C | business | CC-03 |
| F | first | CC-04 |

### CC-01 | Economy (Y → economy)

| # | Assertion |
|---|-----------|
| 1 | Status 201 |
| 2 | Offers returned for economy |

---

### CC-02 | Premium Economy (W → premium_economy)

| # | Assertion |
|---|-----------|
| 1 | Status 201 |
| 2 | Offers returned for premium_economy |
| 3 | No error in response body |

---

### CC-03 | Business (C → business)

| # | Assertion |
|---|-----------|
| 1 | Status 201 |
| 2 | Offers returned for business |
| 3 | No error in response body |

---

### CC-04 | First Class (F → first)

| # | Assertion |
|---|-----------|
| 1 | Status 201 |
| 2 | Offers returned for first |
| 3 | No error in response body |

---

## Folder 5 — Response Schema Validation

Tests every field that `mapOffer()` reads from the API response. If any field is missing, the bot silently returns wrong data.

### RS-01 | All mapOffer() fields present (flight_number, airline, datetime, stops)

| # | Assertion |
|---|-----------|
| 1 | Status 201 |
| 2 | marketing_carrier.iata_code exists |
| 3 | marketing_carrier_flight_number exists |
| 4 | departing_at datetime exists |
| 5 | arriving_at datetime exists |
| 6 | segments array exists for stops calculation |
| 7 | offer.id exists and starts with off_ |

---

### RS-02 | Baggage allowance structure present (seg.passengers[0].baggages)

| # | Assertion |
|---|-----------|
| 1 | Status 201 |
| 2 | seg.passengers array exists |
| 3 | Each passenger has baggages field |

---

### RS-03 | Top-3 cap — API returns more than 3, duffel.js must cap it

| # | Assertion |
|---|-----------|
| 1 | Status 201 |
| 2 | API returns offers for slicing (bot caps to top 3) |
| 3 | All offers have numeric total_amount for sorting |
| 4 | After sort+slice, bot gets max 3 offers |
| 5 | Sorted offers are in ascending price order |

---

### RS-04 | FX currency field present (non-THB route for FX conversion)

| # | Assertion |
|---|-----------|
| 1 | Status 201 |
| 2 | total_currency field is present on all offers |
| 3 | Currency is in duffel.js FX_TO_THB supported list |

---

## Folder 6 — Preferred Airline & Long-Haul Coverage

Tests preferred airline detection and haul classification used for budget cap selection.

### PA-01 | SQ (Singapore Airlines) — preferred partner for SIN routes

| # | Assertion |
|---|-----------|
| 1 | Status 201 |
| 2 | Offers present for BKK→SIN |
| 3 | iata_code field exists on all carriers |
| 4 | SQ (Singapore Airlines) in results — policy preferred partner for SIN |

---

### PA-02 | EK (Emirates) — preferred partner for Middle East & Europe routes

| # | Assertion |
|---|-----------|
| 1 | Status 201 |
| 2 | Offers present for BKK→DXB |
| 3 | iata_code field exists (needed for EK detection) |
| 4 | EK (Emirates) in results — policy preferred for ME/Europe routes |

---

### PA-03 | Long-haul route (BKK→LHR >4h) — classified as LONG_HAUL cap 25000 THB

| # | Assertion |
|---|-----------|
| 1 | Status 201 |
| 2 | Duration exists on long-haul slice |
| 3 | Long-haul flight is > 4 hours (= LONG_HAUL in policy) |

---

### PA-04 | ZZ airline (Duffel sandbox) must NOT appear in results
**Why:** `duffel.js` filters out `TEST_AIRLINE_CODES = new Set(['ZZ'])` — the Duffel sandbox airline should never reach the traveler.

| # | Assertion |
|---|-----------|
| 1 | Status 201 |
| 2 | ZZ (Duffel Airways sandbox airline) not in raw API results |

---

## Folder 7 — Additional Negative Tests

### NEG-07 | Invalid destination airport code (BKK→YYY)

| # | Assertion |
|---|-----------|
| 1 | Status is 4xx for invalid destination |
| 2 | Error body exists |

---

### NEG-08 | Wrong date format (DD/MM/YYYY instead of YYYY-MM-DD)

| # | Assertion |
|---|-----------|
| 1 | Status is 4xx for wrong date format |
| 2 | Error response exists for invalid date format |

---

### NEG-09 | Invalid cabin class value (`biz` — not a valid Duffel value)

| # | Assertion |
|---|-----------|
| 1 | Status is 4xx for invalid cabin_class value |
| 2 | Error response exists for invalid cabin class |

---

### NEG-10 | Completely empty request body

| # | Assertion |
|---|-----------|
| 1 | Status is 4xx for empty body |
| 2 | Error body exists |

---

## What This Test Suite Proves

| Claim | Evidence |
|-------|----------|
| Tests the real API the bot uses | Duffel live endpoint, not a mock |
| Tests map to business rules | Each test links to a rule in `policy.js` or `duffel.js` |
| Covers all cabin classes | CC-01 to CC-04 (Y/W/C/F) |
| Covers error handling paths | 10 negative tests (NEG-01 to NEG-10) |
| Validates field mapping | RS-01 to RS-04 test every field `mapOffer()` reads |
| Preferred airline logic verified | PA-01 (TG), PA-01 (SQ), PA-02 (EK) |
| Sandbox airline filtered | PA-04 confirms ZZ never reaches traveler |
