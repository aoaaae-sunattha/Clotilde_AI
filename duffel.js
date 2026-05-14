// duffel.js
// Real flight search via Duffel API.
// Called by nlg.js when the NLU returns a specific YYYY-MM-DD departure date.
// Falls back to mock_inventory.js when date is vague or API is unavailable.
// Hotels remain mocked — Duffel is flights only.

const fetch = require('node-fetch');
const POLICY = require('./policy.js');

const DUFFEL_BASE    = 'https://api.duffel.com';
const DUFFEL_VERSION = 'v2';

// Hardcoded FX rates → THB (update periodically for accuracy)
const FX_TO_THB = {
  THB: 1,
  USD: 35,
  EUR: 38,
  GBP: 44,
  SGD: 26,
  JPY: 0.23,
};

// Duffel sandbox test airline — never shows in real results
const TEST_AIRLINE_CODES = new Set(['ZZ']);

// Cabin class mapping: IATA code → Duffel label
const CABIN_TO_DUFFEL = {
  Y: 'economy',
  W: 'premium_economy',
  C: 'business',
  F: 'first',
};

// ── Parse ISO 8601 duration → minutes (e.g. "PT6H30M" → 390) ─────────────────
function parseDurationMinutes(iso) {
  if (!iso) return 0;
  const h = parseInt((iso.match(/(\d+)H/) || [0, 0])[1]);
  const m = parseInt((iso.match(/(\d+)M/) || [0, 0])[1]);
  return h * 60 + m;
}

// ── Format ISO datetime → "YYYY-MM-DD HH:MM" ─────────────────────────────────
function fmt(iso) {
  if (!iso) return 'TBD';
  return iso.replace('T', ' ').substring(0, 16);
}

// ── Search flights ────────────────────────────────────────────────────────────
async function searchFlights(origin, destination, departureDate, cabinClass = 'Y') {
  const token = process.env.DUFFEL_API_KEY;
  if (!token) throw new Error('DUFFEL_API_KEY not set in .env');

  origin      = (origin      || 'BKK').toUpperCase();
  destination = (destination || 'SIN').toUpperCase();
  cabinClass  = (cabinClass  || 'Y').toUpperCase();

  const duffelCabin = CABIN_TO_DUFFEL[cabinClass] || 'economy';

  const res = await fetch(`${DUFFEL_BASE}/air/offer_requests?return_offers=true`, {
    method:  'POST',
    headers: {
      'Authorization':  `Bearer ${token}`,
      'Duffel-Version': DUFFEL_VERSION,
      'Content-Type':   'application/json',
      'Accept':         'application/json',
    },
    body: JSON.stringify({
      data: {
        slices:      [{ origin, destination, departure_date: departureDate }],
        passengers:  [{ type: 'adult' }],
        cabin_class: duffelCabin,
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Duffel ${res.status}: ${errText}`);
  }

  const json   = await res.json();
  const offers = json.data?.offers || [];

  console.log(`[DUFFEL] ${offers.length} offers returned for ${origin}→${destination} on ${departureDate}`);

  // Filter out Duffel sandbox test airline (ZZ / "Duffel Airways") — not a real carrier
  const real = offers.filter(offer => {
    const firstSeg = offer.slices?.[0]?.segments?.[0];
    const code     = firstSeg?.marketing_carrier?.iata_code || '';
    return !TEST_AIRLINE_CODES.has(code);
  });

  // Sort by price, take top 3 to keep the NLG prompt manageable
  const top3 = real
    .sort((a, b) => parseFloat(a.total_amount) - parseFloat(b.total_amount))
    .slice(0, 3);

  return top3.map(offer => mapOffer(offer, cabinClass));
}

// ── Map a Duffel offer to Clotilde's flight schema ────────────────────────────
function mapOffer(offer, cabinClass) {
  const slice   = offer.slices?.[0];
  const seg     = slice?.segments?.[0];
  const carrier = seg?.marketing_carrier || {};

  const durationMins = parseDurationMinutes(slice?.duration);
  const isShortHaul  = durationMins <= POLICY.flightBudgetCap.SHORT_HAUL.maxHours * 60;

  const price    = parseFloat(offer.total_amount);
  const currency = offer.total_currency;

  // Convert to THB for policy comparison (hardcoded rates — update periodically)
  const rate     = FX_TO_THB[currency] ?? null;
  const priceTHB = rate !== null ? Math.round(price * rate) : null;
  const cap      = isShortHaul ? POLICY.flightBudgetCap.SHORT_HAUL : POLICY.flightBudgetCap.LONG_HAUL;

  const is_compliant = priceTHB !== null ? priceTHB <= cap.amount : null;

  const fxNote = currency !== 'THB' && rate !== null
    ? ` (≈ ${priceTHB.toLocaleString()} THB at ${rate} THB/${currency} — hardcoded rate)`
    : '';

  const compliance_notes = is_compliant === null
    ? `${price} ${currency} — no FX rate available, manual review needed`
    : is_compliant
      ? `${price} ${currency}${fxNote} — within ${cap.amount.toLocaleString()} THB cap`
      : `${price} ${currency}${fxNote} — EXCEEDS ${cap.amount.toLocaleString()} THB cap. Business justification required.`;

  const preferredEntry = POLICY.preferredAirlines.find(a => a.code === carrier.iata_code);

  return {
    offer_id:           offer.id,
    flight_number:      `${carrier.iata_code || '??'}${seg?.marketing_carrier_flight_number || ''}`,
    airline:            carrier.name || 'Unknown',
    airline_code:       carrier.iata_code || '??',
    origin:             seg?.origin?.iata_code      || '',
    destination:        seg?.destination?.iata_code || '',
    departure_datetime: fmt(seg?.departing_at),
    arrival_datetime:   fmt(seg?.arriving_at),
    duration_minutes:   durationMins,
    stops:              (slice?.segments?.length ?? 1) - 1,
    cabin_class:        cabinClass,
    price:              { amount: price, currency },
    refundable:         offer.conditions?.refund_before_departure?.allowed  ?? false,
    changeable:         offer.conditions?.change_before_departure?.allowed  ?? false,
    change_fee:         null,
    baggage_allowance:  (() => {
      const pax      = seg?.passengers?.[0];
      const baggages = pax?.baggages || [];
      const checked  = baggages.filter(b => b.type === 'checked');
      return checked.length > 0
        ? { checked_bags: checked.reduce((s, b) => s + (b.quantity || 1), 0), weight_kg: 23 }
        : { checked_bags: 0, weight_kg: 0 };
    })(),
    status:             'HK',
    is_preferred:       !!preferredEntry,
    preferred_reason:   preferredEntry?.reason || null,
    is_compliant,
    compliance_notes,
    source:             'duffel_live',
  };
}

module.exports = { searchFlights };
