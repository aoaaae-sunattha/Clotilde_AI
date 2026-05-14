/**
 * test-profiles.js
 * QA fixture — traveler profiles for each role, sourced from travelers.yml.
 *
 * Usage:
 *   const { profiles, getProfile, CHAT_IDS } = require('../fixtures/test-profiles');
 *
 *   // Get Staff profile
 *   const staff = profiles.staff;
 *   console.log(staff.employee_id); // 'EMP-001'
 *
 *   // Get chat_id for a role
 *   const vpChatId = CHAT_IDS['VP-004']; // 100004
 *
 * Source of truth: travelers.yml + reset-test-data.js SEEDED_REGISTRY
 * DO NOT change employee_ids or chat_ids here without updating reset-test-data.js.
 */

'use strict';

/**
 * Test chat IDs — local fake IDs used in all L3 integration tests.
 * These match the SEEDED_REGISTRY in reset-test-data.js exactly.
 * All sendMessage calls must be mocked so no real messages are sent.
 */
const CHAT_IDS = {
  'EMP-001': 100001,
  'MGR-002': 100002,
  'DIR-003': 100003,
  'VP-004':  100004,
};

/**
 * Full traveler profiles — sourced from travelers.yml.
 * Keyed by short role name for convenience.
 */
const profiles = {

  /** Operations / Staff — most restrictive; Economy only; needs approval for OOP */
  staff: {
    employee_id:  'EMP-001',
    name:         'Ally Luciate',
    email:        'Ally.Luciate@company.com',
    department:   'Operations',
    level:        'Operations/Staff',
    cabin_class:  ['Y'],           // Economy only
    chat_id:      CHAT_IDS['EMP-001'],
    nationality:  'TWN',
    approver_id:  'VP-004',
    is_approver:  false,
  },

  /** Manager / Senior — Economy only; needs approval for OOP */
  manager: {
    employee_id:  'MGR-002',
    name:         'Priya Sharma',
    email:        'priya.sharma@company.com',
    department:   'Finance',
    level:        'Manager/Senior',
    cabin_class:  ['Y'],           // Economy only
    chat_id:      CHAT_IDS['MGR-002'],
    nationality:  'IN',
    approver_id:  'VP-004',
    is_approver:  false,
  },

  /** Director — Economy + Business Class allowed; still needs approval for above price cap */
  director: {
    employee_id:  'DIR-003',
    name:         'James Chen',
    email:        'james.chen@company.com',
    department:   'Strategy',
    level:        'Director',
    cabin_class:  ['Y', 'W', 'C'], // Economy, Premium Economy, Business
    chat_id:      CHAT_IDS['DIR-003'],
    nationality:  'SG',
    approver_id:  'VP-004',
    is_approver:  false,
  },

  /** VP / C-Suite — Economy + Business Class; IS the approver; self-approval blocked */
  vp: {
    employee_id:  'VP-004',
    name:         'Sarah Mitchell',
    email:        'sarah.mitchell@company.com',
    department:   'Executive',
    level:        'VP/C-Suite',
    cabin_class:  ['Y', 'W', 'C'], // Economy, Premium Economy, Business
    chat_id:      CHAT_IDS['VP-004'],
    nationality:  'GB',
    approver_id:  null,            // Self-authorised at VP level (but self-approval is BLOCKED in code)
    is_approver:  true,            // This is APPROVER_EMPLOYEE_ID in Index.js
  },

};

/**
 * APPROVER_EMPLOYEE_ID — matches the constant in Index.js line 134.
 * Do not change without also updating Index.js.
 */
const APPROVER_EMPLOYEE_ID = 'VP-004';

/**
 * All employee IDs as an array — useful for iteration tests.
 */
const ALL_EMPLOYEE_IDS = ['EMP-001', 'MGR-002', 'DIR-003', 'VP-004'];

/**
 * Roles that can book Business Class (cabin 'C').
 * Source: POLICY.cabinClass in policy.js.
 */
const BUSINESS_CLASS_ROLES = ['Director', 'VP/C-Suite'];

/**
 * Roles that are Economy-only.
 * Source: POLICY.cabinClass in policy.js.
 */
const ECONOMY_ONLY_ROLES = ['Operations/Staff', 'Manager/Senior'];

/**
 * Get a profile by employee_id.
 * @param {string} employeeId
 * @returns {object|null}
 */
function getProfile(employeeId) {
  return Object.values(profiles).find(p => p.employee_id === employeeId) || null;
}

/**
 * Get a profile by role key ('staff', 'manager', 'director', 'vp').
 * @param {string} roleKey
 * @returns {object|null}
 */
function getProfileByRole(roleKey) {
  return profiles[roleKey] || null;
}

/**
 * Build a minimal mock session object for integration tests.
 * Simulates what Index.js stores in the sessions Map after /start + role selection.
 *
 * @param {string} roleKey - 'staff' | 'manager' | 'director' | 'vp'
 * @returns {object} mock session
 */
function buildMockSession(roleKey) {
  const profile = profiles[roleKey];
  if (!profile) throw new Error(`Unknown role key: ${roleKey}`);

  return {
    history:            [],
    pendingOptions:     null,
    selectedOption:     null,
    role:               profile.level,
    awaitingRole:       false,
    travelerProfile:    profile,
    bookingInProgress:  false,
    awaitingJustification: null,
  };
}

/**
 * Sample mock flight options — in-policy and out-of-policy variants.
 * Shape matches getMockFlights() output from mock_inventory.js.
 */
const mockFlightOptions = {

  /** Economy BKK→SIN, within SHORT_HAUL cap (4800 THB < 5000 THB cap) — IN-POLICY all roles */
  inPolicyEconomy: {
    flight_number:      'TG401',
    airline:            'Thai Airways',
    airline_code:       'TG',
    origin:             'BKK',
    destination:        'SIN',
    departure_datetime: '2026-06-01T08:00:00',
    arrival_datetime:   '2026-06-01T11:30:00',
    cabin_class:        'Y',
    price:              { amount: 4800, currency: 'THB' },
    is_compliant:       true,
    is_preferred:       true,
  },

  /** Economy BKK→SIN, above SHORT_HAUL cap (6500 THB > 5000 THB) — OUT-OF-POLICY */
  outOfPolicyEconomy: {
    flight_number:      'FD501',
    airline:            'Thai AirAsia',
    airline_code:       'FD',
    origin:             'BKK',
    destination:        'SIN',
    departure_datetime: '2026-06-01T14:00:00',
    arrival_datetime:   '2026-06-01T17:30:00',
    cabin_class:        'Y',
    price:              { amount: 6500, currency: 'THB' },
    is_compliant:       false,
    is_preferred:       false,
  },

  /** Business Class BKK→LHR, within LONG_HAUL cap (24000 THB < 25000 THB) — IN-POLICY Director+ */
  inPolicyBusiness: {
    flight_number:      'EK371',
    airline:            'Emirates',
    airline_code:       'EK',
    origin:             'BKK',
    destination:        'LHR',
    departure_datetime: '2026-06-01T23:00:00',
    arrival_datetime:   '2026-06-02T06:30:00',
    cabin_class:        'C',
    price:              { amount: 24000, currency: 'THB' },
    is_compliant:       true,   // for Director/VP; false for Staff/Manager
    is_preferred:       true,
  },

  /** Business Class BKK→LHR, above LONG_HAUL cap (28000 THB > 25000 THB) — OUT-OF-POLICY all roles */
  outOfPolicyBusiness: {
    flight_number:      'TG911',
    airline:            'Thai Airways',
    airline_code:       'TG',
    origin:             'BKK',
    destination:        'LHR',
    departure_datetime: '2026-06-02T01:00:00',
    arrival_datetime:   '2026-06-02T08:30:00',
    cabin_class:        'C',
    price:              { amount: 28000, currency: 'THB' },
    is_compliant:       false,
    is_preferred:       false,
  },

};

/**
 * Sample mock hotel options.
 * Shape matches getMockHotels() output from mock_inventory.js.
 */
const mockHotelOptions = {

  /** BKK hotel, at cap (4000 THB) — IN-POLICY */
  inPolicyBKK: {
    hotel_id:        'H001',
    name:            'Novotel Bangkok Sukhumvit 20',
    room_type:       'Superior',
    city:            'BKK',
    checkin_date:    '2026-06-01',
    checkout_date:   '2026-06-03',
    price_per_night: { amount: 4000, currency: 'THB' },
    is_compliant:    true,
  },

  /** BKK hotel, above cap (4500 THB > 4000 THB) — OUT-OF-POLICY */
  outOfPolicyBKK: {
    hotel_id:        'H002',
    name:            'Mandarin Oriental Bangkok',
    room_type:       'Deluxe River View',
    city:            'BKK',
    checkin_date:    '2026-06-01',
    checkout_date:   '2026-06-03',
    price_per_night: { amount: 4500, currency: 'THB' },
    is_compliant:    false,
  },

  /** SIN hotel, within cap (300 SGD ≤ 350 SGD) — IN-POLICY */
  inPolicySIN: {
    hotel_id:        'H003',
    name:            'Marriott Singapore Tang Plaza',
    room_type:       'Deluxe',
    city:            'SIN',
    checkin_date:    '2026-06-01',
    checkout_date:   '2026-06-03',
    price_per_night: { amount: 300, currency: 'SGD' },
    is_compliant:    true,
  },

};

module.exports = {
  profiles,
  getProfile,
  getProfileByRole,
  buildMockSession,
  mockFlightOptions,
  mockHotelOptions,
  CHAT_IDS,
  APPROVER_EMPLOYEE_ID,
  ALL_EMPLOYEE_IDS,
  BUSINESS_CLASS_ROLES,
  ECONOMY_ONLY_ROLES,
};
