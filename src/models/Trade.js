const mongoose = require('mongoose');

const tradeSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    instrument: { type: mongoose.Schema.Types.ObjectId, ref: 'Instrument', required: true },
    side: { type: String, enum: ['BUY', 'SELL'], required: true },
    quantity: { type: Number, required: true },
    price: { type: Number, required: true },
    tradeTime: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Trade', tradeSchema);
