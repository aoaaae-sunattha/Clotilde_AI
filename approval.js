// approval.js
// Out-of-policy booking approval workflow.
//
// Flow:
//   1. Traveler confirms an out-of-policy booking in Index.js
//   2. Index.js asks for a business justification (text message)
//   3. submitForApproval() saves to approvals.json (PENDING) and notifies the approver via Telegram
//   4. Approver taps Approve or Reject (inline keyboard) → Index.js handles callback_query
//   5. approveBooking() / rejectBooking() → updates approvals.json + bookings.json + notifies traveler

require('dotenv').config();

const TelegramBot = require('node-telegram-bot-api');
const fs          = require('fs');
const path        = require('path');

const APPROVALS_PATH = path.join(__dirname, 'approvals.json');
const BOOKINGS_PATH  = path.join(__dirname, 'bookings.json');

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);

// ── Helpers ───────────────────────────────────────────────────────────────────
function loadApprovals() {
  return JSON.parse(fs.readFileSync(APPROVALS_PATH, 'utf8'));
}

function saveApprovals(approvals) {
  fs.writeFileSync(APPROVALS_PATH, JSON.stringify(approvals, null, 2));
}

function generateApprovalId() {
  const ts   = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).toUpperCase().slice(2, 5);
  return `APR-${ts}-${rand}`;
}

function flightSummaryLine(b) {
  return b.type === 'hotel'
    ? `🏨 ${b.hotel_name} (${b.checkin} → ${b.checkout})`
    : `✈️ ${b.airline} (${b.flight_number}) — ${b.origin} → ${b.destination}\n📅 ${b.departure} → ${b.arrival}`;
}

// ── Submit for approval ───────────────────────────────────────────────────────
async function submitForApproval({ bookingRecord, justification, approverEmployeeId, approverChatId, travelerChatId }) {
  const approvalId = generateApprovalId();
  const now        = new Date().toISOString();
  const b          = bookingRecord;

  const approval = {
    approval_id:          approvalId,
    status:               'PENDING',
    submitted_at:         now,
    resolved_at:          null,
    resolved_by:          null,
    reject_reason:        null,
    booking:              { ...b, pnr: null, status: 'PENDING_APPROVAL' },
    justification,
    traveler_employee_id: b.employee_id,
    traveler_chat_id:     travelerChatId,
    approver_employee_id: approverEmployeeId,
    approver_chat_id:     approverChatId,
  };

  // Save to approvals.json
  const approvals = loadApprovals();
  approvals.push(approval);
  saveApprovals(approvals);

  // Save pending booking to bookings.json (no PNR yet)
  const bookings = JSON.parse(fs.readFileSync(BOOKINGS_PATH, 'utf8'));
  bookings.push({ ...b, pnr: null, approval_id: approvalId, status: 'PENDING_APPROVAL', submitted_at: now });
  fs.writeFileSync(BOOKINGS_PATH, JSON.stringify(bookings, null, 2));

  const summary = flightSummaryLine(b);

  // ── Notify approver ──────────────────────────────────────────────────────────
  if (!approverChatId) {
    console.warn(`[APPROVAL] Approver ${approverEmployeeId} not registered — cannot send Telegram notification.`);
  } else {
    await bot.sendMessage(approverChatId,
      `📋 *Approval Request*\n\n` +
      `*From:* ${b.traveler} (${b.employee_id})\n` +
      `${summary}\n` +
      (b.cabin_class ? `*Cabin:* ${b.cabin_class}\n` : '') +
      (b.price       ? `*Price:* ${b.price.amount?.toLocaleString()} ${b.price.currency}\n` : '') +
      `\n📝 *Business Justification:*\n_${justification}_\n\n` +
      `⚠️ This booking is out-of-policy and requires your approval.\n` +
      `📋 *Ref:* \`${approvalId}\``,
      {
        parse_mode:   'Markdown',
        reply_markup: {
          inline_keyboard: [[
            { text: '✅ Approve', callback_data: `approve_${approvalId}` },
            { text: '❌ Reject',  callback_data: `reject_${approvalId}`  },
          ]],
        },
      }
    );
  }

  // ── Notify traveler — pending ─────────────────────────────────────────────────
  await bot.sendMessage(travelerChatId,
    `📨 *Booking Submitted for Approval*\n\n` +
    `${summary}\n\n` +
    `📋 *Reference:* \`${approvalId}\`\n` +
    `📝 *Your justification:* _${justification}_\n\n` +
    `Your booking is pending manager approval. You will be notified once a decision is made.`,
    { parse_mode: 'Markdown' }
  );

  console.log(`[APPROVAL] Submitted ${approvalId} — traveler: ${b.employee_id}, approver: ${approverEmployeeId}`);
  return approvalId;
}

// ── Approve booking ───────────────────────────────────────────────────────────
async function approveBooking(approvalId) {
  const approvals = loadApprovals();
  const idx       = approvals.findIndex(a => a.approval_id === approvalId);
  if (idx === -1) throw new Error(`Approval ${approvalId} not found`);

  const approval = approvals[idx];
  if (approval.status !== 'PENDING') throw new Error(`Approval ${approvalId} is already ${approval.status}`);

  // Issue PNR
  const pnr = Array.from({ length: 6 }, () =>
    'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]
  ).join('');

  const now = new Date().toISOString();
  approval.status      = 'APPROVED';
  approval.resolved_at = now;
  approval.pnr         = pnr;
  approvals[idx]       = approval;
  saveApprovals(approvals);

  // Update bookings.json
  const bookings = JSON.parse(fs.readFileSync(BOOKINGS_PATH, 'utf8'));
  const bIdx     = bookings.findIndex(b => b.approval_id === approvalId);
  if (bIdx !== -1) {
    bookings[bIdx].status      = 'CONFIRMED';
    bookings[bIdx].pnr         = pnr;
    bookings[bIdx].approved_at = now;
    fs.writeFileSync(BOOKINGS_PATH, JSON.stringify(bookings, null, 2));
  }

  const b          = approval.booking;
  const cabinLabel = { Y: 'Economy', W: 'Premium Economy', C: 'Business', F: 'First' }[b.cabin_class] || b.cabin_class || '—';

  const travellerMsg = b.type === 'hotel'
    ? `✅ *Booking Approved*\n\n` +
      `*Traveler:* ${b.traveler} (${b.employee_id})\n\n` +
      `*Hotel:* ${b.hotel_name}\n` +
      `*Room:* ${b.room_type}\n` +
      `*Check-in:* ${b.checkin}\n` +
      `*Check-out:* ${b.checkout}\n` +
      (b.price_per_night ? `*Price:* ${b.price_per_night.amount?.toLocaleString()} ${b.price_per_night.currency}/night\n` : '') +
      `\n🔖 *Reference: \`${pnr}\`*\n` +
      `📋 *Approval ref:* \`${approvalId}\`\n\n` +
      `Your booking has been confirmed. A confirmation will be sent to your registered email.\n` +
      `For assistance: travel-support@company.com`
    : `✅ *Booking Approved*\n\n` +
      `*Traveler:* ${b.traveler} (${b.employee_id})\n\n` +
      `*Flight:* ${b.airline} (${b.flight_number})\n` +
      `*Route:* ${b.origin} → ${b.destination}\n` +
      `*Departure:* ${b.departure}\n` +
      `*Arrival:* ${b.arrival}\n` +
      `*Cabin:* ${cabinLabel}\n` +
      (b.price ? `*Price:* ${b.price.amount?.toLocaleString()} ${b.price.currency}\n` : '') +
      `\n🎫 *PNR: \`${pnr}\`*\n` +
      `📋 *Approval ref:* \`${approvalId}\`\n\n` +
      `Your booking has been confirmed. A confirmation will be sent to your registered email.\n` +
      `For assistance: travel-support@company.com`;

  // Notify traveler — approved
  await bot.sendMessage(approval.traveler_chat_id, travellerMsg, { parse_mode: 'Markdown' });

  console.log(`[APPROVAL] Approved ${approvalId} — PNR: ${pnr}`);
  return { pnr, approval };
}

// ── Reject booking ────────────────────────────────────────────────────────────
async function rejectBooking(approvalId, reason) {
  const approvals = loadApprovals();
  const idx       = approvals.findIndex(a => a.approval_id === approvalId);
  if (idx === -1) throw new Error(`Approval ${approvalId} not found`);

  const approval = approvals[idx];
  if (approval.status !== 'PENDING') throw new Error(`Approval ${approvalId} is already ${approval.status}`);

  const now = new Date().toISOString();
  approval.status        = 'REJECTED';
  approval.resolved_at   = now;
  approval.reject_reason = reason;
  approvals[idx]         = approval;
  saveApprovals(approvals);

  // Update bookings.json
  const bookings = JSON.parse(fs.readFileSync(BOOKINGS_PATH, 'utf8'));
  const bIdx     = bookings.findIndex(b => b.approval_id === approvalId);
  if (bIdx !== -1) {
    bookings[bIdx].status      = 'REJECTED';
    bookings[bIdx].rejected_at = now;
    fs.writeFileSync(BOOKINGS_PATH, JSON.stringify(bookings, null, 2));
  }

  // Notify traveler — rejected
  await bot.sendMessage(approval.traveler_chat_id,
    `❌ *Booking Request Rejected*\n\n` +
    `📋 *Reference:* \`${approvalId}\`\n` +
    `📝 *Reason:* _${reason}_\n\n` +
    `Please contact Clotilde to find a compliant alternative, or reach travel-support@company.com for assistance.`,
    { parse_mode: 'Markdown' }
  );

  console.log(`[APPROVAL] Rejected ${approvalId} — reason: ${reason}`);
  return approval;
}

// ── Get approval record ───────────────────────────────────────────────────────
function getApproval(approvalId) {
  return loadApprovals().find(a => a.approval_id === approvalId) || null;
}

module.exports = { submitForApproval, approveBooking, rejectBooking, getApproval };
