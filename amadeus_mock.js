// amadeus_mock.js
// Simulates the Amadeus Flight Orders API (POST /v1/booking/flight-orders).
// In production, replace with real Amadeus Node.js SDK calls.
//
// Amadeus docs: https://developers.amadeus.com/self-service/category/flights/api-doc/flight-create-orders

function generatePNR() {
  // Amadeus PNRs: 6 uppercase alphanumeric chars (digits + A-Z, no I/O to avoid confusion)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function generateOrderId(pnr) {
  // Amadeus internal order ID — base64-encoded opaque string
  return Buffer.from(`${pnr}:${Date.now()}`).toString('base64').replace(/=/g, '').slice(0, 20);
}

/**
 * Mock the Amadeus Flight Orders API.
 * Accepts our internal GDS payload and returns an Amadeus-style response.
 *
 * @param {object} gdsPayload — output of buildGDSPayload()
 * @returns {Promise<{ pnr: string, response: object }>}
 */
async function bookFlight(gdsPayload) {
  // Simulate Amadeus API round-trip latency (120–350 ms)
  await new Promise(r => setTimeout(r, 120 + Math.floor(Math.random() * 230)));

  const pnr      = generatePNR();
  const orderId  = generateOrderId(pnr);
  const today    = new Date().toISOString().split('T')[0];

  // Simulate occasional Amadeus 2-day ticketing limit
  const ticketingDeadline = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const response = {
    data: {
      type:             'flight-order',
      id:               orderId,
      bookingStatus:    'CONFIRMED',
      creationDate:     today,
      ticketingAgreement: {
        option:   'DELAY_TO_CANCEL',
        delay:    '2D',
        deadline: ticketingDeadline,
      },
      associatedRecords: [
        {
          reference:        pnr,
          creationDate:     today,
          originSystemCode: 'GDS',
          flightOfferId:    '1',
        },
      ],
      travelers: [
        {
          id:   '1',
          name: { firstName: gdsPayload.traveler?.name_as_booked?.split('/')[1] || 'TRAVELER',
                  lastName:  gdsPayload.traveler?.name_as_booked?.split('/')[0] || 'GUEST' },
          contact: {
            emailAddress: 'traveler@company.com',
          },
          documents: [
            {
              documentType:   'PASSPORT',
              number:         gdsPayload.traveler?.passport_number || '***MASKED***',
              nationality:    gdsPayload.traveler?.nationality     || 'XX',
            },
          ],
        },
      ],
      flightOffers: [
        {
          id:     '1',
          source: 'GDS',
          itineraries: [
            {
              segments: [
                {
                  departure:   { iataCode: gdsPayload.segment?.origin,      at: gdsPayload.segment?.departure },
                  arrival:     { iataCode: gdsPayload.segment?.destination,  at: gdsPayload.segment?.arrival  },
                  carrierCode:  gdsPayload.segment?.flight_number?.slice(0, 2),
                  number:       gdsPayload.segment?.flight_number?.slice(2),
                  cabin:        gdsPayload.segment?.cabin_class,
                  status:       gdsPayload.segment?.status || 'HK',
                },
              ],
            },
          ],
          price: {
            currency:  gdsPayload.fare?.base_fare?.currency || 'USD',
            total:     String(gdsPayload.fare?.total_charge?.amount || gdsPayload.fare?.base_fare?.amount || 0),
            base:      String(gdsPayload.fare?.base_fare?.amount || 0),
            fees:      gdsPayload.fare?.taxes?.map(t => ({
              amount: String(t.amount),
              type:   t.description,
            })) || [],
          },
        },
      ],
    },
    meta: {
      links: {
        self: `https://test.api.amadeus.com/v1/booking/flight-orders/${orderId}`,
      },
    },
  };

  return { pnr, response };
}

module.exports = { bookFlight };
