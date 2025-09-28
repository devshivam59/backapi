const { validationResult } = require('express-validator');
const Instrument = require('../models/Instrument');
const WatchlistItem = require('../models/WatchlistItem');

exports.addToWatchlist = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { symbol } = req.body;
    const instrument = await Instrument.findOne({ symbol: symbol.toUpperCase() });
    if (!instrument) {
      return res.status(404).json({ message: 'Instrument not found' });
    }

    const item = await WatchlistItem.create({ user: req.user._id, instrument: instrument._id });
    res.status(201).json(item);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Instrument already in watchlist' });
    }
    next(error);
  }
};

exports.removeFromWatchlist = async (req, res, next) => {
  try {
    const deleted = await WatchlistItem.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!deleted) {
      return res.status(404).json({ message: 'Watchlist item not found' });
    }
    res.json({ message: 'Removed from watchlist' });
  } catch (error) {
    next(error);
  }
};

exports.getWatchlist = async (req, res, next) => {
  try {
    const watchlist = await WatchlistItem.find({ user: req.user._id }).populate('instrument');
    res.json(watchlist);
  } catch (error) {
    next(error);
  }
};
