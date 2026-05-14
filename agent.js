// agent.js
// Unified agent using Gemini function calling.
// Replaces the separate NLU (nlu.js) + NLG (nlg.js) pipeline.
// The LLM decides what tools to call — no rigid intent classification.

const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs     = require('fs');
const path   = require('path');
const POLICY = require('./policy.js');
const {
  getMockFlights,
  getMockHotels,
  getRouteType,
  THAI_REGIONAL,
  REGIONAL_TO_BKK,
  addMinutesToDateTime,
} = require('./mock_inventory.js');
const { searchFlights: duffelSearchFlights } = require('./duffel.js');
const { formatInventory, buildContextPacket, formatBookingsList } = require('./prompt.js');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ── Tool definitions ──────────────────────────────────────────────────────────
const TOOLS = [{
  functionDeclarations: [
    {
      name: 'search_flights',
      description:
        'Search available flights between two airports. ' +
        'IMPORTANT — before calling this tool you MUST have all three: origin airport (IATA), ' +
        'destination airport (IATA), and travel date. If any are missing, ask for them all in a ' +
        'single message before calling. Do NOT call with a placeholder date or unknown destination. ' +
        'If the traveler names a country or a city with multiple airports, ask which specific airport ' +
        'they want — but only offer airports that realistically serve that route based on your knowledge. ' +
        'If this tool returns no results, it means no flights exist on that route/date — tell the ' +
        'traveler honestly and suggest the nearest major hub as an alternative.',
      parameters: {
        type: 'object',
        properties: {
          origin:      { type: 'string', description: 'IATA airport code, e.g. BKK' },
          destination: { type: 'string', description: 'IATA airport code, e.g. SIN' },
          date:        { type: 'string', description: 'Departure date YYYY-MM-DD — required, always collect this before searching' },
          cabin_class: { type: 'string', enum: ['Y','W','C','F'], description: 'Cabin class code' },
          refundable:  { type: 'boolean', description: 'True if traveler requests refundable fares only' },
        },
        required: ['origin', 'destination'],
      },
    },
    {
      name: 'search_hotels',
      description:
        'Search available hotels in a city. ' +
        'Call this when the traveler wants to find or book a hotel.',
      parameters: {
        type: 'object',
        properties: {
          city:          { type: 'string', description: 'IATA airport/city code, e.g. BKK' },
          checkin_date:  { type: 'string', description: 'Check-in date YYYY-MM-DD' },
          checkout_date: { type: 'string', description: 'Check-out date YYYY-MM-DD' },
        },
        required: ['city'],
      },
    },
    {
      name: 'escalate_to_human',
      description:
        'Hand off to a human travel agent. ' +
        'Call this for: angry traveler, visa/passport issues, medical emergency, ' +
        'lost documents, legal, insurance claims, or repeated failures to resolve.',
      parameters: {
        type: 'object',
        properties: {
          reason: { type: 'string', description: 'Brief reason for escalation' },
        },
        required: ['reason'],
      },
    },
    {
      name: 'get_booking',
      description:
        'Look up an existing booking by PNR or approval reference number. ' +
        'Call this whenever the traveler asks to see details of a specific booking, ' +
        'references a PNR code, or asks "show me my booking XXXX".',
      parameters: {
        type: 'object',
        properties: {
          reference: { type: 'string', description: 'PNR code (e.g. LL9SW8) or approval reference (e.g. APR-xxx)' },
        },
        required: ['reference'],
      },
    },
    {
      name: 'list_my_bookings',
      description:
        'List all bookings made by the current traveler. ' +
        'Call this when the traveler asks "how many bookings do I have?", "show me my bookings", ' +
        '"what have I booked?", "my trips", or any similar question about their booking history or count.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  ],
}];

// ── System prompt ─────────────────────────────────────────────────────────────
function buildSystemPrompt(travelerProfile, travelerRole) {
  const preferred = POLICY.preferredAirlines
    .map(a => `  ${a.name} (${a.code}): ${a.reason}`)
    .join('\n');

  const hotelCaps = Object.entries(POLICY.hotelBudgetCap)
    .filter(([k]) => k !== 'DEFAULT')
    .map(([city, cap]) => `  ${city}: ${cap.amount} ${cap.currency}/night`)
    .join('\n');

  const cabinRules = Object.entries(POLICY.cabinClass)
    .filter(([k]) => k !== 'DEFAULT')
    .map(([, v]) => `  ${v.label}: ${v.roles.join(', ')}`)
    .join('\n');

  const profileSection = travelerProfile ? `
TRAVELER PROFILE (loaded from HR system):
  Name:              ${travelerProfile.name}
  Employee ID:       ${travelerProfile.employee_id}
  Department:        ${travelerProfile.department}
  Level:             ${travelerProfile.level}
  Cabin entitlement: ${travelerProfile.cabin_entitlement}
  Seat preference:   ${travelerProfile.preferences?.seat || 'none'}
  Meal preference:   ${travelerProfile.preferences?.meal || 'none'}
  Frequent flyer:    ${travelerProfile.frequent_flyer?.length
    ? travelerProfile.frequent_flyer.map(f => `${f.airline} — ${f.number}`).join(', ')
    : 'none'}
  Approver:          ${travelerProfile.approver}
  Notes:             ${travelerProfile.notes || 'none'}
`.trim() : `TRAVELER ROLE: ${travelerRole || 'Unknown'}`;

  return `
Today's date: ${new Date().toISOString().split('T')[0]} (use this for all relative date calculations — "tomorrow", "next week", etc.)

You are Clotilde, a professional AI corporate travel assistant.
Your job: help employees plan, search, and book travel — while enforcing company policy.

IDENTITY:
- Name: Clotilde. Tone: professional, warm, conversational — not stiff or robotic.
- Address the traveler by first name once you know it.
- You may answer general questions (time zones, weather, visa guidance, currency) naturally.
- For anything requiring expertise beyond travel (legal, medical), offer to connect to a human agent.

GROUND TRANSPORT AWARENESS:
- Before searching for flights, consider whether the journey is practical by ground. If the origin and destination are in the same region and within roughly 300km of each other, proactively mention that driving or taking a bus/train may be faster and more convenient than flying (no check-in, no airport transfer).
- Examples: Chiang Mai ↔ Lampang (~100km, ~1.5h drive), Bangkok ↔ Pattaya (~150km, ~2h drive), Bangkok ↔ Hua Hin (~200km, ~2.5h drive), Chiang Mai ↔ Chiang Rai (~180km, ~2.5h drive).
- Use your general knowledge to assess any other short-distance pairs the traveler mentions.
- Still offer to search for flights if the traveler prefers — but always mention the ground option first for short distances.

APPROVAL ROUTING:
- All out-of-policy bookings (any rule violation: advance booking, budget cap, cabin class, non-preferred airline) require approval from Sarah Mitchell (VP-004 / CEO) — regardless of what the traveler's profile says in the "approver" field.
- Never mention James Chen or any other manager as the approver. Always refer to Sarah Mitchell as the approver.

HOTEL SUGGESTIONS:
- When offering to search for hotels after a flight search, always use the traveler's FINAL destination city — never the connection or stopover airport.
- Example: BKK → LAX via PVG — offer hotels in Los Angeles (LAX), NOT Shanghai (PVG).

FLIGHT SEARCH RULES:
- Always collect origin, destination, and travel date BEFORE searching. If any are missing, ask for all of them in one message — do not search with incomplete information.
- When the traveler says "next [weekday]" (e.g. "next Tuesday", "next Thursday"), always clarify which date they mean before searching — state both possibilities (the coming [weekday] this week and the one the following week) and ask which they intend. Never assume.
- Resolve city/country names to specific IATA codes using your knowledge. For ambiguous destinations (country name or multi-airport city), ask which airport the traveler prefers — but only list airports that realistically serve that specific route based on actual airline networks.
- If search returns no results: tell the traveler honestly, then suggest the nearest major international hub as an alternative (e.g. HKG → USM empty → suggest HKG → BKK).
- Company preference: for Bangkok, default to BKK (Suvarnabhumi) unless the traveler requests budget/domestic via DMK (Don Mueang).

${profileSection}

COMPANY TRAVEL POLICY:
1. Preferred airlines (recommend first, state reason):
${preferred}

2. Hotel budget caps (per night):
${hotelCaps}
   Default (other cities): 200 USD/night

3. Cabin class by level:
${cabinRules}

4. Advance booking: minimum ${POLICY.advanceBookingDays} days. Same-day/next-day needs manager approval.

5. Out-of-policy options: label clearly, state which rule is violated, offer compliant alternative.
   Traveler may still book with a submitted business justification.

6. Refundable fares: if traveler requests refundable, filter to refundable options only.

7. Cancellation flow:
   a) Confirm booking reference
   b) State void/refund rule (within 24h = void/full refund; after 24h = fare rules apply)
   c) Ask explicit confirmation before cancelling

AIRPORT GEOGRAPHY (Thailand — use this before answering any airport question):
- Bangkok has TWO airports:
  * Suvarnabhumi (BKK) — the only international airport for long-haul flights. ALL flights to/from Europe, the Americas, Middle East, Australia, and any destination outside Asia depart/arrive here. Never ask about DMK for these routes — use BKK automatically.
  * Don Mueang (DMK) — domestic and short-haul regional Asia only (Thai AirAsia, Nok Air, Lion Air to destinations within Thailand or nearby countries like Malaysia, Indonesia, Vietnam).
  * Only ask BKK vs DMK when the route is domestic (within Thailand) or regional Asia, and the traveler has not specified an airport.
  * For all long-haul international routes: use BKK without asking.
- Chonburi / Pattaya / U-Tapao / Eastern Seaboard: nearest airport is U-Tapao International (UTP), ~45 min from Pattaya, ~90 min from Bangkok by road.
  * "Chonburi", "Pattaya", and "U-Tapao" all refer to the same destination area.
  * Search for flights to UTP first. After presenting options, mention car/taxi (~90 min from Bangkok) as a secondary note.
- London has THREE main airports — ask which before searching:
  * Heathrow (LHR) — main hub; all major carriers including Thai Airways, oneworld/Star Alliance long-haul
  * Gatwick (LGW) — secondary hub; some long-haul and budget carriers
  * London City (LCY) — small, no direct long-haul from Bangkok; best for onward connections to European cities
  * When a traveler says "London" without specifying, ask: "London has three main airports — Heathrow (LHR), Gatwick (LGW), or London City (LCY). Which would you prefer?"
  * For Bangkok→London long-haul: LHR is most common. Mention this but still let the traveler choose.
  * Do NOT default to LHR. Do NOT call search_flights until the traveler picks one.
- Chiang Mai: CNX | Phuket: HKT | Koh Samui: USM

TOOL USE RULES:
- Before calling search_flights, you need: (1) origin IATA code, (2) destination IATA code, (3) travel date. Always follow this format:
  a) First, state the destination airport resolution if relevant (e.g. "The nearest airport for Chonburi is U-Tapao International (UTP).").
  b) Then identify ALL missing pieces and ask for them together using a • bulleted list, one bullet per item — every item must have a • prefix, no exceptions. Example:
  "To find the best flights, I need a few details:
  • Which Bangkok airport would you prefer? Suvarnabhumi (BKK) — main hub, or Don Mueang (DMK) — budget carriers?
  • What date would you like to travel?"
  If the traveler's reply still leaves something missing, ask again in the same • bulleted format for what remains.
- Once you have all three and the date is less than ${POLICY.advanceBookingDays} days away: send one message warning about the policy (state the rule, name the approver from their profile) and ask for confirmation. Format this as a brief statement followed by a single confirmation question. Only call search_flights after they confirm.
- When calling search_flights, set cabin_class from the traveler's entitlement: "Up to Business Class" → use 'C'; "Economy only" → use 'Y'. Never default to 'Y' for a traveler entitled to a higher class.
- If search_flights returns no_flights: true, tell the traveler no flights were found on that date and offer alternatives: (1) try a different date, (2) try a different nearby airport if applicable, (3) mention car/taxi if the route is Bangkok↔Chonburi/UTP.
- Before calling search_hotels, you MUST have: (1) city, (2) check-in date, (3) check-out date. Ask for missing details first.
- Call list_my_bookings when the traveler asks how many bookings they have, asks to see their booking history, or uses phrases like "my bookings", "my trips", "what did I book". Never assume the traveler is asking to re-select from a previous flight list — if a booking was already confirmed, it is done.
- Call escalate_to_human for: angry tone, visa/passport, emergency, lost documents, legal, insurance.
- This is a flight booking service. Always search for flights first. Alternative transport (car, train, Eurostar) may be mentioned briefly as a secondary note after presenting flight options — never as the primary recommendation.
- ⚠️ HARD RULE — after receiving tool results: write EXACTLY ONE intro sentence (e.g. "Here are the flights I found from BKK to UTP for 14 May 2026:"). Then STOP. Do NOT write option numbers, airline names, prices, times, policy labels, or any flight/hotel details. Do NOT write "Please select" or "Please reply". Do NOT suggest hotels. The options and selection prompt are appended automatically by the system — if you write them yourself they will appear twice.

CONVERSATION STYLE:
- Be concise for simple answers (1-2 sentences).
- Be thorough for policy questions — give the full picture.
- Never fabricate prices, availability, or booking confirmations.
- Never confirm a booking — present options and ask the traveler to select.
`.trim();
}

// ── Advance booking compliance ────────────────────────────────────────────────
function applyAdvanceBookingCompliance(flights, date, travelerProfile = null) {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return flights;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const departure = new Date(date);
  const diffDays  = Math.round((departure - today) / (1000 * 60 * 60 * 24));

  const isSelfAuthorised =
    travelerProfile?.employee_id === 'VP-004' ||
    travelerProfile?.approver?.toLowerCase().includes('self-authoris');

  if (diffDays < POLICY.advanceBookingDays) {
    const approvalNote = isSelfAuthorised
      ? `self-authorised — no manager approval required`
      : `manager approval needed`;
    return flights.map(f => ({
      ...f,
      is_compliant:     false,
      compliance_notes: `Advance booking violation: only ${diffDays} day(s) notice (minimum ${POLICY.advanceBookingDays} required) — ${approvalNote}.` +
                        (f.compliance_notes ? ` ${f.compliance_notes}` : ''),
    }));
  }
  return flights;
}

// ── Tool executor ─────────────────────────────────────────────────────────────
async function executeTool(name, args, travelerProfile = null) {
  if (name === 'search_flights') {
    const { origin, destination, date, cabin_class = 'Y', refundable = false } = args;

    // IATA code validation — reject anything that isn't a 3-letter airport code
    const IATA_RE = /^[A-Z]{3}$/;
    const badOrigin = origin      && !IATA_RE.test(origin.trim().toUpperCase());
    const badDest   = destination && !IATA_RE.test(destination.trim().toUpperCase());
    if (badOrigin || badDest) {
      return {
        disambiguation: true,
        message:
          `The following could not be matched to a 3-letter IATA airport code: ` +
          [badOrigin ? `origin "${origin}"` : null, badDest ? `destination "${destination}"` : null]
            .filter(Boolean).join(', ') +
          `. Use your knowledge to identify the correct IATA code(s), ask the traveler if the ` +
          `city has multiple airports that serve their route, then call search_flights again.`,
      };
    }

    const hasDate   = date && /^\d{4}-\d{2}-\d{2}$/.test(date);
    const routeType = getRouteType(origin, destination);
    let flights;
    let source;

    // For regional Thai airports + long-haul (e.g. CNX→LAX, LAX→CNX):
    // search the BKK hub leg via Duffel for real prices, then bolt on the feeder segment.
    const isRegionalLongHaul = routeType === 'LONG_HAUL' &&
      (THAI_REGIONAL.has(origin) || THAI_REGIONAL.has(destination));

    // Subtract minutes from a "YYYY-MM-DD HH:MM" string (handles crossing midnight)
    const subtractMins = (dt, mins) => {
      if (!dt || dt.startsWith('TBD')) return dt;
      const [ds, ts] = dt.split(' ');
      const d = new Date(`${ds}T${ts}:00`);
      d.setMinutes(d.getMinutes() - mins);
      return `${d.toISOString().split('T')[0]} ${d.toTimeString().slice(0, 5)}`;
    };

    if (hasDate) {
      if (routeType === 'DOMESTIC') {
        flights = getMockFlights(origin, destination, date, cabin_class);
        source  = 'mock';
        console.log(`[AGENT] Domestic route — mock search: ${flights.length} results`);
      } else if (isRegionalLongHaul) {
        // e.g. CNX→LAX: search BKK→LAX via Duffel; then prepend CNX→BKK feeder.
        //      LAX→CNX: search LAX→BKK via Duffel; then append BKK→CNX feeder.
        const isOutbound    = THAI_REGIONAL.has(origin);   // true = regional is the departure airport
        const hubOrig       = isOutbound ? 'BKK' : origin;
        const hubDest       = isOutbound ? destination : 'BKK';
        const feederAirport = isOutbound ? origin : destination;
        const feederMins    = REGIONAL_TO_BKK[feederAirport] || 70;
        const LAYOVER       = 90;

        try {
          const hubFlights = await duffelSearchFlights(hubOrig, hubDest, date, cabin_class);
          source = 'live';
          console.log(`[AGENT] Regional long-haul hub leg — Duffel ${hubOrig}→${hubDest}: ${hubFlights.length} results`);

          if (hubFlights.length === 0) {
            return {
              count: 0, flights: [], no_flights: true,
              route: `${origin} → ${destination}`, date, source: 'live',
              suggestion: 'No flights found. Inform the traveler and suggest the nearest major hub airport as an alternative.',
            };
          }

          flights = hubFlights.map((f, idx) => {
            const hubMins = f.duration_minutes || 600;

            if (isOutbound) {
              // CNX → BKK → LAX
              // Duffel has BKK→LAX leg. Work backwards from BKK departure to get CNX departure.
              const hubDepDt    = f.departure_datetime;             // BKK departure
              const hubArrDt    = f.arrival_datetime;               // LAX arrival
              const feederArrDt = subtractMins(hubDepDt, LAYOVER);  // feeder arrives BKK
              const feederDepDt = subtractMins(feederArrDt, feederMins); // CNX departure

              return {
                ...f,
                origin:             feederAirport,
                destination:        hubDest,
                departure_datetime: feederDepDt,
                arrival_datetime:   hubArrDt,
                duration_minutes:   feederMins + LAYOVER + hubMins,
                stops:              1,
                via:                'BKK',
                segments: [
                  { from: feederAirport, to: 'BKK', airline: 'Thai Airways', flight_number: `TG${100 + idx * 13}`, duration_minutes: feederMins, departure: feederDepDt, arrival: feederArrDt },
                  { from: 'BKK', to: hubDest, airline: f.airline, flight_number: f.flight_number, duration_minutes: hubMins, departure: hubDepDt, arrival: hubArrDt },
                ],
              };
            } else {
              // LAX → BKK → CNX
              // Duffel has LAX→BKK leg. Append BKK→CNX feeder after layover.
              const hubDepDt    = f.departure_datetime;                        // LAX departure
              const hubArrDt    = f.arrival_datetime;                          // BKK arrival
              const feederDepDt = addMinutesToDateTime(hubArrDt, LAYOVER);     // BKK departure (after layover)
              const feederArrDt = addMinutesToDateTime(feederDepDt, feederMins); // CNX arrival

              return {
                ...f,
                origin:             hubOrig,
                destination:        feederAirport,
                departure_datetime: hubDepDt,
                arrival_datetime:   feederArrDt,
                duration_minutes:   hubMins + LAYOVER + feederMins,
                stops:              1,
                via:                'BKK',
                segments: [
                  { from: hubOrig, to: 'BKK', airline: f.airline, flight_number: f.flight_number, duration_minutes: hubMins, departure: hubDepDt, arrival: hubArrDt },
                  { from: 'BKK', to: feederAirport, airline: 'Thai Airways', flight_number: `TG${100 + idx * 13}`, duration_minutes: feederMins, departure: feederDepDt, arrival: feederArrDt },
                ],
              };
            }
          });
        } catch (err) {
          console.error('[AGENT] Duffel unavailable for regional long-haul hub leg, falling back to mock:', err.message);
          flights = getMockFlights(origin, destination, date, cabin_class);
          source  = 'mock_fallback';
        }
      } else {
        try {
          flights = await duffelSearchFlights(origin, destination, date, cabin_class);
          source  = 'live';
          console.log(`[AGENT] Duffel search: ${flights.length} results`);

          if (flights.length === 0) {
            // No flights on this route/date — tell the user honestly, do NOT fall back to mock
            return {
              count:       0,
              flights:     [],
              no_flights:  true,
              route:       `${origin} → ${destination}`,
              date,
              source:      'live',
              suggestion:  'No flights found. Inform the traveler and suggest the nearest major hub ' +
                           'airport as an alternative (e.g. if destination was a regional airport, ' +
                           'suggest the main international gateway for that country instead).',
            };
          }
        } catch (err) {
          // API unavailable — fall back to mock so the demo still works
          console.error('[AGENT] Duffel unavailable, using mock:', err.message);
          flights = getMockFlights(origin, destination, date, cabin_class);
          source  = 'mock_fallback';
        }
      }
    } else {
      flights = getMockFlights(origin, destination, date, cabin_class);
      source  = 'mock';
      console.log(`[AGENT] Mock search: ${flights.length} results`);
    }

    if (refundable) flights = flights.filter(f => f.refundable);

    // Apply advance booking compliance flag
    flights = applyAdvanceBookingCompliance(flights, date, travelerProfile);

    // Sort: in-policy & preferred first, out-of-policy last (applies to both Duffel and mock)
    flights.sort((a, b) => {
      if (a.is_compliant && !b.is_compliant) return -1;
      if (!a.is_compliant && b.is_compliant) return 1;
      if (a.is_preferred && !b.is_preferred) return -1;
      if (!a.is_preferred && b.is_preferred) return 1;
      return (a.price?.amount || 0) - (b.price?.amount || 0);
    });

    return {
      count:     flights.length,
      flights,
      formatted: flights.length > 0 ? formatInventory({ flights }) : 'No flights found for this route.',
      source,
    };
  }

  if (name === 'search_hotels') {
    const { city, checkin_date, checkout_date } = args;
    const hotels = getMockHotels(city, checkin_date, checkout_date);
    return {
      count:     hotels.length,
      hotels,
      formatted: hotels.length > 0 ? formatInventory({ hotels }) : 'No hotels found for this city.',
      source:    'mock',
    };
  }

  if (name === 'escalate_to_human') {
    return {
      escalated: true,
      contact:   POLICY.escalationContact,
      message:   `Escalation logged. Reason: ${args.reason}`,
    };
  }

  if (name === 'get_booking') {
    const ref      = (args.reference || '').trim().toUpperCase();
    const bookings = JSON.parse(fs.readFileSync(path.join(__dirname, 'bookings.json'), 'utf8'));
    const booking  = bookings.find(b =>
      (b.pnr         && b.pnr.toUpperCase()         === ref) ||
      (b.approval_id && b.approval_id.toUpperCase() === ref)
    );
    if (!booking) {
      return { found: false, reference: ref, message: `No booking found for reference ${ref}.` };
    }
    return { found: true, booking };
  }

  if (name === 'list_my_bookings') {
    const employeeId = travelerProfile?.employee_id;
    const bookings   = JSON.parse(fs.readFileSync(path.join(__dirname, 'bookings.json'), 'utf8'));
    const mine       = employeeId
      ? bookings.filter(b => b.employee_id === employeeId)
      : [];
    return {
      count:    mine.length,
      bookings: mine.map(b => ({
        pnr:         b.pnr         || null,
        approval_id: b.approval_id || null,
        status:      b.status,
        type:        b.type,
        route:       b.origin && b.destination ? `${b.origin} → ${b.destination}` : (b.city || ''),
        date:        b.departure?.split(' ')[0] || b.checkin_date || '',
        airline:     b.airline || null,
        hotel:       b.hotel_name || null,
      })),
    };
  }

  return { error: `Unknown tool: ${name}` };
}

// ── Main entry point ──────────────────────────────────────────────────────────
async function processMessage(userMessage, conversationHistory = [], travelerRole = null, travelerProfile = null, chatId = null) {
  const startTime = Date.now();

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-pro',
    tools: TOOLS,
    generationConfig: {
      temperature:     0.5,
      maxOutputTokens: 8192,
    },
  });

  // Build chat history in Gemini format
  const geminiHistory = conversationHistory.map(m => ({
    role:  m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const chat = model.startChat({
    systemInstruction: { parts: [{ text: buildSystemPrompt(travelerProfile, travelerRole) }] },
    history:           geminiHistory,
  });

  let result = await chat.sendMessage(userMessage);
  let inventoryResults  = null;
  let bookingsResults   = null;
  let escalated         = false;
  let escalationReason  = null;

  // Handle function calls (may loop for multi-step reasoning)
  let iterations = 0;
  while (true) {
    const calls = result.response.functionCalls?.();
    if (!calls?.length || iterations >= 3) break;
    iterations++;

    const call      = calls[0];
    const toolResult = await executeTool(call.name, call.args, travelerProfile);
    console.log(`[AGENT] Tool called: ${call.name}`, JSON.stringify(call.args));

    // Track inventory for inline keyboard buttons
    if (call.name === 'search_flights' && toolResult.flights?.length) {
      inventoryResults = { flights: toolResult.flights, source: toolResult.source };
    }
    if (call.name === 'search_hotels' && toolResult.hotels?.length) {
      inventoryResults = { hotels: toolResult.hotels, source: toolResult.source };
    }
    if (call.name === 'list_my_bookings') {
      bookingsResults = toolResult.bookings || [];
    }
    if (call.name === 'escalate_to_human') {
      escalated        = true;
      escalationReason = call.args.reason || 'Traveler requested human assistance';
      const packet = buildContextPacket(chatId, conversationHistory, { intent: 'escalation', sentiment: 'neutral', entities: {} });
      console.log('\n\x1b[35m[QA PANEL — HANDOFF CONTEXT PACKET]\x1b[0m');
      console.log('\x1b[2m' + JSON.stringify(packet, null, 2) + '\x1b[0m');
    }

    // Send Gemini only a minimal summary — full formatted blocks are appended in code.
    // If we send the full data, Pro will reproduce the options and create duplicates.
    const geminiResponse = call.name === 'search_flights' ? {
      count:       toolResult.count,
      route:       `${call.args.origin} → ${call.args.destination}`,
      date:        call.args.date || 'not specified',
      source:      toolResult.source,
      has_results: (toolResult.count || 0) > 0,
      no_flights:  toolResult.no_flights || false,
      note:        toolResult.no_flights
        ? 'No flights found on this date. Offer alternatives: different date, different airport, or car/taxi if Bangkok↔UTP.'
        : 'Formatted options will be appended automatically. Write intro only.',
    } : call.name === 'search_hotels' ? {
      count:       toolResult.count,
      city:        call.args.city,
      has_results: (toolResult.count || 0) > 0,
      note:        'Formatted options will be appended automatically. Write intro only.',
    } : call.name === 'list_my_bookings' ? {
      count: toolResult.count,
      note:  'Formatted booking list will be appended automatically. Write ONE intro sentence only (e.g. "Here are your 9 bookings, Priya:"). Do NOT list the bookings yourself.',
    } : toolResult;

    result = await chat.sendMessage([{
      functionResponse: { name: call.name, response: geminiResponse },
    }]);
  }

  let reply = result.response.text().trim();
  // Save the raw Gemini text before inventory is appended.
  // This is what gets stored in conversation history so future turns don't
  // see the full formatted option list and accidentally reproduce old options.
  const geminiReply = reply;

  // Append pre-formatted bookings list (Gemini writes intro only)
  if (bookingsResults !== null) {
    reply += '\n\n' + formatBookingsList(bookingsResults);
  }

  // Append pre-formatted inventory blocks (Gemini writes intro only)
  if (inventoryResults?.flights?.length > 0 || inventoryResults?.hotels?.length > 0) {
    reply += '\n\n' + formatInventory(inventoryResults);

    // Fix 4: adaptive phrasing based on result count
    const resultCount = inventoryResults.flights?.length || inventoryResults.hotels?.length || 0;
    reply += resultCount === 1
      ? '\nWould you like to proceed with this option?'
      : '\nPlease reply with the number of your preferred option to proceed.';

    // Car service secondary note for Bangkok ↔ Chonburi/UTP routes
    const flightDest = inventoryResults.flights?.[0]?.destination;
    const flightOrig = inventoryResults.flights?.[0]?.origin;
    if (flightDest === 'UTP' || flightOrig === 'UTP') {
      reply += '\n\n_Note: A car or taxi between Bangkok and Chonburi/Pattaya (~90 min) is also an option._';
    }

    // Proactive hotel suggestion after flight results (handled in code, not by Gemini)
    if (inventoryResults.flights?.length > 0) {
      const AIRPORT_CITIES = {
        BKK: 'Bangkok', DMK: 'Bangkok', CNX: 'Chiang Mai', HKT: 'Phuket',
        USM: 'Koh Samui', UTP: 'Pattaya', SIN: 'Singapore', KUL: 'Kuala Lumpur',
        HKG: 'Hong Kong', NRT: 'Tokyo', KIX: 'Osaka', ICN: 'Seoul',
        PVG: 'Shanghai', PEK: 'Beijing', DEL: 'Delhi', BOM: 'Mumbai',
        DXB: 'Dubai', DOH: 'Doha', LHR: 'London', LGW: 'London', CDG: 'Paris',
        FRA: 'Frankfurt', AMS: 'Amsterdam', ZRH: 'Zurich',
        JFK: 'New York', LAX: 'Los Angeles', SFO: 'San Francisco',
        ORD: 'Chicago', MIA: 'Miami', SEA: 'Seattle',
        SYD: 'Sydney', MEL: 'Melbourne', BNE: 'Brisbane',
      };
      const dest     = flightDest || '';
      const cityName = AIRPORT_CITIES[dest] || dest;
      if (cityName) {
        reply += `\n\nWould you also like me to search for hotels in ${cityName}?`;
      }
    }
  }

  console.log(`[AGENT] Response in ${Date.now() - startTime}ms`);
  return { reply, geminiReply, inventoryResults, bookingsResults, escalated, escalationReason };
}

module.exports = { processMessage };
