const mongoose = require('mongoose');

const instrumentSchema = new mongoose.Schema(
  {
    symbol: { type: String, required: true, unique: true, uppercase: true },
    name: { type: String, required: true },
    exchange: { type: String },
    segment: { type: String },
    instrumentType: { type: String },
    lotSize: { type: Number, default: 1 },
    tickSize: { type: Number, default: 0.05 },
    isin: { type: String },
    lastPrice: { type: Number, default: 0 },
    dailyChange: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Instrument', instrumentSchema);
