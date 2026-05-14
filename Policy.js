// policy.js
// Single source of truth for all company travel rules.
// QA note: every rule here maps to at least one test case in golden_dataset.js

const POLICY = {

  // ── Budget caps per city (nightly hotel rate) ─────────────
  hotelBudgetCap: {
    BKK: { amount: 4000, currency: "THB" },
    SIN: { amount: 350,  currency: "SGD" },
    NYC: { amount: 350,  currency: "USD" },
    LON: { amount: 280,  currency: "GBP" },
    TYO: { amount: 40000,currency: "JPY" },
    DEFAULT: { amount: 200, currency: "USD" },
  },

  // ── Flight budget caps (one-way, per segment) ─────────────
  flightBudgetCap: {
    SHORT_HAUL: { maxHours: 4,  amount: 5000,  currency: "THB" },
    LONG_HAUL:  { maxHours: 99, amount: 25000, currency: "THB" },  // ~$715 USD economy long-haul
  },

  // ── Preferred airlines (always recommend these first) ──────
  preferredAirlines: [
    { code: "TG", name: "Thai Airways",    reason: "Company preferred partner — 20% corporate discount" },
    { code: "SQ", name: "Singapore Airlines", reason: "Preferred partner for Singapore routes" },
    { code: "EK", name: "Emirates",        reason: "Preferred partner for Middle East and Europe routes" },
  ],

  // ── Cabin class rules by employee level ──────────────────
  cabinClass: {
    ECONOMY:  {
      roles:   ["Operations", "Staff", "Manager", "Senior Manager"],
      allowed: ["Y"],
      label:   "Economy only",
    },
    BUSINESS: {
      roles:   ["Director", "VP", "C-Suite", "CEO"],
      allowed: ["Y", "W", "C"],
      label:   "Up to Business Class",
    },
    DEFAULT: { allowed: ["Y"], label: "Economy only" },
  },

  // ── Advance booking requirement ───────────────────────────
  advanceBookingDays: 3,   // must book at least 3 days before departure

  // ── Out-of-policy flow ─────────────────────────────────────
  outOfPolicyFlow: "require_justification", // options: block | require_justification | warn_only

  // ── Fallback / escalation ──────────────────────────────────
  escalationContact: "travel-support@company.com",
  humanAgentTriggers: [
    "visa",
    "passport",
    "lost",
    "emergency",
    "medical",
    "legal",
    "insurance claim",
  ],
};

module.exports = POLICY;