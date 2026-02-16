// ========== IMPORTS ========== //
const mongoose = require("mongoose");

// ========== SUB-SCHEMAS ========== //
const optionSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    votes: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: false }
);

// ========== MAIN SCHEMA ========== //
const pollSchema = new mongoose.Schema(
  {
    question: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },
    options: {
      type: [optionSchema],
      validate: {
        validator: (value) => Array.isArray(value) && value.length >= 2,
        message: "A poll must contain at least two options.",
      },
    },
    voterIps: {
      type: [String],
      default: [],
    },
    voterTokens: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

// ========== EXPORT ========== //
module.exports = mongoose.model("Poll", pollSchema);
