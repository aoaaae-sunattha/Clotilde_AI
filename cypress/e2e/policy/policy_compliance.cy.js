/**
 * @description Policy compliance tests — verifies that cabin class violations are flagged
 *              at both the API level (policyFlags array) and the UI level (policy badge).
 *              Staff requesting Business class = violation. Director = no violation.
 * @jiraStory US-013
 * @testType PolicyCompliance
 * @author Aoaaae
 */

const ResultsPage = require('../../support/pages/ResultsPage');

const apiUrl = Cypress.env('apiUrl');

describe('Policy Compliance — API level', () => {
  it('flags cabin_violation for Staff requesting Business class', () => {
    cy.request('POST', `${apiUrl}/api/search`, {
      query: 'business class BKK to SIN',
      role: 'Staff',
      date: '2026-08-01',
    }).then((response) => {
      expect(response.status).to.eq(200);
      const violations = response.body.data.filter(
        (f) => f.policyFlags && f.policyFlags.includes('cabin_violation')
      );
      expect(violations.length, 'results with cabin_violation').to.be.greaterThan(0);
    });
  });

  it('has no cabin_violation flag for Director requesting Business class', () => {
    cy.request('POST', `${apiUrl}/api/search`, {
      query: 'business class BKK to SIN',
      role: 'Director',
      date: '2026-08-01',
    }).then((response) => {
      expect(response.status).to.eq(200);
      const violations = response.body.data.filter(
        (f) => f.policyFlags && f.policyFlags.includes('cabin_violation')
      );
      expect(violations.length, 'cabin_violation count for Director').to.eq(0);
    });
  });
});

describe('Policy Compliance — UI level', () => {
  it('shows POLICY VIOLATION badge for Staff + Business class query', () => {
    cy.visit('/');
    cy.searchFlight('business class flight to Singapore', 'Staff', '2026-08-01');

    ResultsPage.getResultsList().should('be.visible', { timeout: 5000 });
    ResultsPage.getPolicyBadges().should('have.length.greaterThan', 0);
    ResultsPage.getPolicyBadges().first().should('contain', 'POLICY VIOLATION');
  });

  it('shows no policy badge for Director + economy (domestic route within budget)', () => {
    // Use BKK→HKT (domestic) where all economy fares are well under the 5,000 THB cap.
    // This isolates the cabin-class rule: Directors flying economy should see zero badges.
    cy.visit('/');
    cy.searchFlight('economy flight from Bangkok to Phuket', 'Director', '2026-08-01');

    ResultsPage.getResultsList().should('be.visible', { timeout: 5000 });
    ResultsPage.getResultCards().should('have.length.greaterThan', 0);
    cy.get('[data-cy="policy-badge"]').should('not.exist');
  });
});
