// test_policy.js
// Policy boundary value tests — 5 Pillars: Pillar 2 (Policy Compliance)
// Run with: node test_policy.js
//
// Tests every rule in policy.js at exact boundary values (cap, cap-1, cap+1).
// QA note: run this after ANY change to policy.js or mock_inventory.js.

const POLICY = require('./policy.js');
const { getMockFlights, getMockHotels } = require('./mock_inventory.js');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    const result = fn();
    if (result === true) {
      console.log(`  ✅ ${name}`);
      passed++;
    } else {
      console.log(`  ❌ ${name}`);
      if (result !== false) console.log(`     → ${result}`);
      failed++;
    }
  } catch (e) {
    console.log(`  ❌ ${name} — threw: ${e.message}`);
    failed++;
  }
}

function section(title) {
  console.log(`\n  ── ${title} ${'─'.repeat(50 - title.length)}`);
}

console.log('\n' + '═'.repeat(60));
console.log('  CLOTILDE — POLICY BOUNDARY VALUE TESTS');
console.log('  Testing every rule in policy.js at exact limits');
console.log('═'.repeat(60));

// ═══════════════════════════════════════════════════════════
// 1. HOTEL BUDGET CAPS — boundary: amount, amount-1, amount+1
// ═══════════════════════════════════════════════════════════
section('Hotel Budget Caps');

function hotelCompliance(city, priceAmount, currency) {
  const cap = POLICY.hotelBudgetCap[city] || POLICY.hotelBudgetCap.DEFAULT;
  if (cap.currency !== currency) return null; // currency mismatch — manual review
  return priceAmount <= cap.amount;
}

for (const [city, cap] of Object.entries(POLICY.hotelBudgetCap)) {
  if (city === 'DEFAULT') continue;
  test(`Hotel ${city}: price == cap (${cap.amount} ${cap.currency}) → IN-POLICY`, () =>
    hotelCompliance(city, cap.amount, cap.currency) === true
  );
  test(`Hotel ${city}: price == cap-1 (${cap.amount - 1} ${cap.currency}) → IN-POLICY`, () =>
    hotelCompliance(city, cap.amount - 1, cap.currency) === true
  );
  test(`Hotel ${city}: price == cap+1 (${cap.amount + 1} ${cap.currency}) → OUT-OF-POLICY`, () =>
    hotelCompliance(city, cap.amount + 1, cap.currency) === false
  );
}

test('Hotel DEFAULT: price == 200 USD → IN-POLICY', () =>
  hotelCompliance('DEFAULT', 200, 'USD') === true
);
test('Hotel DEFAULT: price == 201 USD → OUT-OF-POLICY', () =>
  hotelCompliance('DEFAULT', 201, 'USD') === false
);

// ═══════════════════════════════════════════════════════════
// 2. FLIGHT BUDGET CAPS
// ═══════════════════════════════════════════════════════════
section('Flight Budget Caps');

function flightCompliance(amount, routeType) {
  const cap = routeType === 'LONG_HAUL'
    ? POLICY.flightBudgetCap.LONG_HAUL
    : POLICY.flightBudgetCap.SHORT_HAUL;
  return amount <= cap.amount;
}

const sc = POLICY.flightBudgetCap.SHORT_HAUL;
const lc = POLICY.flightBudgetCap.LONG_HAUL;

test(`Flight SHORT_HAUL: price == cap (${sc.amount} THB) → IN-POLICY`, () =>
  flightCompliance(sc.amount, 'SHORT_HAUL') === true
);
test(`Flight SHORT_HAUL: price == cap-1 → IN-POLICY`, () =>
  flightCompliance(sc.amount - 1, 'SHORT_HAUL') === true
);
test(`Flight SHORT_HAUL: price == cap+1 → OUT-OF-POLICY`, () =>
  flightCompliance(sc.amount + 1, 'SHORT_HAUL') === false
);
test(`Flight LONG_HAUL: price == cap (${lc.amount} THB) → IN-POLICY`, () =>
  flightCompliance(lc.amount, 'LONG_HAUL') === true
);
test(`Flight LONG_HAUL: price == cap+1 → OUT-OF-POLICY`, () =>
  flightCompliance(lc.amount + 1, 'LONG_HAUL') === false
);

// ═══════════════════════════════════════════════════════════
// 3. CABIN CLASS RULES
// ═══════════════════════════════════════════════════════════
section('Cabin Class by Role');

function cabinAllowed(role, cabin) {
  for (const rule of Object.values(POLICY.cabinClass)) {
    if (rule.roles && rule.roles.includes(role)) {
      return rule.allowed.includes(cabin);
    }
  }
  return POLICY.cabinClass.DEFAULT.allowed.includes(cabin);
}

test('Operations → Economy (Y) → ALLOWED', () =>
  cabinAllowed('Operations', 'Y') === true
);
test('Operations → Business (C) → DENIED', () =>
  cabinAllowed('Operations', 'C') === false
);
test('Staff → Economy (Y) → ALLOWED', () =>
  cabinAllowed('Staff', 'Y') === true
);
test('Staff → Business (C) → DENIED', () =>
  cabinAllowed('Staff', 'C') === false
);
test('Manager → Economy (Y) → ALLOWED', () =>
  cabinAllowed('Manager', 'Y') === true
);
test('Manager → Business (C) → DENIED', () =>
  cabinAllowed('Manager', 'C') === false
);
test('Director → Business (C) → ALLOWED', () =>
  cabinAllowed('Director', 'C') === true
);
test('Director → Economy (Y) → ALLOWED', () =>
  cabinAllowed('Director', 'Y') === true
);
test('VP → Business (C) → ALLOWED', () =>
  cabinAllowed('VP', 'C') === true
);
test('C-Suite → Business (C) → ALLOWED', () =>
  cabinAllowed('C-Suite', 'C') === true
);

// ═══════════════════════════════════════════════════════════
// 4. ADVANCE BOOKING RULE
// ═══════════════════════════════════════════════════════════
section('Advance Booking Days');

function advanceBookingOk(departureDateStr) {
  const today     = new Date();
  today.setHours(0, 0, 0, 0);
  const departure = new Date(departureDateStr);
  const diffDays  = Math.floor((departure - today) / (1000 * 60 * 60 * 24));
  return diffDays >= POLICY.advanceBookingDays;
}

const today = new Date();
function daysFromToday(n) {
  const d = new Date(today);
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

test(`Advance booking: ${POLICY.advanceBookingDays} days ahead → OK`, () =>
  advanceBookingOk(daysFromToday(POLICY.advanceBookingDays)) === true
);
test(`Advance booking: ${POLICY.advanceBookingDays + 1} days ahead → OK`, () =>
  advanceBookingOk(daysFromToday(POLICY.advanceBookingDays + 1)) === true
);
test(`Advance booking: ${POLICY.advanceBookingDays - 1} days ahead → REQUIRES APPROVAL`, () =>
  advanceBookingOk(daysFromToday(POLICY.advanceBookingDays - 1)) === false
);
test('Advance booking: same day → REQUIRES APPROVAL', () =>
  advanceBookingOk(daysFromToday(0)) === false
);

// ═══════════════════════════════════════════════════════════
// 5. PREFERRED AIRLINE RANKING (via mock_inventory)
// ═══════════════════════════════════════════════════════════
section('Preferred Airline Ranking');

test('First result from getMockFlights is a preferred airline', () => {
  const flights = getMockFlights('BKK', 'SIN', '2026-06-01', 'Y');
  if (!flights.length) return 'No flights returned';
  return flights[0].is_preferred === true
    ? true
    : `First result is ${flights[0].airline} — not preferred`;
});

test('All preferred airlines appear in results (LONG_HAUL BKK→LHR)', () => {
  // Emirates only operates LONG_HAUL routes — use BKK→LHR where all 3 preferred airlines appear
  const flights   = getMockFlights('BKK', 'LHR', '2026-06-01', 'Y');
  const preferred = POLICY.preferredAirlines.map(a => a.code);
  const inResults = flights.filter(f => f.is_preferred).map(f => f.airline_code);
  const missing   = preferred.filter(code => !inResults.includes(code));
  return missing.length === 0
    ? true
    : `Missing preferred airlines in results: ${missing.join(', ')}`;
});

test('is_preferred field present on all results', () => {
  const flights = getMockFlights('BKK', 'SIN', '2026-06-01', 'Y');
  const missing = flights.filter(f => f.is_preferred === undefined);
  return missing.length === 0
    ? true
    : `${missing.length} result(s) missing is_preferred field`;
});

test('is_compliant field present on all results', () => {
  const flights = getMockFlights('BKK', 'SIN', '2026-06-01', 'Y');
  const missing = flights.filter(f => f.is_compliant === undefined);
  return missing.length === 0
    ? true
    : `${missing.length} result(s) missing is_compliant field`;
});

test('Out-of-policy option (Business Class premium) is flagged is_compliant: false (LONG_HAUL BKK→LHR)', () => {
  // Emirates Business Class is only in LONG_HAUL results and exceeds the long-haul cap
  const flights    = getMockFlights('BKK', 'LHR', '2026-06-01', 'C');
  const bizFlights = flights.filter(f => f.cabin_class === 'C' && f.price.amount > lc.amount);
  if (!bizFlights.length) return 'No over-budget Business Class option found on BKK→LHR — check mock_inventory';
  const allFlagged = bizFlights.every(f => f.is_compliant === false);
  return allFlagged ? true : 'Over-budget Business Class not flagged as is_compliant: false';
});

// ═══════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════
const total = passed + failed;
const pct   = total > 0 ? ((passed / total) * 100).toFixed(1) : '0.0';

console.log('\n' + '═'.repeat(60));
console.log(`  RESULTS: ${passed}/${total} passed (${pct}%)`);

const verdict = parseFloat(pct) === 100
  ? '\n  🟢 VERDICT: ALL POLICY RULES VERIFIED'
  : parseFloat(pct) >= 80
  ? `\n  🟡 VERDICT: NEEDS ATTENTION (${failed} rule(s) failing)`
  : `\n  🔴 VERDICT: POLICY ENGINE BROKEN (${failed} rule(s) failing)`;

console.log(verdict);
console.log('═'.repeat(60) + '\n');

process.exit(failed > 0 ? 1 : 0);
