const mongoose = require('mongoose');

const watchlistItemSchema = new mongoose.Schema({
    watchlist_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Watchlist', required: true },
    instrument_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Instrument', required: true },
    sort_order: { type: Number, default: 0 },
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

watchlistItemSchema.virtual('id').get(function() {
    return this._id.toHexString();
});

module.exports = mongoose.model('WatchlistItem', watchlistItemSchema);