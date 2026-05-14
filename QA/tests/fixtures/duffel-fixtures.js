/**
 * duffel-fixtures.js
 * QA fixture — nock intercept factories for Duffel API responses.
 *
 * Usage:
 *   const { mockDuffelError, mockDuffelSuccess } = require('../fixtures/duffel-fixtures');
 *   beforeEach(() => { mockDuffelError(); }); // force fallback to getMockFlights
 *   afterEach(() => { nock.cleanAll(); });
 */

'use strict';

const nock = require('nock');

const DUFFEL_HOST = 'https://api.duffel.com';

/**
 * Mock a Duffel connection error — forces getMockFlights fallback in duffel.js.
 */
function mockDuffelError() {
  return nock(DUFFEL_HOST)
    .post(/\/air\/offer_requests/)
    .replyWithError('Duffel connection timeout');
}

/**
 * Mock Duffel 500 server error.
 */
function mockDuffelServerError() {
  return nock(DUFFEL_HOST)
    .post(/\/air\/offer_requests/)
    .reply(500, { errors: [{ type: 'server_error', message: 'Internal server error' }] });
}

/**
 * Mock Duffel 401 authentication error.
 */
function mockDuffelAuthError() {
  return nock(DUFFEL_HOST)
    .post(/\/air\/offer_requests/)
    .reply(401, { errors: [{ type: 'authentication_error', message: 'Unauthorized' }] });
}

/**
 * Mock a minimal Duffel success response for BKK→SIN Economy.
 * Shape based on Duffel Air offer request format.
 */
function mockDuffelSuccess({ origin = 'BKK', destination = 'SIN', date = '2026-06-01' } = {}) {
  return nock(DUFFEL_HOST)
    .post(/\/air\/offer_requests/)
    .reply(200, {
      data: {
        id: 'orq_test_001',
        offers: [{
          id: 'off_test_001',
          total_amount: '4800.00',
          total_currency: 'THB',
          slices: [{
            segments: [{
              operating_carrier: { iata_code: 'TG', name: 'Thai Airways' },
              marketing_carrier_flight_number: '401',
              origin: { iata_code: origin },
              destination: { iata_code: destination },
              departing_at: `${date}T08:00:00`,
              arriving_at: `${date}T11:30:00`,
              passengers: [{ cabin_class: 'economy' }],
            }],
          }],
        }],
      },
    });
}

module.exports = {
  mockDuffelError,
  mockDuffelServerError,
  mockDuffelAuthError,
  mockDuffelSuccess,
};
