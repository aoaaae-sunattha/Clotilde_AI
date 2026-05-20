// api/routes/book.js
// POST /api/book — accepts { flightId, travelerProfile, flightDetails? }
// Generates PNR, writes to bookings.json, returns BookingConfirmation.

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { validateBook } = require('../middleware/validate');

const BOOKINGS_FILE = path.join(__dirname, '../../bookings.json');

function generatePNR() {
  return 'PNR-' + Math.random().toString(36).substring(2, 8).toUpperCase();
}

function readBookings() {
  try {
    if (!fs.existsSync(BOOKINGS_FILE)) return [];
    const raw = fs.readFileSync(BOOKINGS_FILE, 'utf8').trim();
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeBookings(bookings) {
  fs.writeFileSync(BOOKINGS_FILE, JSON.stringify(bookings, null, 2));
}

router.post('/', validateBook, (req, res, next) => {
  try {
    const { flightId, travelerProfile, flightDetails } = req.body;

    if (!flightDetails) {
      return next({ status: 404, message: 'Flight not found. Please search again.' });
    }

    const pnr = generatePNR();
    const timestamp = new Date().toISOString();

    const booking = {
      flightId,
      airline: flightDetails.airline,
      origin: flightDetails.origin,
      destination: flightDetails.destination,
      departureDate: flightDetails.departureDate,
      cabinClass: flightDetails.cabinClass,
      price: flightDetails.price,
      policyCompliant: flightDetails.policyCompliant,
      policyFlags: flightDetails.policyFlags || [],
    };

    const record = {
      pnr,
      employee_id: travelerProfile.employee_id || 'UNKNOWN',
      type: 'flight',
      status: 'confirmed',
      ...booking,
      timestamp,
    };

    const bookings = readBookings();
    bookings.push(record);
    writeBookings(bookings);

    res.json({
      status: 'ok',
      data: {
        pnr,
        status: 'confirmed',
        booking,
        timestamp,
      },
      policyFlags: booking.policyFlags,
      error: null,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
