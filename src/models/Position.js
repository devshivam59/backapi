const mongoose = require('mongoose');

const positionSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    instrument_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Instrument', required: true },
    product: { type: String, required: true },
    qty: { type: Number, default: 0 },
    avg_price: { type: Number, default: 0 },
    day_buy: { type: Number, default: 0 },
    day_sell: { type: Number, default: 0 },
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

positionSchema.virtual('id').get(function() {
    return this._id.toHexString();
});

positionSchema.index({ user_id: 1, instrument_id: 1, product: 1 }, { unique: true });

module.exports = mongoose.model('Position', positionSchema);