// mock_inventory.js
// Simulates GDS inventory responses with policy compliance flags.
// In production this would be a live call to Amadeus or Sabre.
// For the demo: returns realistic mock data that proves the policy engine works.
// QA note: every result has is_compliant and is_preferred — these are the fields
// the QA layer validates against policy rules.

const POLICY = require('./policy.js');

// ── City name → airport disambiguation ───────────────────────────────────────
// When NLU returns a city name instead of an IATA code, suggest the correct airport.
// CITY_TO_AIRPORT intentionally empty — Gemini resolves all city/airport names
// using its own knowledge base. Only kept for backward compatibility with Nlg.js.
const CITY_TO_AIRPORT = {};

// ── Route type classification ─────────────────────────────────────────────────
const THAI_AIRPORTS = new Set([
  // Major hubs
  'BKK','DMK',
  // North
  'CNX','CEI','LPT','PHS','UTH','NAW',
  // South
  'HKT','USM','KBV','HDY','NST','TST','CJM',
  // East / Northeast
  'UBP','UTP','KKC','BFV','SNO',
  // Other
  'URT',
]);

// Regional Thai airports that require a BKK hub connection for long-haul
const THAI_REGIONAL = new Set(['CNX','HKT','USM','KBV','CEI','UTP','NST','HDY']);

// Approximate direct flight duration in minutes from BKK
const DURATION_FROM_BKK = {
  LAX: 1020, JFK: 1050, SFO: 1020, ORD: 1080, MIA: 1080, SEA: 1020,
  LHR: 690,  LGW: 690,  CDG: 660,  FRA: 660,  AMS: 660,  ZRH: 660,
  SYD: 540,  MEL: 570,  BNE: 540,
  DXB: 370,  AUH: 380,
  NRT: 390,  HND: 390,  KIX: 370,  ICN: 360,
  HKG: 145,  PVG: 195,  PEK: 225,
  SIN: 150,  KUL: 150,
};

// Feeder leg duration from regional Thai airport to BKK
const REGIONAL_TO_BKK = {
  CNX: 65, HKT: 80, USM: 80, KBV: 75, CEI: 75, UTP: 45, NST: 70, HDY: 80,
};

function getRealisticDuration(origin, destination, routeType) {
  if (routeType === 'DOMESTIC') return 75;
  if (origin === 'BKK' || origin === 'DMK') return DURATION_FROM_BKK[destination] || (routeType === 'LONG_HAUL' ? 600 : 150);
  if (destination === 'BKK' || destination === 'DMK') return DURATION_FROM_BKK[origin] || (routeType === 'LONG_HAUL' ? 600 : 150);
  if (THAI_REGIONAL.has(origin) && routeType === 'LONG_HAUL')
    return (REGIONAL_TO_BKK[origin] || 70) + 90 + (DURATION_FROM_BKK[destination] || 600);
  if (THAI_REGIONAL.has(destination) && routeType === 'LONG_HAUL')
    return (DURATION_FROM_BKK[origin] || 600) + 90 + (REGIONAL_TO_BKK[destination] || 70);
  return DURATION_FROM_BKK[destination] || DURATION_FROM_BKK[origin] || 150;
}

// Add minutes to a "YYYY-MM-DD HH:MM" string; handles day rollover
function addMinutesToDateTime(dt, mins) {
  if (!dt || dt.startsWith('TBD')) return dt;
  const [date, time] = dt.split(' ');
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + mins;
  const days  = Math.floor(total / 1440);
  const rem   = total % 1440;
  const nh    = Math.floor(rem / 60);
  const nm    = rem % 60;
  const pad   = n => String(n).padStart(2, '0');
  if (days === 0) return `${date} ${pad(nh)}:${pad(nm)}`;
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return `${d.toISOString().split('T')[0]} ${pad(nh)}:${pad(nm)}`;
}

// Enrich flights with realistic duration, stops, and segments
function enrichFlights(flights, origin, destination, routeType) {
  const needsHubOut = routeType === 'LONG_HAUL' && THAI_REGIONAL.has(origin);
  const needsHubIn  = routeType === 'LONG_HAUL' && THAI_REGIONAL.has(destination);
  const layover     = 90;

  return flights.map((f, idx) => {
    const totalDuration = getRealisticDuration(origin, destination, routeType);
    const arrivalDt     = addMinutesToDateTime(f.departure_datetime, totalDuration);

    if (!needsHubOut && !needsHubIn) {
      return { ...f, duration_minutes: totalDuration, arrival_datetime: arrivalDt, stops: 0, segments: [] };
    }

    if (needsHubOut) {
      // Outbound: regional Thai airport → BKK → long-haul destination  (e.g. CNX → BKK → LAX)
      const feederMins = REGIONAL_TO_BKK[origin] || 70;
      const mainMins   = DURATION_FROM_BKK[destination] || 600;

      const feederDep = f.departure_datetime;
      const feederArr = addMinutesToDateTime(feederDep, feederMins);
      const mainDep   = addMinutesToDateTime(feederArr, layover);
      const mainArr   = addMinutesToDateTime(mainDep, mainMins);

      return {
        ...f,
        duration_minutes:   totalDuration,
        departure_datetime: feederDep,
        arrival_datetime:   mainArr,
        stops: 1,
        via:   'BKK',
        segments: [
          {
            from:             origin,
            to:               'BKK',
            airline:          'Thai Airways',
            flight_number:    `TG${100 + idx * 13}`,
            duration_minutes: feederMins,
            departure:        feederDep,
            arrival:          feederArr,
          },
          {
            from:             'BKK',
            to:               destination,
            airline:          f.airline,
            flight_number:    f.flight_number,
            duration_minutes: mainMins,
            departure:        mainDep,
            arrival:          mainArr,
          },
        ],
      };
    }

    // Inbound: long-haul origin → BKK → regional Thai airport  (e.g. LAX → BKK → CNX)
    const mainMins   = DURATION_FROM_BKK[origin] || 600;
    const feederMins = REGIONAL_TO_BKK[destination] || 70;

    const mainDep   = f.departure_datetime;
    const mainArr   = addMinutesToDateTime(mainDep, mainMins);
    const feederDep = addMinutesToDateTime(mainArr, layover);
    const feederArr = addMinutesToDateTime(feederDep, feederMins);

    return {
      ...f,
      duration_minutes:   totalDuration,
      departure_datetime: mainDep,
      arrival_datetime:   feederArr,
      stops: 1,
      via:   'BKK',
      segments: [
        {
          from:             origin,
          to:               'BKK',
          airline:          f.airline,
          flight_number:    f.flight_number,
          duration_minutes: mainMins,
          departure:        mainDep,
          arrival:          mainArr,
        },
        {
          from:             'BKK',
          to:               destination,
          airline:          'Thai Airways',
          flight_number:    `TG${100 + idx * 13}`,
          duration_minutes: feederMins,
          departure:        feederDep,
          arrival:          feederArr,
        },
      ],
    };
  });
}

const LONG_HAUL_AIRPORTS = new Set([
  'LHR','LGW','LCY','LTN','STN','MAN',           // UK
  'CDG','ORY',                                    // France
  'FRA','MUC',                                    // Germany
  'AMS','ZRH',                                    // Europe
  'JFK','LAX','SFO','ORD','MIA','SEA',            // USA
  'SYD','MEL','BNE',                              // Australia
]);

function getRouteType(origin, destination) {
  const isDomestic  = THAI_AIRPORTS.has(origin) && THAI_AIRPORTS.has(destination);
  const isLongHaul  = LONG_HAUL_AIRPORTS.has(origin) || LONG_HAUL_AIRPORTS.has(destination);
  if (isDomestic)  return 'DOMESTIC';
  if (isLongHaul)  return 'LONG_HAUL';
  return 'REGIONAL'; // international but within Asia
}

// Known IATA airport codes the mock can serve (expand as needed for demos)
const KNOWN_AIRPORTS = new Set([
  'BKK','DMK','CNX','HKT','USM','KBV','CEI','NST','URT','UBP','UTP',  // Thailand
  'SIN',                                                          // Singapore
  'KUL','PEN',                                                    // Malaysia
  'CGK','DPS',                                                    // Indonesia
  'MNL',                                                          // Philippines
  'SGN','HAN',                                                    // Vietnam
  'RGN',                                                          // Myanmar
  'PNH',                                                          // Cambodia
  'VTE',                                                          // Laos
  'HKG',                                                          // Hong Kong
  'NRT','KIX','NGO','FUK','CTS','OKA',                           // Japan
  'ICN','GMP','PUS',                                              // South Korea
  'PEK','PVG','CAN','CTU','SZX',                                  // China
  'DEL','BOM','MAA','BLR',                                        // India
  'DXB','AUH',                                                    // UAE
  'DOH',                                                          // Qatar
  'LHR','LGW','LCY','LTN','STN','MAN',                           // UK
  'CDG','ORY',                                                    // France
  'FRA','MUC',                                                    // Germany
  'AMS',                                                          // Netherlands
  'ZRH',                                                          // Switzerland
  'JFK','LAX','SFO','ORD','MIA','SEA',                           // USA
  'SYD','MEL','BNE',                                              // Australia
]);

// ── Mock flight search ────────────────────────────────────────────────────────
function getMockFlights(origin, destination, departureDate, cabinClass = 'Y') {
  origin      = (origin      || 'BKK').toUpperCase();
  destination = (destination || 'SIN').toUpperCase();
  cabinClass  = (cabinClass  || 'Y').toUpperCase();

  // Must know route type early — affects cabin cap and prices
  const routeType = getRouteType(origin, destination);

  // Domestic Thai routes only have Economy — cap cabin class
  if (routeType === 'DOMESTIC' && cabinClass !== 'Y') cabinClass = 'Y';

  // Return empty if either airport is not a recognised IATA code
  if (!KNOWN_AIRPORTS.has(origin) || !KNOWN_AIRPORTS.has(destination)) return [];
  if (origin === destination) return [];

  // Show TBD for vague/missing dates instead of "relative"
  const dateLabel = (departureDate && departureDate !== 'relative') ? departureDate : 'TBD';

  const preferred  = POLICY.preferredAirlines;
  const cap        = POLICY.flightBudgetCap;
  // Use the correct budget cap for this route type
  const activeCap  = routeType === 'LONG_HAUL' ? cap.LONG_HAUL : cap.SHORT_HAUL;

  // Route-aware one-way Economy prices (THB)
  // LONG_HAUL prices are realistic multi-hour fares; REGIONAL are Asia hops; DOMESTIC are Thai internal
  const prices = routeType === 'LONG_HAUL'
    ? { eco1: 13500, eco2: 14200, budget: 9800,  premium: 52000 }
    : routeType === 'DOMESTIC'
      ? { eco1: 1800,  eco2: 2400,  budget: 900,   premium: 8500  }
      : { eco1: 4200,  eco2: 5800,  budget: 2100,  premium: 28000 }; // REGIONAL

  const allFlights = [
    {
      flight_number:      `${preferred[0].code}408`,
      airline:            preferred[0].name,
      airline_code:       preferred[0].code,
      origin,
      destination,
      departure_datetime: `${dateLabel} 08:30`,
      arrival_datetime:   `${dateLabel} 12:05`,
      duration_minutes:   155,
      cabin_class:        cabinClass,
      fare_basis:         'YLOWTH',
      price:              { amount: prices.eco1, currency: 'THB' },
      refundable:         false,
      changeable:         true,
      change_fee:         { amount: 1500, currency: 'THB' },
      baggage_allowance:  { checked_bags: 1, weight_kg: 20 },
      status:             'HK',
      is_preferred:       true,
      preferred_reason:   preferred[0].reason,
      is_compliant:       prices.eco1 <= activeCap.amount,
      compliance_notes:   `${prices.eco1.toLocaleString()} THB — ${prices.eco1 <= activeCap.amount
        ? `within ${activeCap.amount.toLocaleString()} THB cap`
        : `EXCEEDS ${activeCap.amount.toLocaleString()} THB cap`}`,
    },
    {
      flight_number:      `${preferred[1].code}231`,
      airline:            preferred[1].name,
      airline_code:       preferred[1].code,
      origin,
      destination,
      departure_datetime: `${dateLabel} 10:45`,
      arrival_datetime:   `${dateLabel} 14:25`,
      duration_minutes:   160,
      cabin_class:        cabinClass,
      fare_basis:         'YFLEXTH',
      price:              { amount: prices.eco2, currency: 'THB' },
      refundable:         true,
      changeable:         true,
      change_fee:         { amount: 0, currency: 'THB' },
      baggage_allowance:  { checked_bags: 1, weight_kg: 20 },
      status:             'HK',
      is_preferred:       true,
      preferred_reason:   preferred[1].reason,
      is_compliant:       prices.eco2 <= activeCap.amount,
      compliance_notes:   prices.eco2 <= activeCap.amount
        ? `${prices.eco2.toLocaleString()} THB — within ${activeCap.amount.toLocaleString()} THB cap`
        : `${prices.eco2.toLocaleString()} THB — EXCEEDS ${activeCap.amount.toLocaleString()} THB cap`,
    },
    {
      flight_number:      'FD3210',
      airline:            'Thai AirAsia',
      airline_code:       'FD',
      origin,
      destination,
      departure_datetime: `${dateLabel} 06:00`,
      arrival_datetime:   `${dateLabel} 09:35`,
      duration_minutes:   155,
      cabin_class:        cabinClass,
      fare_basis:         'VBASIC',
      price:              { amount: prices.budget, currency: 'THB' },
      refundable:         false,
      changeable:         false,
      change_fee:         null,
      baggage_allowance:  { checked_bags: 0, weight_kg: 0 },
      status:             'HK',
      is_preferred:       false,
      preferred_reason:   null,
      is_compliant:       prices.budget <= activeCap.amount,
      compliance_notes:   `${prices.budget.toLocaleString()} THB — within cap. Note: non-preferred carrier. No checked baggage.`,
    },
    // ── OUT-OF-POLICY demo option (for QA testing) ──────────────────────────
    // Emirates Business Class: preferred airline but far exceeds long-haul cap.
    // Demonstrates PREFERRED & OUT-OF-POLICY edge case.
    {
      flight_number:      `${preferred[2].code}371`,
      airline:            preferred[2].name,
      airline_code:       preferred[2].code,
      origin,
      destination,
      departure_datetime: `${dateLabel} 23:55`,
      arrival_datetime:   `${dateLabel} 06:30+1`,
      duration_minutes:   515,
      cabin_class:        'C',
      fare_basis:         'CBIZTH',
      price:              { amount: prices.premium, currency: 'THB' },
      refundable:         true,
      changeable:         true,
      change_fee:         { amount: 0, currency: 'THB' },
      baggage_allowance:  { checked_bags: 2, weight_kg: 32 },
      status:             'HK',
      is_preferred:       true,
      preferred_reason:   preferred[2].reason,
      is_compliant:       prices.premium <= cap.LONG_HAUL.amount,
      compliance_notes:   `${prices.premium.toLocaleString()} THB — EXCEEDS ${cap.LONG_HAUL.amount.toLocaleString()} THB long-haul cap. ` +
                          `Business class not permitted for standard employees. Business justification required.`,
    },
  ];

  // ── Filter airlines by route type ──────────────────────────────────────────
  const filtered = allFlights.filter(f => {
    if (routeType === 'DOMESTIC') {
      // Domestic Thai routes: only carriers that actually operate within Thailand
      // TG (Thai Airways) and FD (AirAsia) serve domestic routes; SQ and EK do not
      return ['TG', 'FD', 'DD', 'PG'].includes(f.airline_code);
    }
    if (routeType === 'REGIONAL') {
      // Regional Asia: TG, SQ, FD — no long-haul carriers like EK
      return ['TG', 'SQ', 'FD'].includes(f.airline_code);
    }
    // LONG_HAUL: all carriers valid; remove AirAsia (no long-haul service)
    return f.airline_code !== 'FD';
  });

  // Sort: in-policy first (preferred within), then out-of-policy at end
  filtered.sort((a, b) => {
    if (a.is_compliant && !b.is_compliant) return -1;
    if (!a.is_compliant && b.is_compliant) return 1;
    if (a.is_preferred && !b.is_preferred) return -1;
    if (!a.is_preferred && b.is_preferred) return 1;
    return a.price.amount - b.price.amount;
  });

  return enrichFlights(filtered, origin, destination, routeType);
}

// ── Mock hotel search ─────────────────────────────────────────────────────────
function getMockHotels(city, checkinDate, checkoutDate) {
  city = (city || 'BKK').toUpperCase();
  const cap = POLICY.hotelBudgetCap[city] || POLICY.hotelBudgetCap.DEFAULT;

  const allHotels = [
    {
      hotel_id:       'BKK001',
      name:           'Courtyard by Marriott Bangkok',
      city,
      star_rating:    4,
      checkin_date:   checkinDate  || 'TBD',
      checkout_date:  checkoutDate || 'TBD',
      room_type:      'Standard King',
      price_per_night:{ amount: 3200, currency: cap.currency },
      amenities:      ['WiFi', 'Breakfast included', 'Gym', 'Pool'],
      is_preferred:   false,
      preferred_reason: null,
      is_compliant:   3200 <= cap.amount,
      compliance_notes: `3,200 ${cap.currency} — within ${cap.amount} ${cap.currency} cap`,
    },
    {
      hotel_id:       'BKK002',
      name:           'Novotel Bangkok Sukhumvit 20',
      city,
      star_rating:    4,
      checkin_date:   checkinDate  || 'TBD',
      checkout_date:  checkoutDate || 'TBD',
      room_type:      'Superior Room',
      price_per_night:{ amount: 2800, currency: cap.currency },
      amenities:      ['WiFi', 'Pool', 'Fitness Center'],
      is_preferred:   true,
      preferred_reason: 'Company preferred hotel partner — corporate rate applied',
      is_compliant:   2800 <= cap.amount,
      compliance_notes: `2,800 ${cap.currency} — within ${cap.amount} ${cap.currency} cap. Preferred partner rate.`,
    },
    {
      hotel_id:       'BKK003',
      name:           'Mandarin Oriental Bangkok',
      city,
      star_rating:    5,
      checkin_date:   checkinDate  || 'TBD',
      checkout_date:  checkoutDate || 'TBD',
      room_type:      'Deluxe River View',
      price_per_night:{ amount: 12000, currency: cap.currency },
      amenities:      ['WiFi', 'Breakfast', 'Spa', 'River View', 'Butler Service'],
      is_preferred:   false,
      preferred_reason: null,
      is_compliant:   12000 <= cap.amount,
      compliance_notes: `12,000 ${cap.currency} — EXCEEDS ${cap.amount} ${cap.currency} cap. OUT-OF-POLICY. Business justification required.`,
    },
  ];

  // Sort: preferred first, then compliant, then by price
  allHotels.sort((a, b) => {
    if (a.is_preferred && !b.is_preferred) return -1;
    if (!a.is_preferred && b.is_preferred) return 1;
    if (a.is_compliant && !b.is_compliant) return -1;
    if (!a.is_compliant && b.is_compliant) return 1;
    return a.price_per_night.amount - b.price_per_night.amount;
  });

  return allHotels;
}

// ── Generate mock GDS booking payload ────────────────────────────────────────
// This is what would be sent to Amadeus/Sabre on booking confirmation.
// Logged to the QA panel terminal to demonstrate integration awareness.
function buildGDSPayload(flight, travelerName = 'SMITH/JAMES') {
  return {
    pnr:              null,
    booking_status:   'PENDING',
    created_at:       new Date().toISOString(),
    ticketing_time_limit: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    traveler: {
      name_as_booked:   travelerName,
      passport_number:  '***MASKED***',
      nationality:      'TH',
    },
    segment: {
      flight_number:    flight.flight_number,
      origin:           flight.origin,
      destination:      flight.destination,
      departure:        flight.departure_datetime,
      arrival:          flight.arrival_datetime,
      cabin_class:      flight.cabin_class,
      fare_basis:       flight.fare_basis,
      status:           flight.status,
      baggage:          flight.baggage_allowance,
    },
    fare: {
      base_fare:    flight.price,
      taxes: [
        { code: 'YQ', amount: 850,  currency: 'THB', description: 'Fuel surcharge' },
        { code: 'TH', amount: 120,  currency: 'THB', description: 'Thai airport tax' },
      ],
      total_fare: {
        amount:   flight.price.amount + 850 + 120,
        currency: 'THB',
      },
      refundable:   flight.refundable,
      changeable:   flight.changeable,
      change_fee:   flight.change_fee,
    },
    policy_check: {
      is_compliant:     flight.is_compliant,
      is_preferred:     flight.is_preferred,
      compliance_notes: flight.compliance_notes,
    },
  };
}

module.exports = { getMockFlights, getMockHotels, buildGDSPayload, CITY_TO_AIRPORT, getRouteType, THAI_REGIONAL, REGIONAL_TO_BKK, addMinutesToDateTime };
