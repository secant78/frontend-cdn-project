const express = require("express");
const { v4: uuidv4 } = require("uuid");

const router = express.Router();

// ── In-memory store ──────────────────────────────────────────────────────────
const payments = new Map();

// ── POST /api/payments/process — process a payment ──────────────────────────
// Called internally by booking-service. Not exposed directly via CloudFront.
router.post("/process", (req, res) => {
  const { bookingId, amount, currency = "USD", cardLast4 } = req.body;

  if (!bookingId || !amount || !cardLast4) {
    return res.status(400).json({
      error: "Missing required fields: bookingId, amount, cardLast4",
    });
  }

  if (typeof amount !== "number" || amount <= 0) {
    return res.status(400).json({ error: "amount must be a positive number" });
  }

  if (!/^\d{4}$/.test(cardLast4)) {
    return res.status(400).json({ error: "cardLast4 must be a 4-digit string" });
  }

  // Simulate a declined card for testing (card ending in 0000)
  if (cardLast4 === "0000") {
    return res.status(402).json({ error: "Card declined: insufficient funds" });
  }

  const payment = {
    id:        uuidv4(),
    bookingId,
    amount,
    currency,
    cardLast4,
    status:    "succeeded",
    createdAt: new Date().toISOString(),
  };

  payments.set(payment.id, payment);

  res.status(201).json(payment);
});

// ── GET /api/payments/:id — get a payment by ID ──────────────────────────────
router.get("/:id", (req, res) => {
  const payment = payments.get(req.params.id);
  if (!payment) {
    return res.status(404).json({ error: "Payment not found" });
  }
  res.json(payment);
});

module.exports = router;
