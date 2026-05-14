/**
 * gemini-fixtures.js
 * QA fixture — nock intercept factories for Gemini generateContent responses.
 *
 * Usage:
 *   const { mockGeminiFlightSearch, mockGeminiEscalation } = require('../fixtures/gemini-fixtures');
 *   beforeEach(() => { mockGeminiFlightSearch({ origin: 'BKK', destination: 'SIN' }); });
 *   afterEach(() => { nock.cleanAll(); });
 *
 * Note: If nock cannot intercept @google/generative-ai SDK (v1+ uses gRPC),
 * use the jest.mock fallback in each test file instead.
 */

'use strict';

const nock = require('nock');

const GEMINI_HOST    = 'https://generativelanguage.googleapis.com';
const GEMINI_PATH_RE = /\/v1beta\/models\/.+:generateContent/;

/**
 * Mock Gemini response that triggers search_flights tool call.
 */
function mockGeminiFlightSearch({ origin = 'BKK', destination = 'SIN', date = '2026-06-01', cabin_class = 'Y' } = {}) {
  return nock(GEMINI_HOST)
    .post(GEMINI_PATH_RE)
    .reply(200, {
      candidates: [{
        content: {
          role: 'model',
          parts: [{
            functionCall: {
              name: 'search_flights',
              args: { origin, destination, date, cabin_class },
            },
          }],
        },
        finishReason: 'STOP',
      }],
    });
}

/**
 * Mock Gemini response that triggers search_hotels tool call.
 */
function mockGeminiHotelSearch({ city = 'BKK', checkin = '2026-06-01', checkout = '2026-06-03' } = {}) {
  return nock(GEMINI_HOST)
    .post(GEMINI_PATH_RE)
    .reply(200, {
      candidates: [{
        content: {
          role: 'model',
          parts: [{
            functionCall: {
              name: 'search_hotels',
              args: { city, checkin, checkout },
            },
          }],
        },
        finishReason: 'STOP',
      }],
    });
}

/**
 * Mock Gemini response that triggers escalate_to_human tool call.
 */
function mockGeminiEscalation({ reason = 'Complex multi-leg itinerary requiring agent review' } = {}) {
  return nock(GEMINI_HOST)
    .post(GEMINI_PATH_RE)
    .reply(200, {
      candidates: [{
        content: {
          role: 'model',
          parts: [{
            functionCall: {
              name: 'escalate_to_human',
              args: { reason },
            },
          }],
        },
        finishReason: 'STOP',
      }],
    });
}

/**
 * Mock Gemini plain text response (no tool call).
 */
function mockGeminiTextReply(text = 'I can help you with that.') {
  return nock(GEMINI_HOST)
    .post(GEMINI_PATH_RE)
    .reply(200, {
      candidates: [{
        content: {
          role: 'model',
          parts: [{ text }],
        },
        finishReason: 'STOP',
      }],
    });
}

/**
 * Mock Gemini error (simulates API failure).
 */
function mockGeminiError() {
  return nock(GEMINI_HOST)
    .post(GEMINI_PATH_RE)
    .replyWithError('Gemini API unavailable');
}

module.exports = {
  mockGeminiFlightSearch,
  mockGeminiHotelSearch,
  mockGeminiEscalation,
  mockGeminiTextReply,
  mockGeminiError,
};
