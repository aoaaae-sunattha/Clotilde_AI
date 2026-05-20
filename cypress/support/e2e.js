// cypress/support/e2e.js
// Global support entry point — loaded automatically before every test.
// Imports custom commands and sets up global hooks.

import './commands';

// Suppress non-critical browser errors that are not test failures
Cypress.on('uncaught:exception', (err) => {
  if (err.message.includes('ResizeObserver')) return false;
  return true;
});
