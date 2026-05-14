// notify.js
// Push notifications to travelers via Telegram.
// Reads chat_registry.json to resolve employee ID → Telegram chat_id.
// chat_registry.json is updated automatically when a traveler uses /start.
//
// ══════════════════════════════════════════════════════════════════════════════
// USAGE — run: node notify.js <type> [options]
//
// BOOKING LIFECYCLE
// ─────────────────
// 1. Booking confirmed:
//    node notify.js booking_confirmed --employee EMP-001 --ref PNR-20260514-001 --flight "TG408 BKK→UTP" --date "2026-05-14 08:30"
//
// 2. Flight canceled by airline:
//    node notify.js flight_canceled --employee EMP-001 --flight "TG408" --date "2026-05-14"
//
// 3. No seats available — ask traveler to pick another option:
//    node notify.js no_seats --employee EMP-001 --flight "TG408" --date "2026-05-14"
//
// 4. Departure reminder (send this 24h before):
//    node notify.js reminder --employee EMP-001 --flight "TG408 BKK→UTP" --date "2026-05-14 08:30"
//
// 5. Flight rescheduled (time changed):
//    node notify.js rescheduled --employee EMP-001 --flight "TG408" --old-time "08:30" --new-time "11:00" --date "2026-05-14"
//
// 6. Flight delayed:
//    node notify.js delayed --employee EMP-001 --flight "TG408" --delay "2 hours" --new-time "10:30"
//
// 7. Alternative flight offered (when original is disrupted):
//    node notify.js alternative_offered --employee EMP-001 --original "TG408" --alternative "SQ231 BKK→UTP 10:45"
//
// APPROVAL FLOW (out-of-policy bookings)
// ───────────────────────────────────────
// 8. Out-of-policy request submitted, pending approval:
//    node notify.js policy_pending --employee EMP-001 --ref OOP-2026-001 --details "EK371 Business Class — 28,000 THB"
//
// 9. Out-of-policy request approved:
//    node notify.js policy_approved --employee EMP-001 --ref OOP-2026-001
//
// 10. Out-of-policy request rejected:
//    node notify.js policy_rejected --employee EMP-001 --ref OOP-2026-001 --reason "Exceeds long-haul cap. Economy alternative required."
//
// HOTEL
// ─────
// 11. Hotel booking confirmed:
//    node notify.js hotel_confirmed --employee EMP-001 --hotel "Novotel Bangkok Sukhumvit 20" --checkin "2026-05-14" --checkout "2026-05-16"
//
// 12. Hotel reservation canceled:
//    node notify.js hotel_canceled --employee EMP-001 --hotel "Novotel Bangkok Sukhumvit 20" --date "2026-05-14"
//
// 13. Hotel overbooked — alternative offered:
//    node notify.js hotel_overbooked --employee EMP-001 --hotel "Novotel Bangkok" --alternative "Courtyard by Marriott Bangkok"
//
// DISRUPTION
// ──────────
// 14. Travel disruption alert (weather, strike, closure):
//    node notify.js disruption --employee EMP-001 --area "Bangkok" --details "Suvarnabhumi Airport closed due to severe weather. Check TG website for rebooking."
//
// 15. Emergency broadcast to ALL registered travelers:
//    node notify.js emergency --all --area "Singapore" --details "Civil unrest reported near CBD. Avoid the area and contact travel-support@company.com."
//
// ADMIN / REPORTING
// ─────────────────
// 16. Monthly spend summary:
//    node notify.js spend_summary --employee EMP-001 --month "May 2026" --amount "45,000 THB" --budget "50,000 THB"
//
// 17. Approaching budget cap warning:
//    node notify.js budget_warning --employee EMP-001 --percent 85 --remaining "7,500 THB"
//
// ══════════════════════════════════════════════════════════════════════════════

require('dotenv').config();

const TelegramBot = require('node-telegram-bot-api');
const fs          = require('fs');
const path        = require('path');

const bot      = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);

// ── TEST_MODE intercept ───────────────────────────────────────────────────────
// When TEST_MODE=true, sendMessage writes to a local file instead of Telegram.
// This allows CLI automation tests (QA/tests/cli/) to run without a bot token
// and without sending real messages. Does NOT affect production behaviour.
if (process.env.TEST_MODE === 'true') {
  const _origSend = bot.sendMessage.bind(bot);
  bot.sendMessage = async (chatId, text, opts) => {
    const outPath = path.join(__dirname, 'QA/tests/.last_notify_output.json');
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify({ chatId, text, opts, ts: Date.now() }, null, 2));
    return { message_id: 9999 };
  };
}
// ─────────────────────────────────────────────────────────────────────────────

const REGISTRY = JSON.parse(fs.readFileSync(path.join(__dirname, 'chat_registry.json'), 'utf8'));
const SUPPORT  = 'travel-support@company.com';

// ── Argument parser ───────────────────────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  const type = args[0];
  const opts = {};
  for (let i = 1; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      const val = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : true;
      opts[key] = val;
    }
  }
  return { type, opts };
}

// ── Resolve chat_id ───────────────────────────────────────────────────────────
function resolveChatId(employeeId) {
  const chatId = REGISTRY[employeeId];
  if (!chatId) {
    console.error(`[NOTIFY] Employee ${employeeId} not found in chat_registry.json.`);
    console.error(`         They must /start the Clotilde bot at least once to be registered.`);
    process.exit(1);
  }
  return chatId;
}

// ── Send to one or all ────────────────────────────────────────────────────────
async function send(chatId, message) {
  await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  console.log(`[NOTIFY] Sent to chat_id ${chatId}`);
}

async function broadcast(message) {
  const ids = Object.values(REGISTRY);
  if (ids.length === 0) {
    console.error('[NOTIFY] No registered travelers in chat_registry.json.');
    process.exit(1);
  }
  for (const chatId of ids) {
    await send(chatId, message);
  }
  console.log(`[NOTIFY] Broadcast sent to ${ids.length} traveler(s).`);
}

// ── Message templates ─────────────────────────────────────────────────────────
const templates = {

  booking_confirmed: (o) => `✅ *Booking Confirmed*\n\n` +
    `Your flight has been successfully booked.\n\n` +
    `✈️ *${o.flight}*\n` +
    `📅 ${o.date}\n` +
    `🔖 Reference: \`${o.ref}\`\n\n` +
    `Your e-ticket will be sent to your registered email. ` +
    `For any changes, contact ${SUPPORT}`,

  flight_canceled: (o) => `❌ *Flight Canceled*\n\n` +
    `We regret to inform you that your flight has been canceled by the airline.\n\n` +
    `✈️ *${o.flight}*\n` +
    `📅 ${o.date}\n\n` +
    `Please contact Clotilde or ${SUPPORT} to arrange an alternative flight.`,

  no_seats: (o) => `🚫 *No Seats Available*\n\n` +
    `Unfortunately, the flight you requested is now fully booked.\n\n` +
    `✈️ *${o.flight}*\n` +
    `📅 ${o.date}\n\n` +
    `Please reply to Clotilde to search for alternative options on this route.`,

  reminder: (o) => `⏰ *Departure Reminder*\n\n` +
    `Your flight departs in approximately 24 hours. Please ensure you are prepared.\n\n` +
    `✈️ *${o.flight}*\n` +
    `📅 ${o.date}\n\n` +
    `Check-in is recommended at least 2 hours before departure. Safe travels!`,

  rescheduled: (o) => `🔄 *Flight Rescheduled*\n\n` +
    `Your flight departure time has changed.\n\n` +
    `✈️ *${o.flight}* on ${o.date}\n` +
    `🕐 Previous time: ${o['old-time']}\n` +
    `🕐 New time: *${o['new-time']}*\n\n` +
    `Please adjust your plans accordingly. Contact ${SUPPORT} if you need assistance.`,

  delayed: (o) => `⚠️ *Flight Delayed*\n\n` +
    `Your flight is currently delayed.\n\n` +
    `✈️ *${o.flight}*\n` +
    `⏱ Delay: *${o.delay}*\n` +
    `🕐 New estimated departure: *${o['new-time']}*\n\n` +
    `Please check the airline's app or airport boards for live updates.`,

  alternative_offered: (o) => `🔀 *Alternative Flight Offered*\n\n` +
    `Your original flight *${o.original}* has been disrupted. ` +
    `We have found an alternative for you:\n\n` +
    `✈️ *${o.alternative}*\n\n` +
    `Please reply to Clotilde with *"confirm alternative"* to accept, ` +
    `or contact ${SUPPORT} for other options.`,

  policy_pending: (o) => `📨 *Out-of-Policy Request Submitted*\n\n` +
    `Your booking request requires manager approval as it falls outside travel policy.\n\n` +
    `📋 Reference: \`${o.ref}\`\n` +
    `✈️ ${o.details}\n\n` +
    `You will be notified once a decision has been made. ` +
    `Contact ${SUPPORT} if urgent.`,

  policy_approved: (o) => `✅ *Out-of-Policy Request Approved*\n\n` +
    `Great news — your booking request has been approved by your manager.\n\n` +
    `📋 Reference: \`${o.ref}\`\n\n` +
    `Your booking will now be processed. ` +
    `A confirmation will follow shortly.`,

  policy_rejected: (o) => `❌ *Out-of-Policy Request Rejected*\n\n` +
    `Your booking request has not been approved.\n\n` +
    `📋 Reference: \`${o.ref}\`\n` +
    `📝 Reason: _${o.reason}_\n\n` +
    `Please reply to Clotilde to find a compliant alternative, ` +
    `or contact ${SUPPORT} for assistance.`,

  hotel_confirmed: (o) => `✅ *Hotel Booking Confirmed*\n\n` +
    `Your hotel reservation has been confirmed.\n\n` +
    `🏨 *${o.hotel}*\n` +
    `📅 Check-in:  ${o.checkin}\n` +
    `📅 Check-out: ${o.checkout}\n\n` +
    `Your voucher will be sent to your registered email.`,

  hotel_canceled: (o) => `❌ *Hotel Reservation Canceled*\n\n` +
    `Your hotel reservation has been canceled.\n\n` +
    `🏨 *${o.hotel}*\n` +
    `📅 ${o.date}\n\n` +
    `Please reply to Clotilde to find an alternative hotel, ` +
    `or contact ${SUPPORT}.`,

  hotel_overbooked: (o) => `🏨 *Hotel Overbooking Notice*\n\n` +
    `We regret that *${o.hotel}* is unable to honour your reservation due to overbooking.\n\n` +
    `An alternative has been arranged:\n` +
    `🏨 *${o.alternative}*\n\n` +
    `Please confirm acceptance by replying to Clotilde, ` +
    `or contact ${SUPPORT} for other options.`,

  disruption: (o) => `🌪️ *Travel Disruption Alert*\n\n` +
    `A travel disruption has been reported in your destination area.\n\n` +
    `📍 Area: *${o.area}*\n` +
    `📝 ${o.details}\n\n` +
    `Contact ${SUPPORT} for rebooking assistance or emergency support.`,

  emergency: (o) => `🆘 *EMERGENCY BROADCAST*\n\n` +
    `⚠️ This message has been sent to all company travelers.\n\n` +
    `📍 Area affected: *${o.area}*\n` +
    `📝 ${o.details}\n\n` +
    `Contact ${SUPPORT} immediately if you require assistance.`,

  spend_summary: (o) => `📊 *Monthly Travel Spend Summary*\n\n` +
    `Here is your travel spend summary for *${o.month}*:\n\n` +
    `💰 Total spent: *${o.amount}*\n` +
    `🎯 Budget:      *${o.budget}*\n\n` +
    `For a full breakdown, contact ${SUPPORT}.`,

  budget_warning: (o) => `⚠️ *Budget Cap Warning*\n\n` +
    `You have used *${o.percent}%* of your travel budget for this period.\n\n` +
    `💰 Remaining: *${o.remaining}*\n\n` +
    `Please plan upcoming travel carefully. ` +
    `Out-of-policy bookings will require manager approval.`,
};

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const { type, opts } = parseArgs();

  if (!type || !templates[type]) {
    console.error(`[NOTIFY] Unknown notification type: "${type || '(none)'}"`);
    console.error(`         Available types: ${Object.keys(templates).join(', ')}`);
    process.exit(1);
  }

  const message = templates[type](opts);

  if (opts.all) {
    await broadcast(message);
  } else if (opts.employee) {
    const chatId = resolveChatId(opts.employee);
    await send(chatId, message);
  } else {
    console.error('[NOTIFY] Specify --employee <id> or --all');
    process.exit(1);
  }

  process.exit(0);
}

main().catch(e => {
  console.error('[NOTIFY] Error:', e.message);
  process.exit(1);
});
