// api/middleware/errorHandler.js
// Express 4-arg error middleware — always returns standard ApiResponse format.
// Never exposes stack traces.

function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  const message = err.message || 'Internal server error';
  console.error(`[ERROR] ${status} — ${message}`);
  res.status(status).json({
    status: 'error',
    data: null,
    policyFlags: [],
    error: message,
  });
}

module.exports = errorHandler;
