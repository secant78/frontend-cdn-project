const express = require("express");
const bookingsRouter = require("./routes/bookings");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "booking-service",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/bookings", bookingsRouter);

app.listen(PORT, () => {
  console.log(`Booking service running on port ${PORT}`);
  console.log(`Payment service URL: ${process.env.PAYMENT_SERVICE_URL}`);
});

module.exports = app;
