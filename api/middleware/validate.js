// api/middleware/validate.js
// Input validation middleware for /api/search and /api/book.

const VALID_ROLES = ['Staff', 'Manager', 'Director', 'VP'];
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function validateSearch(req, res, next) {
  const { query, role, date } = req.body;

  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return next({ status: 400, message: 'Missing required field: query' });
  }
  if (query.trim().length > 500) {
    return next({ status: 400, message: 'query exceeds 500 character limit' });
  }
  if (!role) {
    return next({ status: 400, message: 'Missing required field: role' });
  }
  if (!VALID_ROLES.includes(role)) {
    return next({ status: 400, message: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` });
  }
  if (!date) {
    return next({ status: 400, message: 'Missing required field: date' });
  }
  if (!DATE_REGEX.test(date)) {
    return next({ status: 400, message: 'Invalid date format. Use YYYY-MM-DD.' });
  }
  // Validate it's a real calendar date
  const parsed = new Date(date);
  if (isNaN(parsed.getTime())) {
    return next({ status: 400, message: 'Invalid date format. Use YYYY-MM-DD.' });
  }
  // Check month/day are valid (new Date silently adjusts e.g. month 13)
  const [year, month, day] = date.split('-').map(Number);
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() + 1 !== month || parsed.getUTCDate() !== day) {
    return next({ status: 400, message: 'Invalid date format. Use YYYY-MM-DD.' });
  }

  next();
}

function validateBook(req, res, next) {
  const { flightId, travelerProfile } = req.body;

  if (!flightId || typeof flightId !== 'string' || flightId.trim().length === 0) {
    return next({ status: 400, message: 'flightId is required' });
  }
  if (!travelerProfile || typeof travelerProfile !== 'object' || Array.isArray(travelerProfile)) {
    return next({ status: 400, message: 'travelerProfile is required and must be an object' });
  }

  next();
}

module.exports = { validateSearch, validateBook };
