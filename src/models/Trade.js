const mongoose = require('mongoose');

const tradeSchema = new mongoose.Schema({
    order_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    instrument_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Instrument', required: true },
    side: { type: String, enum: ['BUY', 'SELL'], required: true },
    qty: { type: Number, required: true },
    price: { type: Number, required: true },
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

tradeSchema.virtual('id').get(function() {
    return this._id.toHexString();
});

module.exports = mongoose.model('Trade', tradeSchema);