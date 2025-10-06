const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    instrument_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Instrument', required: true },
    type: { type: String, enum: ['MARKET', 'LIMIT'], required: true },
    side: { type: String, enum: ['BUY', 'SELL'], required: true },
    qty: { type: Number, required: true },
    price: { type: Number },
    status: { type: String, enum: ['OPEN', 'COMPLETE', 'CANCELLED', 'REJECTED'], default: 'OPEN' },
    filled_qty: { type: Number, default: 0 },
    average_price: { type: Number, default: 0 },
    idempotency_key: { type: String, unique: true, sparse: true },
}, {
    timestamps: true,
    toJSON: {
        virtuals: true,
        transform: (doc, ret) => {
            delete ret._id;
            delete ret.__v;
        }
    },
    toObject: {
        virtuals: true,
        transform: (doc, ret) => {
            delete ret._id;
            delete ret.__v;
        }
    }
});

orderSchema.virtual('id').get(function() {
    return this._id.toHexString();
});

module.exports = mongoose.model('Order', orderSchema);