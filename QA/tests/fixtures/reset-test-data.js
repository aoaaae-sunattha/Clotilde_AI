/**
 * reset-test-data.js
 * QA fixture — resets file-based state to a clean baseline before each test.
 *
 * Call in beforeEach for ALL L3 integration tests:
 *   const { resetTestData } = require('../fixtures/reset-test-data');
 *   beforeEach(async () => { await resetTestData(); });
 *
 * What it resets:
 *   - bookings.json        → empty array  []
 *   - chat_registry.json   → seeded with 4 test profiles (so role-based tests work)
 *
 * Seeded chat_registry entries:
 *   EMP-001 (Staff)    → chat_id 100001
 *   MGR-002 (Manager)  → chat_id 100002
 *   DIR-003 (Director) → chat_id 100003
 *   VP-004  (VP)       → chat_id 100004
 *
 * These chat_ids are LOCAL TEST IDs only — they do not correspond to any real
 * Telegram account. All sendMessage calls must be mocked before tests run.
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const PROJECT_ROOT    = path.join(__dirname, '../../..');
const BOOKINGS_PATH   = path.join(PROJECT_ROOT, 'bookings.json');
const REGISTRY_PATH   = path.join(PROJECT_ROOT, 'chat_registry.json');

/** Seeded registry — one entry per role. Used by all L3 integration tests. */
const SEEDED_REGISTRY = {
  'EMP-001': 100001,   // Ally Luciate — Operations/Staff
  'MGR-002': 100002,   // Priya Sharma — Manager/Senior
  'DIR-003': 100003,   // James Chen   — Director
  'VP-004':  100004,   // Sarah Mitchell — VP/C-Suite (APPROVER)
};

/**
 * Reset bookings.json to [] and chat_registry.json to seeded state.
 * Synchronous — safe to call without await in beforeEach.
 */
function resetTestData() {
  // Reset bookings to empty array
  fs.writeFileSync(BOOKINGS_PATH, JSON.stringify([], null, 2), 'utf8');

  // Reset chat registry to seeded profiles
  fs.writeFileSync(REGISTRY_PATH, JSON.stringify(SEEDED_REGISTRY, null, 2), 'utf8');
}

/**
 * Reset bookings.json only (leave chat_registry as-is).
 * Use when a test has modified the registry and only needs booking cleanup.
 */
function resetBookings() {
  fs.writeFileSync(BOOKINGS_PATH, JSON.stringify([], null, 2), 'utf8');
}

/**
 * Reset chat_registry.json to seeded state only.
 * Use after tests that modify the registry.
 */
function resetRegistry() {
  fs.writeFileSync(REGISTRY_PATH, JSON.stringify(SEEDED_REGISTRY, null, 2), 'utf8');
}

/**
 * Read current bookings.json contents.
 * Convenience helper for assertions.
 */
function readBookings() {
  try {
    return JSON.parse(fs.readFileSync(BOOKINGS_PATH, 'utf8'));
  } catch {
    return [];
  }
}

/**
 * Read current chat_registry.json contents.
 * Convenience helper for assertions.
 */
function readRegistry() {
  try {
    return JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  } catch {
    return {};
  }
}

/**
 * Wipe chat_registry.json to an EMPTY object {}.
 * Use for tests that need to verify behaviour when no employees are registered.
 */
function wipeRegistry() {
  fs.writeFileSync(REGISTRY_PATH, JSON.stringify({}, null, 2), 'utf8');
}

module.exports = {
  resetTestData,
  resetBookings,
  resetRegistry,
  wipeRegistry,
  readBookings,
  readRegistry,
  SEEDED_REGISTRY,
  BOOKINGS_PATH,
  REGISTRY_PATH,
};
