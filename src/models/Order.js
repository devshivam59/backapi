const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    instrument: { type: mongoose.Schema.Types.ObjectId, ref: 'Instrument', required: true },
    side: { type: String, enum: ['BUY', 'SELL'], required: true },
    quantity: { type: Number, required: true },
    price: { type: Number, required: true },
    status: {
      type: String,
      enum: ['PENDING', 'COMPLETED', 'CANCELLED'],
      default: 'COMPLETED',
    },
    orderType: {
      type: String,
      enum: ['MARKET', 'LIMIT'],
      default: 'MARKET',
    },
    productType: {
      type: String,
      enum: ['CNC', 'MIS', 'NRML'],
      default: 'CNC',
    },
    validity: {
      type: String,
      enum: ['DAY', 'IOC', 'GTC'],
      default: 'DAY',
    },
    notes: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Order', orderSchema);
