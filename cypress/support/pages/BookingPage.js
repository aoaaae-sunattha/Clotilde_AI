// cypress/support/pages/BookingPage.js
// Page Object Model — search form and booking confirmation elements.

class BookingPage {
  visit() { cy.visit('/'); }
  getRoleSelect() { return cy.get('[data-cy="role-select"]'); }
  getDateInput() { return cy.get('[data-cy="date-input"]'); }
  getSearchInput() { return cy.get('[data-cy="search-input"]'); }
  getSendBtn() { return cy.get('[data-cy="send-btn"]'); }
  getErrorMsg() { return cy.get('[data-cy="error-msg"]'); }
  getConfirmBtn() { return cy.get('[data-cy="confirm-btn"]'); }
  getNewSearchBtn() { return cy.get('[data-cy="new-search-btn"]'); }
}

module.exports = new BookingPage();
