// cypress/support/pages/ResultsPage.js
// Page Object Model — flight results, policy badges, and confirmation screen.

class ResultsPage {
  getResultsList() { return cy.get('[data-cy="results-list"]'); }
  getResultCards() { return cy.get('[data-cy="result-card"]'); }
  getPolicyBadges() { return cy.get('[data-cy="policy-badge"]'); }
  getSelectBtns() { return cy.get('[data-cy="select-btn"]'); }
  getPnrDisplay() { return cy.get('[data-cy="pnr-display"]'); }
  getConfirmationScreen() { return cy.get('[data-cy="confirmation-screen"]'); }
  selectFirstFlight() { cy.get('[data-cy="select-btn"]').first().click(); }
}

module.exports = new ResultsPage();
