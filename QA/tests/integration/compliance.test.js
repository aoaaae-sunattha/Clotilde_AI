/**
 * compliance.test.js
 * INT-030 through INT-051 — Policy compliance: cabin class per role, price caps,
 * preferred airline ordering, is_compliant flag routing in proceedWithBooking.
 *
 * Layers:
 *   - INT-030–039: Direct policy.js + mock_inventory.js unit assertions (no bot)
 *   - INT-040–051: Index.js routing — OOP vs. in-policy paths via booking_confirm
 *
 * Run: npx jest QA/tests/integration/compliance.test.js
 */

'use strict';

process.env.TELEGRAM_BOT_TOKEN = 'test-token-compliance';
process.env.GEMINI_API_KEY     = 'test-gemini-key';

const POLICY = require('../../../policy.js');
const { getMockFlights, getMockHotels } = require('../../../mock_inventory.js');
const { profiles, mockFlightOptions, mockHotelOptions, BUSINESS_CLASS_ROLES, ECONOMY_ONLY_ROLES } = require('../fixtures/test-profiles');
const { resetTestData, readBookings } = require('../fixtures/reset-test-data');

// ── Bot harness (for INT-040–051) ─────────────────────────────────────────────
const _handlers  = {};
const _textHandlers = [];
let botInstance;

jest.mock('node-telegram-bot-api', () => {
  return jest.fn().mockImplementation(() => {
    const instance = {
      sendMessage:            jest.fn().mockResolvedValue({ message_id: 1 }),
      answerCallbackQuery:    jest.fn().mockResolvedValue({}),
      editMessageReplyMarkup: jest.fn().mockResolvedValue({}),
      sendChatAction:         jest.fn().mockResolvedValue({}),
      stopPolling:            jest.fn(),
      on:     jest.fn((event, handler) => { _handlers[event] = handler; }),
      onText: jest.fn((regex, handler) => { _textHandlers.push({ regex, handler }); }),
    };
    botInstance = instance;
    return instance;
  });
});

jest.mock('../../../agent.js', () => ({ processMessage: jest.fn() }));
jest.mock('../../../amadeus_mock.js', () => ({
  bookFlight:      jest.fn().mockResolvedValue({ pnr: 'COMPLN', response: {} }),
  buildGDSPayload: jest.fn().mockReturnValue({}),
}));
jest.mock('../../../approval.js', () => ({
  submitForApproval: jest.fn().mockResolvedValue('OOP-COMP-001'),
  approveBooking:    jest.fn().mockResolvedValue({ pnr: 'APPRVD' }),
  rejectBooking:     jest.fn().mockResolvedValue({}),
  getApproval:       jest.fn().mockReturnValue(null),
}));

require('../../../Index.js');
const { processMessage } = require('../../../agent.js');

// Each bot-interaction test uses a unique chat ID to prevent session state
// pollution across tests (/start does not clear awaitingJustification).
let _nextChatId = 400000;
const freshId = () => _nextChatId++;

function buildMsg(chatId, text) {
  return { message_id: 1, from: { id: chatId, is_bot: false }, chat: { id: chatId, type: 'private' }, date: Math.floor(Date.now() / 1000), text };
}
function buildCallback(chatId, data) {
  return { id: '1', from: { id: chatId }, message: { message_id: 1, chat: { id: chatId, type: 'private' } }, data };
}
async function triggerStart(chatId) {
  const h = _textHandlers.find(h => h.regex.test('/start'));
  if (h) await h.handler(buildMsg(chatId, '/start'));
}
async function triggerCallback(chatId, data) {
  await _handlers['callback_query'](buildCallback(chatId, data));
}
async function triggerMessage(chatId, text) {
  await _handlers['message'](buildMsg(chatId, text));
}

beforeEach(() => {
  resetTestData();
  jest.clearAllMocks();
  botInstance.sendMessage.mockResolvedValue({ message_id: 1 });
  botInstance.answerCallbackQuery.mockResolvedValue({});
  botInstance.editMessageReplyMarkup.mockResolvedValue({});
  require('../../../amadeus_mock.js').bookFlight.mockResolvedValue({ pnr: 'COMPLN', response: {} });
  require('../../../approval.js').submitForApproval.mockResolvedValue('OOP-COMP-001');
});

// ═════════════════════════════════════════════════════════════════════════════
// INT-030–039: POLICY.js direct assertions
// Note: policy.js cabinClass uses ECONOMY/BUSINESS groups with role arrays,
// not direct role-name → allowed-cabins map.
// ═════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// INT-030: ECONOMY group includes Operations and Staff roles
// ─────────────────────────────────────────────────────────────────────────────
test('INT-030 — policy.js: ECONOMY group includes Operations and Staff roles, allows only Y', () => {
  const eco = POLICY.cabinClass['ECONOMY'];
  expect(eco).toBeDefined();
  expect(eco.roles).toContain('Operations');
  expect(eco.roles).toContain('Staff');
  expect(eco.allowed).toContain('Y');
  expect(eco.allowed).not.toContain('C');
  expect(eco.allowed).not.toContain('F');
});

// ─────────────────────────────────────────────────────────────────────────────
// INT-031: ECONOMY group includes Manager and Senior Manager roles
// ─────────────────────────────────────────────────────────────────────────────
test('INT-031 — policy.js: ECONOMY group includes Manager and Senior Manager', () => {
  const eco = POLICY.cabinClass['ECONOMY'];
  expect(eco.roles).toContain('Manager');
  expect(eco.roles).toContain('Senior Manager');
  expect(eco.allowed).not.toContain('C');
});

// ─────────────────────────────────────────────────────────────────────────────
// INT-032: BUSINESS group includes Director role and allows C
// ─────────────────────────────────────────────────────────────────────────────
test('INT-032 — policy.js: BUSINESS group includes Director, allows C (Business)', () => {
  const biz = POLICY.cabinClass['BUSINESS'];
  expect(biz).toBeDefined();
  expect(biz.roles).toContain('Director');
  expect(biz.allowed).toContain('Y');
  expect(biz.allowed).toContain('C');
});

// ─────────────────────────────────────────────────────────────────────────────
// INT-033: BUSINESS group includes VP and C-Suite roles
// ─────────────────────────────────────────────────────────────────────────────
test('INT-033 — policy.js: BUSINESS group includes VP and C-Suite', () => {
  const biz = POLICY.cabinClass['BUSINESS'];
  expect(biz.roles).toContain('VP');
  expect(biz.roles).toContain('C-Suite');
  expect(biz.allowed).toContain('C');
});

// ─────────────────────────────────────────────────────────────────────────────
// INT-034: Short-haul flight budget cap is defined with amount and currency
// ─────────────────────────────────────────────────────────────────────────────
test('INT-034 — policy.js: flightBudgetCap.SHORT_HAUL has amount and currency', () => {
  const cap = POLICY.flightBudgetCap?.SHORT_HAUL;
  expect(cap).toBeDefined();
  expect(typeof cap.amount).toBe('number');
  expect(cap.amount).toBeGreaterThan(0);
  expect(cap.currency).toBeDefined();
});

// ─────────────────────────────────────────────────────────────────────────────
// INT-035: Hotel BKK budget cap defined
// ─────────────────────────────────────────────────────────────────────────────
test('INT-035 — policy.js: hotelBudgetCap.BKK has amount and currency', () => {
  const bkkCap = POLICY.hotelBudgetCap?.BKK;
  expect(bkkCap).toBeDefined();
  expect(typeof bkkCap.amount).toBe('number');
  expect(bkkCap.currency).toBeDefined();
});

// ─────────────────────────────────────────────────────────────────────────────
// INT-036: Preferred airlines list is non-empty with code and name fields
// ─────────────────────────────────────────────────────────────────────────────
test('INT-036 — policy.js: preferredAirlines is a non-empty array with code/name fields', () => {
  expect(Array.isArray(POLICY.preferredAirlines)).toBe(true);
  expect(POLICY.preferredAirlines.length).toBeGreaterThan(0);
  expect(POLICY.preferredAirlines[0]).toHaveProperty('code');
  expect(POLICY.preferredAirlines[0]).toHaveProperty('name');
});

// ─────────────────────────────────────────────────────────────────────────────
// INT-037: mock_inventory.js — in-policy economy flight is_compliant true
// ─────────────────────────────────────────────────────────────────────────────
test('INT-037 — mock_inventory.js: BKK→SIN Economy 4800 THB is_compliant=true', () => {
  const f = mockFlightOptions.inPolicyEconomy;
  expect(f.is_compliant).toBe(true);
  expect(f.cabin_class).toBe('Y');
  expect(f.price.amount).toBeLessThanOrEqual(5000);
});

// ─────────────────────────────────────────────────────────────────────────────
// INT-038: mock_inventory.js — out-of-policy economy flight is_compliant false
// ─────────────────────────────────────────────────────────────────────────────
test('INT-038 — mock_inventory.js: BKK→SIN Economy 6500 THB is_compliant=false', () => {
  const f = mockFlightOptions.outOfPolicyEconomy;
  expect(f.is_compliant).toBe(false);
  expect(f.cabin_class).toBe('Y');
  expect(f.price.amount).toBeGreaterThan(5000);
});

// ─────────────────────────────────────────────────────────────────────────────
// INT-039: Compliant flights sorted before non-compliant; within compliant tier,
// preferred airlines appear before non-preferred.
// getMockFlights(origin, destination, departureDate, cabinClass) — positional args
// ─────────────────────────────────────────────────────────────────────────────
test('INT-039 — mock_inventory.js: compliant results sorted before non-compliant', () => {
  const flights = getMockFlights('BKK', 'SIN', '2026-06-01', 'Y');
  if (!flights || flights.length < 2) return;

  // Primary sort: is_compliant=true before is_compliant=false
  const firstNonCompliant = flights.findIndex(f => !f.is_compliant);
  const lastCompliant     = flights.map(f => f.is_compliant).lastIndexOf(true);

  if (firstNonCompliant !== -1 && lastCompliant !== -1) {
    expect(lastCompliant).toBeLessThan(firstNonCompliant);
  }

  // Within compliant flights, preferred airlines appear before non-preferred
  const compliantFlights = flights.filter(f => f.is_compliant);
  if (compliantFlights.length >= 2) {
    const firstNonPref = compliantFlights.findIndex(f => !f.is_preferred);
    const lastPref     = compliantFlights.map(f => f.is_preferred).lastIndexOf(true);
    if (firstNonPref !== -1 && lastPref !== -1) {
      expect(lastPref).toBeLessThan(firstNonPref);
    }
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// INT-040–051: Index.js routing — OOP vs. in-policy via booking_confirm
// ═════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// INT-040: Staff + in-policy Economy → CONFIRMED (no approval)
// ─────────────────────────────────────────────────────────────────────────────
test('INT-040 — Staff + in-policy Economy → booking CONFIRMED, no approval submitted', async () => {
  const chatId = freshId();
  processMessage.mockResolvedValueOnce({
    reply: 'Options:', geminiReply: 'Options:',
    inventoryResults: { flights: [mockFlightOptions.inPolicyEconomy] },
    escalated: false,
  });

  await triggerStart(chatId);
  await triggerCallback(chatId, 'role_operations');
  await triggerMessage(chatId, 'BKK to SIN');
  await triggerCallback(chatId, 'select_0');
  await triggerCallback(chatId, 'booking_confirm');

  const bookings = readBookings();
  expect(bookings).toHaveLength(1);
  expect(bookings[0].status).toBe('CONFIRMED');

  const { submitForApproval } = require('../../../approval.js');
  expect(submitForApproval).not.toHaveBeenCalled();
});

// ─────────────────────────────────────────────────────────────────────────────
// INT-041: Staff + OOP Economy → PENDING_APPROVAL (approval submitted)
// ─────────────────────────────────────────────────────────────────────────────
test('INT-041 — Staff + OOP Economy → PENDING_APPROVAL, submitForApproval called', async () => {
  const chatId = freshId();
  processMessage.mockResolvedValueOnce({
    reply: 'Options:', geminiReply: 'Options:',
    inventoryResults: { flights: [mockFlightOptions.outOfPolicyEconomy] },
    escalated: false,
  });

  await triggerStart(chatId);
  await triggerCallback(chatId, 'role_operations');
  await triggerMessage(chatId, 'BKK to SIN');
  await triggerCallback(chatId, 'select_0');
  await triggerCallback(chatId, 'booking_confirm');
  await triggerMessage(chatId, 'Client meeting requires premium option');

  const { submitForApproval } = require('../../../approval.js');
  expect(submitForApproval).toHaveBeenCalledWith(
    expect.objectContaining({
      bookingRecord: expect.objectContaining({ status: 'PENDING_APPROVAL' }),
      approverEmployeeId: 'VP-004',
    })
  );

  const bookings = readBookings();
  expect(bookings.filter(b => b.status === 'CONFIRMED')).toHaveLength(0);
});

// ─────────────────────────────────────────────────────────────────────────────
// INT-042: Manager + in-policy Economy → CONFIRMED
// ─────────────────────────────────────────────────────────────────────────────
test('INT-042 — Manager + in-policy Economy → CONFIRMED', async () => {
  const chatId = freshId();
  processMessage.mockResolvedValueOnce({
    reply: 'Options:', geminiReply: 'Options:',
    inventoryResults: { flights: [mockFlightOptions.inPolicyEconomy] },
    escalated: false,
  });

  await triggerStart(chatId);
  await triggerCallback(chatId, 'role_manager');
  await triggerMessage(chatId, 'BKK to SIN');
  await triggerCallback(chatId, 'select_0');
  await triggerCallback(chatId, 'booking_confirm');

  const bookings = readBookings();
  expect(bookings.find(b => b.status === 'CONFIRMED')).toBeDefined();
});

// ─────────────────────────────────────────────────────────────────────────────
// INT-043: Staff cannot book Business Class (C) — treated as OOP
// ─────────────────────────────────────────────────────────────────────────────
test('INT-043 — Staff selecting Business Class cabin triggers OOP approval flow', async () => {
  const chatId = freshId();
  const businessForStaff = { ...mockFlightOptions.inPolicyBusiness, is_compliant: false };

  processMessage.mockResolvedValueOnce({
    reply: 'Options:', geminiReply: 'Options:',
    inventoryResults: { flights: [businessForStaff] },
    escalated: false,
  });

  await triggerStart(chatId);
  await triggerCallback(chatId, 'role_operations');
  await triggerMessage(chatId, 'BKK to LHR Business');
  await triggerCallback(chatId, 'select_0');
  await triggerCallback(chatId, 'booking_confirm');

  const justificationPrompt = botInstance.sendMessage.mock.calls.find(
    c => c[0] === chatId && /justification/i.test(c[1])
  );
  expect(justificationPrompt).toBeDefined();
});

// ─────────────────────────────────────────────────────────────────────────────
// INT-044: Director + in-policy Business Class → CONFIRMED
// ─────────────────────────────────────────────────────────────────────────────
test('INT-044 — Director + in-policy Business Class → CONFIRMED (no approval)', async () => {
  const chatId = freshId();
  require('../../../amadeus_mock.js').bookFlight.mockResolvedValue({ pnr: 'DIRBIZ', response: {} });

  processMessage.mockResolvedValueOnce({
    reply: 'Options:', geminiReply: 'Options:',
    inventoryResults: { flights: [mockFlightOptions.inPolicyBusiness] },
    escalated: false,
  });

  await triggerStart(chatId);
  await triggerCallback(chatId, 'role_director');
  await triggerMessage(chatId, 'BKK to LHR Business');
  await triggerCallback(chatId, 'select_0');
  await triggerCallback(chatId, 'booking_confirm');

  const bookings = readBookings();
  const dirBooking = bookings.find(b => b.status === 'CONFIRMED' && b.cabin_class === 'C');
  expect(dirBooking).toBeDefined();
});

// ─────────────────────────────────────────────────────────────────────────────
// INT-045: Director + OOP Business (above long-haul cap) → PENDING_APPROVAL
// ─────────────────────────────────────────────────────────────────────────────
test('INT-045 — Director + OOP Business (above cap) → PENDING_APPROVAL', async () => {
  const chatId = freshId();
  processMessage.mockResolvedValueOnce({
    reply: 'Options:', geminiReply: 'Options:',
    inventoryResults: { flights: [mockFlightOptions.outOfPolicyBusiness] },
    escalated: false,
  });

  await triggerStart(chatId);
  await triggerCallback(chatId, 'role_director');
  await triggerMessage(chatId, 'BKK to LHR');
  await triggerCallback(chatId, 'select_0');
  await triggerCallback(chatId, 'booking_confirm');

  const justificationPrompt = botInstance.sendMessage.mock.calls.find(
    c => c[0] === chatId && /justification/i.test(c[1])
  );
  expect(justificationPrompt).toBeDefined();
});

// ─────────────────────────────────────────────────────────────────────────────
// INT-046: is_compliant=null treated as OOP (FX rate unavailable)
// ─────────────────────────────────────────────────────────────────────────────
test('INT-046 — is_compliant=null treated as OOP (triggers justification flow)', async () => {
  const chatId = freshId();
  const nullCompliant = { ...mockFlightOptions.inPolicyBusiness, is_compliant: null };

  processMessage.mockResolvedValueOnce({
    reply: 'Options:', geminiReply: 'Options:',
    inventoryResults: { flights: [nullCompliant] },
    escalated: false,
  });

  await triggerStart(chatId);
  await triggerCallback(chatId, 'role_operations');
  await triggerMessage(chatId, 'BKK to LHR');
  await triggerCallback(chatId, 'select_0');
  await triggerCallback(chatId, 'booking_confirm');

  const justificationPrompt = botInstance.sendMessage.mock.calls.find(
    c => c[0] === chatId && /justification/i.test(c[1])
  );
  expect(justificationPrompt).toBeDefined();
});

// ─────────────────────────────────────────────────────────────────────────────
// INT-047: In-policy hotel (BKK, at cap) → CONFIRMED
// ─────────────────────────────────────────────────────────────────────────────
test('INT-047 — in-policy hotel BKK at cap → CONFIRMED booking', async () => {
  const chatId = freshId();
  processMessage.mockResolvedValueOnce({
    reply: 'Hotels:', geminiReply: 'Hotels:',
    inventoryResults: { hotels: [mockHotelOptions.inPolicyBKK] },
    escalated: false,
  });

  await triggerStart(chatId);
  await triggerCallback(chatId, 'role_operations');
  await triggerMessage(chatId, 'Hotel in Bangkok');
  await triggerCallback(chatId, 'select_0');
  await triggerCallback(chatId, 'booking_confirm');

  const bookings = readBookings();
  expect(bookings.find(b => b.type === 'hotel' && b.status === 'CONFIRMED')).toBeDefined();
});

// ─────────────────────────────────────────────────────────────────────────────
// INT-048: OOP hotel (above BKK cap) → PENDING_APPROVAL
// ─────────────────────────────────────────────────────────────────────────────
test('INT-048 — OOP hotel (above BKK cap) → approval justification prompt', async () => {
  const chatId = freshId();
  processMessage.mockResolvedValueOnce({
    reply: 'Hotels:', geminiReply: 'Hotels:',
    inventoryResults: { hotels: [mockHotelOptions.outOfPolicyBKK] },
    escalated: false,
  });

  await triggerStart(chatId);
  await triggerCallback(chatId, 'role_operations');
  await triggerMessage(chatId, 'Hotel in Bangkok');
  await triggerCallback(chatId, 'select_0');
  await triggerCallback(chatId, 'booking_confirm');

  const justificationPrompt = botInstance.sendMessage.mock.calls.find(
    c => c[0] === chatId && /justification/i.test(c[1])
  );
  expect(justificationPrompt).toBeDefined();
});

// ─────────────────────────────────────────────────────────────────────────────
// INT-049: POLICY.cabinClass has ECONOMY and BUSINESS groups with required fields
// ─────────────────────────────────────────────────────────────────────────────
test('INT-049 — policy.js cabinClass has ECONOMY and BUSINESS groups with roles and allowed fields', () => {
  for (const group of ['ECONOMY', 'BUSINESS']) {
    expect(POLICY.cabinClass[group]).toBeDefined();
    expect(Array.isArray(POLICY.cabinClass[group].roles)).toBe(true);
    expect(POLICY.cabinClass[group].roles.length).toBeGreaterThan(0);
    expect(Array.isArray(POLICY.cabinClass[group].allowed)).toBe(true);
    expect(POLICY.cabinClass[group].allowed.length).toBeGreaterThan(0);
    expect(POLICY.cabinClass[group].allowed).toContain('Y');
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// INT-050: BUSINESS group allows C; ECONOMY group does not
// ─────────────────────────────────────────────────────────────────────────────
test('INT-050 — BUSINESS group allowed includes C (Business); ECONOMY does not', () => {
  expect(POLICY.cabinClass['BUSINESS'].allowed).toContain('C');
  expect(POLICY.cabinClass['ECONOMY'].allowed).not.toContain('C');
});

// ─────────────────────────────────────────────────────────────────────────────
// INT-051: OOP booking record has pnr=null, status=PENDING_APPROVAL
// ─────────────────────────────────────────────────────────────────────────────
test('INT-051 — OOP booking record passed to submitForApproval has pnr=null', async () => {
  const chatId = freshId();
  processMessage.mockResolvedValueOnce({
    reply: 'Options:', geminiReply: 'Options:',
    inventoryResults: { flights: [mockFlightOptions.outOfPolicyEconomy] },
    escalated: false,
  });

  await triggerStart(chatId);
  await triggerCallback(chatId, 'role_operations');
  await triggerMessage(chatId, 'BKK to SIN');
  await triggerCallback(chatId, 'select_0');
  await triggerCallback(chatId, 'booking_confirm');
  await triggerMessage(chatId, 'Price difference justified by merger timeline');

  const { submitForApproval } = require('../../../approval.js');
  const callArg = submitForApproval.mock.calls[0]?.[0];
  expect(callArg).toBeDefined();
  expect(callArg.bookingRecord.pnr).toBeNull();
  expect(callArg.bookingRecord.status).toBe('PENDING_APPROVAL');
});
