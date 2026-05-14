/**
 * booking-flow.test.js
 * INT-001 through INT-019 — Role selection, flight search, booking confirm, PNR generation.
 *
 * Architecture:
 *   - Mocks node-telegram-bot-api (no real Telegram calls)
 *   - Mocks agent.js processMessage (no real Gemini calls)
 *   - Mocks amadeus_mock.js bookFlight (returns deterministic PNR)
 *   - Mocks approval.js (no approval side effects)
 *   - Reads real bookings.json and chat_registry.json — reset between tests
 *
 * Run: npx jest QA/tests/integration/booking-flow.test.js
 */

'use strict';

// ── Env must be set before any require ───────────────────────────────────────
process.env.TELEGRAM_BOT_TOKEN = 'test-token-booking';
process.env.GEMINI_API_KEY     = 'test-gemini-key';

const path = require('path');
const fs   = require('fs');

const PROJECT_ROOT = path.join(__dirname, '../../..');
const { resetTestData, readBookings, readRegistry, SEEDED_REGISTRY } = require('../fixtures/reset-test-data');
const { profiles, mockFlightOptions, buildMockSession }              = require('../fixtures/test-profiles');

// ── Bot harness ───────────────────────────────────────────────────────────────
// Captures handlers registered by Index.js so we can trigger them in tests.
let botInstance;
const _handlers = {};
const _textHandlers = [];

jest.mock('node-telegram-bot-api', () => {
  return jest.fn().mockImplementation(() => {
    const instance = {
      sendMessage:            jest.fn().mockResolvedValue({ message_id: 1 }),
      answerCallbackQuery:    jest.fn().mockResolvedValue({}),
      editMessageReplyMarkup: jest.fn().mockResolvedValue({}),
      sendChatAction:         jest.fn().mockResolvedValue({}),
      stopPolling:            jest.fn(),
      on:     jest.fn((event, handler)  => { _handlers[event] = handler; }),
      onText: jest.fn((regex, handler)  => { _textHandlers.push({ regex, handler }); }),
    };
    botInstance = instance;
    return instance;
  });
});

jest.mock('../../../agent.js', () => ({
  processMessage: jest.fn(),
}));

jest.mock('../../../amadeus_mock.js', () => ({
  bookFlight:     jest.fn().mockResolvedValue({ pnr: 'TESTPN', response: {} }),
  buildGDSPayload: jest.fn().mockReturnValue({}),
}));

jest.mock('../../../approval.js', () => ({
  submitForApproval: jest.fn().mockResolvedValue('OOP-TEST-001'),
  approveBooking:    jest.fn().mockResolvedValue({ pnr: 'APPRVD' }),
  rejectBooking:     jest.fn().mockResolvedValue({}),
  getApproval:       jest.fn().mockReturnValue(null),
}));

// Require Index.js AFTER mocks are set — this registers all handlers on botInstance
require('../../../Index.js');

const { processMessage } = require('../../../agent.js');

// ── Helpers ───────────────────────────────────────────────────────────────────
const STAFF_CHAT_ID    = SEEDED_REGISTRY['EMP-001'];  // 100001
const MANAGER_CHAT_ID  = SEEDED_REGISTRY['MGR-002'];  // 100002
const DIRECTOR_CHAT_ID = SEEDED_REGISTRY['DIR-003'];  // 100003
const VP_CHAT_ID       = SEEDED_REGISTRY['VP-004'];   // 100004

let _nextChatId = 500000;
const freshId = () => _nextChatId++;

function buildMsg(chatId, text) {
  return {
    message_id: Math.floor(Math.random() * 9000) + 1000,
    from:       { id: chatId, first_name: 'Test', is_bot: false },
    chat:       { id: chatId, type: 'private' },
    date:       Math.floor(Date.now() / 1000),
    text,
  };
}

function buildCallback(chatId, data) {
  return {
    id:      String(Math.random()),
    from:    { id: chatId, first_name: 'Test' },
    message: { message_id: 1, chat: { id: chatId, type: 'private' } },
    data,
  };
}

async function triggerStart(chatId) {
  // Find /start text handler
  const startHandler = _textHandlers.find(h => h.regex.test('/start'));
  if (startHandler) await startHandler.handler(buildMsg(chatId, '/start'));
}

async function triggerCallback(chatId, data) {
  await _handlers['callback_query'](buildCallback(chatId, data));
}

async function triggerMessage(chatId, text) {
  await _handlers['message'](buildMsg(chatId, text));
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────
beforeEach(() => {
  resetTestData();
  jest.clearAllMocks();
  // Re-apply default mocks after clearAllMocks
  botInstance.sendMessage.mockResolvedValue({ message_id: 1 });
  botInstance.answerCallbackQuery.mockResolvedValue({});
  botInstance.editMessageReplyMarkup.mockResolvedValue({});
  botInstance.sendChatAction.mockResolvedValue({});
  require('../../../amadeus_mock.js').bookFlight.mockResolvedValue({ pnr: 'TESTPN', response: {} });
  require('../../../approval.js').submitForApproval.mockResolvedValue('OOP-TEST-001');
});

// ─────────────────────────────────────────────────────────────────────────────
// INT-001: /start sends role keyboard
// ─────────────────────────────────────────────────────────────────────────────
test('INT-001 — /start sends role selection keyboard', async () => {
  const chatId = freshId();
  await triggerStart(chatId);

  expect(botInstance.sendMessage).toHaveBeenCalledWith(
    chatId,
    expect.stringContaining('role'),
    expect.objectContaining({ reply_markup: expect.objectContaining({ inline_keyboard: expect.any(Array) }) })
  );
  const call = botInstance.sendMessage.mock.calls[0][2];
  const buttons = call.reply_markup.inline_keyboard.flat().map(b => b.callback_data);
  expect(buttons).toContain('role_operations');
  expect(buttons).toContain('role_manager');
  expect(buttons).toContain('role_director');
  expect(buttons).toContain('role_vp');
});

// ─────────────────────────────────────────────────────────────────────────────
// INT-002: role_operations sets Operations/Staff role and registers chat_id
// ─────────────────────────────────────────────────────────────────────────────
test('INT-002 — role_operations sets role and registers chat_id in chat_registry.json', async () => {
  const chatId = freshId();
  await triggerStart(chatId);
  await triggerCallback(chatId, 'role_operations');

  // Session role should be set (reflected in subsequent behaviour)
  // Registry should have this chat_id (key is EMP-001 from profile)
  const registry = readRegistry();
  expect(registry['EMP-001']).toBeDefined();

  // Greeting should mention the traveler name
  const calls = botInstance.sendMessage.mock.calls;
  const greetingCall = calls.find(c => c[0] === chatId && /Ally/i.test(c[1]));
  expect(greetingCall).toBeDefined();
});

// ─────────────────────────────────────────────────────────────────────────────
// INT-003: role_manager sets Manager/Senior role
// ─────────────────────────────────────────────────────────────────────────────
test('INT-003 — role_manager sets Manager/Senior and greets with correct name', async () => {
  const chatId = freshId();
  await triggerStart(chatId);
  await triggerCallback(chatId, 'role_manager');

  const registry = readRegistry();
  expect(registry['MGR-002']).toBeDefined();

  const calls = botInstance.sendMessage.mock.calls;
  const greetingCall = calls.find(c => c[0] === chatId && /Priya/i.test(c[1]));
  expect(greetingCall).toBeDefined();
});

// ─────────────────────────────────────────────────────────────────────────────
// INT-004: role_director sets Director role
// ─────────────────────────────────────────────────────────────────────────────
test('INT-004 — role_director sets Director role and registers chat_id', async () => {
  const chatId = freshId();
  await triggerStart(chatId);
  await triggerCallback(chatId, 'role_director');

  const registry = readRegistry();
  expect(registry['DIR-003']).toBeDefined();
});

// ─────────────────────────────────────────────────────────────────────────────
// INT-005: role_vp shows VP action menu (not plain greeting)
// ─────────────────────────────────────────────────────────────────────────────
test('INT-005 — role_vp shows VP action menu with Book Flights and Pending Approvals buttons', async () => {
  const chatId = freshId();
  await triggerStart(chatId);
  await triggerCallback(chatId, 'role_vp');

  const calls = botInstance.sendMessage.mock.calls;
  const vpCall = calls.find(c => c[0] === chatId && c[2]?.reply_markup?.inline_keyboard?.flat().some(b => b.callback_data === 'vp_book_flights'));
  expect(vpCall).toBeDefined();

  const buttons = vpCall[2].reply_markup.inline_keyboard.flat().map(b => b.callback_data);
  expect(buttons).toContain('vp_book_flights');
  expect(buttons).toContain('vp_view_approvals');
});

// ─────────────────────────────────────────────────────────────────────────────
// INT-006: Text message before role selection shows role keyboard prompt
// ─────────────────────────────────────────────────────────────────────────────
test('INT-006 — text message before role selection prompts role keyboard', async () => {
  const chatId = freshId();
  await triggerStart(chatId);
  // Do NOT select role — send text immediately
  await triggerMessage(chatId, 'Book me a flight');

  const calls = botInstance.sendMessage.mock.calls;
  const rolePrompt = calls.find(c => c[0] === chatId && c[2]?.reply_markup?.inline_keyboard);
  expect(rolePrompt).toBeDefined();
});

// ─────────────────────────────────────────────────────────────────────────────
// INT-007: processMessage called after role selected
// ─────────────────────────────────────────────────────────────────────────────
test('INT-007 — flight search triggers processMessage with user text', async () => {
  const chatId = freshId();
  processMessage.mockResolvedValueOnce({
    reply:            'Here are your flights from BKK to SIN:',
    geminiReply:      'Here are your flights from BKK to SIN:',
    inventoryResults: { flights: [mockFlightOptions.inPolicyEconomy] },
    escalated:        false,
  });

  await triggerStart(chatId);
  await triggerCallback(chatId, 'role_operations');
  await triggerMessage(chatId, 'Book me a flight from Bangkok to Singapore on June 1');

  expect(processMessage).toHaveBeenCalledWith(
    'Book me a flight from Bangkok to Singapore on June 1',
    expect.any(Array),  // history
    'Operations/Staff',
    expect.objectContaining({ employee_id: 'EMP-001' }),
    chatId
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// INT-008: Flight options displayed as inline keyboard buttons
// ─────────────────────────────────────────────────────────────────────────────
test('INT-008 — flight results displayed with select_N inline keyboard', async () => {
  const chatId = freshId();
  processMessage.mockResolvedValueOnce({
    reply:            'Found 2 flights:',
    geminiReply:      'Found 2 flights:',
    inventoryResults: {
      flights: [mockFlightOptions.inPolicyEconomy, mockFlightOptions.outOfPolicyEconomy],
    },
    escalated: false,
  });

  await triggerStart(chatId);
  await triggerCallback(chatId, 'role_operations');
  await triggerMessage(chatId, 'Book a flight BKK to SIN');

  const calls = botInstance.sendMessage.mock.calls;
  const flightMsg = calls.find(c => c[0] === chatId && c[2]?.reply_markup?.inline_keyboard?.flat().some(b => b.callback_data === 'select_0'));
  expect(flightMsg).toBeDefined();

  const buttons = flightMsg[2].reply_markup.inline_keyboard.flat();
  expect(buttons.some(b => b.callback_data === 'select_0')).toBe(true);
  expect(buttons.some(b => b.callback_data === 'select_1')).toBe(true);
});

// ─────────────────────────────────────────────────────────────────────────────
// INT-009: select_0 shows confirm/cancel keyboard
// ─────────────────────────────────────────────────────────────────────────────
test('INT-009 — select_0 displays booking confirm/cancel keyboard', async () => {
  const chatId = freshId();
  processMessage.mockResolvedValueOnce({
    reply:            'Here are your options:',
    geminiReply:      'Here are your options:',
    inventoryResults: { flights: [mockFlightOptions.inPolicyEconomy] },
    escalated:        false,
  });

  await triggerStart(chatId);
  await triggerCallback(chatId, 'role_operations');
  await triggerMessage(chatId, 'Book BKK to SIN');

  jest.clearAllMocks();
  botInstance.sendMessage.mockResolvedValue({ message_id: 2 });
  botInstance.answerCallbackQuery.mockResolvedValue({});
  botInstance.editMessageReplyMarkup.mockResolvedValue({});

  await triggerCallback(chatId, 'select_0');

  const calls = botInstance.sendMessage.mock.calls;
  const confirmMsg = calls.find(c => c[0] === chatId && c[2]?.reply_markup?.inline_keyboard);
  expect(confirmMsg).toBeDefined();

  const buttons = confirmMsg[2].reply_markup.inline_keyboard.flat().map(b => b.callback_data);
  expect(buttons).toContain('booking_confirm');
  expect(buttons).toContain('booking_cancel');
});

// ─────────────────────────────────────────────────────────────────────────────
// INT-010: booking_confirm (in-policy) writes CONFIRMED booking to bookings.json
// ─────────────────────────────────────────────────────────────────────────────
test('INT-010 — booking_confirm in-policy flight writes CONFIRMED to bookings.json', async () => {
  const chatId = freshId();
  processMessage.mockResolvedValueOnce({
    reply:            'Here is your flight:',
    geminiReply:      'Here is your flight:',
    inventoryResults: { flights: [mockFlightOptions.inPolicyEconomy] },
    escalated:        false,
  });

  await triggerStart(chatId);
  await triggerCallback(chatId, 'role_operations');
  await triggerMessage(chatId, 'Book BKK to SIN');
  await triggerCallback(chatId, 'select_0');

  jest.clearAllMocks();
  botInstance.sendMessage.mockResolvedValue({ message_id: 3 });
  botInstance.answerCallbackQuery.mockResolvedValue({});
  botInstance.editMessageReplyMarkup.mockResolvedValue({});

  await triggerCallback(chatId, 'booking_confirm');

  const bookings = readBookings();
  expect(bookings).toHaveLength(1);
  expect(bookings[0].status).toBe('CONFIRMED');
  expect(bookings[0].employee_id).toBe('EMP-001');
  expect(bookings[0].type).toBe('flight');
  expect(bookings[0].flight_number).toBe('TG401');
});

// ─────────────────────────────────────────────────────────────────────────────
// INT-011: PNR format matches charset (no I, O, 1, 0)
// ─────────────────────────────────────────────────────────────────────────────
test('INT-011 — hotel booking generates 6-char PNR from correct charset', async () => {
  const chatId = freshId();
  // For hotel bookings, PNR is generated locally (not via amadeus_mock.js bookFlight)
  // Use mockFlightOptions.inPolicyEconomy with is_compliant=true (non-hotel path uses amadeus_mock)
  // For hotel: pnr from charset 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const { mockHotelOptions } = require('../fixtures/test-profiles');

  processMessage.mockResolvedValueOnce({
    reply:            'Here are your hotels:',
    geminiReply:      'Here are your hotels:',
    inventoryResults: { hotels: [mockHotelOptions.inPolicyBKK] },
    escalated:        false,
  });

  await triggerStart(chatId);
  await triggerCallback(chatId, 'role_director');
  await triggerMessage(chatId, 'Book a hotel in Bangkok');
  await triggerCallback(chatId, 'select_0');

  jest.clearAllMocks();
  botInstance.sendMessage.mockResolvedValue({ message_id: 4 });
  botInstance.answerCallbackQuery.mockResolvedValue({});
  botInstance.editMessageReplyMarkup.mockResolvedValue({});

  await triggerCallback(chatId, 'booking_confirm');

  const bookings = readBookings();
  expect(bookings).toHaveLength(1);
  expect(bookings[0].status).toBe('CONFIRMED');
  expect(bookings[0].type).toBe('hotel');
  // PNR from charset: no I, O, 1, 0
  expect(bookings[0].pnr).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
});

// ─────────────────────────────────────────────────────────────────────────────
// INT-012: Confirm message contains PNR
// ─────────────────────────────────────────────────────────────────────────────
test('INT-012 — confirmation reply contains PNR', async () => {
  const chatId = freshId();
  require('../../../amadeus_mock.js').bookFlight.mockResolvedValue({ pnr: 'ABCDEF', response: {} });

  processMessage.mockResolvedValueOnce({
    reply:            'Here is your flight:',
    geminiReply:      'Here is your flight:',
    inventoryResults: { flights: [mockFlightOptions.inPolicyEconomy] },
    escalated:        false,
  });

  await triggerStart(chatId);
  await triggerCallback(chatId, 'role_operations');
  await triggerMessage(chatId, 'BKK to SIN');
  await triggerCallback(chatId, 'select_0');

  jest.clearAllMocks();
  botInstance.sendMessage.mockResolvedValue({ message_id: 5 });
  botInstance.answerCallbackQuery.mockResolvedValue({});
  botInstance.editMessageReplyMarkup.mockResolvedValue({});

  await triggerCallback(chatId, 'booking_confirm');

  const confirmCall = botInstance.sendMessage.mock.calls.find(c => c[0] === chatId && /ABCDEF/i.test(c[1]));
  expect(confirmCall).toBeDefined();
});

// ─────────────────────────────────────────────────────────────────────────────
// INT-013: booking_cancel clears selected option, sends cancellation message
// ─────────────────────────────────────────────────────────────────────────────
test('INT-013 — booking_cancel sends cancellation acknowledgement', async () => {
  const chatId = freshId();
  processMessage.mockResolvedValueOnce({
    reply:            'Here is your flight:',
    geminiReply:      'Here is your flight:',
    inventoryResults: { flights: [mockFlightOptions.inPolicyEconomy] },
    escalated:        false,
  });

  await triggerStart(chatId);
  await triggerCallback(chatId, 'role_operations');
  await triggerMessage(chatId, 'BKK to SIN');
  await triggerCallback(chatId, 'select_0');

  jest.clearAllMocks();
  botInstance.sendMessage.mockResolvedValue({ message_id: 6 });
  botInstance.answerCallbackQuery.mockResolvedValue({});
  botInstance.editMessageReplyMarkup.mockResolvedValue({});

  await triggerCallback(chatId, 'booking_cancel');

  // No booking should be written
  const bookings = readBookings();
  expect(bookings).toHaveLength(0);

  // Some reply should have been sent
  const cancelCall = botInstance.sendMessage.mock.calls.find(c => c[0] === chatId);
  expect(cancelCall).toBeDefined();
  expect(typeof cancelCall[1]).toBe('string');
});

// ─────────────────────────────────────────────────────────────────────────────
// INT-014: Idempotency guard — rapid double-tap booking_confirm blocked
// ─────────────────────────────────────────────────────────────────────────────
test('INT-014 — duplicate booking_confirm blocked by idempotency guard', async () => {
  const chatId = freshId();
  processMessage.mockResolvedValueOnce({
    reply:            'Here is your flight:',
    geminiReply:      'Here is your flight:',
    inventoryResults: { flights: [mockFlightOptions.inPolicyEconomy] },
    escalated:        false,
  });

  // Slow down bookFlight to simulate race condition
  require('../../../amadeus_mock.js').bookFlight.mockImplementation(
    () => new Promise(resolve => setTimeout(() => resolve({ pnr: 'RACECD', response: {} }), 100))
  );

  await triggerStart(chatId);
  await triggerCallback(chatId, 'role_operations');
  await triggerMessage(chatId, 'BKK to SIN');
  await triggerCallback(chatId, 'select_0');

  jest.clearAllMocks();
  botInstance.sendMessage.mockResolvedValue({ message_id: 7 });
  botInstance.answerCallbackQuery.mockResolvedValue({});
  botInstance.editMessageReplyMarkup.mockResolvedValue({});

  // Fire two confirms simultaneously
  const [r1, r2] = await Promise.all([
    triggerCallback(chatId, 'booking_confirm'),
    triggerCallback(chatId, 'booking_confirm'),
  ]);

  // Only one booking should be saved
  const bookings = readBookings();
  expect(bookings).toHaveLength(1);
});

// ─────────────────────────────────────────────────────────────────────────────
// INT-015: Out-of-policy booking prompts for justification (Staff + OOP flight)
// ─────────────────────────────────────────────────────────────────────────────
test('INT-015 — OOP booking prompts for justification text', async () => {
  const chatId = freshId();
  processMessage.mockResolvedValueOnce({
    reply:            'Here is an option:',
    geminiReply:      'Here is an option:',
    inventoryResults: { flights: [mockFlightOptions.outOfPolicyEconomy] },
    escalated:        false,
  });

  await triggerStart(chatId);
  await triggerCallback(chatId, 'role_operations');
  await triggerMessage(chatId, 'BKK to SIN');
  await triggerCallback(chatId, 'select_0');

  jest.clearAllMocks();
  botInstance.sendMessage.mockResolvedValue({ message_id: 8 });
  botInstance.answerCallbackQuery.mockResolvedValue({});
  botInstance.editMessageReplyMarkup.mockResolvedValue({});

  await triggerCallback(chatId, 'booking_confirm');

  // Should NOT write a booking yet — awaiting justification
  const bookings = readBookings();
  expect(bookings).toHaveLength(0);

  // Should prompt for justification
  const justificationPrompt = botInstance.sendMessage.mock.calls.find(
    c => c[0] === chatId && /justification/i.test(c[1])
  );
  expect(justificationPrompt).toBeDefined();
});

// ─────────────────────────────────────────────────────────────────────────────
// INT-016: Justification text calls submitForApproval
// ─────────────────────────────────────────────────────────────────────────────
test('INT-016 — justification message calls submitForApproval with booking record', async () => {
  const chatId = freshId();
  processMessage.mockResolvedValueOnce({
    reply:            'Here is an option:',
    geminiReply:      'Here is an option:',
    inventoryResults: { flights: [mockFlightOptions.outOfPolicyEconomy] },
    escalated:        false,
  });

  await triggerStart(chatId);
  await triggerCallback(chatId, 'role_operations');
  await triggerMessage(chatId, 'BKK to SIN');
  await triggerCallback(chatId, 'select_0');
  await triggerCallback(chatId, 'booking_confirm');  // triggers OOP prompt

  jest.clearAllMocks();
  botInstance.sendMessage.mockResolvedValue({ message_id: 9 });

  await triggerMessage(chatId, 'Business requirement for client visit');

  const { submitForApproval } = require('../../../approval.js');
  expect(submitForApproval).toHaveBeenCalledWith(
    expect.objectContaining({
      justification:      'Business requirement for client visit',
      approverEmployeeId: 'VP-004',
      bookingRecord:      expect.objectContaining({
        status:      'PENDING_APPROVAL',
        employee_id: 'EMP-001',
        type:        'flight',
      }),
    })
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// INT-017: VP-004 booking in-policy — NOT routed to approval (self bypass)
// ─────────────────────────────────────────────────────────────────────────────
test('INT-017 — VP booking out-of-policy is booked directly (approver bypass)', async () => {
  const chatId = freshId();
  // VP is APPROVER_EMPLOYEE_ID — OOP check has: profile?.employee_id !== APPROVER_EMPLOYEE_ID
  // So VP can bypass OOP approval
  processMessage.mockResolvedValueOnce({
    reply:            'Here is your flight:',
    geminiReply:      'Here is your flight:',
    inventoryResults: { flights: [mockFlightOptions.outOfPolicyBusiness] },  // OOP for most, but VP bypasses
    escalated:        false,
  });

  require('../../../amadeus_mock.js').bookFlight.mockResolvedValue({ pnr: 'VPBOOK', response: {} });

  await triggerStart(chatId);
  await triggerCallback(chatId, 'role_vp');
  await triggerCallback(chatId, 'vp_book_flights');
  await triggerMessage(chatId, 'Book BKK to LHR Business');
  await triggerCallback(chatId, 'select_0');

  jest.clearAllMocks();
  botInstance.sendMessage.mockResolvedValue({ message_id: 10 });
  botInstance.answerCallbackQuery.mockResolvedValue({});
  botInstance.editMessageReplyMarkup.mockResolvedValue({});

  await triggerCallback(chatId, 'booking_confirm');

  const bookings = readBookings();
  expect(bookings).toHaveLength(1);
  expect(bookings[0].status).toBe('CONFIRMED');
  expect(bookings[0].employee_id).toBe('VP-004');
});

// ─────────────────────────────────────────────────────────────────────────────
// INT-018: /reset clears session and shows role keyboard again
// ─────────────────────────────────────────────────────────────────────────────
test('INT-018 — /reset clears session and re-prompts role selection', async () => {
  const chatId = freshId();
  await triggerStart(chatId);
  await triggerCallback(chatId, 'role_operations');

  jest.clearAllMocks();
  botInstance.sendMessage.mockResolvedValue({ message_id: 11 });

  const resetHandler = _textHandlers.find(h => h.regex.test('/reset'));
  if (resetHandler) await resetHandler.handler(buildMsg(chatId, '/reset'));

  // Should prompt role selection again
  const rolePrompt = botInstance.sendMessage.mock.calls.find(
    c => c[0] === chatId && c[2]?.reply_markup?.inline_keyboard
  );
  expect(rolePrompt).toBeDefined();
  const buttons = rolePrompt[2].reply_markup.inline_keyboard.flat().map(b => b.callback_data);
  expect(buttons).toContain('role_operations');
});

// ─────────────────────────────────────────────────────────────────────────────
// INT-019: bookings.json record has all required fields
// ─────────────────────────────────────────────────────────────────────────────
test('INT-019 — confirmed booking record has all required fields', async () => {
  const chatId = freshId();
  require('../../../amadeus_mock.js').bookFlight.mockResolvedValue({ pnr: 'FIELDS', response: {} });

  processMessage.mockResolvedValueOnce({
    reply:            'Here is your flight:',
    geminiReply:      'Here is your flight:',
    inventoryResults: { flights: [mockFlightOptions.inPolicyEconomy] },
    escalated:        false,
  });

  await triggerStart(chatId);
  await triggerCallback(chatId, 'role_operations');
  await triggerMessage(chatId, 'BKK to SIN');
  await triggerCallback(chatId, 'select_0');

  jest.clearAllMocks();
  botInstance.sendMessage.mockResolvedValue({ message_id: 12 });
  botInstance.answerCallbackQuery.mockResolvedValue({});
  botInstance.editMessageReplyMarkup.mockResolvedValue({});

  await triggerCallback(chatId, 'booking_confirm');

  const bookings = readBookings();
  const b = bookings[0];

  expect(b).toMatchObject({
    pnr:         expect.any(String),
    status:      'CONFIRMED',
    employee_id: 'EMP-001',
    traveler:    'Ally Luciate',
    type:        'flight',
    chat_id:     chatId,
    confirmed_at: expect.any(String),
    flight_number: 'TG401',
    airline:       'Thai Airways',
    origin:        'BKK',
    destination:   'SIN',
  });
});
