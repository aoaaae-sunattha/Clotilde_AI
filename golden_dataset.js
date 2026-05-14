// golden_dataset.js
// 15 NLU regression test cases. Run with: node run_tests.js
// QA note: run this after EVERY change to prompt.js or policy.js

const goldenDataset = [

  // ── STANDARD BOOKING ─────────────────────────────────────────────────────────
  {
    id: "G001",
    category: "booking_standard",
    utterance: "Book a flight to Singapore next Monday",
    expected_intent: "flight_booking",
    expected_entities: { destination: "SIN" },
    notes: "Standard booking — baseline test. Must always pass.",
  },
  {
    id: "G002",
    category: "booking_synonym",
    utterance: "Reserve me a seat to Bangkok on June 10",
    expected_intent: "flight_booking",
    expected_entities: { destination: "BKK" },
    notes: "Synonym: Reserve must map to flight_booking intent.",
  },
  {
    id: "G003",
    category: "booking_synonym",
    utterance: "I need to get to Tokyo next week",
    expected_intent: "flight_booking",
    expected_entities: { destination: "TYO" },
    notes: "Informal phrasing with no booking verb.",
  },

  // ── SLANG & INFORMAL ─────────────────────────────────────────────────────────
  {
    id: "G004",
    category: "booking_slang",
    utterance: "Grab a bird to BKK tomorrow",
    expected_intent: "flight_booking",
    expected_entities: { destination: "BKK" },
    notes: "Slang: bird = airplane. High risk of UNKNOWN. Key regression test.",
  },
  {
    id: "G005",
    category: "booking_slang",
    utterance: "Get me on a plane to London ASAP",
    expected_intent: "flight_booking",
    expected_entities: { destination: "LON" },
    notes: "Urgency slang — ASAP must not break intent classification.",
  },

  // ── NEGATION ─────────────────────────────────────────────────────────────────
  {
    id: "G006",
    category: "negation",
    utterance: "I do NOT want to fly to London",
    expected_intent: "flight_search_negative",
    expected_entities: {},
    forbidden_entities: { destination: "LON" },
    notes: "CRITICAL: London must NOT appear as destination entity.",
  },
  {
    id: "G007",
    category: "negation",
    utterance: "Do not book the hotel, just the flight to Paris",
    expected_intent: "flight_booking",
    expected_entities: { destination: "CDG" },
    notes: "Partial negation — hotel excluded, flight intent preserved.",
  },

  // ── AMBIGUITY ────────────────────────────────────────────────────────────────
  {
    id: "G008",
    category: "ambiguity",
    utterance: "Book a flight to London",
    expected_intent: "flight_booking",
    expected_behavior: "ask_clarification",
    expected_confidence_max: 0.95,
    notes: "London has 3 airports (LHR, LGW, STN) — must ask or flag missing slot.",
  },
  {
    id: "G009",
    category: "ambiguity",
    utterance: "I need a flight",
    expected_intent: "flight_booking",
    expected_behavior: "ask_clarification",
    expected_confidence_max: 0.69,
    notes: "No destination, no date — confidence must be low.",
  },

  // ── INTENT OVERLAP ────────────────────────────────────────────────────────────
  {
    id: "G010",
    category: "intent_overlap",
    utterance: "What is the cancellation policy?",
    expected_intent: "policy_inquiry",
    expected_entities: {},
    notes: "Policy QUESTION — must not trigger cancellation_action intent.",
  },
  {
    id: "G011",
    category: "intent_overlap",
    utterance: "Cancel my booking",
    expected_intent: "booking_cancel",
    notes: "Cancellation ACTION — different from policy inquiry.",
  },

  // ── OUT OF SCOPE ──────────────────────────────────────────────────────────────
  {
    id: "G012",
    category: "out_of_scope",
    utterance: "Order me a pizza",
    expected_intent: "out_of_scope",
    notes: "Must not attempt to interpret as a travel request.",
  },
  {
    id: "G013",
    category: "out_of_scope",
    utterance: "What is the capital of France?",
    expected_intent: "out_of_scope",
    notes: "General knowledge — out of scope for travel assistant.",
  },

  // ── POLICY ───────────────────────────────────────────────────────────────────
  {
    id: "G014",
    category: "policy",
    utterance: "Book business class to Tokyo",
    expected_intent: "flight_booking",
    expected_entities: { cabin_class: "C", destination: "TYO" },
    notes: "Policy violation for standard employee — cabin_class must be extracted.",
  },

  // ── CONTEXT / ANAPHORA ───────────────────────────────────────────────────────
  {
    id: "G015",
    category: "context",
    utterance: "Book it for next Friday",
    context_prior_message: "I am looking at flights to Paris",
    expected_intent: "flight_booking",
    expected_entities: { destination: "CDG" },
    notes: "Anaphora: 'it' must resolve to Paris from prior context.",
  },
];

module.exports = goldenDataset;