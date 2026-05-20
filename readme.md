# Clotilde — AI Corporate Travel Assistant

Clotilde is a Telegram-based AI travel assistant for corporate travelers, powered by **Gemini 2.5 Pro** with function calling. It searches live flights via the Duffel API, applies company travel policy, and handles the full booking lifecycle — search, select, confirm, and notify.

> Demo project for QA interview preparation, simulating Claire (American Express GBT).

---

## Features

- **Conversational flight & hotel search** via Telegram
- **Live flight data** via Duffel API (`POST /air/offer_requests`)
- **Policy enforcement** — cabin class by role, budget caps, preferred airlines (TG, SQ, EK), advance booking rules
- **Role-based profiles** — Operations/Staff, Manager/Senior, Director, VP/C-Suite
- **Booking confirmation** with PNR generation
- **17 notification types** — booking confirmed, delays, cancellations, reminders, visa alerts, and more
- **Admin REPL** — natural language booking management via Gemini 2.5 Flash
- **Entry requirements check** — AI-powered visa/entry info per destination

---

## Architecture

```
Telegram message
    → Index.js       (session state, role selection, inline keyboards)
    → agent.js       (Gemini 2.5 Pro function calling)
         ↳ search_flights  → duffel.js (live) or mock_inventory.js (fallback)
         ↳ search_hotels   → mock_inventory.js
         ↳ escalate_to_human
    → Index.js       (sendReply: inline keyboard, PNR on confirm)
    → Telegram reply
```

| File | Role |
|------|------|
| `Index.js` | Bot server — session state, role selection, booking flow |
| `agent.js` | Gemini 2.5 Pro function calling agent |
| `duffel.js` | Live flight search via Duffel API v2 |
| `mock_inventory.js` | GDS simulator — fallback and hotel search |
| `policy.js` | Single source of truth for all travel rules |
| `prompt.js` | `formatInventory()` + escalation handoff builder |
| `travelers.js` / `travelers.yml` | Role-based traveler profiles |
| `notify.js` | CLI for sending 17 notification types to travelers |
| `admin.js` | Natural language admin REPL (list, update, notify) |
| `bookings.json` | Confirmed booking store (PNR records) |
| `chat_registry.json` | employee_id → Telegram chat_id map |

---

## Travel Policy

| Rule | Value |
|------|-------|
| Preferred airlines | TG (Thai Airways), SQ (Singapore Airlines), EK (Emirates) |
| Economy cabin | Operations, Staff, Manager, Senior Manager |
| Business cabin | Director, VP, C-Suite, CEO |
| Short-haul budget cap | 5,000 THB (≤ 4 hours) |
| Long-haul budget cap | 25,000 THB (> 4 hours) |
| Advance booking | Minimum 3 days before departure |
| Out-of-policy flow | Require justification |

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
TELEGRAM_BOT_TOKEN=your_telegram_bot_token    # from @BotFather
GEMINI_API_KEY=your_gemini_api_key            # from Google AI Studio
DUFFEL_API_KEY=duffel_test_your_key           # from Duffel dashboard
AGENT_GROUP_CHAT_ID=your_group_chat_id        # optional
```

### 3. Run

```bash
node Index.js       # start the Telegram bot
node admin.js       # admin REPL (natural language booking management)
```

---

## Commands

### Bot commands (Telegram)

| Command | Action |
|---------|--------|
| `/start` | Begin session, select role |
| `/reset` | Clear session and start over |
| `/status` | Show current session state |

### Notifications CLI

Send one-off notifications to travelers:

```bash
# Booking confirmed
node notify.js booking_confirmed --employee EMP-001 --ref PNR-20260514-001 --flight "TG408 BKK→SIN" --date "2026-05-20 08:30"

# Flight delayed
node notify.js delayed --employee EMP-001 --flight "TG408" --delay "2 hours" --new-time "10:30"

# Departure reminder
node notify.js reminder --employee EMP-001 --flight "TG408 BKK→SIN" --date "2026-05-20 08:30"
```

Run `node notify.js` with no arguments to see all 17 notification types and their options.

---

## Duffel API Test Suite

The `postman/` directory contains a complete Postman/Newman test suite for the Duffel API integration.

**28 test cases across 7 groups:**

| Group | IDs | Focus |
|-------|-----|-------|
| 1 — Happy Path | HP-01–03 | Core search flow |
| 2 — Policy Compliance | PC-01–03 | Fields needed by `policy.js` |
| 3 — Negative Tests | NEG-01–06 | Error handling |
| 4 — Cabin Class Coverage | CC-01–04 | All 4 IATA cabin codes |
| 5 — Response Schema | RS-01–04 | Every field `mapOffer()` reads |
| 6 — Preferred Airline & Long-Haul | PA-01–04 | TG/SQ/EK detection, ZZ sandbox filter |
| 7 — Additional Negative Tests | NEG-07–10 | Edge cases |

### Run with Newman

```bash
cd postman
newman run duffel_collection.json -e duffel_environment.json
```

> Set `api_key` in `duffel_environment.json` to your Duffel test token before running.
> HP-01 must run first — it captures `offer_id` used by HP-03.

---

## Project Structure

```
Clotilde_AI/
├── Index.js                  # Bot server (entry point)
├── agent.js                  # Gemini function calling agent
├── duffel.js                 # Live flight search (Duffel API v2)
├── mock_inventory.js         # GDS simulator + hotel search
├── policy.js                 # Travel rules (single source of truth)
├── prompt.js                 # Inventory formatter + handoff builder
├── travelers.js / .yml       # Role-based traveler profiles
├── notify.js                 # Notification CLI (17 types)
├── admin.js                  # Admin REPL
├── bookings.json             # Confirmed bookings store
├── chat_registry.json        # employee_id → chat_id map
├── .env.example              # Environment variable template
└── postman/
    ├── duffel_collection.json     # Postman collection (28 tests)
    ├── duffel_environment.json    # Environment variables
    ├── Duffel_API_Test_Cases.md   # Test case specifications
    └── TEST_REPORT.md             # Assertions per test case
```

---

## Tech Stack

- **Runtime:** Node.js v20+
- **AI:** Google Gemini 2.5 Pro (agent), Gemini 2.5 Flash (admin + entry requirements)
- **Messaging:** Telegram Bot API via `node-telegram-bot-api`
- **Flight data:** Duffel API v2
- **Config:** YAML traveler profiles via `js-yaml`
- **Testing:** Postman / Newman

---

## ✈ V2 — Web Interface + Cypress QA Layer

### V2 Overview

V1 (above) is a Telegram bot — it has no browser surface, so Cypress cannot test it directly. V2 adds a thin Express REST API and a plain HTML single-page app (SPA) on top of V1's existing logic, without modifying any V1 file. This creates a testable web interface that mirrors the bot's booking flow.

The purpose of V2 is to demonstrate full-stack QA engineering for the 30SecondsToFly / Claire QA role — specifically: SPA frontend E2E testing, API contract testing, travel policy compliance testing, GenAI output regression detection, and GitHub Actions CI/CD integration. All powered by Cypress 13.

---

### V2 Branch Strategy

```
main             ← V1 Telegram bot only (this README, untouched)
v2-web-cypress   ← V1 + web layer + Cypress test suite
```

V2 adds only new files — no V1 file is modified, renamed, or deleted on either branch.

---

### V2 Project Structure (New Files Only)

```
── V2 NEW FILES (v2-web-cypress branch) ────────────────

cypress.config.js               ← Cypress config at project root

api/
  server.js                     ← Express REST API adapter
  routes/
    search.js                   ← POST /api/search
    book.js                     ← POST /api/book
  middleware/
    validate.js                 ← Request validation
    errorHandler.js             ← Centralised error responses

web/
  index.html                    ← Single-page booking UI (plain HTML/JS)

cypress/
  e2e/
    booking/booking_flow.cy.js        ← E2E: full booking flow
    api/api_contract.cy.js            ← API: schema + error handling
    policy/policy_compliance.cy.js    ← Policy: cabin violation flags
    regression/ai_regression.cy.js    ← GenAI: output drift detection
  fixtures/
    ai_baselines.json                 ← Stored AI baseline for regression
    mock_flight.json
  support/
    e2e.js                            ← Cypress support entry point
    commands.js                       ← Custom commands
    pages/
      BookingPage.js                  ← Page Object: form elements
      ResultsPage.js                  ← Page Object: results + confirmation
  screenshots/
  videos/

reports/                        ← Mochawesome HTML test reports (at root)
scripts/
  update_baselines.js           ← Manual baseline updater (never run by CI)

.github/workflows/cypress.yml   ← GitHub Actions CI pipeline
```

---

### V2 Installation

```bash
git checkout v2-web-cypress
npm install
```

No new environment variables are required to run the Cypress tests. Mock mode bypasses all external APIs.

---

### V2 Running the Web Layer

```bash
# Terminal 1 — Start API server in mock mode (no API key needed)
npm run start:api:mock

# Terminal 2 — Serve the web SPA
npm run start:web

# Open in browser
open http://localhost:3000
```

---

### V2 Running Cypress Tests

```bash
# Run all tests headlessly — same as CI
npm run cypress:run

# Open interactive Cypress Test Runner
npm run cypress:open

# Start both servers + run tests in one command
npm run test:ci

# Update GenAI baseline fixture (manual only — never run by CI)
npm run cypress:update-baselines
```

> **Note:** `npm run test:ci` handles server startup automatically. For `cypress:run` or `cypress:open`, start both servers first.

---

### V2 Test Suite

| Spec | Type | Story | What It Tests |
|---|---|---|---|
| `booking/booking_flow.cy.js` | E2E | US-010 | Search → select → confirm → PNR visible |
| `api/api_contract.cy.js` | API | US-011, US-012 | Endpoint schema, status codes, error messages |
| `policy/policy_compliance.cy.js` | Policy | US-013 | Cabin violation flags in API + UI badges |
| `regression/ai_regression.cy.js` | GenAI Regression | US-015, US-016 | AI output drift detection via baseline comparison |

---

### V2 GenAI Regression — How It Works

- `ai_baselines.json` stores the expected output (airline, price, cabin class, result count) from a fixed search payload.
- If the AI output changes (e.g. after a prompt edit), the regression test fails and shows: `Expected: "Thai Airways" | Got: "Bangkok Air"`.
- To reset after an intentional change: run `npm run cypress:update-baselines` locally, review the diff, then commit.

---

### V2 CI/CD Pipeline

- GitHub Actions runs on every push to `v2-web-cypress` and all pull requests to `main`
- Starts API (mock mode) + web server → waits → runs `cypress run --headless --browser chrome`
- HTML test reports uploaded as `cypress-results` artifact after every run (`if: always()`)
- Failing test = red ✗ on the commit, merge blocked

```
![Cypress Tests](https://github.com/aoaaae-sunattha/Clotilde_AI/actions/workflows/cypress.yml/badge.svg?branch=v2-web-cypress)
```

---

### V2 Key Design Decisions

| Decision | Why |
|---|---|
| Plain HTML/JS (no framework) | No build step — simpler CI, fewer failure points. Cypress tests the DOM identically regardless of framework. |
| Mock mode for CI (`USE_MOCK=true`) | Fully deterministic tests without real API keys. CI runs cleanly on every push for free. |
| Page Object Model | All `data-cy` selectors live in `BookingPage.js` and `ResultsPage.js`. Zero raw `cy.get()` in spec files — one place to update when UI changes. |
| Baseline fixtures for GenAI regression | AI output is non-deterministic in live mode. Storing key fields as JSON catches unintended prompt drift without testing the full response text. |
