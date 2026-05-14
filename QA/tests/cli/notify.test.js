/**
 * notify.test.js
 * CLI-001 through CLI-015 — notify.js CLI automation tests.
 *
 * Strategy:
 *   - Uses spawnSync to invoke notify.js as a child process
 *   - TEST_MODE=true intercepts bot.sendMessage → writes to .last_notify_output.json
 *   - Seeds a local TEST_REGISTRY before each test; restores after
 *   - Never sends real Telegram messages
 *   - Never requires a live bot token
 *
 * Run: npx jest QA/tests/cli/notify.test.js
 *      node --test QA/tests/cli/notify.test.js   (Node 20+)
 */

'use strict';

const { spawnSync } = require('child_process');
const fs            = require('fs');
const path          = require('path');

// ── Paths ─────────────────────────────────────────────────────────────────────
const PROJECT_ROOT       = path.join(__dirname, '../../..');
const REGISTRY_PATH      = path.join(PROJECT_ROOT, 'chat_registry.json');
const OUTPUT_FILE        = path.join(__dirname, '../.last_notify_output.json');
const REGISTRY_BACKUP    = REGISTRY_PATH + '.notify-test-bak';

// ── Test registry — fake chat_ids (no real Telegram accounts) ─────────────────
const TEST_REGISTRY = {
  'EMP-001': 987654321,
  'MGR-002': 987654322,
  'DIR-003': 987654323,
  'VP-004':  987654324,
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function runNotify(args, env = {}) {
  return spawnSync('node', ['notify.js', ...args], {
    cwd:      PROJECT_ROOT,
    env:      { ...process.env, TEST_MODE: 'true', TELEGRAM_BOT_TOKEN: 'test-token', ...env },
    encoding: 'utf8',
  });
}

function readCapturedMessage() {
  if (!fs.existsSync(OUTPUT_FILE)) return null;
  return JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'));
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────
beforeEach(() => {
  // Write test registry
  fs.writeFileSync(REGISTRY_PATH, JSON.stringify(TEST_REGISTRY, null, 2));
  // Clear last captured output
  if (fs.existsSync(OUTPUT_FILE)) fs.unlinkSync(OUTPUT_FILE);
});

afterEach(() => {
  // Restore registry from reset-test-data SEEDED_REGISTRY if needed
  const { resetRegistry } = require('../fixtures/reset-test-data');
  resetRegistry();
});

// ─────────────────────────────────────────────────────────────────────────────
// CLI-001: booking_confirmed — all required fields present
// ─────────────────────────────────────────────────────────────────────────────
test('CLI-001 — booking_confirmed sends message with PNR, flight, and date', () => {
  const result = runNotify([
    'booking_confirmed',
    '--employee', 'EMP-001',
    '--ref',     'PNR-20260514-001',
    '--flight',  'TG408 BKK→UTP',
    '--date',    '2026-05-14 08:30',
  ]);

  expect(result.status).toBe(0);

  const msg = readCapturedMessage();
  expect(msg).not.toBeNull();
  expect(msg.chatId).toBe(TEST_REGISTRY['EMP-001']);
  expect(msg.text).toContain('PNR-20260514-001');
  expect(msg.text).toContain('TG408 BKK→UTP');
  expect(msg.text).toContain('2026-05-14 08:30');
  expect(msg.text).toContain('Booking Confirmed');
});

// ─────────────────────────────────────────────────────────────────────────────
// CLI-002: flight_canceled — non-empty body with flight and date
// ─────────────────────────────────────────────────────────────────────────────
test('CLI-002 — flight_canceled sends message with flight and date', () => {
  const result = runNotify([
    'flight_canceled',
    '--employee', 'EMP-001',
    '--flight',  'TG408',
    '--date',    '2026-05-14',
  ]);

  expect(result.status).toBe(0);

  const msg = readCapturedMessage();
  expect(msg).not.toBeNull();
  expect(msg.text).toContain('TG408');
  expect(msg.text).toContain('2026-05-14');
  expect(msg.text).toMatch(/cancel/i);
  expect(msg.text.length).toBeGreaterThan(20);
});

// ─────────────────────────────────────────────────────────────────────────────
// CLI-003: delayed — delay info and new time in body
// ─────────────────────────────────────────────────────────────────────────────
test('CLI-003 — delayed includes delay duration and new departure time', () => {
  const result = runNotify([
    'delayed',
    '--employee', 'EMP-001',
    '--flight',  'TG408',
    '--delay',   '2 hours',
    '--new-time', '10:30',
  ]);

  expect(result.status).toBe(0);

  const msg = readCapturedMessage();
  expect(msg).not.toBeNull();
  expect(msg.text).toContain('2 hours');
  expect(msg.text).toContain('10:30');
  expect(msg.text).toMatch(/delay/i);
});

// ─────────────────────────────────────────────────────────────────────────────
// CLI-004: policy_pending — ref in body
// ─────────────────────────────────────────────────────────────────────────────
test('CLI-004 — policy_pending includes reference number and details', () => {
  const result = runNotify([
    'policy_pending',
    '--employee', 'EMP-001',
    '--ref',     'OOP-2026-001',
    '--details', 'EK371 Business Class — 28,000 THB',
  ]);

  expect(result.status).toBe(0);

  const msg = readCapturedMessage();
  expect(msg).not.toBeNull();
  expect(msg.text).toContain('OOP-2026-001');
  expect(msg.text).toContain('EK371 Business Class');
  expect(msg.text).toMatch(/pending|approval/i);
});

// ─────────────────────────────────────────────────────────────────────────────
// CLI-005: policy_approved — ref in body
// ─────────────────────────────────────────────────────────────────────────────
test('CLI-005 — policy_approved includes reference number', () => {
  const result = runNotify([
    'policy_approved',
    '--employee', 'EMP-001',
    '--ref',     'OOP-2026-001',
  ]);

  expect(result.status).toBe(0);

  const msg = readCapturedMessage();
  expect(msg).not.toBeNull();
  expect(msg.text).toContain('OOP-2026-001');
  expect(msg.text).toMatch(/approved/i);
});

// ─────────────────────────────────────────────────────────────────────────────
// CLI-006: policy_rejected — reason in body
// ─────────────────────────────────────────────────────────────────────────────
test('CLI-006 — policy_rejected includes reference and rejection reason', () => {
  const result = runNotify([
    'policy_rejected',
    '--employee', 'EMP-001',
    '--ref',     'OOP-2026-001',
    '--reason',  'Exceeds long-haul cap. Economy alternative required.',
  ]);

  expect(result.status).toBe(0);

  const msg = readCapturedMessage();
  expect(msg).not.toBeNull();
  expect(msg.text).toContain('OOP-2026-001');
  expect(msg.text).toContain('Exceeds long-haul cap');
  expect(msg.text).toMatch(/reject/i);
});

// ─────────────────────────────────────────────────────────────────────────────
// CLI-007: hotel_confirmed — hotel name and dates in body
// ─────────────────────────────────────────────────────────────────────────────
test('CLI-007 — hotel_confirmed includes hotel name, check-in, and check-out dates', () => {
  const result = runNotify([
    'hotel_confirmed',
    '--employee', 'EMP-001',
    '--hotel',   'Novotel Bangkok Sukhumvit 20',
    '--checkin', '2026-05-14',
    '--checkout', '2026-05-16',
  ]);

  expect(result.status).toBe(0);

  const msg = readCapturedMessage();
  expect(msg).not.toBeNull();
  expect(msg.text).toContain('Novotel Bangkok Sukhumvit 20');
  expect(msg.text).toContain('2026-05-14');
  expect(msg.text).toContain('2026-05-16');
  expect(msg.text).toMatch(/hotel|booking/i);
});

// ─────────────────────────────────────────────────────────────────────────────
// CLI-008: disruption — area and details in body
// ─────────────────────────────────────────────────────────────────────────────
test('CLI-008 — disruption includes area and details text', () => {
  const result = runNotify([
    'disruption',
    '--employee', 'EMP-001',
    '--area',    'Bangkok',
    '--details', 'Suvarnabhumi Airport closed due to severe weather.',
  ]);

  expect(result.status).toBe(0);

  const msg = readCapturedMessage();
  expect(msg).not.toBeNull();
  expect(msg.text).toContain('Bangkok');
  expect(msg.text).toContain('Suvarnabhumi Airport closed due to severe weather');
  expect(msg.text).toMatch(/disruption|alert/i);
});

// ─────────────────────────────────────────────────────────────────────────────
// CLI-009: spend_summary — amount and budget in body
// ─────────────────────────────────────────────────────────────────────────────
test('CLI-009 — spend_summary includes month, spent amount, and budget', () => {
  const result = runNotify([
    'spend_summary',
    '--employee', 'EMP-001',
    '--month',   'May 2026',
    '--amount',  '45,000 THB',
    '--budget',  '50,000 THB',
  ]);

  expect(result.status).toBe(0);

  const msg = readCapturedMessage();
  expect(msg).not.toBeNull();
  expect(msg.text).toContain('May 2026');
  expect(msg.text).toContain('45,000 THB');
  expect(msg.text).toContain('50,000 THB');
  expect(msg.text).toMatch(/spend|summary/i);
});

// ─────────────────────────────────────────────────────────────────────────────
// CLI-010: budget_warning — percent and remaining in body
// ─────────────────────────────────────────────────────────────────────────────
test('CLI-010 — budget_warning includes percentage and remaining amount', () => {
  const result = runNotify([
    'budget_warning',
    '--employee', 'EMP-001',
    '--percent',  '85',
    '--remaining', '7,500 THB',
  ]);

  expect(result.status).toBe(0);

  const msg = readCapturedMessage();
  expect(msg).not.toBeNull();
  expect(msg.text).toContain('85');
  expect(msg.text).toContain('7,500 THB');
  expect(msg.text).toMatch(/budget|warning/i);
});

// ─────────────────────────────────────────────────────────────────────────────
// CLI-011: Unknown employee_id → exit ≥1, readable error naming the ID
// ─────────────────────────────────────────────────────────────────────────────
test('CLI-011 — unknown employee_id EMP-999 exits with code ≥1 and names the ID in error', () => {
  const result = runNotify([
    'booking_confirmed',
    '--employee', 'EMP-999',
    '--ref',     'ABC123',
    '--flight',  'TG401',
    '--date',    '2026-06-01',
  ]);

  expect(result.status).toBeGreaterThanOrEqual(1);

  const output = result.stdout + result.stderr;
  expect(output).toContain('EMP-999');
  // Must not be a raw Node.js stack trace as primary output
  expect(output.trim()).not.toMatch(/^Error:\s+/);
  expect(output.trim()).not.toMatch(/^    at /);
});

// ─────────────────────────────────────────────────────────────────────────────
// CLI-012: Missing chat_registry.json → exit ≥1, readable error
// ─────────────────────────────────────────────────────────────────────────────
test('CLI-012 — missing chat_registry.json exits with code ≥1', () => {
  // Temporarily rename the registry
  fs.renameSync(REGISTRY_PATH, REGISTRY_BACKUP);
  let result;
  try {
    result = runNotify([
      'booking_confirmed',
      '--employee', 'EMP-001',
      '--ref',     'ABC123',
      '--flight',  'TG401',
      '--date',    '2026-06-01',
    ]);
  } finally {
    fs.renameSync(REGISTRY_BACKUP, REGISTRY_PATH);
  }

  expect(result.status).toBeGreaterThanOrEqual(1);
  // Should not output an unformatted stack trace as the primary message
  const output = result.stdout + result.stderr;
  expect(output.trim().length).toBeGreaterThan(0);
});

// ─────────────────────────────────────────────────────────────────────────────
// CLI-013: Malformed chat_registry.json → exit ≥1
// ─────────────────────────────────────────────────────────────────────────────
test('CLI-013 — malformed chat_registry.json exits with code ≥1', () => {
  fs.writeFileSync(REGISTRY_PATH, '{ invalid json !!');
  const result = runNotify([
    'booking_confirmed',
    '--employee', 'EMP-001',
    '--ref',     'ABC123',
    '--flight',  'TG401',
    '--date',    '2026-06-01',
  ]);

  // Restore valid registry
  fs.writeFileSync(REGISTRY_PATH, JSON.stringify(TEST_REGISTRY, null, 2));

  expect(result.status).toBeGreaterThanOrEqual(1);
});

// ─────────────────────────────────────────────────────────────────────────────
// CLI-014: No raw chat_id in message body (privacy requirement)
// ─────────────────────────────────────────────────────────────────────────────
test('CLI-014 — raw numeric chat_id (987654321) must NOT appear in message body', () => {
  const result = runNotify([
    'booking_confirmed',
    '--employee', 'EMP-001',
    '--ref',     'PNR-PRIV-001',
    '--flight',  'TG401 BKK→SIN',
    '--date',    '2026-06-01',
  ]);

  expect(result.status).toBe(0);

  const msg = readCapturedMessage();
  expect(msg).not.toBeNull();

  const rawChatId = String(TEST_REGISTRY['EMP-001']); // '987654321'
  expect(msg.text).not.toContain(rawChatId);
});

// ─────────────────────────────────────────────────────────────────────────────
// CLI-015: No "undefined" in any message body (template field completeness)
// ─────────────────────────────────────────────────────────────────────────────
test('CLI-015 — no "undefined" in message body for booking_confirmed with all fields', () => {
  const result = runNotify([
    'booking_confirmed',
    '--employee', 'EMP-001',
    '--ref',     'PNR-UNDEF-001',
    '--flight',  'TG401 BKK→SIN',
    '--date',    '2026-06-01 08:00',
  ]);

  expect(result.status).toBe(0);

  const msg = readCapturedMessage();
  expect(msg).not.toBeNull();
  expect(msg.text).not.toContain('undefined');
});
