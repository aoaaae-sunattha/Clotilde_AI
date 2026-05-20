/**
 * @description End-to-end booking flow: visit SPA → search → select flight → confirm → assert PNR.
 *              Also covers empty input validation and state reset via "Search Again".
 * @jiraStory US-010
 * @testType E2E
 * @author Aoaaae
 */

const BookingPage = require('../../support/pages/BookingPage');
const ResultsPage = require('../../support/pages/ResultsPage');

describe('Booking Flow — E2E', () => {
  beforeEach(() => {
    BookingPage.visit();
  });

  it('loads page with search input visible and focused', () => {
    BookingPage.getSearchInput().should('be.visible').and('be.focused');
    BookingPage.getSendBtn().should('be.visible');
    BookingPage.getRoleSelect().should('be.visible');
    BookingPage.getDateInput().should('be.visible');
  });

  it('completes full booking and shows PNR', () => {
    cy.searchFlight('flight Bangkok to Tokyo', 'Staff', '2026-08-01');

    ResultsPage.getResultsList().should('be.visible', { timeout: 5000 });
    ResultsPage.getResultCards().should('have.length.greaterThan', 0);

    ResultsPage.selectFirstFlight();

    BookingPage.getConfirmBtn().should('not.be.disabled');
    BookingPage.getConfirmBtn().click();

    ResultsPage.getPnrDisplay().should('be.visible');
    ResultsPage.getPnrDisplay()
      .invoke('text')
      .should('match', /^PNR-[A-Z0-9]{6}$/);
  });

  it('shows error for empty input, no API call made', () => {
    cy.intercept('POST', '**/api/search').as('searchCall');

    BookingPage.getSendBtn().click();

    BookingPage.getErrorMsg()
      .should('be.visible')
      .and('contain', 'Please enter a travel request');

    cy.get('@searchCall.all').should('have.length', 0);
  });

  it('shows error for whitespace-only input, no API call made', () => {
    cy.intercept('POST', '**/api/search').as('searchCallWs');

    BookingPage.getSearchInput().type('   ');
    BookingPage.getSendBtn().click();

    BookingPage.getErrorMsg()
      .should('be.visible')
      .and('contain', 'Please enter a travel request');

    cy.get('@searchCallWs.all').should('have.length', 0);
  });

  it('resets state when Search Again is clicked', () => {
    cy.searchFlight('flight Bangkok to Tokyo', 'Staff', '2026-08-01');
    ResultsPage.getResultsList().should('be.visible', { timeout: 5000 });
    ResultsPage.selectFirstFlight();
    BookingPage.getConfirmBtn().click();
    ResultsPage.getPnrDisplay().should('be.visible');

    BookingPage.getNewSearchBtn().click();

    BookingPage.getSearchInput().should('be.visible');
    cy.get('[data-cy="confirmation-screen"]').should('not.be.visible');
  });
});
