// api/server.js
// Clotilde V2 — Express API server.
// Ports: API on 3001, SPA served separately on 3000.
// Set USE_MOCK=true to bypass Gemini entirely (required for Cypress / CI).

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const searchRoute = require('./routes/search');
const bookRoute = require('./routes/book');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.API_PORT || 3001;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'http://localhost:3000';

app.use(cors({ origin: ALLOWED_ORIGIN }));
app.use(express.json());

// Health check — used by wait-on in CI before Cypress starts
app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/search', searchRoute);
app.use('/api/book', bookRoute);

// 404 catch-all for unrecognised routes
app.use((req, res) => {
  res.status(404).json({ status: 'error', data: null, policyFlags: [], error: 'Route not found' });
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Clotilde API listening on :${PORT} | mock=${process.env.USE_MOCK}`);
});

module.exports = app;
