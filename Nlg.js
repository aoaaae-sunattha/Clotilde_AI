// nlg.js  v2.0
// NLG layer: generates Clotilde's replies.
// Gap fixes applied:
//   + injects mock inventory results into NLG context
//   + logs mock GDS payload to QA panel on booking intent
//   + formats and logs context packet on human handoff
//   + sentiment-aware escalation

const { GoogleGenerativeAI } = require('@google/generative-ai');
const {
  buildNLGPrompt,
  buildFallbackPrompt,
  buildContextPacket,
  formatInventory,
} = require('./prompt.js');
const POLICY = require('./policy.js');
const {
  getMockFlights,
  getMockHotels,
  buildGDSPayload,
  CITY_TO_AIRPORT,
} = require('./mock_inventory.js');
const { searchFlights: duffelSearchFlights } = require('./duffel.js');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ── Generate response for a successful NLU classification ─────────────────────
async function generateResponse(nluResult, conversationHistory = [], chatId = null, travelerRole = null, travelerProfile = null) {
  const startTime = Date.now();

  try {
    // ── 1. Immediate escalation for angry sentiment or escalation keywords ─────
    const escalationTrigger = checkEscalationTriggers(
      nluResult.raw_message,
      nluResult.sentiment
    );
    if (escalationTrigger) {
      const packet = buildContextPacket(chatId, conversationHistory, nluResult);
      logContextPacket(packet);
      return buildEscalationResponse(escalationTrigger, packet);
    }

    // ── 2. Fetch inventory (live via Duffel, or mock fallback) ───────────────
    const inventoryResults = await getInventoryForIntent(nluResult);

    // ── 4. Generate NLG reply ─────────────────────────────────────────────────
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature:     0.4,
        maxOutputTokens: 2048,
      },
    });

    const prompt = buildNLGPrompt(nluResult, conversationHistory, inventoryResults, travelerRole, travelerProfile);
    const result = await model.generateContent(prompt);
    let reply    = result.response.text().trim();
    const latencyMs = Date.now() - startTime;

    // Append pre-formatted inventory blocks directly — Gemini writes intro only
    if (inventoryResults?.flights?.length > 0 || inventoryResults?.hotels?.length > 0) {
      reply += '\n\n' + formatInventory(inventoryResults);
      reply += '\nPlease reply with the number of your preferred option to proceed.';
    }

    console.log(`[NLG] Response generated in ${latencyMs}ms`);
    return { reply, latencyMs, escalated: false, inventoryResults };

  } catch (error) {
    console.error('[NLG] Gemini API error:', error.message);
    return {
      reply: 'I apologise — a technical issue occurred. Please try again or contact travel-support@company.com.',
      latencyMs: Date.now() - startTime,
      escalated: false,
      error: true,
    };
  }
}

// ── Generate fallback response ────────────────────────────────────────────────
async function generateFallbackResponse(rawMessage, consecutiveFallbacks = 1) {
  const startTime = Date.now();

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature:     0.3,
        maxOutputTokens: 256,
      },
    });

    const prompt = buildFallbackPrompt(rawMessage, consecutiveFallbacks);
    const result = await model.generateContent(prompt);
    const reply  = result.response.text().trim();
    const latencyMs = Date.now() - startTime;

    console.log(`[NLG] Fallback response (attempt ${consecutiveFallbacks}) in ${latencyMs}ms`);
    return { reply, latencyMs, escalated: false };

  } catch (error) {
    console.error('[NLG] Fallback error:', error.message);
    return {
      reply: 'I apologise — I was unable to process your request. Please rephrase, or contact travel-support@company.com.',
      latencyMs: Date.now() - startTime,
      escalated: false,
    };
  }
}

// ── Fetch inventory based on intent (Duffel live or mock fallback) ────────────
async function getInventoryForIntent(nluResult) {
  const { intent, entities } = nluResult;

  if (intent === 'flight_booking' || intent === 'flight_search') {
    const date        = entities?.departure_date;
    const rawDest     = (entities?.destination || '').toUpperCase();
    const rawOrigin   = (entities?.origin      || '').toUpperCase();

    // ── Disambiguation: city name with no direct IATA code ─────────────────
    const destHint   = CITY_TO_AIRPORT[rawDest];
    const originHint = CITY_TO_AIRPORT[rawOrigin];
    if (destHint || originHint) {
      return {
        flights:        [],
        source:         'disambiguation',
        disambiguation: {
          origin:      originHint || null,
          destination: destHint   || null,
        },
      };
    }

    const hasSpecificDate = date && date !== 'relative' && /^\d{4}-\d{2}-\d{2}$/.test(date);

    if (hasSpecificDate) {
      try {
        const flights = await duffelSearchFlights(
          rawOrigin || undefined,
          rawDest   || undefined,
          date,
          entities?.cabin_class || 'Y'
        );
        const filtered = entities?.refundable ? flights.filter(f => f.refundable) : flights;
        return { flights: filtered, source: 'live', searchParams: { origin: rawOrigin, destination: rawDest, date } };
      } catch (err) {
        console.error('[NLG] Duffel search failed, using mock:', err.message);
      }
    }

    // Fall back to mock (vague date or Duffel error)
    const flights = getMockFlights(
      rawOrigin || undefined,
      rawDest   || undefined,
      date,
      entities?.cabin_class || 'Y'
    );
    const filtered = entities?.refundable ? flights.filter(f => f.refundable) : flights;
    return { flights: filtered, source: 'mock', searchParams: { origin: rawOrigin, destination: rawDest, date } };
  }

  if (intent === 'hotel_booking' || intent === 'hotel_search') {
    const hotels = getMockHotels(
      entities?.hotel_city || entities?.destination,
      entities?.checkin_date,
      entities?.checkout_date
    );
    return { hotels, source: 'mock' };
  }

  return null;
}

// ── Escalation trigger check ──────────────────────────────────────────────────
function checkEscalationTriggers(message, sentiment) {
  if (!message) return null;

  // Angry sentiment = immediate escalation
  if (sentiment === 'angry') return 'angry_sentiment';

  // Keyword triggers
  const lower = message.toLowerCase();
  return POLICY.humanAgentTriggers.find(trigger => lower.includes(trigger)) || null;
}

// ── Build escalation response ─────────────────────────────────────────────────
function buildEscalationResponse(trigger, contextPacket) {
  const reason = trigger === 'angry_sentiment'
    ? 'I understand you are frustrated'
    : `I understand your message relates to ${trigger}`;

  return {
    reply: `${reason}. This requires assistance from a human travel agent who can provide the proper support.\n\nPlease contact our travel support team:\n📧 ${POLICY.escalationContact}\n\nThey are available 24/7. Your full conversation history has been prepared for the agent — you will not need to repeat anything.`,
    latencyMs:         0,
    escalated:         true,
    escalationTrigger: trigger,
    contextPacket,
  };
}

// ── Log GDS payload to QA panel ───────────────────────────────────────────────
function logGDSPayload(payload) {
  console.log('\n\x1b[36m[QA PANEL — GDS PAYLOAD]\x1b[0m What would be sent to Amadeus/Sabre:');
  console.log('\x1b[2m' + JSON.stringify(payload, null, 2) + '\x1b[0m');
}

// ── Log context packet to QA panel ───────────────────────────────────────────
function logContextPacket(packet) {
  console.log('\n\x1b[35m[QA PANEL — HANDOFF CONTEXT PACKET]\x1b[0m What agent desktop receives:');
  console.log('\x1b[2m' + JSON.stringify(packet, null, 2) + '\x1b[0m');
}

module.exports = { generateResponse, generateFallbackResponse };