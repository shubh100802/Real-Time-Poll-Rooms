// ========== IMPORTS ========== //
const express = require("express");
const pollRoutes = require("./routes/pollRoutes");

// ========== APP SETUP ========== //
const app = express();

app.set("trust proxy", true);
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

// ========== ROUTES ========== //
app.use(pollRoutes);

// ========== NOT FOUND HANDLER ========== //
app.use((req, res) => {
  res.status(404).json({ error: "Route not found." });
});

// ========== ERROR HANDLER ========== //
app.use((error, req, res, next) => {
  if (error.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Invalid JSON payload." });
  }

  if (error.name === "ValidationError") {
    return res.status(400).json({ error: error.message });
  }

  console.error(error);
  res.status(500).json({ error: "Internal server error." });
});

// ========== EXPORT ========== //
module.exports = app;
