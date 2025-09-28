const mongoose = require('mongoose');

const watchlistItemSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    instrument: { type: mongoose.Schema.Types.ObjectId, ref: 'Instrument', required: true },
  },
  { timestamps: true }
);

watchlistItemSchema.index({ user: 1, instrument: 1 }, { unique: true });

module.exports = mongoose.model('WatchlistItem', watchlistItemSchema);
