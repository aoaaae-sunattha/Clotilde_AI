# Clotilde ✈ — AI Travel Booking Assistant

*V2 — Web Interface + Cypress QA Layer*

![Cypress Tests](https://github.com/aoaaae-sunattha/Clotilde_AI/actions/workflows/cypress.yml/badge.svg?branch=v2-web-cypress)
![Node](https://img.shields.io/badge/node-%3E%3D18-green)

---

## Overview

Clotilde is an AI-powered corporate travel booking assistant inspired by Claire (30SecondsToFly). V1 is a Telegram bot built with Node.js and Gemini 2.5 Pro that searches flights, enforces company travel policy (cabin class entitlements, budget caps, preferred airlines), and generates booking confirmations with PNR references.

This branch (`v2-web-cypress`) adds a web SPA and Express REST API on top of V1 so that Cypress can test the full booking flow end-to-end. It is built as a QA engineering portfolio piece targeting the Claire QA role — covering SPA frontend testing, API contract testing, travel policy compliance testing, and GenAI output regression detection.

All tests run in mock mode (`USE_MOCK=true`), which routes requests through `mock_inventory.js` instead of calling Gemini. This makes every test fully deterministic, requires no API keys, and means CI runs cleanly on every push.

---

## Project Structure

```
project-root/
├─ cypress.config.js          ← Cypress config (at root — not inside /cypress/)
├─ package.json
├─ .env.example
│
├─ api/                        ← V2: Express REST API adapter
│  ├─ server.js                ← Entry point — port 3001
│  ├─ routes/
│  │  ├─ search.js             ← POST /api/search
│  │  └─ book.js               ← POST /api/book
│  └─ middleware/
│     ├─ validate.js           ← Input validation for both routes
│     └─ errorHandler.js       ← Centralised error responses
│
├─ web/
│  └─ index.html               ← V2: Single-page booking UI (plain HTML/JS)
│
├─ cypress/
│  ├─ e2e/
│  │  ├─ booking/
│  │  │  └─ booking_flow.cy.js      ← E2E: full booking flow
│  │  ├─ api/
│  │  │  └─ api_contract.cy.js      ← API: schema + error handling
│  │  ├─ policy/
│  │  │  └─ policy_compliance.cy.js ← Policy: cabin class violations
│  │  └─ regression/
│  │     └─ ai_regression.cy.js     ← GenAI: output drift detection
│  ├─ fixtures/
│  │  ├─ ai_baselines.json          ← Stored AI baseline for regression tests
│  │  └─ mock_flight.json
│  ├─ support/
│  │  ├─ e2e.js                     ← Cypress support entry point
│  │  ├─ commands.js                ← Custom commands: validateApiSchema, searchFlight
│  │  └─ pages/
│  │     ├─ BookingPage.js          ← Page Object: form + confirmation elements
│  │     └─ ResultsPage.js          ← Page Object: results list + policy badges
│  ├─ screenshots/                  ← Failure screenshots (auto-generated)
│  └─ videos/                       ← Test videos (auto-generated)
│
├─ reports/                    ← Mochawesome HTML test reports
├─ scripts/
│  └─ update_baselines.js      ← Manual baseline updater (never run by CI)
│
├─ .github/
│  └─ workflows/
│     └─ cypress.yml           ← GitHub Actions CI pipeline
│
│  ── V1 FILES (DO NOT MODIFY) ──────────────────────────────────
├─ Index.js                    ← V1: Telegram bot server
├─ agent.js                    ← V1: Gemini 2.5 Pro function calling agent
├─ policy.js                   ← V1: Travel policy rules (cabin class, budget caps)
├─ mock_inventory.js           ← V1: Mock flight and hotel inventory
├─ travelers.js / travelers.yml← V1: Role-based traveler profiles
└─ bookings.json               ← V1: Confirmed booking store
```

---

## Prerequisites

- Node.js 18+
- npm 9+
- For V1 bot: Telegram Bot Token + Gemini API Key
- For V2 Cypress tests: **no API keys required** (mock mode)

---

## Installation

```bash
git clone https://github.com/aoaaae-sunattha/Clotilde_AI.git
cd Clotilde_AI
git checkout v2-web-cypress
npm install
```

Copy the environment file:

```bash
cp .env.example .env
# Fill in TELEGRAM_BOT_TOKEN and GEMINI_API_KEY only if running the V1 Telegram bot.
# The V2 web layer and all Cypress tests work without any API keys.
```

---

## Running V1 (Telegram Bot)

```bash
node Index.js
```

V1 is the original Telegram bot and is untouched on this branch. See the `main` branch for the original V1 documentation and setup instructions.

---

## Running V2 (Web + API)

```bash
# Terminal 1 — start the Express API server (mock mode, no API key needed)
npm run start:api:mock

# Terminal 2 — start the web SPA
npm run start:web

# Open in browser
open http://localhost:3000
```

With `USE_MOCK=true` the API returns deterministic results from `mock_inventory.js`. No Gemini API key is required.

---

## Running Cypress Tests

```bash
# Run all tests headlessly — same as CI
npm run cypress:run

# Open Cypress Test Runner interactively (useful during development)
npm run cypress:open

# Start API + web server + Cypress in one command (handles server startup automatically)
npm run test:ci

# Update the GenAI baseline fixture after mock data changes — run manually, NEVER in CI
npm run cypress:update-baselines
```

> **Before running tests manually:** make sure both servers are running (`npm run start:api:mock` and `npm run start:web`), or use `npm run test:ci` which handles startup automatically.

---

## Test Suite Overview

| Spec File | Type | User Story | What It Tests |
|---|---|---|---|
| `booking/booking_flow.cy.js` | E2E | US-010 | Full booking: search → select → confirm → PNR |
| `api/api_contract.cy.js` | API | US-011, US-012 | REST endpoint schema, status codes, error messages |
| `policy/policy_compliance.cy.js` | Policy | US-013 | Cabin class violations, policy badges in UI and API |
| `regression/ai_regression.cy.js` | GenAI Regression | US-015, US-016 | AI output drift detection via baseline comparison |

The GenAI regression spec stores expected key fields (`airline`, `price`, `cabinClass`, result count) in `cypress/fixtures/ai_baselines.json`. On every run it calls the API with a fixed payload and compares the result against the stored baseline — if the output has changed, the test fails with a clear message such as `Expected airline: "Thai Airways" | Got: "Bangkok Air"`. To demo drift detection live: edit `ai_baselines.json`, set `firstResult.airline` to a wrong value, then run Cypress. Reset the baseline with `npm run cypress:update-baselines`.

---

## CI/CD Pipeline

GitHub Actions runs the full Cypress suite on every push to `v2-web-cypress` and on all pull requests targeting `main`.

The workflow:
1. Installs dependencies (`npm ci`)
2. Starts the API server in mock mode (`USE_MOCK=true`)
3. Starts the web server
4. Waits for both servers to be ready (`wait-on`)
5. Runs `cypress run --headless --browser chrome`
6. Uploads Mochawesome HTML reports as a `cypress-results` artifact (runs even on failure)

Any failing test exits with a non-zero code, which blocks the merge with a red status on the commit.

![Cypress Tests](https://github.com/aoaaae-sunattha/Clotilde_AI/actions/workflows/cypress.yml/badge.svg?branch=v2-web-cypress)

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `TELEGRAM_BOT_TOKEN` | V1 only | — | Telegram bot token from @BotFather |
| `GEMINI_API_KEY` | V1 live mode only | — | Google AI Studio API key |
| `USE_MOCK` | No | `false` | Set `true` to bypass Gemini and use mock inventory |
| `API_PORT` | No | `3001` | Express API server port |
| `ALLOWED_ORIGIN` | No | `http://localhost:3000` | CORS allowed origin for the web SPA |

---

## Key Design Decisions

- **Plain HTML/JS (no framework):** No build step means a simpler CI pipeline with fewer failure points. Cypress tests the DOM identically regardless of which framework rendered it.
- **Mock mode for CI:** `USE_MOCK=true` routes all search calls through `mock_inventory.js`, making every test fully deterministic without real API keys. CI stays free and reproducible.
- **Page Object Model:** All `data-cy` selectors are encapsulated in `BookingPage.js` and `ResultsPage.js`. Spec files contain zero raw `cy.get()` calls — if a selector changes, it is fixed in exactly one place.
- **GenAI regression via baseline fixtures:** AI output is non-deterministic in live mode. Storing key fields as a JSON baseline catches unintended prompt drift without brittle full-text matching.

---

## Branch Strategy

```
main             ← V1 Telegram bot (original codebase, untouched)
v2-web-cypress   ← V1 + web SPA + Express API + Cypress test suite (this branch)
```

V2 adds only new files to the existing codebase. No V1 file is modified, renamed, or deleted.

---

## Author

**Aoaaae** — QA Engineer

Built as a portfolio project for the 30SecondsToFly / Claire QA Engineer role. Inspired by Claire: an AI-powered corporate travel booking assistant.
