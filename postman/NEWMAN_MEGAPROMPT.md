# Newman CLI Mega Prompt
## Duffel API Testing — Clotilde Travel Bot

> **Context:** This guide connects directly to `duffel.js` in the Clotilde project.
> Every test case here maps to real logic in the bot code.

---

## STEP 1 — Install Newman

```bash
# Install Newman globally
npm install -g newman

# Install the HTML reporter (nice visual reports)
npm install -g newman-reporter-htmlextra

# Verify
newman --version
```

---

## STEP 2 — Set Up Your API Key

Open `duffel_environment.json` and replace the placeholder:

```json
"key": "api_key",
"value": "YOUR_DUFFEL_TEST_KEY_HERE"   ← replace this
```

Get your test key at: https://app.duffel.com → Settings → API Tokens
Use the **Test mode** token (starts with `duffel_test_...`)

Or set it as an environment variable to keep it out of files:

```bash
export DUFFEL_TEST_KEY="duffel_test_xxxxxxxxxxxx"
```

Then run Newman with `--env-var "api_key=$DUFFEL_TEST_KEY"` instead.

---

## STEP 3 — Run All Tests

```bash
# Basic run — see results in terminal
newman run duffel_collection.json \
  --environment duffel_environment.json

# With colors and verbose output
newman run duffel_collection.json \
  --environment duffel_environment.json \
  --color on \
  --verbose
```

---

## STEP 4 — Generate Reports

### HTML Report (best for portfolio/screenshots)
```bash
newman run duffel_collection.json \
  --environment duffel_environment.json \
  --reporters cli,htmlextra \
  --reporter-htmlextra-export reports/duffel_test_report.html \
  --reporter-htmlextra-title "Clotilde Duffel API Test Report"
```
Open `reports/duffel_test_report.html` in a browser → screenshot this for your portfolio.

### JSON Report (for CI/CD pipelines)
```bash
newman run duffel_collection.json \
  --environment duffel_environment.json \
  --reporters cli,json \
  --reporter-json-export reports/duffel_results.json
```

### JUnit XML (for GitHub Actions / Jenkins)
```bash
newman run duffel_collection.json \
  --environment duffel_environment.json \
  --reporters cli,junit \
  --reporter-junit-export reports/duffel_junit.xml
```

---

## STEP 5 — Run Specific Folders Only

```bash
# Run only Negative Tests
newman run duffel_collection.json \
  --environment duffel_environment.json \
  --folder "3 - Negative Tests (Error Handling)"

# Run only Happy Path
newman run duffel_collection.json \
  --environment duffel_environment.json \
  --folder "1 - Happy Path"

# Run only Policy Compliance
newman run duffel_collection.json \
  --environment duffel_environment.json \
  --folder "2 - Policy Compliance Tests"
```

---

## STEP 6 — Add npm Scripts to package.json

Add these to your project's `package.json` so anyone can run tests easily:

```json
"scripts": {
  "node Index.js": "node Index.js",
  "test:api": "newman run postman/duffel_collection.json --environment postman/duffel_environment.json",
  "test:api:report": "newman run postman/duffel_collection.json --environment postman/duffel_environment.json --reporters cli,htmlextra --reporter-htmlextra-export postman/reports/report.html",
  "test:api:negative": "newman run postman/duffel_collection.json --environment postman/duffel_environment.json --folder '3 - Negative Tests (Error Handling)'",
  "test:api:happy": "newman run postman/duffel_collection.json --environment postman/duffel_environment.json --folder '1 - Happy Path'"
}
```

Then run with:
```bash
npm run test:api
npm run test:api:report
```

---

## STEP 7 — Understand the Test Coverage

| ID | Test Name | Maps to duffel.js Logic |
|----|-----------|------------------------|
| HP-01 | BKK→SIN Economy valid date | `searchFlights()` core call with `return_offers=true` |
| HP-02 | BKK→NRT Business class | `CABIN_TO_DUFFEL['C'] = 'business'` mapping |
| HP-03 | Get offer by ID | Individual offer retrieval after request |
| PC-01 | TG in results | `POLICY.preferredAirlines` — TG gets `is_preferred: true` |
| PC-02 | Duration field present | `parseDurationMinutes()` — needed for short/long haul decision |
| PC-03 | Refund/change conditions | `offer.conditions.refund_before_departure.allowed` mapping |
| NEG-01 | Invalid airport code XXX | `if (!res.ok) throw new Error(...)` in duffel.js |
| NEG-02 | Past departure date | Date validation at API level |
| NEG-03 | Same origin/destination | Edge case — BKK→BKK |
| NEG-04 | Empty passengers array | Missing required field validation |
| NEG-05 | No Authorization header | `DUFFEL_API_KEY not set` error path |
| NEG-06 | Missing departure_date | Required field validation |
| CC-01 | Economy (Y) | `CABIN_TO_DUFFEL['Y'] = 'economy'` |
| CC-02 | Premium Economy (W) | `CABIN_TO_DUFFEL['W'] = 'premium_economy'` |
| CC-03 | Business (C) | `CABIN_TO_DUFFEL['C'] = 'business'` |
| CC-04 | First (F) | `CABIN_TO_DUFFEL['F'] = 'first'` |

---

## STEP 8 — What Good Output Looks Like

When all tests pass you'll see:
```
┌─────────────────────────────┬──────────┬──────────┐
│                             │ executed │   failed │
├─────────────────────────────┼──────────┼──────────┤
│              iterations     │        1 │        0 │
│                requests     │       16 │        0 │
│            test-scripts     │       16 │        0 │
│      prerequest-scripts     │        0 │        0 │
│              assertions     │       45 │        0 │
├─────────────────────────────┼──────────┼──────────┤
│ total run duration: ~25s    │          │          │
└─────────────────────────────┴──────────┴──────────┘
```

---

## STEP 9 — Folder Structure for Your Portfolio

```
Clotilde_AI/
├── postman/
│   ├── duffel_collection.json       ← Import into Postman GUI or run with Newman
│   ├── duffel_environment.json      ← Environment variables (replace api_key)
│   ├── NEWMAN_MEGAPROMPT.md         ← This file
│   └── reports/                     ← Generated by --reporter-htmlextra-export
│       └── duffel_test_report.html  ← HTML report for screenshots/portfolio
```

---

## STEP 10 — CI/CD (GitHub Actions)

Create `.github/workflows/api-tests.yml`:

```yaml
name: Duffel API Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  api-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install Newman
        run: npm install -g newman newman-reporter-htmlextra
      - name: Run API Tests
        run: |
          newman run postman/duffel_collection.json \
            --environment postman/duffel_environment.json \
            --env-var "api_key=${{ secrets.DUFFEL_TEST_KEY }}" \
            --reporters cli,junit \
            --reporter-junit-export reports/junit.xml
      - name: Upload Results
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: api-test-results
          path: reports/junit.xml
```

Add `DUFFEL_TEST_KEY` as a GitHub Secret in your repo settings.

---

## Quick Reference — Common Issues

| Problem | Fix |
|---------|-----|
| `newman: command not found` | Run `npm install -g newman` |
| `401 Unauthorized` | Check `api_key` in environment file |
| `offer_id` variable empty | Run HP-01 first — it sets `offer_id` |
| HTML report not generating | Install `npm install -g newman-reporter-htmlextra` |
| Tests fail on dates | Update `departure_date_valid` in environment to a future date |
| `Duffel-Version header missing` | Ensure environment has `duffel_version: v2` |

---

## Key Talking Points for Portfolio/Interviews

1. **"I tested the actual external API that the bot depends on"** — not a mock, not a fake endpoint
2. **"My tests are aligned with business logic"** — each test maps to a real policy rule in `policy.js`
3. **"I covered happy path, negative cases, and edge cases"** — 16 tests across 4 categories
4. **"The tests can run in CI/CD"** — Newman + GitHub Actions setup included
5. **"I used environment variables for secrets"** — no hardcoded API keys in test files
