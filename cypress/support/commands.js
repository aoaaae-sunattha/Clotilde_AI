// cypress/support/commands.js
// Custom Cypress commands shared across all spec files.

/**
 * Validates the standard ApiResponse schema:
 * { status, data, policyFlags: array, error }
 */
Cypress.Commands.add('validateApiSchema', (response) => {
  expect(response.body).to.have.property('status');
  expect(response.body).to.have.property('data');
  expect(response.body).to.have.property('policyFlags').that.is.an('array');
  expect(response.body).to.have.property('error');
});

/**
 * Types a travel search query into the SPA and submits it.
 * Uses the BookingPage selectors via direct data-cy attributes.
 */
Cypress.Commands.add('searchFlight', (query, role = 'Staff', date = '2026-07-01') => {
  cy.get('[data-cy="role-select"]').select(role);
  cy.get('[data-cy="date-input"]').clear().type(date);
  cy.get('[data-cy="search-input"]').clear().type(query);
  cy.get('[data-cy="send-btn"]').click();
});
