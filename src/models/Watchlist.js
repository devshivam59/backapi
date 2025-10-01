const mongoose = require('mongoose');

const watchlistInstrumentSchema = new mongoose.Schema({
  instrumentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Instrument',
    required: true
  },
  instrumentToken: {
    type: String,
    required: true
  },
  symbol: {
    type: String,
    required: true
  },
  tradingSymbol: {
    type: String,
    required: true
  },
  exchange: {
    type: String,
    required: true
  },
  addedAt: {
    type: Date,
    default: Date.now
  }
});

const watchlistSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  instruments: [watchlistInstrumentSchema],
  isDefault: {
    type: Boolean,
    default: false
  },
  color: {
    type: String,
    default: '#3B82F6' // Blue color
  },
  description: {
    type: String,
    maxlength: 500
  }
}, {
  timestamps: true
});

// Index for faster queries
watchlistSchema.index({ userId: 1, createdAt: -1 });
watchlistSchema.index({ userId: 1, name: 1 }, { unique: true });

// Virtual for instrument count
watchlistSchema.virtual('instrumentCount').get(function() {
  return this.instruments.length;
});

// Method to add instrument
watchlistSchema.methods.addInstrument = function(instrumentData) {
  const exists = this.instruments.some(
    inst => inst.instrumentId.toString() === instrumentData.instrumentId.toString()
  );
  
  if (!exists) {
    this.instruments.push(instrumentData);
    return true;
  }
  return false;
};

// Method to remove instrument
watchlistSchema.methods.removeInstrument = function(instrumentId) {
  const index = this.instruments.findIndex(
    inst => inst.instrumentId.toString() === instrumentId.toString()
  );
  
  if (index > -1) {
    this.instruments.splice(index, 1);
    return true;
  }
  return false;
};

// Static method to get user's default watchlist
watchlistSchema.statics.getDefaultWatchlist = async function(userId) {
  let watchlist = await this.findOne({ userId, isDefault: true });
  
  if (!watchlist) {
    // Create default watchlist if it doesn't exist
    watchlist = new this({
      name: 'My Watchlist',
      userId,
      isDefault: true,
      description: 'Default watchlist for tracking favorite instruments'
    });
    await watchlist.save();
  }
  
  return watchlist;
};

// Pre-save middleware to ensure only one default watchlist per user
watchlistSchema.pre('save', async function(next) {
  if (this.isDefault && this.isModified('isDefault')) {
    // Remove default flag from other watchlists of the same user
    await this.constructor.updateMany(
      { userId: this.userId, _id: { $ne: this._id } },
      { isDefault: false }
    );
  }
  next();
});

module.exports = mongoose.model('Watchlist', watchlistSchema);
