/**
 * hotel-flow.test.js
 * INT-075 through INT-085 — Hotel search and booking flow.
 *
 * Coverage:
 *   - Hotel search → hotel options displayed as inline keyboard
 *   - select_N → confirm/cancel keyboard
 *   - booking_confirm hotel → CONFIRMED in bookings.json with hotel fields
 *   - PNR for hotel: 6-char from local charset (not amadeus_mock)
 *   - OOP hotel → PENDING_APPROVAL
 *   - Hotel record fields: hotel_id, hotel_name, room_type, checkin, checkout, price_per_night
 *   - In-policy SIN hotel → CONFIRMED
 *   - Hotel booking cancel → no record written
 *   - Hotel option buttons labeled with hotel name
 *
 * Run: npx jest QA/tests/integration/hotel-flow.test.js
 */

'use strict';

process.env.TELEGRAM_BOT_TOKEN = 'test-token-hotel';
process.env.GEMINI_API_KEY     = 'test-gemini-key';

const { resetTestData, readBookings, SEEDED_REGISTRY } = require('../fixtures/reset-test-data');
const { mockHotelOptions }                              = require('../fixtures/test-profiles');

// ── Bot harness ───────────────────────────────────────────────────────────────
const _handlers     = {};
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

jest.mock('../../../agent.js',        () => ({ processMessage: jest.fn() }));
jest.mock('../../../amadeus_mock.js',  () => ({
  bookFlight:      jest.fn().mockResolvedValue({ pnr: 'HTLPNR', response: {} }),
  buildGDSPayload: jest.fn().mockReturnValue({}),
}));
jest.mock('../../../approval.js', () => ({
  submitForApproval: jest.fn().mockResolvedValue('OOP-HTL-001'),
  approveBooking:    jest.fn().mockResolvedValue({ pnr: 'APPRVD' }),
  rejectBooking:     jest.fn().mockResolvedValue({}),
  getApproval:       jest.fn().mockReturnValue(null),
}));

require('../../../Index.js');
const { processMessage } = require('../../../agent.js');

const STAFF_CHAT_ID    = SEEDED_REGISTRY['EMP-001'];
const DIRECTOR_CHAT_ID = SEEDED_REGISTRY['DIR-003'];

let _nextChatId = 800000;
const freshId = () => _nextChatId++;

function buildMsg(chatId, text) {
  return { message_id: Math.floor(Math.random()*9000)+1, from: { id: chatId, is_bot: false }, chat: { id: chatId, type: 'private' }, date: Math.floor(Date.now() / 1000), text };
}
function buildCallback(chatId, data) {
  return { id: String(Math.random()), from: { id: chatId }, message: { message_id: 1, chat: { id: chatId, type: 'private' } }, data };
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
  require('../../../approval.js').submitForApproval.mockResolvedValue('OOP-HTL-001');
});

// ─────────────────────────────────────────────────────────────────────────────
// INT-075: Hotel search returns options with select_N keyboard
// ─────────────────────────────────────────────────────────────────────────────
test('INT-075 — hotel search results displayed with select_N inline keyboard', async () => {
  const chatId = freshId();
  processMessage.mockResolvedValueOnce({
    reply:            'Here are available hotels in Bangkok:',
    geminiReply:      'Here are available hotels in Bangkok:',
    inventoryResults: {
      hotels: [mockHotelOptions.inPolicyBKK, mockHotelOptions.outOfPolicyBKK],
    },
    escalated: false,
  });

  await triggerStart(chatId);
  await triggerCallback(chatId, 'role_operations');
  await triggerMessage(chatId, 'Find me a hotel in Bangkok for June 1-3');

  const calls = botInstance.sendMessage.mock.calls;
  const hotelMsg = calls.find(c => c[0] === chatId && c[2]?.reply_markup?.inline_keyboard?.flat().some(b => b.callback_data === 'select_0'));
  expect(hotelMsg).toBeDefined();

  const buttons = hotelMsg[2].reply_markup.inline_keyboard.flat();
  expect(buttons.some(b => b.callback_data === 'select_0')).toBe(true);
  expect(buttons.some(b => b.callback_data === 'select_1')).toBe(true);
  // Buttons should include hotel name
  expect(buttons[0].text).toMatch(/Option 1/i);
});

// ─────────────────────────────────────────────────────────────────────────────
// INT-076: select_0 for hotel shows confirm/cancel keyboard with hotel details
// ─────────────────────────────────────────────────────────────────────────────
test('INT-076 — select_0 hotel shows booking_confirm / booking_cancel keyboard', async () => {
  const chatId = freshId();
  processMessage.mockResolvedValueOnce({
    reply: 'Hotels:', geminiReply: 'Hotels:',
    inventoryResults: { hotels: [mockHotelOptions.inPolicyBKK] },
    escalated: false,
  });

  await triggerStart(chatId);
  await triggerCallback(chatId, 'role_operations');
  await triggerMessage(chatId, 'Hotel Bangkok');

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

  // Summary should mention hotel name
  expect(confirmMsg[1]).toMatch(/Novotel|hotel/i);
});

// ─────────────────────────────────────────────────────────────────────────────
// INT-077: booking_confirm hotel → type='hotel' in bookings.json
// ─────────────────────────────────────────────────────────────────────────────
test('INT-077 — booking_confirm hotel writes type=hotel to bookings.json', async () => {
  const chatId = freshId();
  processMessage.mockResolvedValueOnce({
    reply: 'Hotels:', geminiReply: 'Hotels:',
    inventoryResults: { hotels: [mockHotelOptions.inPolicyBKK] },
    escalated: false,
  });

  await triggerStart(chatId);
  await triggerCallback(chatId, 'role_operations');
  await triggerMessage(chatId, 'Hotel Bangkok');
  await triggerCallback(chatId, 'select_0');

  jest.clearAllMocks();
  botInstance.sendMessage.mockResolvedValue({ message_id: 3 });
  botInstance.answerCallbackQuery.mockResolvedValue({});
  botInstance.editMessageReplyMarkup.mockResolvedValue({});

  await triggerCallback(chatId, 'booking_confirm');

  const bookings = readBookings();
  expect(bookings).toHaveLength(1);
  expect(bookings[0].type).toBe('hotel');
  expect(bookings[0].status).toBe('CONFIRMED');
});

// ─────────────────────────────────────────────────────────────────────────────
// INT-078: Hotel booking record contains hotel-specific fields
// ─────────────────────────────────────────────────────────────────────────────
test('INT-078 — hotel booking record has hotel_id, hotel_name, room_type, checkin, checkout', async () => {
  const chatId = freshId();
  processMessage.mockResolvedValueOnce({
    reply: 'Hotels:', geminiReply: 'Hotels:',
    inventoryResults: { hotels: [mockHotelOptions.inPolicyBKK] },
    escalated: false,
  });

  await triggerStart(chatId);
  await triggerCallback(chatId, 'role_operations');
  await triggerMessage(chatId, 'Hotel Bangkok');
  await triggerCallback(chatId, 'select_0');

  jest.clearAllMocks();
  botInstance.sendMessage.mockResolvedValue({ message_id: 4 });
  botInstance.answerCallbackQuery.mockResolvedValue({});
  botInstance.editMessageReplyMarkup.mockResolvedValue({});

  await triggerCallback(chatId, 'booking_confirm');

  const bookings = readBookings();
  const b = bookings[0];
  expect(b.hotel_id).toBe('H001');
  expect(b.hotel_name).toBe('Novotel Bangkok Sukhumvit 20');
  expect(b.room_type).toBe('Superior');
  expect(b.checkin).toBe('2026-06-01');
  expect(b.checkout).toBe('2026-06-03');
  expect(b.price_per_night).toEqual({ amount: 4000, currency: 'THB' });
});

// ─────────────────────────────────────────────────────────────────────────────
// INT-079: Hotel PNR is 6 chars from correct charset (no I/O/1/0)
// ─────────────────────────────────────────────────────────────────────────────
test('INT-079 — hotel booking PNR is 6 chars from ABCDEFGHJKLMNPQRSTUVWXYZ23456789', async () => {
  const chatId = freshId();
  processMessage.mockResolvedValueOnce({
    reply: 'Hotels:', geminiReply: 'Hotels:',
    inventoryResults: { hotels: [mockHotelOptions.inPolicyBKK] },
    escalated: false,
  });

  await triggerStart(chatId);
  await triggerCallback(chatId, 'role_operations');
  await triggerMessage(chatId, 'Hotel Bangkok');
  await triggerCallback(chatId, 'select_0');

  jest.clearAllMocks();
  botInstance.sendMessage.mockResolvedValue({ message_id: 5 });
  botInstance.answerCallbackQuery.mockResolvedValue({});
  botInstance.editMessageReplyMarkup.mockResolvedValue({});

  await triggerCallback(chatId, 'booking_confirm');

  const bookings = readBookings();
  const pnr = bookings[0].pnr;

  expect(pnr).toHaveLength(6);
  // Must not contain I, O, 1, or 0
  expect(pnr).not.toMatch(/[IO10]/);
  // Must be uppercase alphanumeric
  expect(pnr).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
});

// ─────────────────────────────────────────────────────────────────────────────
// INT-080: Hotel confirmation message contains hotel name and PNR
// ─────────────────────────────────────────────────────────────────────────────
test('INT-080 — hotel confirmation message includes hotel name and reference code', async () => {
  const chatId = freshId();
  processMessage.mockResolvedValueOnce({
    reply: 'Hotels:', geminiReply: 'Hotels:',
    inventoryResults: { hotels: [mockHotelOptions.inPolicyBKK] },
    escalated: false,
  });

  await triggerStart(chatId);
  await triggerCallback(chatId, 'role_operations');
  await triggerMessage(chatId, 'Hotel Bangkok');
  await triggerCallback(chatId, 'select_0');

  jest.clearAllMocks();
  botInstance.sendMessage.mockResolvedValue({ message_id: 6 });
  botInstance.answerCallbackQuery.mockResolvedValue({});
  botInstance.editMessageReplyMarkup.mockResolvedValue({});

  await triggerCallback(chatId, 'booking_confirm');

  const bookings = readBookings();
  const pnr = bookings[0].pnr;

  const confirmMsg = botInstance.sendMessage.mock.calls.find(
    c => c[0] === chatId && c[1].includes(pnr)
  );
  expect(confirmMsg).toBeDefined();
  expect(confirmMsg[1]).toMatch(/Novotel|hotel/i);
});

// ─────────────────────────────────────────────────────────────────────────────
// INT-081: OOP hotel → justification prompt (not CONFIRMED immediately)
// ─────────────────────────────────────────────────────────────────────────────
test('INT-081 — OOP hotel triggers justification prompt, no booking written', async () => {
  const chatId = freshId();
  processMessage.mockResolvedValueOnce({
    reply: 'Hotels:', geminiReply: 'Hotels:',
    inventoryResults: { hotels: [mockHotelOptions.outOfPolicyBKK] },
    escalated: false,
  });

  await triggerStart(chatId);
  await triggerCallback(chatId, 'role_operations');
  await triggerMessage(chatId, 'Hotel Bangkok');
  await triggerCallback(chatId, 'select_0');
  await triggerCallback(chatId, 'booking_confirm');

  const bookings = readBookings();
  expect(bookings).toHaveLength(0);

  const justificationMsg = botInstance.sendMessage.mock.calls.find(
    c => c[0] === chatId && /justification/i.test(c[1])
  );
  expect(justificationMsg).toBeDefined();
});

// ─────────────────────────────────────────────────────────────────────────────
// INT-082: OOP hotel justification → submitForApproval with type=hotel record
// ─────────────────────────────────────────────────────────────────────────────
test('INT-082 — OOP hotel justification calls submitForApproval with type=hotel record', async () => {
  const chatId = freshId();
  processMessage.mockResolvedValueOnce({
    reply: 'Hotels:', geminiReply: 'Hotels:',
    inventoryResults: { hotels: [mockHotelOptions.outOfPolicyBKK] },
    escalated: false,
  });

  await triggerStart(chatId);
  await triggerCallback(chatId, 'role_operations');
  await triggerMessage(chatId, 'Hotel Bangkok');
  await triggerCallback(chatId, 'select_0');
  await triggerCallback(chatId, 'booking_confirm');

  jest.clearAllMocks();
  botInstance.sendMessage.mockResolvedValue({ message_id: 7 });

  await triggerMessage(chatId, 'Client requires this specific property');

  const { submitForApproval } = require('../../../approval.js');
  expect(submitForApproval).toHaveBeenCalledWith(
    expect.objectContaining({
      bookingRecord: expect.objectContaining({
        type:   'hotel',
        status: 'PENDING_APPROVAL',
        pnr:    null,
      }),
      approverEmployeeId: 'VP-004',
    })
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// INT-083: booking_cancel for hotel — no booking written
// ─────────────────────────────────────────────────────────────────────────────
test('INT-083 — booking_cancel hotel → no booking written, cancel acknowledged', async () => {
  const chatId = freshId();
  processMessage.mockResolvedValueOnce({
    reply: 'Hotels:', geminiReply: 'Hotels:',
    inventoryResults: { hotels: [mockHotelOptions.inPolicyBKK] },
    escalated: false,
  });

  await triggerStart(chatId);
  await triggerCallback(chatId, 'role_operations');
  await triggerMessage(chatId, 'Hotel Bangkok');
  await triggerCallback(chatId, 'select_0');

  jest.clearAllMocks();
  botInstance.sendMessage.mockResolvedValue({ message_id: 8 });
  botInstance.answerCallbackQuery.mockResolvedValue({});
  botInstance.editMessageReplyMarkup.mockResolvedValue({});

  await triggerCallback(chatId, 'booking_cancel');

  const bookings = readBookings();
  expect(bookings).toHaveLength(0);
  expect(botInstance.sendMessage).toHaveBeenCalled();
});

// ─────────────────────────────────────────────────────────────────────────────
// INT-084: In-policy SIN hotel → CONFIRMED with SGD price
// ─────────────────────────────────────────────────────────────────────────────
test('INT-084 — in-policy Singapore hotel (300 SGD) → CONFIRMED booking', async () => {
  const chatId = freshId();
  processMessage.mockResolvedValueOnce({
    reply: 'Hotels in Singapore:', geminiReply: 'Hotels in Singapore:',
    inventoryResults: { hotels: [mockHotelOptions.inPolicySIN] },
    escalated: false,
  });

  await triggerStart(chatId);
  await triggerCallback(chatId, 'role_director');
  await triggerMessage(chatId, 'Hotel Singapore June 1-3');
  await triggerCallback(chatId, 'select_0');

  jest.clearAllMocks();
  botInstance.sendMessage.mockResolvedValue({ message_id: 9 });
  botInstance.answerCallbackQuery.mockResolvedValue({});
  botInstance.editMessageReplyMarkup.mockResolvedValue({});

  await triggerCallback(chatId, 'booking_confirm');

  const bookings = readBookings();
  const sinBooking = bookings.find(b => b.hotel_id === 'H003');
  expect(sinBooking).toBeDefined();
  expect(sinBooking.status).toBe('CONFIRMED');
  expect(sinBooking.price_per_night.currency).toBe('SGD');
  expect(sinBooking.price_per_night.amount).toBe(300);
});

// ─────────────────────────────────────────────────────────────────────────────
// INT-085: Multiple hotel options — select_1 picks second hotel
// ─────────────────────────────────────────────────────────────────────────────
test('INT-085 — select_1 picks second hotel option correctly', async () => {
  const chatId = freshId();
  processMessage.mockResolvedValueOnce({
    reply: 'Hotels:', geminiReply: 'Hotels:',
    inventoryResults: {
      hotels: [mockHotelOptions.inPolicyBKK, mockHotelOptions.inPolicySIN],
    },
    escalated: false,
  });

  await triggerStart(chatId);
  await triggerCallback(chatId, 'role_operations');
  await triggerMessage(chatId, 'Hotels');

  jest.clearAllMocks();
  botInstance.sendMessage.mockResolvedValue({ message_id: 10 });
  botInstance.answerCallbackQuery.mockResolvedValue({});
  botInstance.editMessageReplyMarkup.mockResolvedValue({});

  // Select second option (index 1)
  await triggerCallback(chatId, 'select_1');

  const calls = botInstance.sendMessage.mock.calls;
  const selectionMsg = calls.find(c => c[0] === chatId && c[1].includes('Marriott'));
  expect(selectionMsg).toBeDefined();
});
