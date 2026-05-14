// travelers.js
// Loads traveler profiles from travelers.yml.
// In production: replace with HR API call keyed by employee ID or SSO token.

const fs   = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const raw      = fs.readFileSync(path.join(__dirname, 'travelers.yml'), 'utf8');
const data     = yaml.load(raw);
const profiles = data.profiles;

/**
 * Returns the profile object for a given role label, or null if not found.
 * @param {string} role  e.g. "VP/C-Suite"
 */
function getProfile(role) {
  return profiles[role] || null;
}

module.exports = { getProfile };
