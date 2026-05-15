# Postman CLI Mega Prompt
## Duffel API Testing — Clotilde Travel Bot

> **What is Postman CLI?**
> The official CLI tool from Postman (not Newman).
> It connects to your Postman account and runs collections
> you built in the Postman app — from your terminal.
> Download: https://learning.postman.com/docs/postman-cli/postman-cli-installation/

---

## STEP 1 — Install Postman CLI

### macOS
```bash
brew install postman/tap/postman-cli
```

### macOS (manual / no Homebrew)
```bash
curl -o- "https://dl-cli.pstmn.io/install/osx_64.sh" | sh
```

### Windows (PowerShell)
```powershell
powershell.exe -NoProfile -InputFormat None -ExecutionPolicy AllSigned -Command `
"[System.Net.ServicePointManager]::SecurityProtocol = 3072; `
iex ((New-Object System.Net.WebClient).DownloadString('https://dl-cli.pstmn.io/install/win64.ps1'))"
```

### Verify install
```bash
postman --version
```

---

## STEP 2 — Log In to Your Postman Account

You need a Postman account (free). Go to https://postman.com and sign up if you don't have one.

### Get your Postman API Key
1. Open Postman app → click your avatar (top right)
2. Go to **Settings → API keys**
3. Click **Generate API Key**
4. Copy the key — you only see it once

### Log in via CLI
```bash
postman login --with-api-key YOUR_POSTMAN_API_KEY
```

You should see:
```
Logged in as your@email.com
```

---

## STEP 3 — Build Your Collection in Postman App First

Before running from CLI, you build the collection in the Postman desktop app.

### Import the ready-made collection and environment from this project
1. Open Postman app
2. Click **Import** (top left)
3. Import both files:
   - `postman/duffel_collection.json`
   - `postman/duffel_environment.json`
4. Open the environment and set `api_key` to your Duffel test token
   (get it at https://app.duffel.com → Settings → API Tokens → Test mode)
5. Click **Save**

### Get your Collection ID and Environment ID
After importing:

**Collection ID:**
- Right-click the collection → **Info** → copy the ID (format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)

**Environment ID:**
- Click Environments (left sidebar) → select your env → **Info** → copy the ID

---

## STEP 4 — Run Collection from CLI

```bash
# Basic run
postman collection run YOUR_COLLECTION_ID

# Run with a specific environment
postman collection run YOUR_COLLECTION_ID \
  --environment YOUR_ENVIRONMENT_ID

# Run with verbose output (see each request + response)
postman collection run YOUR_COLLECTION_ID \
  --environment YOUR_ENVIRONMENT_ID \
  --verbose
```

---

## STEP 5 — Override Variables from Terminal

You can override environment variables directly from the CLI without editing the file:

```bash
# Override api_key (never hardcode secrets in files)
postman collection run YOUR_COLLECTION_ID \
  --environment YOUR_ENVIRONMENT_ID \
  --env-var "api_key=duffel_test_xxxxxxxxxxxx" \
  --env-var "departure_date_valid=2026-08-01"
```

This is how you keep secrets out of committed files.

---

## STEP 6 — Run Specific Folder Only

```bash
# Run only negative tests
postman collection run YOUR_COLLECTION_ID \
  --environment YOUR_ENVIRONMENT_ID \
  --folder "3 - Negative Tests (Error Handling)"

# Run only happy path
postman collection run YOUR_COLLECTION_ID \
  --environment YOUR_ENVIRONMENT_ID \
  --folder "1 - Happy Path"
```

---

## STEP 7 — Generate Reports

```bash
# Output results as JSON file
postman collection run YOUR_COLLECTION_ID \
  --environment YOUR_ENVIRONMENT_ID \
  --output reports/duffel_results.json

# Output as JUnit XML (for CI/CD)
postman collection run YOUR_COLLECTION_ID \
  --environment YOUR_ENVIRONMENT_ID \
  --reporter junit \
  --output reports/duffel_junit.xml
```

---

## STEP 8 — Add npm Scripts to package.json

So anyone on your team can run tests with one command:

```json
"scripts": {
  "test:api": "postman collection run YOUR_COLLECTION_ID --environment YOUR_ENVIRONMENT_ID",
  "test:api:report": "postman collection run YOUR_COLLECTION_ID --environment YOUR_ENVIRONMENT_ID --output postman/reports/results.json",
  "test:api:negative": "postman collection run YOUR_COLLECTION_ID --environment YOUR_ENVIRONMENT_ID --folder '3 - Negative Tests (Error Handling)'",
  "test:api:happy": "postman collection run YOUR_COLLECTION_ID --environment YOUR_ENVIRONMENT_ID --folder '1 - Happy Path'"
}
```

Run with:
```bash
npm run test:api
npm run test:api:report
```

---

## STEP 9 — CI/CD (GitHub Actions)

Create `.github/workflows/api-tests.yml`:

```yaml
name: Duffel API Tests (Postman CLI)

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

      - name: Install Postman CLI
        run: |
          curl -o- "https://dl-cli.pstmn.io/install/linux64.sh" | sh

      - name: Login to Postman
        run: postman login --with-api-key ${{ secrets.POSTMAN_API_KEY }}

      - name: Run API Tests
        run: |
          postman collection run YOUR_COLLECTION_ID \
            --environment YOUR_ENVIRONMENT_ID \
            --env-var "api_key=${{ secrets.DUFFEL_TEST_KEY }}" \
            --reporter junit \
            --output reports/results.xml

      - name: Upload Test Results
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: api-test-results
          path: reports/results.xml
```

Add these two secrets in your GitHub repo (Settings → Secrets):
- `POSTMAN_API_KEY` — from Postman Settings → API keys
- `DUFFEL_TEST_KEY` — from Duffel dashboard, test mode

---

## STEP 10 — What the Test Collection Covers

| ID | Test | Why it exists |
|----|------|---------------|
| HP-01 | BKK→SIN Economy, valid date | Core `searchFlights()` call — mirrors exactly what `duffel.js` sends |
| HP-02 | BKK→NRT Business class | Tests `CABIN_TO_DUFFEL['C'] = 'business'` mapping |
| HP-03 | Get offer by ID | Offer retrieval after a search |
| PC-01 | TG (Thai Airways) in results | `POLICY.preferredAirlines` — TG gets `is_preferred: true` |
| PC-02 | Duration field present | `parseDurationMinutes()` — decides short vs long haul cap |
| PC-03 | Refund/change flags present | Maps to `offer.conditions.refund_before_departure.allowed` |
| NEG-01 | Invalid airport code XXX | Triggers `duffel.js` error handler: `throw new Error('Duffel 422...')` |
| NEG-02 | Past departure date | API-level date validation |
| NEG-03 | BKK→BKK same origin/dest | Edge case — 0 results or 422 |
| NEG-04 | Empty passengers array | Missing required field |
| NEG-05 | No Authorization header | `DUFFEL_API_KEY not set` error path |
| NEG-06 | Missing departure_date | Required field validation |
| CC-01 | Economy (Y) | `CABIN_TO_DUFFEL['Y'] = 'economy'` |
| CC-02 | Premium Economy (W) | `CABIN_TO_DUFFEL['W'] = 'premium_economy'` |
| CC-03 | Business (C) | `CABIN_TO_DUFFEL['C'] = 'business'` |
| CC-04 | First (F) | `CABIN_TO_DUFFEL['F'] = 'first'` |

---

## Quick Reference — Common Issues

| Problem | Fix |
|---------|-----|
| `postman: command not found` | Restart terminal after install, or check PATH |
| `Not logged in` | Run `postman login --with-api-key YOUR_KEY` |
| `Collection not found` | Double-check Collection ID from Postman app Info panel |
| `401 from Duffel` | Check `api_key` env variable — use Duffel **test** token, not live |
| `offer_id` empty in HP-03 | Run HP-01 first — it sets `offer_id` via test script |
| Dates failing | Update `departure_date_valid` in environment to a future date |

---

## Folder Structure

```
Clotilde_AI/
├── postman/
│   ├── duffel_collection.json        ← Import into Postman app
│   ├── duffel_environment.json       ← Import into Postman app (set api_key)
│   ├── POSTMAN_CLI_MEGAPROMPT.md     ← This guide
│   └── reports/                      ← Output from --output flag
│       └── results.json
└── .github/
    └── workflows/
        └── api-tests.yml             ← CI/CD pipeline
```

---

## Key Talking Points for Portfolio / Interviews

1. **"I tested the real API the bot uses"** — Duffel live endpoint, not a mock
2. **"Tests map to business rules"** — each test case links to a policy rule in `policy.js`
3. **"I used the official Postman CLI"** — not just the GUI, but automated from terminal
4. **"Secrets are never hardcoded"** — API keys passed as `--env-var` or GitHub Secrets
5. **"Tests can run in CI/CD"** — GitHub Actions workflow included
6. **"I covered 4 test types"** — happy path, compliance, negative, and cabin class coverage
