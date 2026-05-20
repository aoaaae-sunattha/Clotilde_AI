// api/routes/search.js
// POST /api/search — accepts { query, role, date } and returns FlightResult[].
// In mock mode (USE_MOCK=true) calls mock_inventory.js directly; no Gemini call.

const express = require('express');
const router = express.Router();
const { validateSearch } = require('../middleware/validate');
const { getMockFlights, getRouteType } = require('../../mock_inventory');
const POLICY = require('../../policy');

// ── IATA code extraction ──────────────────────────────────────────────────────
// Detect 3-letter IATA codes in the query, or map common city names.
const CITY_MAP = {
  'bangkok': 'BKK', 'bkk': 'BKK', 'dmk': 'DMK',
  'tokyo': 'NRT', 'nrt': 'NRT', 'hnd': 'HND', 'tyo': 'NRT',
  'singapore': 'SIN', 'sin': 'SIN',
  'london': 'LHR', 'lhr': 'LHR',
  'new york': 'JFK', 'jfk': 'JFK', 'nyc': 'JFK',
  'sydney': 'SYD', 'syd': 'SYD',
  'dubai': 'DXB', 'dxb': 'DXB',
  'hong kong': 'HKG', 'hkg': 'HKG',
  'kuala lumpur': 'KUL', 'kul': 'KUL',
  'seoul': 'ICN', 'icn': 'ICN',
  'paris': 'CDG', 'cdg': 'CDG',
  'frankfurt': 'FRA', 'fra': 'FRA',
  'chiang mai': 'CNX', 'cnx': 'CNX',
  'phuket': 'HKT', 'hkt': 'HKT',
  'osaka': 'KIX', 'kix': 'KIX',
  'delhi': 'DEL', 'del': 'DEL',
  'mumbai': 'BOM', 'bom': 'BOM',
};

function resolveCode(word) {
  if (!word) return null;
  const w = word.trim().toLowerCase();
  return CITY_MAP[w] || null;
}

function extractAirports(query) {
  const q = query.toLowerCase();
  let origin = 'BKK';
  let destination = 'SIN';

  // Split on the LAST occurrence of " to " so "flight BKK to TYO" → before="flight BKK", after="TYO"
  const toIdx = q.lastIndexOf(' to ');
  if (toIdx !== -1) {
    const beforeTo = q.substring(0, toIdx).trim();
    const afterTo  = q.substring(toIdx + 4).trim().split(/\s+/)[0]; // first token after "to"

    // Destination: first token after "to"
    const destCode = resolveCode(afterTo);
    if (destCode) destination = destCode;

    // Origin: walk backwards through tokens before "to" to find first recognised airport
    const beforeTokens = beforeTo.split(/\s+/).reverse();
    for (const tok of beforeTokens) {
      const code = resolveCode(tok);
      if (code) { origin = code; break; }
    }
  } else {
    // No "to" — scan all tokens for known codes; treat first as origin, second as destination
    const tokens = q.split(/\s+/);
    const found = [];
    for (const tok of tokens) {
      const code = resolveCode(tok);
      if (code && !found.includes(code)) found.push(code);
    }
    // Also scan for multi-word city names
    for (const [city, code] of Object.entries(CITY_MAP)) {
      if (city.includes(' ') && q.includes(city) && !found.includes(code)) found.push(code);
    }
    if (found.length >= 2) [origin, destination] = found;
    else if (found.length === 1) destination = found[0];
  }

  return { origin, destination };
}

function extractCabinClass(query) {
  const q = query.toLowerCase();
  if (q.includes('business')) return 'C';
  if (q.includes('first class') || q.includes('first-class')) return 'F';
  return 'Y'; // economy default
}

// Map mock_inventory cabin_class codes to PRD schema strings
function mapCabinLabel(code) {
  if (!code) return 'economy';
  const c = code.toUpperCase();
  if (c === 'C' || c === 'J') return 'business';
  if (c === 'F' || c === 'A') return 'first';
  return 'economy';
}

// Compute policy flags for a result given the traveler role
function computePolicyFlags(flight, role) {
  const flags = [];
  const cabinCode = (flight.cabin_class || 'Y').toUpperCase();

  // Roles only allowed Economy
  const economyOnlyRoles = POLICY.cabinClass.ECONOMY.roles;
  const isEconomyOnly = economyOnlyRoles.includes(role);

  if (isEconomyOnly && cabinCode !== 'Y' && cabinCode !== 'W') {
    flags.push('cabin_violation');
  }

  // Price check: determine route type for budget cap
  const routeType = getRouteType(flight.origin, flight.destination);
  const cap = routeType === 'LONG_HAUL'
    ? POLICY.flightBudgetCap.LONG_HAUL.amount
    : POLICY.flightBudgetCap.SHORT_HAUL.amount;

  if (flight.price && flight.price.amount > cap) {
    flags.push('budget_exceeded');
  }

  return flags;
}

// Map a mock_inventory flight object to the PRD FlightResult schema
function toFlightResult(flight, idx) {
  const cabinLabel = mapCabinLabel(flight.cabin_class);
  const priceUSD = flight.price
    ? Math.round(flight.price.amount / 35)  // rough THB→USD
    : 0;

  return {
    flightId: `FL-${String(idx + 1).padStart(3, '0')}`,
    airline: flight.airline,
    origin: flight.origin,
    destination: flight.destination,
    departureDate: flight.departure_datetime
      ? flight.departure_datetime.split(' ')[0]
      : 'TBD',
    cabinClass: cabinLabel,
    price: priceUSD,
    policyCompliant: flight.is_compliant || false,
    policyFlags: [],  // populated below
  };
}

router.post('/', validateSearch, (req, res, next) => {
  try {
    const { query, role, date } = req.body;
    const { origin, destination } = extractAirports(query);
    const cabinCode = extractCabinClass(query);

    let rawFlights;
    if (process.env.USE_MOCK === 'true') {
      rawFlights = getMockFlights(origin, destination, date, cabinCode);
    } else {
      // Live mode: attempt Gemini agent, fall back to mock on any error
      try {
        // Dynamic require so server starts without GEMINI_API_KEY in mock mode
        const agent = require('../../agent');
        // agent.js is designed for Telegram, so we fall back to mock for web API
        throw new Error('agent.js not adapted for web API — using mock fallback');
      } catch (agentErr) {
        console.warn(`[WARN] Falling back to mock: ${agentErr.message}`);
        rawFlights = getMockFlights(origin, destination, date, cabinCode);
      }
    }

    const results = rawFlights.map((f, idx) => {
      const result = toFlightResult(f, idx);
      result.policyFlags = computePolicyFlags(f, role);
      result.policyCompliant = result.policyFlags.length === 0 && (f.is_compliant !== false);
      return result;
    });

    const aggregatedFlags = [...new Set(results.flatMap(r => r.policyFlags))];

    res.json({
      status: 'ok',
      data: results,
      policyFlags: aggregatedFlags,
      error: null,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
