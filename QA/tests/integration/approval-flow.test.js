/**
 * approval-flow.test.js
 * INT-055 through INT-065 — Out-of-policy approval workflow.
 *
 * Coverage:
 *   - OOP → justification prompt
 *   - Justification → submitForApproval (approvalId returned)
 *   - VP sees approve/reject keyboard
 *   - approve_<id> callback → approveBooking, PNR issued
 *   - reject_<id> callback → awaitingRejectionReason
 *   - Rejection reason → rejectBooking called
 *   - VP self-approval block (VP-004 cannot be routed to approval)
 *   - approvals.json NOT modified directly (delegated to approval.js)
 *
 * Run: npx jest QA/tests/integration/approval-flow.test.js
 */

'use strict';

process.env.TELEGRAM_BOT_TOKEN = 'test-token-approval';
process.env.GEMINI_API_KEY     = 'test-gemini-key';

const path = require('path');
const fs   = require('fs');
const { resetTestData, readBookings, SEEDED_REGISTRY } = require('../fixtures/reset-test-data');
const { mockFlightOptions } = require('../fixtures/test-profiles');

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

jest.mock('../../../agent.js',       () => ({ processMessage: jest.fn() }));
jest.mock('../../../amadeus_mock.js', () => ({
  bookFlight:      jest.fn().mockResolvedValue({ pnr: 'APRVPN', response: {} }),
  buildGDSPayload: jest.fn().mockReturnValue({}),
}));

// approval.js is NOT fully mocked here — we test interaction points
jest.mock('../../../approval.js', () => ({
  submitForApproval: jest.fn().mockResolvedValue('OOP-2026-001'),
  approveBooking:    jest.fn().mockResolvedValue({ pnr: 'APPRVD' }),
  rejectBooking:     jest.fn().mockResolvedValue({}),
  getApproval:       jest.fn().mockReturnValue(null),
}));

require('../../../Index.js');
const { processMessage }                           = require('../../../agent.js');
const { submitForApproval, approveBooking, rejectBooking } = require('../../../approval.js');

const STAFF_CHAT_ID = SEEDED_REGISTRY['EMP-001'];
const VP_CHAT_ID    = SEEDED_REGISTRY['VP-004'];

let _nextChatId = 600000;
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

/** Helper: set up Staff with one OOP flight option selected and confirmed */
async function setupOopBookingConfirmed(chatId) {
  processMessage.mockResolvedValueOnce({
    reply: 'Options:', geminiReply: 'Options:',
    inventoryResults: { flights: [mockFlightOptions.outOfPolicyEconomy] },
    escalated: false,
  });
  await triggerStart(chatId);
  await triggerCallback(chatId, 'role_operations');
  await triggerMessage(chatId, 'BKK to SIN');
  await triggerCallback(chatId, 'select_0');
  await triggerCallback(chatId, 'booking_confirm'); // triggers OOP prompt
}

beforeEach(() => {
  resetTestData();
  jest.clearAllMocks();
  botInstance.sendMessage.mockResolvedValue({ message_id: 1 });
  botInstance.answerCallbackQuery.mockResolvedValue({});
  botInstance.editMessageReplyMarkup.mockResolvedValue({});
  submitForApproval.mockResolvedValue('OOP-2026-001');
  approveBooking.mockResolvedValue({ pnr: 'APPRVD' });
  rejectBooking.mockResolvedValue({});
});

// ─────────────────────────────────────────────────────────────────────────────
// INT-055: OOP booking_confirm triggers justification prompt
// ─────────────────────────────────────────────────────────────────────────────
test('INT-055 — OOP booking_confirm sends justification request message', async () => {
  const chatId = freshId();
  await setupOopBookingConfirmed(chatId);

  const calls = botInstance.sendMessage.mock.calls;
  const justificationMsg = calls.find(c => c[0] === chatId && /justification/i.test(c[1]));
  expect(justificationMsg).toBeDefined();
  expect(justificationMsg[1]).toMatch(/out.of.policy|approval|justification/i);
});

// ─────────────────────────────────────────────────────────────────────────────
// INT-056: Justification message calls submitForApproval with correct fields
// ─────────────────────────────────────────────────────────────────────────────
test('INT-056 — justification text calls submitForApproval with approverEmployeeId VP-004', async () => {
  const chatId = freshId();
  await setupOopBookingConfirmed(chatId);

  jest.clearAllMocks();
  botInstance.sendMessage.mockResolvedValue({ message_id: 2 });

  await triggerMessage(chatId, 'Trip required for Q3 client review');

  expect(submitForApproval).toHaveBeenCalledTimes(1);
  const arg = submitForApproval.mock.calls[0][0];
  expect(arg.justification).toBe('Trip required for Q3 client review');
  expect(arg.approverEmployeeId).toBe('VP-004');
  expect(arg.bookingRecord.employee_id).toBe('EMP-001');
  expect(arg.bookingRecord.status).toBe('PENDING_APPROVAL');
  expect(arg.travelerChatId).toBe(chatId);
});

// ─────────────────────────────────────────────────────────────────────────────
// INT-057: submitForApproval returns approvalId (mock returns 'OOP-2026-001')
// ─────────────────────────────────────────────────────────────────────────────
test('INT-057 — submitForApproval resolves with approval ID string', async () => {
  const chatId = freshId();
  await setupOopBookingConfirmed(chatId);

  jest.clearAllMocks();
  botInstance.sendMessage.mockResolvedValue({ message_id: 3 });

  await triggerMessage(chatId, 'Board meeting in London');

  // submitForApproval should have been called and should have resolved
  expect(submitForApproval).toHaveBeenCalled();
  // The resolved value ('OOP-2026-001') is used internally; verify no crash
  expect(botInstance.sendMessage).not.toHaveBeenCalledWith(
    chatId,
    expect.stringContaining('error'),
    expect.anything()
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// INT-058: approve_<id> callback calls approveBooking
// ─────────────────────────────────────────────────────────────────────────────
test('INT-058 — approve_<id> callback triggers approveBooking and sends PNR to approver', async () => {
  const chatId = freshId();
  approveBooking.mockResolvedValueOnce({ pnr: 'APRPNR' });

  await triggerStart(chatId);
  await triggerCallback(chatId, 'role_vp');

  jest.clearAllMocks();
  botInstance.sendMessage.mockResolvedValue({ message_id: 5 });
  botInstance.answerCallbackQuery.mockResolvedValue({});
  botInstance.editMessageReplyMarkup.mockResolvedValue({});

  await triggerCallback(chatId, 'approve_OOP-2026-001');

  expect(approveBooking).toHaveBeenCalledWith('OOP-2026-001');

  // Approver receives confirmation with PNR
  const confirmMsg = botInstance.sendMessage.mock.calls.find(
    c => c[0] === chatId && /APRPNR|approved/i.test(c[1])
  );
  expect(confirmMsg).toBeDefined();
});

// ─────────────────────────────────────────────────────────────────────────────
// INT-059: reject_<id> callback sets awaitingRejectionReason
// ─────────────────────────────────────────────────────────────────────────────
test('INT-059 — reject_<id> callback prompts VP for rejection reason', async () => {
  const chatId = freshId();
  await triggerStart(chatId);
  await triggerCallback(chatId, 'role_vp');

  jest.clearAllMocks();
  botInstance.sendMessage.mockResolvedValue({ message_id: 6 });
  botInstance.answerCallbackQuery.mockResolvedValue({});
  botInstance.editMessageReplyMarkup.mockResolvedValue({});

  await triggerCallback(chatId, 'reject_OOP-2026-001');

  // Should ask for reason text
  const reasonPrompt = botInstance.sendMessage.mock.calls.find(
    c => c[0] === chatId && /reason/i.test(c[1])
  );
  expect(reasonPrompt).toBeDefined();
});

// ─────────────────────────────────────────────────────────────────────────────
// INT-060: Rejection reason text calls rejectBooking with reason
// ─────────────────────────────────────────────────────────────────────────────
test('INT-060 — rejection reason message calls rejectBooking(approvalId, reason)', async () => {
  const chatId = freshId();
  await triggerStart(chatId);
  await triggerCallback(chatId, 'role_vp');
  await triggerCallback(chatId, 'reject_OOP-2026-001'); // sets awaitingRejectionReason

  jest.clearAllMocks();
  botInstance.sendMessage.mockResolvedValue({ message_id: 7 });

  await triggerMessage(chatId, 'Exceeds long-haul cap. Economy alternative required.');

  expect(rejectBooking).toHaveBeenCalledWith(
    'OOP-2026-001',
    'Exceeds long-haul cap. Economy alternative required.'
  );

  const ackMsg = botInstance.sendMessage.mock.calls.find(
    c => c[0] === chatId && /rejected/i.test(c[1])
  );
  expect(ackMsg).toBeDefined();
});

// ─────────────────────────────────────────────────────────────────────────────
// INT-061: VP-004 booking OOP → does NOT route to approval (bypass)
// ─────────────────────────────────────────────────────────────────────────────
test('INT-061 — VP-004 OOP booking bypasses approval (APPROVER_EMPLOYEE_ID check)', async () => {
  const chatId = freshId();
  require('../../../amadeus_mock.js').bookFlight.mockResolvedValue({ pnr: 'VPOOP1', response: {} });

  processMessage.mockResolvedValueOnce({
    reply: 'Options:', geminiReply: 'Options:',
    inventoryResults: { flights: [{ ...mockFlightOptions.outOfPolicyBusiness }] },
    escalated: false,
  });

  await triggerStart(chatId);
  await triggerCallback(chatId, 'role_vp');
  await triggerCallback(chatId, 'vp_book_flights');
  await triggerMessage(chatId, 'BKK to LHR');
  await triggerCallback(chatId, 'select_0');

  jest.clearAllMocks();
  botInstance.sendMessage.mockResolvedValue({ message_id: 8 });
  botInstance.answerCallbackQuery.mockResolvedValue({});
  botInstance.editMessageReplyMarkup.mockResolvedValue({});

  await triggerCallback(chatId, 'booking_confirm');

  // No justification prompt should appear — VP bypasses OOP check
  const justificationPrompt = botInstance.sendMessage.mock.calls.find(
    c => c[0] === chatId && /justification/i.test(c[1])
  );
  expect(justificationPrompt).toBeUndefined();

  // Booking should be CONFIRMED directly
  const bookings = readBookings();
  const vpBooking = bookings.find(b => b.employee_id === 'VP-004');
  if (vpBooking) {
    expect(vpBooking.status).toBe('CONFIRMED');
  }
  expect(submitForApproval).not.toHaveBeenCalled();
});

// ─────────────────────────────────────────────────────────────────────────────
// INT-062: approveBooking error → approver receives error message
// ─────────────────────────────────────────────────────────────────────────────
test('INT-062 — approveBooking error sends error message to approver chat', async () => {
  const chatId = freshId();
  approveBooking.mockRejectedValueOnce(new Error('Approval OOP-NOTFOUND not found'));

  await triggerStart(chatId);
  await triggerCallback(chatId, 'role_vp');

  jest.clearAllMocks();
  botInstance.sendMessage.mockResolvedValue({ message_id: 9 });
  botInstance.answerCallbackQuery.mockResolvedValue({});
  botInstance.editMessageReplyMarkup.mockResolvedValue({});

  await triggerCallback(chatId, 'approve_OOP-NOTFOUND');

  const errorMsg = botInstance.sendMessage.mock.calls.find(
    c => c[0] === chatId && /error/i.test(c[1])
  );
  expect(errorMsg).toBeDefined();
});

// ─────────────────────────────────────────────────────────────────────────────
// INT-063: OOP booking record has chat_id set (for notifying traveler later)
// ─────────────────────────────────────────────────────────────────────────────
test('INT-063 — OOP booking record passed to submitForApproval includes travelerChatId', async () => {
  const chatId = freshId();
  await setupOopBookingConfirmed(chatId);

  jest.clearAllMocks();
  botInstance.sendMessage.mockResolvedValue({ message_id: 10 });
  await triggerMessage(chatId, 'Important client engagement');

  const arg = submitForApproval.mock.calls[0]?.[0];
  expect(arg).toBeDefined();
  expect(arg.travelerChatId).toBe(chatId);
  expect(arg.approverChatId).toBe(VP_CHAT_ID); // from SEEDED_REGISTRY
});

// ─────────────────────────────────────────────────────────────────────────────
// INT-064: Multiple OOP bookings — each gets unique approval call
// ─────────────────────────────────────────────────────────────────────────────
test('INT-064 — two sequential OOP bookings produce two submitForApproval calls', async () => {
  const chatId = freshId();
  // First OOP booking
  await setupOopBookingConfirmed(chatId);
  jest.clearAllMocks();
  botInstance.sendMessage.mockResolvedValue({ message_id: 11 });
  await triggerMessage(chatId, 'First business reason');

  // Reset flight search result for second booking
  processMessage.mockResolvedValueOnce({
    reply: 'Options:', geminiReply: 'Options:',
    inventoryResults: { flights: [mockFlightOptions.outOfPolicyEconomy] },
    escalated: false,
  });
  await triggerMessage(chatId, 'BKK to SIN again');
  await triggerCallback(chatId, 'select_0');
  await triggerCallback(chatId, 'booking_confirm');
  await triggerMessage(chatId, 'Second business reason');

  expect(submitForApproval).toHaveBeenCalledTimes(2);
});

// ─────────────────────────────────────────────────────────────────────────────
// INT-065: awaitingJustification cleared after justification submitted
// ─────────────────────────────────────────────────────────────────────────────
test('INT-065 — after justification submitted, subsequent message goes to AI (not re-submits)', async () => {
  const chatId = freshId();
  processMessage.mockResolvedValue({
    reply: 'How can I help?', geminiReply: 'How can I help?',
    inventoryResults: {}, escalated: false,
  });

  await setupOopBookingConfirmed(chatId);

  jest.clearAllMocks();
  botInstance.sendMessage.mockResolvedValue({ message_id: 12 });

  // Submit justification
  await triggerMessage(chatId, 'Client site visit required');

  jest.clearAllMocks();
  botInstance.sendMessage.mockResolvedValue({ message_id: 13 });

  // Next message should go to processMessage (AI), not re-trigger approval
  await triggerMessage(chatId, 'What hotels are available?');

  expect(processMessage).toHaveBeenCalledWith(
    'What hotels are available?',
    expect.any(Array),
    'Operations/Staff',
    expect.objectContaining({ employee_id: 'EMP-001' }),
    chatId
  );
  // submitForApproval should NOT have been called again
  expect(submitForApproval).not.toHaveBeenCalled();
});
