/**
 * @description API contract tests for POST /api/search and POST /api/book.
 *              Validates HTTP status codes, response schema, and exact error messages.
 * @jiraStory US-011, US-012
 * @testType API
 * @author Aoaaae
 */

const apiUrl = Cypress.env('apiUrl');

describe('POST /api/search — contract', () => {
  it('returns 200 + valid schema for a valid payload', () => {
    cy.request('POST', `${apiUrl}/api/search`, {
      query: 'BKK to NRT',
      role: 'Staff',
      date: '2026-08-01',
    }).then((response) => {
      expect(response.status, 'HTTP status').to.eq(200);
      cy.validateApiSchema(response);
      expect(response.body.status, 'body.status').to.eq('ok');
      expect(response.body.error, 'body.error').to.be.null;
      expect(response.body.data, 'data array').to.have.length.greaterThan(0);
    });
  });

  it('returns 400 when query field is missing', () => {
    cy.request({
      method: 'POST',
      url: `${apiUrl}/api/search`,
      body: { role: 'Staff', date: '2026-08-01' },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status, 'HTTP status').to.eq(400);
      expect(response.body.error, 'error message').to.include('query');
    });
  });

  it('returns 400 for invalid date format (DD-MM-YYYY)', () => {
    cy.request({
      method: 'POST',
      url: `${apiUrl}/api/search`,
      body: { query: 'BKK to SIN', role: 'Staff', date: '01-08-2026' },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status, 'HTTP status').to.eq(400);
      expect(response.body.error, 'error message').to.eq('Invalid date format. Use YYYY-MM-DD.');
    });
  });

  it('returns 400 for invalid role', () => {
    cy.request({
      method: 'POST',
      url: `${apiUrl}/api/search`,
      body: { query: 'BKK to SIN', role: 'CEO', date: '2026-08-01' },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status, 'HTTP status').to.eq(400);
      expect(response.body.error, 'error message').to.include('Invalid role');
    });
  });

  it('returns 400 when date field is missing', () => {
    cy.request({
      method: 'POST',
      url: `${apiUrl}/api/search`,
      body: { query: 'BKK to SIN', role: 'Staff' },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status, 'HTTP status').to.eq(400);
      expect(response.body.error, 'error message').to.include('date');
    });
  });
});

describe('POST /api/book — error cases', () => {
  it('returns 400 when flightId is missing from body', () => {
    cy.request({
      method: 'POST',
      url: `${apiUrl}/api/book`,
      body: { travelerProfile: { role: 'Staff' } },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status, 'HTTP status').to.eq(400);
      expect(response.body.error, 'error message').to.eq('flightId is required');
    });
  });

  it('returns 400 for empty string flightId', () => {
    cy.request({
      method: 'POST',
      url: `${apiUrl}/api/book`,
      body: { flightId: '', travelerProfile: { role: 'Staff' } },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status, 'HTTP status').to.eq(400);
      expect(response.body.error, 'error message').to.eq('flightId is required');
    });
  });

  it('returns 404 for unknown flightId (no flightDetails provided)', () => {
    cy.request({
      method: 'POST',
      url: `${apiUrl}/api/book`,
      body: { flightId: 'FL-UNKNOWN-999', travelerProfile: { role: 'Staff' } },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status, 'HTTP status').to.eq(404);
      expect(response.body.error, 'error message').to.eq('Flight not found. Please search again.');
    });
  });

  it('returns 404 for an unrecognised API route', () => {
    cy.request({
      method: 'GET',
      url: `${apiUrl}/api/xyz`,
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status, 'HTTP status').to.eq(404);
      expect(response.body.error, 'error message').to.eq('Route not found');
    });
  });
});
