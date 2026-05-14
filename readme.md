# Clotilde — AI Corporate Travel Assistant

Demo project built for QA interview preparation.
Shows NLU intent classification, policy enforcement, and fallback handling
using Gemini 1.5 Flash + Telegram Bot API.

## Project structure

```
clotilde/
├── index.js          — bot server (main entry point)
├── nlu.js            — NLU layer: classifies intent + extracts entities
├── nlg.js            — NLG layer: generates Clotilde's replies
├── prompt.js         — mega system prompt (identity + policy + behavior rules)
├── policy.js         — travel policy rules (budget caps, preferred airlines)
├── golden_dataset.js — 15 NLU regression test cases
├── run_tests.js      — batch test runner
├── .env              — your secret keys (never share this)
└── .env.example      — template for .env
```

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create your `.env` file:
```bash
cp .env.example .env
```
Then open `.env` and fill in your Telegram bot token and Gemini API key.

3. Run the bot:
```bash
node index.js
```

4. Run the NLU regression tests:
```bash
node run_tests.js
```

## What the QA panel shows

When `index.js` is running, every message triggers a log entry in the terminal:

```
───────────────────────────────────────────────────────
[QA PANEL] 2025-05-12T10:23:11.000Z
User:       "Book a flight to Singapore next Monday"
Intent:     flight_booking
Confidence: 88%
Path:       SUCCESS
Entities:   {"destination":"SIN","departure_date":"relative"}
Missing:    ["origin"]
Latency:    843ms
───────────────────────────────────────────────────────
```

The interviewer sees this terminal alongside the Telegram chat on your phone —
proving you understand the NLU decision layer, not just the chat interface.

## Key concepts demonstrated

- NLU vs NLG as separate layers (two distinct Gemini API calls)
- Confidence threshold routing (≥ 0.70 = success, < 0.70 = fallback)
- Travel policy enforcement (budget caps, cabin class, preferred airlines)
- Slot filling (asking for missing entities)
- Fallback handling and human escalation triggers
- Golden Dataset regression testing