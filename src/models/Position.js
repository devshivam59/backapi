const mongoose = require('mongoose');

const positionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    instrument: { type: mongoose.Schema.Types.ObjectId, ref: 'Instrument', required: true },
    side: { type: String, enum: ['LONG', 'SHORT'], required: true },
    quantity: { type: Number, required: true },
    averagePrice: { type: Number, required: true },
    markPrice: { type: Number, required: true },
    pnl: { type: Number, required: true },
  },
  { timestamps: true }
);

positionSchema.index({ user: 1, instrument: 1 }, { unique: true });

module.exports = mongoose.model('Position', positionSchema);
