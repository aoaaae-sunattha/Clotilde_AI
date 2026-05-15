// index.js  v3.0
// Main entry point — Telegram bot server.
// Architecture: Gemini function calling agent (agent.js).
// No separate NLU classifier — the LLM reasons and calls tools directly.

require('dotenv').config();

const TelegramBot            = require('node-telegram-bot-api');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { processMessage }     = require('./agent.js');
const { buildGDSPayload } = require('./mock_inventory.js');
const { bookFlight }     = require('./amadeus_mock.js');
const { submitForApproval, approveBooking, rejectBooking } = require('./approval.js');
const { getProfile }      = require('./travelers.js');
const { buildContextPacket } = require('./prompt.js');
const POLICY = require('./policy.js');
const fs     = require('fs');
const REGISTRY_PATH  = require('path').join(__dirname, 'chat_registry.json');
const BOOKINGS_PATH  = require('path').join(__dirname, 'bookings.json');

const AGENT_GROUP_CHAT_ID = process.env.AGENT_GROUP_CHAT_ID
  ? parseInt(process.env.AGENT_GROUP_CHAT_ID)
  : null;

// Maps agent-group message_id → traveler chat_id (in-memory, lost on restart)
const groupMsgToTraveler = new Map();  // messageId → travelerChatId
const agentTravelerMap   = new Map();  // agentUserId → travelerChatId

function saveBooking(record) {
  try {
    const bookings = JSON.parse(fs.readFileSync(BOOKINGS_PATH, 'utf8'));
    bookings.push(record);
    fs.writeFileSync(BOOKINGS_PATH, JSON.stringify(bookings, null, 2));
  } catch (e) {
    console.error('[BOOKINGS] Failed to save booking:', e.message);
  }
}

// ── PII helpers — mask traveler name and chat ID in logs ─────────────────────
function maskName(name) {
  if (!name) return '***';
  return name.split(/[ /]/).map(p => (p[0] || '*') + '***').join('/');
}
function maskChatId(chatId) {
  const s = String(chatId);
  return s.length > 5 ? s.slice(0, 3) + '****' : '****';
}

function registerChatId(employeeId, chatId) {
  try {
    const reg = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
    reg[employeeId] = chatId;
    fs.writeFileSync(REGISTRY_PATH, JSON.stringify(reg, null, 2));
  } catch (e) {
    console.error('[REGISTRY] Failed to save chat_id:', e.message);
  }
}

// ── Visa check helpers ────────────────────────────────────────────────────────
const THAI_AIRPORTS = new Set([
  'BKK','DMK','CNX','HKT','USM','HDY','CEI','KBV','UTP','NST','UTH','KKC','UBP','NAW',
]);

const NATIONALITY_NAMES = {
  TWN: 'Taiwan (Republic of China)',
  IN:  'India',
  SG:  'Singapore',
  GB:  'United Kingdom',
  TH:  'Thailand',
  US:  'United States',
  AU:  'Australia',
  MY:  'Malaysia',
  JP:  'Japan',
  KR:  'South Korea',
  CN:  'China',
  HK:  'Hong Kong',
  PH:  'Philippines',
  VN:  'Vietnam',
  ID:  'Indonesia',
};

async function checkEntryRequirements(nationalityCode, destinationIata) {
  if (THAI_AIRPORTS.has(destinationIata)) return null; // domestic — skip

  const nationality = NATIONALITY_NAMES[nationalityCode] || nationalityCode;
  const genAI       = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model       = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const prompt =
    `You are a travel entry requirements assistant. Reply ONLY with valid JSON — no markdown, no prose.\n\n` +
    `A ${nationality} passport holder is flying to the country served by IATA airport code ${destinationIata}.\n\n` +
    `Return:\n` +
    `1. Whether they need a visa (or visa on arrival)\n` +
    `2. Any mandatory pre-travel forms or registrations (e.g. TDAC for Thailand, MDAC for Malaysia, ` +
    `K-ETA for South Korea, SGAC for Singapore, ESTA for USA, ETIAS for Schengen, UK ETA, NZeTA, ` +
    `Australia ETA/eVisitor, Visit Japan Web, or similar systems). Only include forms that are ` +
    `genuinely required or strongly recommended for entry.\n\n` +
    `Reply with exactly this structure:\n` +
    `{"requires_visa":false,"visa_on_arrival":false,"destination_country":"<name>",` +
    `"note":"<one sentence about visa status>",` +
    `"entry_forms":[{"name":"<form name>","description":"<what it is and when to complete it>","mandatory":true}]}\n\n` +
    `entry_forms must be an empty array [] if none apply. ` +
    `Base this on typical 2025 policies. If uncertain about visa, set requires_visa to true.`;

  const result = await model.generateContent(prompt);
  const raw    = result.response.text().trim()
    .replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '').trim();
  return JSON.parse(raw);
}

// ── Core booking logic (shared by booking_confirm and visa_ok) ────────────────
async function proceedWithBooking(chatId, session) {
  // Idempotency guard — prevents duplicate booking from rapid double-taps
  if (session.bookingInProgress) {
    console.warn('[BOOKING] Duplicate confirm blocked — booking already in progress');
    return;
  }
  session.bookingInProgress = true;

  try {
    await _proceedWithBooking(chatId, session);
  } finally {
    session.bookingInProgress = false;
  }
}

async function _proceedWithBooking(chatId, session) {
  const opt     = session.selectedOption;
  const isHotel = !!opt?.hotel_id;
  const ref     = isHotel ? opt.hotel_id : opt?.flight_number;
  const profile = session.travelerProfile;

  // ── Out-of-policy → route to approval workflow ──────────────────────────
  const APPROVER_EMPLOYEE_ID = 'VP-004';
  // is_compliant === null means no FX rate — treat as out-of-policy (manual review)
  if ((opt?.is_compliant === false || opt?.is_compliant === null) && profile?.employee_id !== APPROVER_EMPLOYEE_ID) {
    const APPROVER_NAME  = 'Sarah Mitchell';
    const REGISTRY       = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
    const approverChatId       = REGISTRY[APPROVER_EMPLOYEE_ID] || null;

    const bookingRecord = {
      pnr:          null,
      status:       'PENDING_APPROVAL',
      confirmed_at: new Date().toISOString(),
      employee_id:  profile?.employee_id || null,
      traveler:     profile?.name        || 'Unknown',
      chat_id:      chatId,
      type:         isHotel ? 'hotel' : 'flight',
      ...(isHotel ? {
        hotel_id:        opt.hotel_id,
        hotel_name:      opt.name,
        room_type:       opt.room_type,
        checkin:         opt.checkin_date,
        checkout:        opt.checkout_date,
        price_per_night: opt.price_per_night,
      } : {
        flight_number: opt.flight_number,
        airline:       opt.airline,
        origin:        opt.origin,
        destination:   opt.destination,
        departure:     opt.departure_datetime,
        arrival:       opt.arrival_datetime,
        cabin_class:   opt.cabin_class,
        price:         opt.price,
      }),
    };

    session.awaitingJustification = { bookingRecord, approverEmployeeId: APPROVER_EMPLOYEE_ID, approverChatId };
    session.pendingOptions        = null;
    session.selectedOption        = null;

    await bot.sendMessage(chatId,
      `⚠️ *Out-of-Policy Booking*\n\n` +
      `This booking requires approval from *${APPROVER_NAME}* (CEO).\n\n` +
      `Please provide a brief business justification:\n` +
      `_Type your reason and send it as a message._`,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  let pnr;

  if (!isHotel && opt?.flight_number) {
    const travelerName = profile
      ? profile.name.toUpperCase().replace(' ', '/')
      : 'GUEST/TRAVELER';
    const gdsPayload = buildGDSPayload(opt, travelerName);

    console.log('\n\x1b[36m[QA PANEL — AMADEUS REQUEST]\x1b[0m Sending to Amadeus Flight Orders API...');
    const logPayload = JSON.parse(JSON.stringify(gdsPayload));
    if (logPayload.data?.travelers) {
      logPayload.data.travelers = logPayload.data.travelers.map(t => ({
        ...t, name: { firstName: '***', lastName: '***' },
      }));
    }
    console.log('\x1b[2m' + JSON.stringify(logPayload, null, 2) + '\x1b[0m');

    const amadeusResult = await bookFlight(gdsPayload);
    pnr = amadeusResult.pnr;

    console.log('\n\x1b[32m[QA PANEL — AMADEUS RESPONSE]\x1b[0m Booking confirmed by Amadeus:');
    console.log('\x1b[2m' + JSON.stringify(amadeusResult.response, null, 2) + '\x1b[0m');
  } else {
    pnr = Array.from({ length: 6 }, () =>
      'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]
    ).join('');
  }

  const bookingRecord = {
    pnr,
    status:       'CONFIRMED',
    confirmed_at: new Date().toISOString(),
    employee_id:  profile?.employee_id || null,
    traveler:     profile?.name        || 'Unknown',
    chat_id:      chatId,
    type:         isHotel ? 'hotel' : 'flight',
    ...(isHotel ? {
      hotel_id:        opt.hotel_id,
      hotel_name:      opt.name,
      room_type:       opt.room_type,
      checkin:         opt.checkin_date,
      checkout:        opt.checkout_date,
      price_per_night: opt.price_per_night,
    } : {
      flight_number: opt.flight_number,
      airline:       opt.airline,
      origin:        opt.origin,
      destination:   opt.destination,
      departure:     opt.departure_datetime,
      arrival:       opt.arrival_datetime,
      cabin_class:   opt.cabin_class,
      price:         opt.price,
    }),
  };
  saveBooking(bookingRecord);

  console.log(`[BOT] Booking confirmed — PNR: ${pnr} — ref: ${ref} — user: ${maskChatId(chatId)}`);

  const cabinLabel = { Y: 'Economy', W: 'Premium Economy', C: 'Business', F: 'First' }[opt.cabin_class] || opt.cabin_class || '—';
  const confirmMsg = isHotel
    ? `✅ *Booking Confirmed*\n\n` +
      `*Traveler:* ${profile?.name || 'Unknown'} (${profile?.employee_id || '—'})\n\n` +
      `*Hotel:* ${opt.name}\n` +
      `*Room:* ${opt.room_type}\n` +
      `*Check-in:* ${opt.checkin_date}\n` +
      `*Check-out:* ${opt.checkout_date}\n` +
      (opt.price_per_night ? `*Price:* ${opt.price_per_night.amount?.toLocaleString()} ${opt.price_per_night.currency}/night\n` : '') +
      `\n🔖 *Reference: \`${pnr}\`*\n\n` +
      `A confirmation will be sent to your registered email. For assistance: ${POLICY.escalationContact}`
    : `✅ *Booking Confirmed*\n\n` +
      `*Traveler:* ${profile?.name || 'Unknown'} (${profile?.employee_id || '—'})\n\n` +
      `*Flight:* ${opt.airline} (${opt.flight_number})\n` +
      `*Route:* ${opt.origin} → ${opt.destination}\n` +
      `*Departure:* ${opt.departure_datetime}\n` +
      `*Arrival:* ${opt.arrival_datetime}\n` +
      `*Cabin:* ${cabinLabel}\n` +
      (opt.price ? `*Price:* ${opt.price.amount?.toLocaleString()} ${opt.price.currency}\n` : '') +
      `\n🎫 *PNR: \`${pnr}\`*\n\n` +
      `A confirmation will be sent to your registered email. For assistance: ${POLICY.escalationContact}`;

  await bot.sendMessage(chatId, confirmMsg, { parse_mode: 'Markdown' });
  session.pendingOptions  = null;
  session.selectedOption  = null;
}

// ── Post escalation to agent group ───────────────────────────────────────────
async function postEscalationToGroup(chatId, session, reason) {
  if (!AGENT_GROUP_CHAT_ID) {
    console.warn('[ESCALATION] AGENT_GROUP_CHAT_ID not set — skipping group notification');
    return;
  }

  const profile = session.travelerProfile;
  const name    = profile?.name        || 'Unknown traveler';
  const empId   = profile?.employee_id || '—';
  const dept    = profile?.department  || '—';

  // Escape characters that break Telegram Markdown v1
  const esc = s => s.replace(/[_*`\[]/g, '\\$&');

  // Full session history (capped at MAX_HISTORY_TURNS)
  const recent    = session.history;
  const transcript = recent.length > 0
    ? recent.map(m => `${m.role === 'user' ? '👤' : '🤖'} ${esc(m.content.slice(0, 400))}${m.content.length > 400 ? '…' : ''}`).join('\n')
    : 'No conversation history.';

  const text =
    `🚨 *New Escalation*\n\n` +
    `*Traveler:* ${esc(name)} (${esc(empId)})\n` +
    `*Department:* ${esc(dept)}\n` +
    `*Reason:* ${esc(reason)}\n\n` +
    `*Full conversation:*\n${transcript}\n\n` +
    `_Claim this case to take over the conversation._`;

  let msg;
  try {
    msg = await bot.sendMessage(AGENT_GROUP_CHAT_ID, text, {
      parse_mode:   'Markdown',
      reply_markup: {
        inline_keyboard: [[
          { text: '🙋 Claim this case', callback_data: `claim_${chatId}` },
        ]],
      },
    });
  } catch (err) {
    console.error(`[ESCALATION] Failed to post to agent group (chat_id: ${AGENT_GROUP_CHAT_ID}):`, err.message);
    // Notify traveler that the handoff failed so they're not left hanging
    await bot.sendMessage(chatId,
      `⚠️ I was unable to reach the agent team right now. Please contact us directly at ${POLICY.escalationContact}`
    );
    return;
  }

  groupMsgToTraveler.set(msg.message_id, chatId);
  session.agentGroupMessageId = msg.message_id;
  session.mode                = 'pending_claim';

  console.log(`[ESCALATION] Posted to agent group — message_id: ${msg.message_id}`);
}

// ── Validate env on startup ───────────────────────────────────────────────────
['TELEGRAM_BOT_TOKEN', 'GEMINI_API_KEY'].forEach(key => {
  if (!process.env[key]) {
    console.error(`\n[ERROR] Missing environment variable: ${key}\nCheck your .env file.\n`);
    process.exit(1);
  }
});

// ── Start Telegram bot ────────────────────────────────────────────────────────
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

// ── Per-user session state ────────────────────────────────────────────────────
// Key: chat_id
// Value: { history: [], consecutiveFallbacks: 0, lastNluResult: null }
const sessions        = new Map();
const MAX_HISTORY_TURNS = 10;  // more turns now that there's no NLU token overhead

function getSession(chatId) {
  if (!sessions.has(chatId)) {
    sessions.set(chatId, {
      history:                [],
      pendingOptions:         null,   // flights or hotels awaiting selection
      selectedOption:         null,   // option chosen, awaiting confirm/cancel
      role:                   null,   // employee level set at /start
      awaitingRole:           true,   // always require role before first message
      travelerProfile:        null,   // loaded from travelers.yml on role selection
      awaitingJustification:    null,   // pending booking record awaiting justification text
      awaitingRejectionReason:  null,  // approvalId awaiting rejection reason text
      awaitingVisaConfirmation: false, // flight parked pending traveler visa acknowledgement
      bookingInProgress:        false, // idempotency guard — blocks duplicate confirms
      mode:                     'ai',  // 'ai' | 'pending_claim' | 'human'
      agentGroupMessageId:      null,  // message_id of the claim post in the agent group
      pendingEscalationReason:  null,  // stored until user confirms escalation
    });
  }
  return sessions.get(chatId);
}

// ── Role selection keyboard ───────────────────────────────────────────────────
const ROLE_KEYBOARD = {
  inline_keyboard: [
    [
      { text: 'Operations / Staff',  callback_data: 'role_operations' },
      { text: 'Manager / Senior',    callback_data: 'role_manager'    },
    ],
    [
      { text: 'Director',            callback_data: 'role_director'   },
      { text: 'VP / C-Suite',        callback_data: 'role_vp'         },
    ],
  ],
};

const ROLE_LABELS = {
  role_operations: 'Operations/Staff',
  role_manager:    'Manager/Senior',
  role_director:   'Director',
  role_vp:         'VP/C-Suite',
};

// ── Affirmative / negative detection (for disambiguation confirmations) ────────
const AFFIRMATIVES = new Set([
  'yes','yep','yeah','yup','sure','ok','okay','correct','right','confirm',
  'absolutely','definitely','affirmative','go ahead','that\'s right','sounds right',
  'correct','aye','roger',
]);
const NEGATIVES = new Set([
  'no','nope','nah','negative','cancel','wrong','incorrect','not that','neither',
]);

function isAffirmative(text) {
  return AFFIRMATIVES.has(text.toLowerCase().trim().replace(/[.!?]/g, ''));
}
function isNegative(text) {
  return NEGATIVES.has(text.toLowerCase().trim().replace(/[.!?]/g, ''));
}

// ── Shared helpers ────────────────────────────────────────────────────────────
function trimHistory(session) {
  while (session.history.length > MAX_HISTORY_TURNS * 2) {
    session.history.splice(0, 2);
  }
}

async function sendReply(bot, chatId, nlgResult, session) {
  let replyMarkup;

  if (nlgResult.escalated) {
    replyMarkup = {
      inline_keyboard: [[
        { text: '✅ Connect me to a human agent', callback_data: 'escalate_yes' },
        { text: '❌ Stay with Clotilde',          callback_data: 'escalate_no'  },
      ]],
    };
  } else if (nlgResult.inventoryResults?.flights?.length > 0) {
    session.pendingOptions = { type: 'flight', items: nlgResult.inventoryResults.flights };
    replyMarkup = {
      inline_keyboard: [
        nlgResult.inventoryResults.flights.map((f, i) => {
          // For connecting flights with multiple airlines, abbreviate to keep button text short
          let label = f.airline;
          if (f.stops > 0 && f.segments?.length > 1) {
            const codes = [...new Set(f.segments.map(s => s.airline.split(' ')[0]))];
            if (codes.length > 1) label = codes.join('+');
          }
          return { text: `Option ${i + 1} — ${label}`, callback_data: `select_${i}` };
        }),
      ],
    };
  } else if (nlgResult.inventoryResults?.hotels?.length > 0) {
    session.pendingOptions = { type: 'hotel', items: nlgResult.inventoryResults.hotels };
    replyMarkup = {
      inline_keyboard: [
        nlgResult.inventoryResults.hotels.map((h, i) => ({
          text:          `Option ${i + 1} — ${h.name}`,
          callback_data: `select_${i}`,
        })),
      ],
    };
  }

  await bot.sendMessage(
    chatId,
    nlgResult.reply,
    replyMarkup ? { reply_markup: replyMarkup, parse_mode: 'Markdown' } : { parse_mode: 'Markdown' }
  );
}

// ── Startup banner ────────────────────────────────────────────────────────────
console.log('\n' + '═'.repeat(58));
console.log('  CLOTILDE v3.0 — Corporate Travel Assistant');
console.log('  Powered by Gemini 2.5 Flash + Telegram Bot API');
console.log('  Architecture: Gemini function calling agent');
console.log('  Listening for messages...');
console.log('═'.repeat(58));
console.log('  Tools available : search_flights, search_hotels, escalate_to_human');
console.log('  GDS payloads logged on booking confirmation');
console.log('  Context packets logged on escalations');
console.log('\n  Press Ctrl+C to stop\n');

// ── /start ────────────────────────────────────────────────────────────────────
bot.onText(/\/start/, async (msg) => {
  const chatId  = msg.chat.id;
  const session = getSession(chatId);
  session.history         = [];
  session.role            = null;
  session.awaitingRole    = true;
  session.pendingOptions  = null;
  session.selectedOption  = null;
  session.travelerProfile = null;

  await bot.sendMessage(chatId,
    `Good day. I am Clotilde, your corporate travel assistant.\n\n` +
    `Before we begin, please select your role so I can apply the correct travel policy:`,
    { reply_markup: ROLE_KEYBOARD }
  );
  console.log(`[BOT] New session — chat_id: ${chatId}`);
});

// ── /reset ────────────────────────────────────────────────────────────────────
bot.onText(/\/reset/, async (msg) => {
  const chatId  = msg.chat.id;
  const session = getSession(chatId);
  session.history         = [];
  session.role            = null;
  session.awaitingRole    = true;
  session.pendingOptions  = null;
  session.selectedOption  = null;
  session.travelerProfile = null;

  await bot.sendMessage(chatId,
    `Session reset. Please select your role to continue:`,
    { reply_markup: ROLE_KEYBOARD }
  );
  console.log(`[BOT] Session reset — chat_id: ${chatId}`);
});

// ── /status ───────────────────────────────────────────────────────────────────
bot.onText(/\/status/, async (msg) => {
  const chatId  = msg.chat.id;
  const session = getSession(chatId);
  const turns   = Math.floor(session.history.length / 2);

  await bot.sendMessage(chatId,
    `Session status:\n` +
    `• Conversation turns: ${turns}\n` +
    `• Consecutive fallbacks: ${session.consecutiveFallbacks}\n` +
    `• System: online`
  );
});

// ── Main message handler ──────────────────────────────────────────────────────
bot.on('message', async (msg) => {
  const chatId      = msg.chat.id;
  const userMessage = msg.text;

  if (!userMessage || userMessage.startsWith('/')) return;

  // ── Temporary: log every chat ID so you can identify the agent group ──────
  console.log(`[DEBUG] Message from chat_id: ${chatId} (type: ${msg.chat.type}, title: ${msg.chat.title || 'private'})`);

  // ── Agent group: route messages back to traveler ─────────────────────────
  if (AGENT_GROUP_CHAT_ID && chatId === AGENT_GROUP_CHAT_ID) {
    if (msg.from?.is_bot) return; // ignore bot's own messages

    // Try reply-based routing first, then fall back to agent-claim routing
    let travelerChatId = null;
    if (msg.reply_to_message) {
      travelerChatId = groupMsgToTraveler.get(msg.reply_to_message.message_id);
    }
    if (!travelerChatId && msg.from?.id) {
      travelerChatId = agentTravelerMap.get(msg.from.id);
    }
    if (!travelerChatId) return;

    const travelerSession = getSession(travelerChatId);
    if (travelerSession.mode !== 'human') return;

    const agentName = msg.from?.first_name || 'Agent';
    await bot.sendMessage(travelerChatId,
      `👤 *${agentName}:* ${userMessage}`,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  const session = getSession(chatId);

  // ── Human agent mode: forward traveler messages to agent group ────────────
  if (session.mode === 'human' || session.mode === 'pending_claim') {
    if (session.agentGroupMessageId && AGENT_GROUP_CHAT_ID) {
      const profile = session.travelerProfile;
      await bot.sendMessage(AGENT_GROUP_CHAT_ID,
        `💬 *${profile?.name || 'Traveler'}:* ${userMessage}`,
        {
          parse_mode:         'Markdown',
          reply_to_message_id: session.agentGroupMessageId,
        }
      );
      if (session.mode === 'pending_claim') {
        await bot.sendMessage(chatId,
          `_Your message has been forwarded. An agent will join shortly…_`,
          { parse_mode: 'Markdown' }
        );
      }
    }
    return;
  }

  // ── Role not yet set — remind user to use the buttons ────────────────────────
  if (session.awaitingRole) {
    await bot.sendMessage(chatId,
      `Please select your role before we proceed:`,
      { reply_markup: ROLE_KEYBOARD }
    );
    return;
  }

  // ── Awaiting business justification for out-of-policy booking ────────────────
  if (session.awaitingJustification) {
    const { bookingRecord, approverEmployeeId, approverChatId } = session.awaitingJustification;
    session.awaitingJustification = null;

    try {
      const approvalId = await submitForApproval({
        bookingRecord,
        justification:  userMessage,
        approverEmployeeId,
        approverChatId,
        travelerChatId: chatId,
      });
      console.log(`[BOT] Approval submitted — ${approvalId}`);
    } catch (err) {
      console.error('[BOT] Failed to submit approval:', err.message);
      await bot.sendMessage(chatId, 'There was an error submitting your approval request. Please contact travel-support@company.com.');
    }
    return;
  }

  // ── VP/C-Suite: text shortcut for pending approvals ─────────────────────────
  if (session.role === 'VP/C-Suite') {
    const lower = userMessage.toLowerCase();
    const isApprovalQuery = /approv|pending|request|review/.test(lower);
    if (isApprovalQuery) {
      const APPROVALS_PATH = require('path').join(__dirname, 'approvals.json');
      const approvals = JSON.parse(fs.readFileSync(APPROVALS_PATH, 'utf8'));
      const pending   = approvals.filter(a => a.status === 'PENDING');

      if (pending.length === 0) {
        await bot.sendMessage(chatId, `📋 *Pending Approvals*\n\nNo pending approval requests at this time.`, { parse_mode: 'Markdown' });
        return;
      }

      for (const a of pending) {
        const b    = a.booking;
        const line = b.type === 'hotel'
          ? `🏨 ${b.hotel_name} (${b.checkin} → ${b.checkout})`
          : `✈️ ${b.airline} (${b.flight_number}) — ${b.origin} → ${b.destination}\n📅 ${b.departure} → ${b.arrival}`;

        await bot.sendMessage(chatId,
          `📋 *Approval Request*\n\n` +
          `*From:* ${b.traveler} (${b.employee_id})\n` +
          `${line}\n` +
          (b.cabin_class ? `*Cabin:* ${b.cabin_class}\n` : '') +
          (b.price       ? `*Price:* ${b.price.amount?.toLocaleString()} ${b.price.currency}\n` : '') +
          `\n📝 *Justification:* _${a.justification}_\n` +
          `📋 *Ref:* \`${a.approval_id}\``,
          {
            parse_mode:   'Markdown',
            reply_markup: {
              inline_keyboard: [[
                { text: '✅ Approve', callback_data: `approve_${a.approval_id}` },
                { text: '❌ Reject',  callback_data: `reject_${a.approval_id}`  },
              ]],
            },
          }
        );
      }
      return;
    }
  }

  // ── Awaiting rejection reason from approver ───────────────────────────────────
  if (session.awaitingRejectionReason) {
    const approvalId = session.awaitingRejectionReason;
    session.awaitingRejectionReason = null;

    try {
      await rejectBooking(approvalId, userMessage);
      await bot.sendMessage(chatId,
        `✅ Booking \`${approvalId}\` has been rejected. The traveler has been notified.`,
        { parse_mode: 'Markdown' }
      );
    } catch (err) {
      console.error('[BOT] Failed to reject booking:', err.message);
      await bot.sendMessage(chatId, `Error: ${err.message}`);
    }
    return;
  }

  // ── Intercept option selection by number (e.g. "3", "option 2") ─────────────
  // Prevents Gemini from confirming bookings conversationally.
  if (session.pendingOptions?.items?.length > 0) {
    const numMatch = userMessage.trim().match(/^(?:option\s*)?(\d+)$/i);
    if (numMatch) {
      const idx    = parseInt(numMatch[1]) - 1;
      const chosen = session.pendingOptions.items[idx];
      if (chosen) {
        session.selectedOption = chosen;
        const isHotel = session.pendingOptions.type === 'hotel';
        const summary = isHotel
          ? `*${chosen.name}* — ${chosen.room_type}\n💰 ${chosen.price_per_night.amount.toLocaleString()} ${chosen.price_per_night.currency}/night`
          : `*${chosen.airline} (${chosen.flight_number})*\n📅 ${chosen.departure_datetime} → ${chosen.arrival_datetime}\n💰 ${chosen.price.amount.toLocaleString()} ${chosen.price.currency}`;
        await bot.sendMessage(chatId,
          `You have selected:\n\n${summary}\n\nShall I proceed with this booking?`,
          {
            parse_mode:   'Markdown',
            reply_markup: {
              inline_keyboard: [[
                { text: '✅ Confirm', callback_data: 'booking_confirm' },
                { text: '❌ Go back', callback_data: 'booking_cancel'  },
              ]],
            },
          }
        );
        return;
      }
    }
  }

  // ── Intercept affirmative when a selection is already pending confirm ─────────
  if (session.selectedOption && isAffirmative(userMessage)) {
    await proceedWithBooking(chatId, session);
    return;
  }

  await bot.sendChatAction(chatId, 'typing');

  try {
    const agentResult = await processMessage(
      userMessage,
      session.history,
      session.role,
      session.travelerProfile,
      chatId
    );

    await sendReply(bot, chatId, agentResult, session);

    session.history.push({ role: 'user',      content: userMessage });
    // Store only Gemini's intro sentence, not the full formatted inventory block.
    // Storing the full block causes future searches to "see" old options and reproduce them.
    session.history.push({ role: 'assistant', content: agentResult.geminiReply || agentResult.reply });
    trimHistory(session);

    if (agentResult.escalated) {
      session.pendingEscalationReason = agentResult.escalationReason || 'Traveler requested human assistance';
      console.log(`[BOT] Escalation triggered — chat_id: ${chatId}`);
    }

  } catch (error) {
    console.error('[BOT] Unexpected error:', error.message);
    await bot.sendMessage(
      chatId,
      'I apologise — a technical error occurred. Please try again or contact travel-support@company.com.'
    );
  }
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────
process.on('SIGINT', () => {
  console.log('\n[BOT] Shutting down...');
  bot.stopPolling();
  process.exit(0);
});

// ── Inline keyboard callback handler ─────────────────────────────────────────
bot.on('callback_query', async (query) => {
  const chatId  = query.message.chat.id;
  const msgId   = query.message.message_id;
  const data    = query.data;
  const session = getSession(chatId);

  // Acknowledge immediately so Telegram stops the spinner
  await bot.answerCallbackQuery(query.id);

  // Remove the keyboard from the original message
  try {
    await bot.editMessageReplyMarkup(
      { inline_keyboard: [] },
      { chat_id: chatId, message_id: msgId }
    );
  } catch (_) { /* ignore if already edited */ }

  // ── VP menu buttons ──────────────────────────────────────────────────────
  if (data === 'vp_book_flights') {
    await bot.sendMessage(chatId,
      `✈️ Of course. How may I assist you with your travel today?`
    );
    return;
  }

  if (data === 'vp_view_approvals') {
    const APPROVALS_PATH = require('path').join(__dirname, 'approvals.json');
    const approvals = JSON.parse(fs.readFileSync(APPROVALS_PATH, 'utf8'));
    const pending   = approvals.filter(a => a.status === 'PENDING');

    if (pending.length === 0) {
      await bot.sendMessage(chatId, `📋 *Pending Approvals*\n\nNo pending approval requests at this time.`, { parse_mode: 'Markdown' });
      return;
    }

    for (const a of pending) {
      const b    = a.booking;
      const line = b.type === 'hotel'
        ? `🏨 ${b.hotel_name} (${b.checkin} → ${b.checkout})`
        : `✈️ ${b.airline} (${b.flight_number}) — ${b.origin} → ${b.destination}\n📅 ${b.departure} → ${b.arrival}`;

      await bot.sendMessage(chatId,
        `📋 *Approval Request*\n\n` +
        `*From:* ${b.traveler} (${b.employee_id})\n` +
        `${line}\n` +
        (b.cabin_class ? `*Cabin:* ${b.cabin_class}\n` : '') +
        (b.price       ? `*Price:* ${b.price.amount?.toLocaleString()} ${b.price.currency}\n` : '') +
        `\n📝 *Justification:* _${a.justification}_\n` +
        `📋 *Ref:* \`${a.approval_id}\``,
        {
          parse_mode:   'Markdown',
          reply_markup: {
            inline_keyboard: [[
              { text: '✅ Approve', callback_data: `approve_${a.approval_id}` },
              { text: '❌ Reject',  callback_data: `reject_${a.approval_id}`  },
            ]],
          },
        }
      );
    }
    return;
  }

  // ── Approval buttons (sent to manager) ──────────────────────────────────
  if (data.startsWith('approve_')) {
    const approvalId = data.slice(8);
    try {
      const { pnr } = await approveBooking(approvalId);
      await bot.sendMessage(chatId,
        `✅ Approved. PNR *\`${pnr}\`* has been issued and the traveler has been notified.`,
        { parse_mode: 'Markdown' }
      );
    } catch (err) {
      await bot.sendMessage(chatId, `Error: ${err.message}`);
    }
    return;
  }

  if (data.startsWith('reject_')) {
    const approvalId = data.slice(7);
    session.awaitingRejectionReason = approvalId;
    await bot.sendMessage(chatId,
      `Please type your reason for rejecting this booking and send it as a message.`
    );
    return;
  }

  // ── Escalation buttons ───────────────────────────────────────────────────
  if (data === 'escalate_yes') {
    const reason = session.pendingEscalationReason || 'Traveler requested human assistance';
    session.pendingEscalationReason = null;

    await postEscalationToGroup(chatId, session, reason);

    await bot.sendMessage(chatId,
      `✅ You are now being connected to a live travel support agent.\n\n` +
      `An agent will join this conversation shortly — you don't need to repeat anything.\n` +
      `For urgent help: ${POLICY.escalationContact}`
    );
    return;
  }

  // ── Agent: claim a case ──────────────────────────────────────────────────
  if (data.startsWith('claim_')) {
    const travelerChatId    = parseInt(data.slice(6));
    const travelerSession   = getSession(travelerChatId);
    const agentName         = query.from?.first_name || 'An agent';
    const agentUsername     = query.from?.username ? `@${query.from.username}` : agentName;

    travelerSession.mode = 'human';
    agentTravelerMap.set(query.from.id, travelerChatId);

    // Update group message keyboard: replace Claim with Resolve
    try {
      await bot.editMessageReplyMarkup(
        { inline_keyboard: [[
          { text: `✅ Claimed by ${agentUsername} — Click to Resolve`, callback_data: `resolve_${travelerChatId}` },
        ]] },
        { chat_id: AGENT_GROUP_CHAT_ID, message_id: msgId }
      );
    } catch (_) {}

    // Post a thread-starter reply in the group so the agent knows where to type
    try {
      const threadMsg = await bot.sendMessage(AGENT_GROUP_CHAT_ID,
        `✅ *${agentUsername} claimed this case.* Reply to this message to send messages to the traveler.`,
        { parse_mode: 'Markdown', reply_to_message_id: msgId }
      );
      // Register this message too so replies to it also route to the traveler
      groupMsgToTraveler.set(threadMsg.message_id, travelerChatId);
    } catch (_) {}

    // Notify traveler
    await bot.sendMessage(travelerChatId,
      `✅ *${agentName} has joined your conversation.*\n\nYou are now speaking with a live travel support agent. Please go ahead.`,
      { parse_mode: 'Markdown' }
    );

    await bot.answerCallbackQuery(query.id, { text: `Case claimed. Traveler has been notified.` });
    return;
  }

  // ── Agent: resolve a case ────────────────────────────────────────────────
  if (data.startsWith('resolve_')) {
    const travelerChatId  = parseInt(data.slice(8));
    const travelerSession = getSession(travelerChatId);
    const agentName       = query.from?.first_name || 'The agent';

    travelerSession.mode             = 'ai';
    agentTravelerMap.delete(query.from.id);
    travelerSession.agentGroupMessageId = null;

    // Remove resolve button from group message
    try {
      await bot.editMessageReplyMarkup(
        { inline_keyboard: [] },
        { chat_id: AGENT_GROUP_CHAT_ID, message_id: msgId }
      );
    } catch (_) {}

    // Notify traveler
    await bot.sendMessage(travelerChatId,
      `✅ Your case has been resolved by ${agentName}.\n\nYou are back with Clotilde — how can I help you further?`
    );

    await bot.answerCallbackQuery(query.id, { text: 'Case resolved.' });
    return;
  }

  if (data === 'escalate_no') {
    await bot.sendMessage(chatId,
      'Understood. I am here to assist. How may I help you with your travel requirements?'
    );
    return;
  }

  // ── Role selection buttons ───────────────────────────────────────────────
  if (data.startsWith('role_')) {
    const role = ROLE_LABELS[data];
    if (!role) return;

    session.role            = role;
    session.awaitingRole    = false;
    session.travelerProfile = getProfile(role);

    if (session.travelerProfile?.employee_id) {
      registerChatId(session.travelerProfile.employee_id, chatId);
      console.log(`[REGISTRY] Registered ${session.travelerProfile.employee_id} → user: ${maskChatId(chatId)}`);
    }
    console.log(`[BOT] Role set: ${role} — user: ${maskChatId(chatId)} — traveler: ${maskName(session.travelerProfile?.name || '')}`);

    const profile = session.travelerProfile;

    // ── VP/C-Suite: show action menu instead of plain greeting ──────────────
    if (data === 'role_vp' && profile) {
      const vpGreeting =
        `Good day, *${profile.name}* (${profile.employee_id}).\n\n` +
        `What would you like to do today?`;

      await bot.sendMessage(chatId, vpGreeting, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            { text: '✈️ Search / Book Flights', callback_data: 'vp_book_flights'      },
            { text: '📋 Pending Approvals',      callback_data: 'vp_view_approvals'   },
          ]],
        },
      });
      return;
    }

    const greeting = profile
      ? `Good day, *${profile.name}* (${profile.employee_id}).\n\n` +
        `I have loaded your travel profile:\n` +
        `• Department: ${profile.department}\n` +
        `• Cabin entitlement: ${profile.cabin_entitlement}\n` +
        (profile.frequent_flyer?.length
          ? `• Frequent flyer: ${profile.frequent_flyer.map(f => `${f.airline} — ${f.number}`).join(', ')}\n`
          : '') +
        `• Seat preference: ${profile.preferences?.seat || 'not set'}\n` +
        `• Meal preference: ${profile.preferences?.meal || 'not set'}\n\n` +
        `How may I assist you today?`
      : `Thank you. I have noted your role as *${role}*.\n\nHow may I assist you?`;

    await bot.sendMessage(chatId, greeting, { parse_mode: 'Markdown' });
    return;
  }

  // ── Option selection buttons ─────────────────────────────────────────────
  if (data.startsWith('select_')) {
    const idx    = parseInt(data.split('_')[1]);
    const chosen = session.pendingOptions?.items?.[idx];
    if (!chosen) return;

    session.selectedOption = chosen;
    const isHotel = session.pendingOptions.type === 'hotel';

    const summary = isHotel
      ? `*${chosen.name}* — ${chosen.room_type}\n💰 ${chosen.price_per_night.amount} ${chosen.price_per_night.currency}/night`
      : `*${chosen.airline} (${chosen.flight_number})*\n📅 ${chosen.departure_datetime} → ${chosen.arrival_datetime}\n💰 ${chosen.price.amount} ${chosen.price.currency}`;

    await bot.sendMessage(chatId,
      `You have selected:\n\n${summary}\n\nShall I proceed with this booking?`,
      {
        parse_mode:   'Markdown',
        reply_markup: {
          inline_keyboard: [[
            { text: '✅ Confirm',    callback_data: 'booking_confirm' },
            { text: '❌ Go back',    callback_data: 'booking_cancel'  },
          ]],
        },
      }
    );
    return;
  }

  // ── Booking confirm / cancel ─────────────────────────────────────────────
  if (data === 'booking_confirm') {
    const opt         = session.selectedOption;
    const isHotel     = !!opt?.hotel_id;
    const profile     = session.travelerProfile;
    const nationality = profile?.passport?.nationality;

    // ── Entry requirements check for international flights ──────────────────
    if (!isHotel && nationality && opt?.destination && !THAI_AIRPORTS.has(opt.destination)) {
      try {
        const entry    = await checkEntryRequirements(nationality, opt.destination);
        const needVisa = entry && (entry.requires_visa || entry.visa_on_arrival);
        const forms    = entry?.entry_forms?.filter(f => f.mandatory) ?? [];

        if (needVisa) {
          // ── Gate: visa required ─────────────────────────────────────────
          session.awaitingVisaConfirmation = true;
          let msg =
            `🛂 *Visa Notice*\n\n` +
            `${entry.note}`;
          if (forms.length > 0) {
            msg +=
              `\n\n📋 *Also required before travel:*\n` +
              forms.map(f => `• *${f.name}* — ${f.description}`).join('\n');
          }
          msg +=
            `\n\nPlease confirm you have the required travel documents before we finalise your booking.\n\n` +
            `_Always verify with the official embassy or your foreign ministry._`;
          await bot.sendMessage(chatId, msg, {
            parse_mode:   'Markdown',
            reply_markup: {
              inline_keyboard: [[
                { text: '✅ I have a valid visa',   callback_data: 'visa_ok'    },
                { text: '⏸ I need to apply first', callback_data: 'visa_later' },
              ]],
            },
          });
          return;
        } else if (forms.length > 0) {
          // ── Info only: no visa needed, but forms required ───────────────
          await bot.sendMessage(chatId,
            `📋 *Entry Requirements — ${entry.destination_country}*\n\n` +
            `${entry.note}\n\n` +
            `*Please complete before travel:*\n` +
            forms.map(f => `• *${f.name}* — ${f.description}`).join('\n') +
            `\n\n_Always verify with the official embassy or your foreign ministry._`,
            { parse_mode: 'Markdown' }
          );
          // Fall through — no gate, booking proceeds
        }
      } catch (err) {
        console.error('[ENTRY] Check failed — proceeding without notice:', err.message);
      }
    }

    await proceedWithBooking(chatId, session);
    return;
  }

  // ── Visa gate responses ──────────────────────────────────────────────────
  if (data === 'visa_ok') {
    session.awaitingVisaConfirmation = false;
    await proceedWithBooking(chatId, session);
    return;
  }

  if (data === 'visa_later') {
    session.awaitingVisaConfirmation = false;
    session.selectedOption           = null;
    session.pendingOptions           = null;
    await bot.sendMessage(chatId,
      `No problem. Once your visa is approved, come back and I will help you complete the booking.\n\n` +
      `For visa information, check your country's official foreign ministry website or the destination country's embassy.`
    );
    return;
  }

  if (data === 'booking_cancel') {
    session.pendingOptions = null;
    session.selectedOption = null;
    await bot.sendMessage(chatId,
      'No problem. Would you like to see the options again or search for something different?'
    );
  }
});

bot.on('polling_error', (error) => {
  console.error('[POLLING ERROR]', error.message);
});