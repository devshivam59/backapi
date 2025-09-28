const mongoose = require('mongoose');

const holdingSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    instrument: { type: mongoose.Schema.Types.ObjectId, ref: 'Instrument', required: true },
    quantity: { type: Number, required: true, default: 0 },
    averagePrice: { type: Number, required: true, default: 0 },
  },
  { timestamps: true }
);

holdingSchema.index({ user: 1, instrument: 1 }, { unique: true });

module.exports = mongoose.model('Holding', holdingSchema);
