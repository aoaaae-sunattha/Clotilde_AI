# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
node Index.js        # start the Telegram bot (requires .env)
node admin.js        # natural language admin interface (booking management + notifications)
node notify.js <type> --employee <id> [options]   # send one-off notifications directly
npm install          # install dependencies
```

There is no linter configured. No build step — plain Node.js.

## Architecture

Single-agent pipeline using Gemini function calling (v3.0):

```
Telegram message
    → Index.js       (session state, role selection, inline keyboards)
    → agent.js       (Gemini 2.5 Pro function calling agent)
         ↳ search_flights  → duffel.js (live) or mock_inventory.js (fallback)
         ↳ search_hotels   → mock_inventory.js
         ↳ escalate_to_human
    → Index.js       (sendReply: inline keyboard for selection, PNR on confirm)
    → Telegram reply
```

**`Index.js`** — bot server (v3.0). Maintains per-user sessions in a `Map`: `{ history, pendingOptions, selectedOption, role, awaitingRole: true, travelerProfile }`. Handles /start, /reset, /status commands and all `callback_query` events (role selection, flight/hotel selection, booking confirm/cancel). Writes confirmed bookings to `bookings.json`. Registers employee_id → chat_id in `chat_registry.json` on role selection.

**`agent.js`** — Gemini 2.5 Pro function calling agent. Replaces the old NLU+NLG pipeline. System prompt includes today's date, traveler profile, and company policy. Sends minimal metadata back to Gemini after tool calls (not full flight data) to prevent duplicate listing. Appends `formatInventory()` to the reply in code.

**`prompt.js`** — `formatInventory(results)` formats flights/hotels as Markdown blocks with compliance flags. `buildContextPacket(chatId, history, lastNluResult)` builds escalation handoff packets.

**`policy.js`** — single source of truth for travel rules: hotel budget caps, preferred airlines, cabin class by role level, advance booking days, escalation contact. Imported by `agent.js` and `mock_inventory.js`.

**`mock_inventory.js`** — simulates GDS responses. `CITY_TO_AIRPORT` map handles disambiguation (e.g. "Chonburi" → UTP). Compliance flags computed dynamically. Exports: `getMockFlights`, `getMockHotels`, `buildGDSPayload`, `CITY_TO_AIRPORT`.

**`duffel.js`** — live flight search via Duffel API. Called when a valid YYYY-MM-DD date is provided. Falls back to mock on error.

**`travelers.js`** / **`travelers.yml`** — YAML traveler profiles (one per role: Operations/Staff, Manager/Senior, Director, VP/C-Suite). Loaded on role selection. `getProfile(role)` returns profile or null.

**`notify.js`** — standalone CLI for sending 17 notification types to travelers via Telegram. Reads `chat_registry.json` to resolve employee_id → chat_id. See top of file for full usage docs.

**`admin.js`** — natural language admin REPL. Gemini 2.5 Flash with 4 tools: `list_bookings`, `get_traveler`, `send_notification`, `update_booking_status`. Admin types plain English; Gemini calls tools and reports result.

**`bookings.json`** — confirmed booking store. Written by Index.js on `booking_confirm`. Each record includes PNR, employee_id, type (flight/hotel), status, and full booking details.

**`chat_registry.json`** — employee_id → Telegram chat_id map. Auto-populated when travelers use /start and select a role. Read by `notify.js` and `admin.js`.

## macOS filename note

Source files use mixed capitalisation (`Index.js`, `Policy.js`, `Prompt.js`). On macOS (case-insensitive APFS) `require('./policy.js')` resolves to `Policy.js` correctly. Do not rename files.

## Environment

Copy `.env.example` → `.env` and fill in:
- `TELEGRAM_BOT_TOKEN` — from @BotFather
- `GEMINI_API_KEY` — from Google AI Studio

Both vars are validated on startup; missing vars exit with a clear error.
