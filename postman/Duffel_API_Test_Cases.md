# API Test Case Document
**Project:** Clotilde Travel Bot — Duffel API Integration
**Endpoint:** `POST /air/offer_requests?return_offers=true` · `GET /air/offers/:id`
**Duffel API Version:** v2 · **Base URL:** `https://api.duffel.com`
**Test Tool:** Postman CLI · **Total Test Cases:** 28 · **Test Groups:** 7
**Prepared by:** QA Engineer · **Date:** 2026-05-15

---

## Test Summary

| Group | Test IDs | Count | Focus Area |
|-------|----------|-------|------------|
| 1 — Happy Path | HP-01 to HP-03 | 3 | Core search flow |
| 2 — Policy Compliance Tests | PC-01 to PC-03 | 3 | Policy rules |
| 3 — Negative Tests (Error Handling) | NEG-01 to NEG-06 | 6 | Error handling |
| 4 — Cabin Class Coverage | CC-01 to CC-04 | 4 | Cabin mapping |
| 5 — Response Schema Validation | RS-01 to RS-04 | 4 | Schema fields |
| 6 — Preferred Airline & Long-Haul | PA-01 to PA-04 | 4 | Preferred airlines |
| 7 — Additional Negative Tests | NEG-07 to NEG-10 | 4 | Edge cases |
| **TOTAL** | | **28** | |

---

## Column Definitions

| Column | Definition |
|--------|------------|
| **ID** | Unique test case identifier. Format: PREFIX-NN (e.g. HP-01, NEG-03) |
| **Purpose** | Why this test exists. Which function/line in `duffel.js` or `policy.js` it validates |
| **Parameters / Input** | HTTP method, endpoint, and all request body fields. Variables in `{{}}` come from `duffel_environment.json` |
| **Expected Result** | All assertions that must pass: HTTP status, response body fields, conditions |
| **Status** | Tester fills in after execution: `Pass` / `Fail` / `Blocked` / `Skip` |

---

## Group 1 — Happy Path

> Core search flow. Mirrors the exact request structure `duffel.js` sends to `POST /air/offer_requests?return_offers=true`.

---

### HP-01 | Search BKK→SIN Economy (valid date)

| Field | Detail |
|-------|--------|
| **Purpose** | Verify the core `searchFlights()` call returns valid offers for the most common route. Sets `offer_id` and `offer_request_id` in environment for HP-03. |
| **Method** | POST |
| **Endpoint** | `/air/offer_requests?return_offers=true` |
| **Parameters / Input** | `origin`: BKK · `destination`: SIN · `departure_date`: `{{departure_date_valid}}` · `cabin_class`: economy · `passengers`: [adult] |
| **Expected Result** | • HTTP **201** Created · `data.id` starts with `"orq_"` · `data.offers.length ≥ 1` · Each offer has `total_amount` and `total_currency` · `segments[0].origin.iata_code = "BKK"` · `segments[0].destination.iata_code = "SIN"` · Response time < 10s · `offer_id` and `offer_request_id` saved to environment |
| **Status** | |

---

### HP-02 | Search BKK→NRT Business Class (Director role)

| Field | Detail |
|-------|--------|
| **Purpose** | Verify business class requests work. Policy allows Directors / VP / C-Suite up to Business Class. Tests `CABIN_TO_DUFFEL['C'] = 'business'` mapping. |
| **Method** | POST |
| **Endpoint** | `/air/offer_requests?return_offers=true` |
| **Parameters / Input** | `origin`: BKK · `destination`: NRT · `departure_date`: `{{departure_date_valid}}` · `cabin_class`: business · `passengers`: [adult] |
| **Expected Result** | • HTTP **201** Created · `data.offers.length ≥ 1` · `offers[0].total_amount` exists · `offers[0].total_currency` exists · No `errors` in response body |
| **Status** | |

---

### HP-03 | Get single offer by ID

| Field | Detail |
|-------|--------|
| **Purpose** | Verify a specific offer can be retrieved by ID after a search. Used when a traveler confirms details before booking. Depends on `{{offer_id}}` set by HP-01. |
| **Method** | GET |
| **Endpoint** | `/air/offers/{{offer_id}}` |
| **Parameters / Input** | `offer_id`: `{{offer_id}}` (auto-set by HP-01) · Header: `Duffel-Version: v2` |
| **Expected Result** | • HTTP **200** OK · `data.id` matches saved `{{offer_id}}` · `data.conditions` exists · `data.conditions.refund_before_departure` exists · `data.slices[0].segments[0].passengers` is an array |
| **Status** | |

---

## Group 2 — Policy Compliance Tests

> Verify the data the API returns contains the fields `duffel.js` needs to apply rules from `policy.js` (budget caps, preferred airlines, refund conditions).

---

### PC-01 | TG (Thai Airways) appears in BKK→SIN results

| Field | Detail |
|-------|--------|
| **Purpose** | `policy.js` lists TG as preferred partner with 20% corporate discount. API must return `marketing_carrier.iata_code` so `duffel.js` can set `is_preferred: true` for TG offers. |
| **Method** | POST |
| **Endpoint** | `/air/offer_requests?return_offers=true` |
| **Parameters / Input** | `origin`: BKK · `destination`: SIN · `departure_date`: `{{departure_date_valid}}` · `cabin_class`: economy · `passengers`: [adult] |
| **Expected Result** | • HTTP **201** Created · All offers have `marketing_carrier.iata_code` (string) — **hard assertion** · TG in results = **soft check** (logged, not blocking — availability varies daily) · All airline codes logged to console |
| **Status** | |

---

### PC-02 | Short-haul flight returns parseable ISO 8601 duration

| Field | Detail |
|-------|--------|
| **Purpose** | `duffel.js` calls `parseDurationMinutes(slice.duration)` to decide SHORT_HAUL (≤4h, cap 5,000 THB) vs LONG_HAUL (cap 25,000 THB). The `duration` field must exist and be parseable. |
| **Method** | POST |
| **Endpoint** | `/air/offer_requests?return_offers=true` |
| **Parameters / Input** | `origin`: BKK · `destination`: SIN · `departure_date`: `{{departure_date_valid}}` · `cabin_class`: economy · `passengers`: [adult] |
| **Expected Result** | • HTTP **201** Created · `offers[0].slices[0].duration` matches `/^PT/` · Duration is parseable to total minutes > 0 · Parsed minutes value logged to console for manual review |
| **Status** | |

---

### PC-03 | Refund and change conditions returned on long-haul

| Field | Detail |
|-------|--------|
| **Purpose** | `duffel.js` maps `offer.conditions.refund_before_departure.allowed → refundable` and `offer.conditions.change_before_departure.allowed → changeable`. Both fields must be present on all offers. |
| **Method** | POST |
| **Endpoint** | `/air/offer_requests?return_offers=true` |
| **Parameters / Input** | `origin`: BKK · `destination`: LHR · `departure_date`: `{{departure_date_valid}}` · `cabin_class`: economy · `passengers`: [adult] |
| **Expected Result** | • HTTP **201** Created · All offers have `conditions` field · `conditions.refund_before_departure` exists on all offers · `conditions.change_before_departure` exists on all offers · `refund_before_departure.allowed` is type `boolean` |
| **Status** | |

---

## Group 3 — Negative Tests (Error Handling)

> Invalid and missing inputs. Verifies `duffel.js` error handler (`throw new Error("Duffel 4xx: ...")`) is triggered correctly by the API.

---

### NEG-01 | Invalid origin airport code (XXX)

| Field | Detail |
|-------|--------|
| **Purpose** | Sending a non-existent IATA code as origin. `duffel.js` throws on any non-2xx status. API must return a 4xx with a descriptive error message. |
| **Method** | POST |
| **Endpoint** | `/air/offer_requests?return_offers=true` |
| **Parameters / Input** | `origin`: **XXX** (invalid) · `destination`: SIN · `departure_date`: `{{departure_date_valid}}` · `cabin_class`: economy |
| **Expected Result** | • HTTP **4xx** (400–499) · Response body has `errors` array or `error` field · `errors[0].message` is a non-empty string · Error message logged to console |
| **Status** | |

---

### NEG-02 | Past departure date (2024-01-01)

| Field | Detail |
|-------|--------|
| **Purpose** | Sending a date in the past. The bot uses today's date + `advanceBookingDays = 3`. The API should reject past dates clearly. |
| **Method** | POST |
| **Endpoint** | `/air/offer_requests?return_offers=true` |
| **Parameters / Input** | `origin`: BKK · `destination`: SIN · `departure_date`: **2024-01-01** (past) · `cabin_class`: economy |
| **Expected Result** | • HTTP **4xx** (400–499) · Response body has `errors` or `error` field · Error message logged to console |
| **Status** | |

---

### NEG-03 | Same origin and destination (BKK→BKK)

| Field | Detail |
|-------|--------|
| **Purpose** | Edge case: traveler accidentally types the same city twice. Verifies the API either rejects it or returns zero offers — not a 201 with phantom results. |
| **Method** | POST |
| **Endpoint** | `/air/offer_requests?return_offers=true` |
| **Parameters / Input** | `origin`: BKK · `destination`: **BKK** (same as origin) · `departure_date`: `{{departure_date_valid}}` |
| **Expected Result** | • **Option A**: HTTP 4xx — API explicitly rejects same-city request · **Option B**: HTTP 201 with `data.offers.length = 0` · Response status logged for documentation |
| **Status** | |

---

### NEG-04 | Empty passengers array ([])

| Field | Detail |
|-------|--------|
| **Purpose** | `passengers` is a required field in `duffel.js`. Sending an empty array should be rejected by the API with a clear validation error. |
| **Method** | POST |
| **Endpoint** | `/air/offer_requests?return_offers=true` |
| **Parameters / Input** | `origin`: BKK · `destination`: SIN · `departure_date`: `{{departure_date_valid}}` · `passengers`: **[]** (empty array) |
| **Expected Result** | • HTTP **4xx** (400–499) · Response has `errors` or `error` field · Error body logged for review |
| **Status** | |

---

### NEG-05 | Missing Authorization header (no token)

| Field | Detail |
|-------|--------|
| **Purpose** | Verifies the API rejects requests with no Bearer token. In `duffel.js` this triggers `"DUFFEL_API_KEY not set"` before the request is even made. Tests the API's own auth layer. |
| **Method** | POST |
| **Endpoint** | `/air/offer_requests?return_offers=true` |
| **Parameters / Input** | Auth: **NONE** (overrides collection-level Bearer token) · Body: valid payload (BKK→SIN) |
| **Expected Result** | • HTTP **401** Unauthorized · Response has `errors` or `error` field |
| **Status** | |

---

### NEG-06 | Missing required field: departure_date

| Field | Detail |
|-------|--------|
| **Purpose** | `departure_date` is required in the slices object. Omitting it should trigger a clear API validation error naming the missing field. |
| **Method** | POST |
| **Endpoint** | `/air/offer_requests?return_offers=true` |
| **Parameters / Input** | `slices`: `[{ origin: BKK, destination: SIN }]` — **no departure_date** · `passengers`: [adult] · `cabin_class`: economy |
| **Expected Result** | • HTTP **4xx** (400–499) · Response has `errors` or `error` field · Validation error logged to console |
| **Status** | |

---

## Group 4 — Cabin Class Coverage

> Tests all 4 values in `CABIN_TO_DUFFEL` map in `duffel.js`: Y→economy, W→premium_economy, C→business, F→first.

---

### CC-01 | Economy class (Y → economy)

| Field | Detail |
|-------|--------|
| **Purpose** | Economy is the default cabin class. Applies to Operations, Staff, Manager, Senior Manager roles per `policy.js`. |
| **Method** | POST |
| **Endpoint** | `/air/offer_requests?return_offers=true` |
| **Parameters / Input** | `origin`: BKK · `destination`: SIN · `departure_date`: `{{departure_date_valid}}` · `cabin_class`: **economy** |
| **Expected Result** | • HTTP **201** Created · `data.offers.length ≥ 1` · No `errors` in response |
| **Status** | |

---

### CC-02 | Premium Economy (W → premium_economy)

| Field | Detail |
|-------|--------|
| **Purpose** | Tests that `premium_economy` is accepted as a valid `cabin_class` by the API. Maps from `CABIN_TO_DUFFEL['W']`. |
| **Method** | POST |
| **Endpoint** | `/air/offer_requests?return_offers=true` |
| **Parameters / Input** | `origin`: BKK · `destination`: LHR · `departure_date`: `{{departure_date_valid}}` · `cabin_class`: **premium_economy** |
| **Expected Result** | • HTTP **201** Created · `data.offers.length ≥ 1` · `res.errors` is undefined · Offer count logged to console |
| **Status** | |

---

### CC-03 | Business Class (C → business)

| Field | Detail |
|-------|--------|
| **Purpose** | Business class applies to Director, VP, C-Suite, CEO per `policy.js`. Tests the API accepts the `business` value and returns results. |
| **Method** | POST |
| **Endpoint** | `/air/offer_requests?return_offers=true` |
| **Parameters / Input** | `origin`: BKK · `destination`: NRT · `departure_date`: `{{departure_date_valid}}` · `cabin_class`: **business** |
| **Expected Result** | • HTTP **201** Created · `data.offers.length ≥ 1` · `res.errors` is undefined · Offer count logged |
| **Status** | |

---

### CC-04 | First Class (F → first)

| Field | Detail |
|-------|--------|
| **Purpose** | First class is rarely booked but must be a valid value. Completes full `CABIN_TO_DUFFEL` map coverage. |
| **Method** | POST |
| **Endpoint** | `/air/offer_requests?return_offers=true` |
| **Parameters / Input** | `origin`: BKK · `destination`: LHR · `departure_date`: `{{departure_date_valid}}` · `cabin_class`: **first** |
| **Expected Result** | • HTTP **201** Created · `data.offers.length ≥ 1` · `res.errors` is undefined · Offer count logged |
| **Status** | |

---

## Group 5 — Response Schema Validation

> Validates that every field `mapOffer()` in `duffel.js` reads from the API response actually exists. A missing field causes silent wrong data in the bot with no error thrown.

---

### RS-01 | All mapOffer() fields present: flight_number, datetime, stops, offer_id

| Field | Detail |
|-------|--------|
| **Purpose** | `mapOffer()` reads: `marketing_carrier.iata_code`, `marketing_carrier_flight_number`, `departing_at`, `arriving_at`, `segments.length` (for stops), `offer.id`. All must exist or the bot returns `"??"` silently. |
| **Method** | POST |
| **Endpoint** | `/air/offer_requests?return_offers=true` |
| **Parameters / Input** | `origin`: BKK · `destination`: SIN · `departure_date`: `{{departure_date_valid}}` · `cabin_class`: economy |
| **Expected Result** | • HTTP **201** Created · `marketing_carrier.iata_code` is a non-empty string · `marketing_carrier_flight_number` exists · `departing_at` matches `/^\d{4}-\d{2}-\d{2}T/` · `arriving_at` matches `/^\d{4}-\d{2}-\d{2}T/` · `slices[0].segments` is an array · `offers[0].id` starts with `"off_"` |
| **Status** | |

---

### RS-02 | Baggage allowance structure: seg.passengers[0].baggages

| Field | Detail |
|-------|--------|
| **Purpose** | `duffel.js` reads `seg.passengers[0].baggages` and filters by `type="checked"`. If structure is missing, `baggage_allowance` defaults to `{checked_bags:0, weight_kg:0}` silently with no error. |
| **Method** | POST |
| **Endpoint** | `/air/offer_requests?return_offers=true` |
| **Parameters / Input** | `origin`: BKK · `destination`: NRT · `departure_date`: `{{departure_date_valid}}` · `cabin_class`: economy |
| **Expected Result** | • HTTP **201** Created · `slices[0].segments[0].passengers` is an array · Each passenger has a `baggages` property · Each `baggages` value is an array · Baggage entries logged for manual review |
| **Status** | |

---

### RS-03 | Top-3 price sort: offers sortable and cappable to 3

| Field | Detail |
|-------|--------|
| **Purpose** | `duffel.js` runs `.sort((a,b) => price_a - price_b).slice(0,3)`. All offers must have numeric `total_amount` and after simulation the sort must produce ≤ 3 results in ascending price order. |
| **Method** | POST |
| **Endpoint** | `/air/offer_requests?return_offers=true` |
| **Parameters / Input** | `origin`: BKK · `destination`: LHR · `departure_date`: `{{departure_date_valid}}` · `cabin_class`: economy |
| **Expected Result** | • HTTP **201** Created · All offers have numeric `total_amount > 0` · After simulated sort+slice: `length ≤ 3` · Sorted prices are in ascending order · Top-3 prices logged to console |
| **Status** | |

---

### RS-04 | FX currency field present for non-THB route

| Field | Detail |
|-------|--------|
| **Purpose** | `duffel.js` uses `FX_TO_THB` to convert prices to THB for compliance check. `total_currency` must be present. Supported: THB, USD, EUR, GBP, SGD, JPY. Unknown currency → `is_compliant: null`. |
| **Method** | POST |
| **Endpoint** | `/air/offer_requests?return_offers=true` |
| **Parameters / Input** | `origin`: BKK · `destination`: LHR · `departure_date`: `{{departure_date_valid}}` · `cabin_class`: economy |
| **Expected Result** | • HTTP **201** Created · All offers have `total_currency` (3-letter string) · Currencies logged to console · `WARNING` logged if a currency is outside FX_TO_THB supported list · (Soft check — new currencies do not block the test) |
| **Status** | |

---

## Group 6 — Preferred Airline & Long-Haul Coverage

> `policy.js` defines 3 preferred airlines: TG, SQ, EK. Only TG was covered in Group 2. This group adds SQ, EK, long-haul duration classification, and ZZ sandbox filter documentation.

---

### PA-01 | SQ (Singapore Airlines) in BKK→SIN results

| Field | Detail |
|-------|--------|
| **Purpose** | `policy.js`: SQ is preferred partner for Singapore routes (`reason: "Preferred partner for Singapore routes"`). `iata_code` field must be returned so `duffel.js` can set `is_preferred: true` for SQ offers. |
| **Method** | POST |
| **Endpoint** | `/air/offer_requests?return_offers=true` |
| **Parameters / Input** | `origin`: BKK · `destination`: SIN · `departure_date`: `{{departure_date_valid}}` · `cabin_class`: economy |
| **Expected Result** | • HTTP **201** Created · All carriers have `iata_code` field (string) — **hard assertion** · Unique airlines logged to console · SQ in results = **soft check** (logged, not blocking) |
| **Status** | |

---

### PA-02 | EK (Emirates) in BKK→DXB results

| Field | Detail |
|-------|--------|
| **Purpose** | `policy.js`: EK is preferred partner for Middle East and Europe routes. `iata_code` must be present on all carriers for `duffel.js` to detect EK and set `is_preferred: true`. |
| **Method** | POST |
| **Endpoint** | `/air/offer_requests?return_offers=true` |
| **Parameters / Input** | `origin`: BKK · `destination`: **DXB** (Dubai) · `departure_date`: `{{departure_date_valid}}` · `cabin_class`: economy |
| **Expected Result** | • HTTP **201** Created · `data.offers.length ≥ 1` · All carriers have `iata_code` field — **hard assertion** · Airlines logged to console · EK in results = **soft check** |
| **Status** | |

---

### PA-03 | Long-haul route BKK→LHR: duration > 4h = LONG_HAUL cap 25,000 THB

| Field | Detail |
|-------|--------|
| **Purpose** | `duffel.js` classifies flights where `durationMins > 240` as LONG_HAUL (cap 25,000 THB). BKK→LHR (~11h) must return `duration` > 240 minutes so the correct budget cap is applied. |
| **Method** | POST |
| **Endpoint** | `/air/offer_requests?return_offers=true` |
| **Parameters / Input** | `origin`: BKK · `destination`: LHR · `departure_date`: `{{departure_date_valid}}` · `cabin_class`: economy |
| **Expected Result** | • HTTP **201** Created · `slices[0].duration` matches `/^PT/` · Parsed total minutes **> 240** (= LONG_HAUL) · Console logs: `"Total minutes: X — classified as LONG_HAUL, cap 25000 THB"` |
| **Status** | |

---

### PA-04 | ZZ airline (Duffel sandbox) must not appear in results

| Field | Detail |
|-------|--------|
| **Purpose** | `duffel.js`: `const TEST_AIRLINE_CODES = new Set(['ZZ'])` — all offers where the first segment `iata_code` is `ZZ` are filtered out. This test documents whether ZZ appears in the raw API response so we know the filter in `duffel.js` is needed. |
| **Method** | POST |
| **Endpoint** | `/air/offer_requests?return_offers=true` |
| **Parameters / Input** | `origin`: BKK · `destination`: SIN · `departure_date`: `{{departure_date_valid}}` · `cabin_class`: economy |
| **Expected Result** | • HTTP **201** Created · All airline codes logged · If ZZ present: `WARNING` logged (filter in `duffel.js` handles this) · If ZZ absent: confirmation logged · (Informational — filter is at `duffel.js` level, not API level) |
| **Status** | |

---

## Group 7 — Additional Negative Tests

> Edge cases not covered in Group 3: invalid destination, wrong date format, invalid cabin class value, and empty body.

---

### NEG-07 | Invalid destination airport code (BKK→YYY)

| Field | Detail |
|-------|--------|
| **Purpose** | NEG-01 only tested invalid origin. This mirrors it for destination to verify both fields are validated symmetrically by the API. |
| **Method** | POST |
| **Endpoint** | `/air/offer_requests?return_offers=true` |
| **Parameters / Input** | `origin`: BKK (valid) · `destination`: **YYY** (invalid) · `departure_date`: `{{departure_date_valid}}` · `cabin_class`: economy |
| **Expected Result** | • HTTP **4xx** (400–499) · Response has `errors` or `error` field · Error message logged to console |
| **Status** | |

---

### NEG-08 | Wrong date format (01/07/2026 instead of YYYY-MM-DD)

| Field | Detail |
|-------|--------|
| **Purpose** | `duffel.js` expects `YYYY-MM-DD` from the NLU layer. If an incorrectly formatted date reaches the API, the API must reject it clearly so the error bubbles back up correctly. |
| **Method** | POST |
| **Endpoint** | `/air/offer_requests?return_offers=true` |
| **Parameters / Input** | `origin`: BKK · `destination`: SIN · `departure_date`: **"01/07/2026"** (DD/MM/YYYY — wrong format) · `cabin_class`: economy |
| **Expected Result** | • HTTP **4xx** (400–499) · Response has `errors` or `error` field · Validation error logged · Error message should indicate `departure_date` format issue |
| **Status** | |

---

### NEG-09 | Invalid cabin class value ("biz")

| Field | Detail |
|-------|--------|
| **Purpose** | `duffel.js` falls back unknown `CABIN_TO_DUFFEL` keys to `"economy"`. But sending a raw invalid string directly to the API tests the API's own `cabin_class` enum validation. |
| **Method** | POST |
| **Endpoint** | `/air/offer_requests?return_offers=true` |
| **Parameters / Input** | `origin`: BKK · `destination`: SIN · `departure_date`: `{{departure_date_valid}}` · `cabin_class`: **"biz"** (not a valid Duffel value) |
| **Expected Result** | • HTTP **4xx** (400–499) · Response has `errors` or `error` field · Cabin class validation error logged to console |
| **Status** | |

---

### NEG-10 | Completely empty request body ({})

| Field | Detail |
|-------|--------|
| **Purpose** | Verifies the API rejects a completely empty `data` object with proper error messages listing all required fields. |
| **Method** | POST |
| **Endpoint** | `/air/offer_requests?return_offers=true` |
| **Parameters / Input** | Body: **{}** (empty object — no slices, no passengers, no cabin_class) |
| **Expected Result** | • HTTP **4xx** (400–499) · Response has `errors` or `error` field · Error message should list missing required fields |
| **Status** | |

---

## Environment Variables Reference

> File: `postman/duffel_environment.json`

| Variable | Default Value | Description |
|----------|---------------|-------------|
| `base_url` | `https://api.duffel.com` | Duffel API base URL |
| `duffel_version` | `v2` | Required header: `Duffel-Version: v2` |
| `api_key` | *(your test key)* | Duffel test token. Replace before running. **Never commit to Git.** |
| `departure_date_valid` | `2026-07-01` | Future date for happy path tests. Update if expired. |
| `departure_date_past` | `2024-01-01` | Past date used in NEG-02 to trigger API validation error |
| `offer_request_id` | *(auto-set by HP-01)* | Populated from HP-01 test script |
| `offer_id` | *(auto-set by HP-01)* | Populated from HP-01. Used in HP-03 to retrieve a single offer |

---

## Notes for Testers

1. **Run HP-01 first** — it sets `offer_id` and `offer_request_id` needed by HP-03.
2. **Soft check tests** (PA-01, PA-02, PC-01) log warnings but do not fail — airline availability changes daily.
3. **Update `departure_date_valid`** to a future date before each test run.
4. **Set `api_key`** in the environment to your Duffel test token (`duffel_test_...`) before running.
5. **Status column** — fill in `Pass` / `Fail` / `Blocked` / `Skip` after each execution cycle.
