const express = require("express");
const paymentsRouter = require("./routes/payments");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "payment-service",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/payments", paymentsRouter);

app.listen(PORT, () => {
  console.log(`Payment service running on port ${PORT}`);
});

module.exports = app;
