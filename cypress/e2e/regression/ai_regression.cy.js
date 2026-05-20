/**
 * @description GenAI output regression suite — sends a fixed payload and compares key fields
 *              against a stored baseline fixture. Detects unexpected AI output drift.
 *
 *              DEMO NOTE: To trigger regression detection live in an interview:
 *              1. Open cypress/fixtures/ai_baselines.json
 *              2. Change firstResult.airline to a wrong value (e.g. "Wrong Airline")
 *              3. Run cypress — the first test fails with expected vs actual diff
 *              4. Run `npm run cypress:update-baselines` to restore baseline
 *
 * @jiraStory US-015, US-016
 * @testType GenAI-Regression
 * @author Aoaaae
 */

const FIXED_PAYLOAD = {
  query: 'flight BKK to TYO',
  role: 'Staff',
  date: '2026-08-01',
};

const apiUrl = Cypress.env('apiUrl');

describe('GenAI Output Regression', () => {
  it('baseline fixture exists and is readable', () => {
    cy.fixture('ai_baselines.json').then((baseline) => {
      expect(baseline, 'baseline object').to.have.property('firstResult');
      expect(baseline.firstResult, 'firstResult').to.have.property('airline');
      expect(baseline.firstResult, 'firstResult').to.have.property('cabinClass');
      expect(baseline.firstResult, 'firstResult').to.have.property('price');
      expect(baseline, 'baseline object').to.have.property('expectedResultCount');
    });
  });

  it('matches baseline for key response fields', () => {
    cy.fixture('ai_baselines.json').then((baseline) => {
      cy.request('POST', `${apiUrl}/api/search`, FIXED_PAYLOAD).then((response) => {
        expect(response.status, 'HTTP status').to.eq(200);

        expect(
          response.body.data.length,
          `result count — expected ${baseline.expectedResultCount}`
        ).to.eq(baseline.expectedResultCount);

        expect(
          response.body.data[0].airline,
          `airline — expected "${baseline.firstResult.airline}"`
        ).to.eq(baseline.firstResult.airline);

        expect(
          response.body.data[0].cabinClass,
          `cabinClass — expected "${baseline.firstResult.cabinClass}"`
        ).to.eq(baseline.firstResult.cabinClass);

        expect(
          response.body.data[0].price,
          `price — expected ${baseline.firstResult.price}`
        ).to.eq(baseline.firstResult.price);
      });
    });
  });
});
