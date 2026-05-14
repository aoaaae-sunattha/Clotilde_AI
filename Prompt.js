// prompt.js  v2.0
// Mega system prompt — rewritten with all gap fixes applied:
//   + sentiment detection field in NLU output
//   + refundable entity extraction
//   + confirmation step before cancellation
//   + mock inventory results injected into NLG context
//   + structured context packet format for agent handoff
// QA note: any change here requires a full golden_dataset regression run.

const POLICY = require('./policy.js');

// ── NLU prompt ────────────────────────────────────────────────────────────────
function buildNLUPrompt() {
  return `
You are a travel intent classifier for a corporate travel assistant named Clotilde.
Your ONLY job is to analyze the user message and return a structured JSON object.
You NEVER reply conversationally. You ONLY return valid JSON.

SUPPORTED INTENTS:
- flight_booking       : user wants to book a flight
- flight_search        : user wants to search/check flights without booking
- hotel_booking        : user wants to book a hotel
- hotel_search         : user wants to search/check hotels without booking
- booking_change       : user wants to modify an existing booking
- booking_cancel       : user wants to cancel an existing booking
- booking_status       : user wants to check status of an existing booking
- booking_confirm      : user is confirming a previously presented option
- policy_inquiry       : user is asking about travel rules or policies
- disruption_support   : user reports a disruption (delay, cancellation, emergency)
- out_of_scope         : message is not related to corporate travel
- unclear              : message is too vague to classify with confidence

ENTITIES TO EXTRACT (include only what is actually present):
- origin          : departure city or IATA code (e.g. BKK, SIN)
- destination     : arrival city or IATA code
- departure_date  : normalize to YYYY-MM-DD, or "relative" if vague
- return_date     : normalize to YYYY-MM-DD if present
- cabin_class     : Y=Economy, W=Premium Economy, C=Business, F=First
- travelers       : number of travelers (default 1)
- hotel_city      : city for hotel search
- checkin_date    : normalize to YYYY-MM-DD
- checkout_date   : normalize to YYYY-MM-DD
- booking_ref     : PNR or booking reference if mentioned
- refundable      : true if user explicitly requests refundable/flexible ticket
- selected_option : number (1,2,3) if user selects from a presented list

CONFIDENCE SCORING:
- 0.9–1.0 : very clear intent, all key entities present
- 0.7–0.89: clear intent, some entities missing
- 0.5–0.69: likely intent but ambiguous — will trigger clarification
- 0.0–0.49: too unclear — triggers fallback

SENTIMENT DETECTION — assess emotional tone:
- "neutral"    : normal request, no strong emotion
- "frustrated" : irritation, repeated words, complaints
- "urgent"     : time pressure, ASAP, emergency, immediately
- "angry"      : aggressive tone, CAPS, exclamation marks, "unacceptable"

NEGATION RULE: "do NOT", "don't want", "not going to" — negated destination
or action must NOT appear in entities.

REQUIRED OUTPUT FORMAT — return ONLY this JSON, nothing else:
{
  "intent": "<intent_name>",
  "confidence": <0.0 to 1.0>,
  "sentiment": "<neutral|frustrated|urgent|angry>",
  "entities": {
    <only include entities actually present>
  },
  "clarification_needed": <true if confidence < 0.7>,
  "missing_slots": [<required fields not yet provided>],
  "raw_message": "<the original user message>"
}

EXAMPLES:

User: "Book a flight to Singapore next Monday"
Output: {"intent":"flight_booking","confidence":0.88,"sentiment":"neutral","entities":{"destination":"SIN","departure_date":"relative"},"clarification_needed":false,"missing_slots":["origin"],"raw_message":"Book a flight to Singapore next Monday"}

User: "I do NOT want to fly to London"
Output: {"intent":"flight_search_negative","confidence":0.95,"sentiment":"neutral","entities":{},"clarification_needed":false,"missing_slots":[],"raw_message":"I do NOT want to fly to London"}

User: "I need a REFUNDABLE ticket to Tokyo ASAP"
Output: {"intent":"flight_booking","confidence":0.91,"sentiment":"urgent","entities":{"destination":"TYO","refundable":true},"clarification_needed":false,"missing_slots":["origin","departure_date"],"raw_message":"I need a REFUNDABLE ticket to Tokyo ASAP"}

User: "This is UNACCEPTABLE. I need a real person NOW!"
Output: {"intent":"disruption_support","confidence":0.85,"sentiment":"angry","entities":{},"clarification_needed":false,"missing_slots":[],"raw_message":"This is UNACCEPTABLE. I need a real person NOW!"}

User: "Cancel my booking"
Output: {"intent":"booking_cancel","confidence":0.95,"sentiment":"neutral","entities":{},"clarification_needed":false,"missing_slots":["booking_ref"],"raw_message":"Cancel my booking"}

User: "Yes, book option 2"
Output: {"intent":"booking_confirm","confidence":0.97,"sentiment":"neutral","entities":{"selected_option":2},"clarification_needed":false,"missing_slots":[],"raw_message":"Yes, book option 2"}

User: "Grab a bird to BKK tomorrow"
Output: {"intent":"flight_booking","confidence":0.72,"sentiment":"neutral","entities":{"destination":"BKK","departure_date":"relative"},"clarification_needed":false,"missing_slots":["origin"],"raw_message":"Grab a bird to BKK tomorrow"}

User: "Book it"
Output: {"intent":"unclear","confidence":0.2,"sentiment":"neutral","entities":{},"clarification_needed":true,"missing_slots":["destination","departure_date","origin"],"raw_message":"Book it"}

User: "yep"
Output: {"intent":"booking_confirm","confidence":0.85,"sentiment":"neutral","entities":{},"clarification_needed":false,"missing_slots":[],"raw_message":"yep"}

User: "yeah"
Output: {"intent":"booking_confirm","confidence":0.85,"sentiment":"neutral","entities":{},"clarification_needed":false,"missing_slots":[],"raw_message":"yeah"}

User: "sure"
Output: {"intent":"booking_confirm","confidence":0.85,"sentiment":"neutral","entities":{},"clarification_needed":false,"missing_slots":[],"raw_message":"sure"}

User: "nope"
Output: {"intent":"booking_cancel","confidence":0.85,"sentiment":"neutral","entities":{},"clarification_needed":false,"missing_slots":[],"raw_message":"nope"}
`.trim();
}

// ── Pre-format inventory into labelled blocks for the NLG prompt ──────────────
// Labels are computed in code (deterministic) so Gemini never has to guess.
function formatInventory(inventoryResults) {
  const lines = [];

  if (inventoryResults.flights?.length > 0) {
    inventoryResults.flights.forEach((f, i) => {
      const h = Math.floor(f.duration_minutes / 60);
      const m = f.duration_minutes % 60;
      const duration = m > 0 ? `${h}h ${m}m` : `${h}h`;
      const stops    = !f.stops ? 'Non-stop' : `${f.stops} stop${f.stops > 1 ? 's' : ''}`;

      let policyLabel;
      if (f.is_compliant === true && f.is_preferred) {
        policyLabel = '✅ PREFERRED & IN-POLICY';
      } else if (f.is_compliant === true) {
        policyLabel = '✅ IN-POLICY';
      } else if (f.is_compliant === false && f.is_preferred) {
        policyLabel = '❌ OUT-OF-POLICY (preferred airline) — business justification required';
      } else if (f.is_compliant === false) {
        policyLabel = '❌ OUT-OF-POLICY — business justification required';
      } else if (f.is_preferred) {
        policyLabel = '⭐ PREFERRED — price in ' + f.price.currency + ' (manual review vs. policy cap)';
      } else {
        policyLabel = '⚠️ IN-POLICY CHECK NEEDED — price in ' + f.price.currency + ' (policy cap is in THB)';
      }

      // For connecting flights with different airlines on each leg, show both in the header
      let headerAirline = `${f.airline} (${f.flight_number})`;
      if (f.stops > 0 && f.segments?.length > 1) {
        const uniqueAirlines = [...new Set(f.segments.map(s => s.airline))];
        if (uniqueAirlines.length > 1) {
          headerAirline = f.segments.map(s => `${s.airline} (${s.flight_number})`).join(' + ');
        }
      }
      lines.push(`*Option ${i + 1} — ${headerAirline}*`);
      lines.push(`📅 ${f.departure_datetime} → ${f.arrival_datetime}`);
      lines.push(`⏱ ${duration}  |  ${stops}`);
      if (f.stops > 0 && f.segments?.length > 0) {
        f.segments.forEach(s => {
          const sh = Math.floor(s.duration_minutes / 60);
          const sm = s.duration_minutes % 60;
          const sd = sm > 0 ? `${sh}h ${sm}m` : `${sh}h`;
          lines.push(`   ✈️ ${s.from} → ${s.to}  ${s.airline} ${s.flight_number}  ${s.departure} → ${s.arrival}  (${sd})`);
        });
      }
      lines.push(`💰 ${f.price.amount.toLocaleString()} ${f.price.currency}`);
      lines.push(`🔖 ${policyLabel}`);
      if (f.is_compliant === false && f.compliance_notes) lines.push(`   ↳ ${f.compliance_notes}`);
      lines.push(`↩️ ${f.refundable ? 'REFUNDABLE' : 'NON-REFUNDABLE'}`);
      if (f.baggage_allowance) {
        const b = f.baggage_allowance;
        lines.push(b.checked_bags > 0
          ? `🧳 ${b.checked_bags} checked bag${b.checked_bags > 1 ? 's' : ''} (${b.weight_kg}kg)`
          : `🧳 No checked baggage included`);
      }
      // For connecting flights, only show preferred note if the primary (long-haul) carrier is preferred
      const showPreferred = f.preferred_reason && f.is_compliant !== false &&
        !(f.stops > 0 && f.segments?.length > 1 && f.segments[f.segments.length - 1].airline !== f.airline && !f.is_preferred);
      if (showPreferred) lines.push(`ℹ️ ${f.preferred_reason}`);
      lines.push('');
    });
  }

  if (inventoryResults.hotels?.length > 0) {
    inventoryResults.hotels.forEach((h, i) => {
      const policyLabel = h.is_compliant
        ? (h.is_preferred ? '✅ PREFERRED & IN-POLICY' : '✅ IN-POLICY')
        : '❌ OUT-OF-POLICY — business justification required';

      lines.push(`*Option ${i + 1} — ${h.name} (${'★'.repeat(h.star_rating)})*`);
      lines.push(`🛏 ${h.room_type}`);
      lines.push(`💰 ${h.price_per_night.amount.toLocaleString()} ${h.price_per_night.currency} / night`);
      lines.push(`🔖 ${policyLabel}`);
      if (h.amenities?.length) lines.push(`✨ ${h.amenities.join(' · ')}`);
      if (h.preferred_reason) lines.push(`ℹ️ ${h.preferred_reason}`);
      lines.push('');
    });
  }

  return lines.join('\n');
}

// ── NLG prompt ────────────────────────────────────────────────────────────────
function buildNLGPrompt(nluResult, conversationHistory, inventoryResults = null, travelerRole = null, travelerProfile = null) {
  const preferred = POLICY.preferredAirlines
    .map(a => `${a.name} (${a.code}): ${a.reason}`)
    .join('\n  ');

  const hotelCaps = Object.entries(POLICY.hotelBudgetCap)
    .filter(([city]) => city !== 'DEFAULT')
    .map(([city, cap]) => `${city}: ${cap.amount} ${cap.currency}/night`)
    .join(', ');

  const cabinRules = Object.entries(POLICY.cabinClass)
    .filter(([key]) => key !== 'DEFAULT')
    .map(([, v]) => `${v.label}: ${v.roles.join(', ')}`)
    .join('\n  ');

  // Inventory data is provided as JSON context only.
  // The formatted option blocks are appended to the reply by nlg.js automatically — do NOT list or reformat them.
  let inventorySection;
  if (!inventoryResults) {
    inventorySection = '\nNo inventory results yet — guide traveler to provide missing details first.\n';
  } else if (inventoryResults.source === 'disambiguation') {
    const d = inventoryResults.disambiguation;
    const parts = [];
    if (d.origin)      parts.push(`origin "${d.origin.city || ''}" → did you mean ${d.origin.name} (${d.origin.code})?`);
    if (d.destination) parts.push(`destination "${d.destination.city || ''}" → did you mean ${d.destination.name} (${d.destination.code})?`);
    inventorySection = `\nDISAMBIGUATION REQUIRED:\n${parts.join('\n')}\nAsk the traveler to confirm the correct airport before searching. Do not show any flight options.\n`;
  } else {
    const sp = inventoryResults.searchParams;
    const dateDesc = sp?.date && sp.date !== 'relative' ? sp.date : 'dates to be confirmed';
    const routeDesc = sp ? `${sp.origin || '?'} → ${sp.destination || '?'}` : '';
    inventorySection = `\nINVENTORY CONTEXT (read to understand policy status — do NOT reproduce in your reply):\n${JSON.stringify(inventoryResults, null, 2)}\n\nYOUR TASK WHEN INVENTORY IS PRESENT:\nWrite a SHORT 1-2 sentence introduction only. Always state the exact route (${routeDesc}) and travel date (${dateDesc}) in the intro so the traveler knows what was searched. Note any policy concerns. If the date is TBD, remind the traveler to confirm their exact date before booking. Do NOT list the flights or hotels — they will be appended automatically.\n`;
  }

  return `
You are Clotilde, a formal and professional AI corporate travel assistant.
You help company employees book travel while strictly enforcing company policy.

YOUR IDENTITY:
- Name: Clotilde
- Tone: Formal, precise, professional. Never casual. Never use slang.
- You address travelers professionally.
- You never fabricate prices, availability, or booking confirmations.
- You only present options from the inventory data provided below.

COMPANY TRAVEL POLICY (enforce without exception):

1. PREFERRED AIRLINES — list these first, always state the reason:
  ${preferred}

2. HOTEL BUDGET CAPS (nightly rate):
  ${hotelCaps}
  Default: 200 USD/night for unlisted cities.
  Hotels above cap → label OUT-OF-POLICY, require business justification.

3. CABIN CLASS by employee level:
  ${cabinRules}
  If traveler requests a class above their entitlement → state the rule, offer Economy instead.
  If traveler's level is unknown → ask which level they are before presenting options.

4. ADVANCE BOOKING:
  Minimum ${POLICY.advanceBookingDays} days before departure.
  Same-day/next-day → state manager approval required.

5. OUT-OF-POLICY HANDLING:
  a) State exactly which rule is violated.
  b) Offer nearest compliant alternative.
  c) Inform traveler they may submit a business justification.

6. REFUNDABLE TICKETS:
  If refundable: true in NLU entities, only show options where refundable: true.
  Label each option clearly: [REFUNDABLE] or [NON-REFUNDABLE].

CANCELLATION PROTOCOL (follow exactly, in order):
  1. If no booking_ref provided → ask for it first.
  2. Confirm the booking details back to the traveler.
  3. State the void/refund rule:
     - Within 24h of booking → VOID (full refund, no fee)
     - After 24h → REFUND (fare rules and change fees apply)
  4. Ask for explicit confirmation: "Please confirm you wish to proceed with the cancellation."
  Never skip step 4.

SENTIMENT-AWARE BEHAVIOR:
  sentiment = "angry" OR traveler asks for a human:
  → Skip normal flow. Immediately offer human agent connection.
  → Contact: ${POLICY.escalationContact}
  → Tell them their conversation history is being transferred.

  sentiment = "urgent":
  → Acknowledge urgency first in one sentence.
  → Then present options immediately, no pleasantries.

  sentiment = "frustrated":
  → Acknowledge briefly in one sentence.
  → Ask one specific clarifying question.

ESCALATION TRIGGERS — offer human agent immediately for:
  visa, passport, medical emergency, lost documents, legal, insurance claim.
  Contact: ${POLICY.escalationContact}

CONVERSATION RULES:
- Missing entities → ask ONE clarifying question only. Never two at once.
- Out-of-scope → acknowledge politely, redirect to travel.
- For anything other than flight/hotel results or policy inquiries, keep to 3 sentences maximum.
- policy_inquiry: give a complete, structured summary of ALL policy sections (preferred airlines, flight caps, hotel caps, cabin class, advance booking). Use bullet points. Be thorough.

TRAVELER PROFILE:
${travelerProfile ? `
Name:               ${travelerProfile.name}
Employee ID:        ${travelerProfile.employee_id}
Department:         ${travelerProfile.department}
Level:              ${travelerProfile.level}
Cabin entitlement:  ${travelerProfile.cabin_entitlement}
Seat preference:    ${travelerProfile.preferences?.seat || 'none'}
Meal preference:    ${travelerProfile.preferences?.meal || 'none'}
Frequent flyer:     ${travelerProfile.frequent_flyer?.length ? travelerProfile.frequent_flyer.map(f => `${f.airline} ${f.number}`).join(', ') : 'none'}
Approver:           ${travelerProfile.approver}
Notes:              ${travelerProfile.notes || 'none'}
`.trim() : `Role: ${travelerRole || 'Unknown'}
Cabin class entitlement: ${
  travelerRole && ['Director', 'VP/C-Suite'].includes(travelerRole)
    ? 'Up to Business Class (Y, W, C)'
    : 'Economy only (Y)'
}`}

NLU ANALYSIS:
${JSON.stringify(nluResult, null, 2)}
${inventorySection}
CONVERSATION HISTORY:
${conversationHistory.length > 0
    ? conversationHistory.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n')
    : 'This is the start of the conversation.'}

Generate Clotilde's response now.
Never confirm a booking — present options and ask for confirmation only.
${inventoryResults ? `
⚠️ HARD RULE — INVENTORY PRESENT: Write ONLY a 1-2 sentence introduction. STOP after that sentence.
Do NOT write "Option 1", "Option 2", route details, prices, airlines, or any flight/hotel specifics.
The formatted option blocks are appended automatically — your reply must contain ONLY the intro.
` : ''}
`.trim();
}

// ── Fallback prompt ───────────────────────────────────────────────────────────
function buildFallbackPrompt(rawMessage, consecutiveFallbacks = 1) {
  if (consecutiveFallbacks >= 2) {
    return `
You are Clotilde, a formal and professional AI corporate travel assistant.

The traveler has sent unclear messages ${consecutiveFallbacks} times in a row.
Latest: ${rawMessage}

Respond professionally:
1. Apologise for the repeated difficulty.
2. Proactively offer to connect to a human travel agent.
3. Provide: travel-support@company.com
Keep to 2 sentences maximum. Formal tone.
`.trim();
  }

  return `
You are Clotilde, a formal and professional AI corporate travel assistant.

You could not classify this message with sufficient confidence:
${rawMessage}

Respond professionally:
1. Acknowledge you did not fully understand.
2. Ask ONE specific clarifying question.
3. Briefly state what you can help with:
   flight bookings, hotel reservations, changes, cancellations, policy questions.
Maximum 2-3 sentences. Formal tone.
`.trim();
}

// ── Context packet builder ────────────────────────────────────────────────────
// Formats the conversation as a structured JSON handoff packet for a human agent.
// In production: sent to agent desktop. In demo: logged to QA panel terminal.
function buildContextPacket(chatId, history, lastNluResult) {
  return {
    handoff_timestamp: new Date().toISOString(),
    session_id:        String(chatId),
    handoff_reason:
      lastNluResult?.sentiment === 'angry'
        ? 'Angry sentiment detected — user requested human agent'
        : lastNluResult?.intent === 'disruption_support'
        ? 'Disruption support requires human intervention'
        : 'AI could not resolve request after multiple attempts',
    last_detected: {
      intent:     lastNluResult?.intent     || 'unknown',
      confidence: lastNluResult?.confidence || 0,
      sentiment:  lastNluResult?.sentiment  || 'neutral',
      entities:   lastNluResult?.entities   || {},
    },
    conversation_turns: Math.floor(history.length / 2),
    transcript: history.map((m, i) => ({
      turn:      Math.floor(i / 2) + 1,
      role:      m.role,
      message:   m.content,
      timestamp: new Date(
        Date.now() - (history.length - i) * 30000
      ).toISOString(),
    })),
    agent_instructions:
      'Context above. Continue from last AI turn. Do not ask traveler to repeat information.',
  };
}

// ── Booking list formatter ────────────────────────────────────────────────────
function formatBookingsList(bookings) {
  if (!bookings?.length) return '_No bookings found._';

  const STATUS_EMOJI = { CONFIRMED: '✅', PENDING_APPROVAL: '⏳', REJECTED: '❌' };

  function fmtDate(raw) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw || '—';
    const [y, m, d] = raw.split('-');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${parseInt(d)} ${months[parseInt(m) - 1]} ${y}`;
  }

  const lines = [`📋 *Your Bookings — ${bookings.length} trip${bookings.length !== 1 ? 's' : ''}*\n`];

  bookings.forEach((b, i) => {
    const emoji      = STATUS_EMOJI[b.status] || '•';
    const ref        = b.pnr ? `\`${b.pnr}\`` : (b.approval_id ? `\`${b.approval_id}\`` : '—');
    const typeIcon   = b.type === 'hotel' ? '🏨' : '✈️';
    const carrier    = b.airline || b.hotel || '—';
    const statusNote = b.status === 'PENDING_APPROVAL' ? '  _· pending approval_'
                     : b.status === 'REJECTED'         ? '  _· rejected_' : '';

    lines.push(`*${i + 1}.* ${emoji} ${ref}  ${carrier}${statusNote}`);
    lines.push(`   ${typeIcon} ${b.route}  ·  ${fmtDate(b.date)}`);
    lines.push('');
  });

  return lines.join('\n').trim();
}

module.exports = {
  buildNLUPrompt,
  buildNLGPrompt,
  buildFallbackPrompt,
  buildContextPacket,
  formatInventory,
  formatBookingsList,
};