const mongoose = require('mongoose');

const instrumentSchema = new mongoose.Schema({
    name: { type: String, required: true },
    symbol: { type: String, required: true },
    tradingsymbol: { type: String, required: true },
    exchange: { type: String, required: true, default: 'NSE' },
    segment: { type: String, required: true, default: 'NSE' },
    type: { type: String, enum: ['stock', 'future', 'option', 'index'], default: 'stock' },
    lot_size: { type: Number, default: 1 },
    tick_size: { type: Number, default: 0.05 },
    expiry: { type: Date },
    strike: { type: Number },
    broker_tokens: { type: Map, of: String },
    metadata: { type: mongoose.Schema.Types.Mixed },
    lastPrice: { type: Number, default: 0 },
    dailyChange: { type: Number, default: 0 }
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

instrumentSchema.virtual('id').get(function() {
    return this._id.toHexString();
});

// Create a compound index for faster lookups on imports
instrumentSchema.index({ tradingsymbol: 1, exchange: 1 }, { unique: true });
// Create a text index for searching
instrumentSchema.index({ name: 'text', symbol: 'text', tradingsymbol: 'text' });


module.exports = mongoose.model('Instrument', instrumentSchema);