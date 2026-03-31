const express = require("express");
const { v4: uuidv4 } = require("uuid");

const router = express.Router();

// ── In-memory store ──────────────────────────────────────────────────────────
// In a real service this would be a database (RDS, DynamoDB, etc.)
const bookings = new Map();

// ── Cruise catalog (minimal — for price lookup and validation) ───────────────
const CRUISE_PRICES = {
  "cruise-1": { name: "Caribbean Paradise",      basePrice: 899  },
  "cruise-2": { name: "Mediterranean Discovery", basePrice: 1299 },
  "cruise-3": { name: "Alaskan Frontier",        basePrice: 1099 },
  "cruise-4": { name: "Hawaiian Island Hopper",  basePrice: 1449 },
  "cruise-5": { name: "Bahamas Escape",          basePrice: 499  },
  "cruise-6": { name: "Northern Europe Explorer",basePrice: 1899 },
};

const CABIN_SURCHARGES = {
  Interior:   0,
  "Ocean View": 150,
  Balcony:    350,
  Suite:      800,
};

function generateRef() {
  return "AZV-" + Math.random().toString(36).slice(2, 8).toUpperCase();
}

// ── POST /api/bookings — create a booking ────────────────────────────────────
router.post("/", async (req, res) => {
  const {
    cruiseId,
    cabinType,
    passengers,
    contactName,
    contactEmail,
    cardLast4,
  } = req.body;

  // Validate required fields
  if (!cruiseId || !cabinType || !passengers || !contactName || !contactEmail || !cardLast4) {
    return res.status(400).json({
      error: "Missing required fields: cruiseId, cabinType, passengers, contactName, contactEmail, cardLast4",
    });
  }

  const cruise = CRUISE_PRICES[cruiseId];
  if (!cruise) {
    return res.status(404).json({ error: `Cruise '${cruiseId}' not found` });
  }

  const surcharge = CABIN_SURCHARGES[cabinType];
  if (surcharge === undefined) {
    return res.status(400).json({
      error: `Invalid cabinType. Must be one of: ${Object.keys(CABIN_SURCHARGES).join(", ")}`,
    });
  }

  if (typeof passengers !== "number" || passengers < 1 || passengers > 8) {
    return res.status(400).json({ error: "passengers must be a number between 1 and 8" });
  }

  const totalPrice = (cruise.basePrice + surcharge) * passengers;
  const bookingId  = uuidv4();

  // ── Call payment service ─────────────────────────────────────────────────
  const paymentServiceUrl = process.env.PAYMENT_SERVICE_URL || "http://payment-service";
  let paymentId;

  try {
    const paymentRes = await fetch(`${paymentServiceUrl}/api/payments/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bookingId,
        amount: totalPrice,
        currency: "USD",
        cardLast4,
      }),
    });

    if (!paymentRes.ok) {
      const err = await paymentRes.json().catch(() => ({}));
      return res.status(402).json({
        error: "Payment declined",
        detail: err.error || paymentRes.statusText,
      });
    }

    const payment = await paymentRes.json();
    paymentId = payment.id;
  } catch (err) {
    console.error("Payment service unreachable:", err.message);
    return res.status(503).json({ error: "Payment service unavailable. Please try again." });
  }

  // ── Persist booking ──────────────────────────────────────────────────────
  const booking = {
    id: bookingId,
    bookingRef: generateRef(),
    cruiseId,
    cruiseName: cruise.name,
    cabinType,
    passengers,
    totalPrice,
    contactName,
    contactEmail,
    cardLast4,
    paymentId,
    status: "confirmed",
    createdAt: new Date().toISOString(),
  };

  bookings.set(bookingId, booking);

  res.status(201).json(booking);
});

// ── GET /api/bookings — list all bookings ────────────────────────────────────
router.get("/", (req, res) => {
  const list = Array.from(bookings.values()).sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );
  res.json({ bookings: list, total: list.length });
});

// ── GET /api/bookings/:id — get one booking ──────────────────────────────────
router.get("/:id", (req, res) => {
  const booking = bookings.get(req.params.id);
  if (!booking) {
    return res.status(404).json({ error: "Booking not found" });
  }
  res.json(booking);
});

// ── DELETE /api/bookings/:id — cancel a booking ──────────────────────────────
router.delete("/:id", (req, res) => {
  const booking = bookings.get(req.params.id);
  if (!booking) {
    return res.status(404).json({ error: "Booking not found" });
  }
  if (booking.status === "cancelled") {
    return res.status(409).json({ error: "Booking is already cancelled" });
  }

  booking.status    = "cancelled";
  booking.cancelledAt = new Date().toISOString();
  bookings.set(booking.id, booking);

  res.json({ message: "Booking cancelled", booking });
});

module.exports = router;
