// admin.js
// Natural language admin interface for Clotilde.
// Type plain English — Gemini figures out what action to take.
//
// USAGE:
//   node admin.js
//
// EXAMPLES:
//   > Send Ally a booking confirmation for her flight PNR-001
//   > James Chen's flight was cancelled, notify him
//   > Tell Priya her request was approved, reference OOP-2026-001
//   > Show me all confirmed bookings
//   > Send a budget warning to EMP-001, they've used 85% with 7500 THB remaining
//   > Broadcast emergency alert: civil unrest in Singapore CBD, avoid area

require('dotenv').config();

const readline              = require('readline');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const TelegramBot           = require('node-telegram-bot-api');
const fs                    = require('fs');
const path                  = require('path');
const { execSync }          = require('child_process');
const yaml                  = require('js-yaml');

const genAI    = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const bot      = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);

const BOOKINGS_PATH  = path.join(__dirname, 'bookings.json');
const REGISTRY_PATH  = path.join(__dirname, 'chat_registry.json');
const TRAVELERS_PATH = path.join(__dirname, 'travelers.yml');

// ── Tool definitions ──────────────────────────────────────────────────────────
const TOOLS = [{
  functionDeclarations: [

    {
      name: 'list_bookings',
      description: 'Retrieve all confirmed bookings. Use when admin asks to see bookings, check a PNR, or find a traveler\'s booking.',
      parameters: {
        type: 'object',
        properties: {
          employee_id: { type: 'string', description: 'Filter by employee ID (optional)' },
          status:      { type: 'string', description: 'Filter by status: CONFIRMED, CANCELLED (optional)' },
        },
      },
    },

    {
      name: 'get_traveler',
      description: 'Look up a traveler by name or employee ID. Use this to resolve a name like "James Chen" to their employee ID before sending a notification.',
      parameters: {
        type: 'object',
        properties: {
          name:        { type: 'string', description: 'Full or partial traveler name' },
          employee_id: { type: 'string', description: 'Employee ID (e.g. EMP-001)' },
        },
      },
    },

    {
      name: 'send_notification',
      description:
        'Send a Telegram notification to a traveler. ' +
        'Available types: booking_confirmed, flight_canceled, no_seats, reminder, rescheduled, delayed, ' +
        'alternative_offered, policy_pending, policy_approved, policy_rejected, hotel_confirmed, ' +
        'hotel_canceled, hotel_overbooked, disruption, emergency, spend_summary, budget_warning.',
      parameters: {
        type: 'object',
        properties: {
          employee_id: { type: 'string', description: 'Employee ID to notify (or "ALL" for broadcast)' },
          type:        { type: 'string', description: 'Notification type' },
          params:      {
            type: 'object',
            description: 'Parameters for the notification template',
            properties: {
              ref:         { type: 'string' },
              flight:      { type: 'string' },
              date:        { type: 'string' },
              hotel:       { type: 'string' },
              checkin:     { type: 'string' },
              checkout:    { type: 'string' },
              delay:       { type: 'string' },
              'old-time':  { type: 'string' },
              'new-time':  { type: 'string' },
              original:    { type: 'string' },
              alternative: { type: 'string' },
              details:     { type: 'string' },
              area:        { type: 'string' },
              reason:      { type: 'string' },
              month:       { type: 'string' },
              amount:      { type: 'string' },
              budget:      { type: 'string' },
              percent:     { type: 'string' },
              remaining:   { type: 'string' },
            },
          },
        },
        required: ['employee_id', 'type', 'params'],
      },
    },

    {
      name: 'update_booking_status',
      description: 'Update the status of a booking in the database (e.g. mark as CANCELLED).',
      parameters: {
        type: 'object',
        properties: {
          pnr:    { type: 'string', description: 'The PNR / booking reference' },
          status: { type: 'string', description: 'New status: CANCELLED, RESCHEDULED, etc.' },
        },
        required: ['pnr', 'status'],
      },
    },

  ],
}];

// ── Tool executors ────────────────────────────────────────────────────────────
function listBookings({ employee_id, status } = {}) {
  const bookings = JSON.parse(fs.readFileSync(BOOKINGS_PATH, 'utf8'));
  let results = bookings;
  if (employee_id) results = results.filter(b => b.employee_id === employee_id);
  if (status)      results = results.filter(b => b.status === status.toUpperCase());
  return { count: results.length, bookings: results };
}

function getTraveler({ name, employee_id } = {}) {
  const data     = yaml.load(fs.readFileSync(TRAVELERS_PATH, 'utf8'));
  const profiles = Object.values(data.profiles);

  if (employee_id) {
    const found = profiles.find(p => p.employee_id === employee_id);
    return found ? { found: true, traveler: found } : { found: false };
  }
  if (name) {
    const lower = name.toLowerCase();
    const found = profiles.find(p => p.name.toLowerCase().includes(lower));
    return found ? { found: true, traveler: found } : { found: false };
  }
  return { found: false, error: 'Provide name or employee_id' };
}

async function sendNotification({ employee_id, type, params }) {
  const REGISTRY = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));

  const templates = {
    booking_confirmed:   (o) => `✅ *Booking Confirmed*\n\nYour flight has been successfully booked.\n\n✈️ *${o.flight}*\n📅 ${o.date}\n🔖 Reference: \`${o.ref}\`\n\nYour e-ticket will be sent to your registered email.`,
    flight_canceled:     (o) => `❌ *Flight Canceled*\n\nYour flight has been canceled by the airline.\n\n✈️ *${o.flight}*\n📅 ${o.date}\n\nPlease contact Clotilde or travel-support@company.com to arrange an alternative.`,
    no_seats:            (o) => `🚫 *No Seats Available*\n\nThe flight you requested is now fully booked.\n\n✈️ *${o.flight}*\n📅 ${o.date}\n\nPlease reply to Clotilde to search for alternatives.`,
    reminder:            (o) => `⏰ *Departure Reminder*\n\nYour flight departs in approximately 24 hours.\n\n✈️ *${o.flight}*\n📅 ${o.date}\n\nCheck-in recommended at least 2 hours before departure. Safe travels!`,
    rescheduled:         (o) => `🔄 *Flight Rescheduled*\n\nYour departure time has changed.\n\n✈️ *${o.flight}* on ${o.date}\n🕐 Previous: ${o['old-time']}\n🕐 New: *${o['new-time']}*\n\nContact travel-support@company.com if you need assistance.`,
    delayed:             (o) => `⚠️ *Flight Delayed*\n\n✈️ *${o.flight}*\n⏱ Delay: *${o.delay}*\n🕐 New estimated departure: *${o['new-time']}*\n\nCheck airline app or airport boards for live updates.`,
    alternative_offered: (o) => `🔀 *Alternative Flight Offered*\n\nYour original flight *${o.original}* has been disrupted. Alternative:\n\n✈️ *${o.alternative}*\n\nReply to Clotilde with *"confirm alternative"* to accept.`,
    policy_pending:      (o) => `📨 *Out-of-Policy Request Submitted*\n\nYour booking requires manager approval.\n\n📋 Reference: \`${o.ref}\`\n✈️ ${o.details}\n\nYou will be notified once a decision has been made.`,
    policy_approved:     (o) => `✅ *Out-of-Policy Request Approved*\n\nYour booking has been approved.\n\n📋 Reference: \`${o.ref}\`\n\nYour booking will now be processed.`,
    policy_rejected:     (o) => `❌ *Out-of-Policy Request Rejected*\n\n📋 Reference: \`${o.ref}\`\n📝 Reason: _${o.reason}_\n\nPlease reply to Clotilde to find a compliant alternative.`,
    hotel_confirmed:     (o) => `✅ *Hotel Booking Confirmed*\n\n🏨 *${o.hotel}*\n📅 Check-in:  ${o.checkin}\n📅 Check-out: ${o.checkout}\n\nYour voucher will be sent to your registered email.`,
    hotel_canceled:      (o) => `❌ *Hotel Reservation Canceled*\n\n🏨 *${o.hotel}*\n📅 ${o.date}\n\nPlease reply to Clotilde to find an alternative.`,
    hotel_overbooked:    (o) => `🏨 *Hotel Overbooking Notice*\n\n*${o.hotel}* cannot honour your reservation.\n\nAlternative arranged:\n🏨 *${o.alternative}*\n\nPlease confirm acceptance by replying to Clotilde.`,
    disruption:          (o) => `🌪️ *Travel Disruption Alert*\n\n📍 Area: *${o.area}*\n📝 ${o.details}\n\nContact travel-support@company.com for rebooking or emergency support.`,
    emergency:           (o) => `🆘 *EMERGENCY BROADCAST*\n\n⚠️ This message has been sent to all company travelers.\n\n📍 Area affected: *${o.area}*\n📝 ${o.details}\n\nContact travel-support@company.com immediately if you require assistance.`,
    spend_summary:       (o) => `📊 *Monthly Travel Spend Summary*\n\n*${o.month}*\n💰 Total spent: *${o.amount}*\n🎯 Budget: *${o.budget}*`,
    budget_warning:      (o) => `⚠️ *Budget Cap Warning*\n\nYou have used *${o.percent}%* of your travel budget.\n\n💰 Remaining: *${o.remaining}*\n\nOut-of-policy bookings will require manager approval.`,
  };

  const template = templates[type];
  if (!template) return { success: false, error: `Unknown notification type: ${type}` };

  const message = template(params);

  if (employee_id === 'ALL') {
    const chatIds = Object.values(REGISTRY);
    if (chatIds.length === 0) return { success: false, error: 'No registered travelers in chat_registry.json' };
    for (const chatId of chatIds) {
      await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    }
    return { success: true, sent_to: chatIds.length, broadcast: true };
  }

  const chatId = REGISTRY[employee_id];
  if (!chatId) return { success: false, error: `${employee_id} not found in chat_registry. They must /start the bot first.` };

  await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  return { success: true, sent_to: employee_id, chat_id: chatId };
}

function updateBookingStatus({ pnr, status }) {
  const bookings = JSON.parse(fs.readFileSync(BOOKINGS_PATH, 'utf8'));
  const idx      = bookings.findIndex(b => b.pnr === pnr);
  if (idx === -1) return { success: false, error: `PNR ${pnr} not found` };
  bookings[idx].status     = status.toUpperCase();
  bookings[idx].updated_at = new Date().toISOString();
  fs.writeFileSync(BOOKINGS_PATH, JSON.stringify(bookings, null, 2));
  return { success: true, pnr, status: bookings[idx].status, booking: bookings[idx] };
}

async function executeTool(name, args) {
  if (name === 'list_bookings')        return listBookings(args);
  if (name === 'get_traveler')         return getTraveler(args);
  if (name === 'send_notification')    return await sendNotification(args);
  if (name === 'update_booking_status') return updateBookingStatus(args);
  return { error: `Unknown tool: ${name}` };
}

// ── System prompt ─────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `
You are the Clotilde Admin Assistant — an internal tool for travel managers.
Today's date: ${new Date().toISOString().split('T')[0]}

Your job: execute travel management actions based on natural language instructions.

AVAILABLE ACTIONS:
- list_bookings: retrieve and display confirmed bookings
- get_traveler: look up traveler details by name or employee ID
- send_notification: send Telegram notifications to travelers
- update_booking_status: update booking status in the system

WORKFLOW:
1. If the admin mentions a traveler by name (e.g. "James Chen"), call get_traveler first to resolve their employee ID.
2. If the admin says "cancelled flight" or "flight disruption", also offer to update the booking status.
3. Always confirm what action you took and the result.
4. For send_notification, fill params as completely as possible from the admin's message.
   - If a date is missing, use today's date as a placeholder and note it.
   - If flight number or other detail is missing, ask the admin.

RESPONSE STYLE:
- Concise. State what you did and the outcome.
- If a notification was sent, confirm delivery.
- If something failed, explain clearly.
`.trim();

// ── Main REPL ─────────────────────────────────────────────────────────────────
async function main() {
  ['TELEGRAM_BOT_TOKEN', 'GEMINI_API_KEY'].forEach(key => {
    if (!process.env[key]) {
      console.error(`[ERROR] Missing environment variable: ${key}`);
      process.exit(1);
    }
  });

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    tools: TOOLS,
    generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
  });

  const chat = model.startChat({
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    history: [],
  });

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log('\n' + '═'.repeat(58));
  console.log('  CLOTILDE ADMIN — Natural Language Interface');
  console.log('  Type your instruction in plain English.');
  console.log('  Type "exit" or Ctrl+C to quit.');
  console.log('═'.repeat(58) + '\n');

  const ask = () => {
    rl.question('admin> ', async (input) => {
      const trimmed = input.trim();
      if (!trimmed) return ask();
      if (trimmed.toLowerCase() === 'exit') {
        console.log('Goodbye.');
        process.exit(0);
      }

      try {
        let result = await chat.sendMessage(trimmed);

        // Tool call loop
        let iterations = 0;
        while (true) {
          const calls = result.response.functionCalls?.();
          if (!calls?.length || iterations >= 5) break;
          iterations++;

          const responses = [];
          for (const call of calls) {
            console.log(`  [→ ${call.name}]`, JSON.stringify(call.args));
            const toolResult = await executeTool(call.name, call.args);
            responses.push({ functionResponse: { name: call.name, response: toolResult } });
          }

          result = await chat.sendMessage(responses);
        }

        const reply = result.response.text().trim();
        console.log('\n' + reply + '\n');

      } catch (err) {
        console.error('[ERROR]', err.message);
      }

      ask();
    });
  };

  ask();
}

main().catch(e => {
  console.error('[FATAL]', e.message);
  process.exit(1);
});
