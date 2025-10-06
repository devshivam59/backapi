const express = require('express');
const asyncHandler = require('../../utils/asyncHandler');
const { HttpError } = require('../../utils/httpError');
const { authenticate } = require('../../middleware/auth');
const Watchlist = require('../../models/Watchlist');
const WatchlistItem = require('../../models/WatchlistItem');
const Instrument = require('../../models/Instrument');
const { placeOrder } = require('../../services/orderEngine');

const router = express.Router();

async function serializeWatchlistWithItems(watchlist) {
    const items = await WatchlistItem.find({ watchlist_id: watchlist._id })
                                     .sort('sort_order')
                                     .populate('instrument_id');
    return {
        ...watchlist.toObject(),
        items: items.map(item => ({
            ...item.toObject(),
            instrument: item.instrument_id.toObject() // Assuming instrument_id is populated
        }))
    };
}

router.get('/', authenticate(true), asyncHandler(async (req, res) => {
    const watchlists = await Watchlist.find({ user_id: req.user._id });
    const serializedWatchlists = await Promise.all(watchlists.map(serializeWatchlistWithItems));
    res.json({ data: serializedWatchlists });
}));

router.post('/', authenticate(true), asyncHandler(async (req, res) => {
    const { name } = req.body;
    if (!name) {
        throw new HttpError(400, 'VALIDATION_FAILED', 'name is required');
    }
    const watchlist = new Watchlist({
        user_id: req.user._id,
        name,
    });
    await watchlist.save();
    res.status(201).json({ data: await serializeWatchlistWithItems(watchlist) });
}));

router.put('/:watchlistId', authenticate(true), asyncHandler(async (req, res) => {
    const watchlist = await Watchlist.findOne({ _id: req.params.watchlistId, user_id: req.user._id });
    if (!watchlist) {
        throw new HttpError(404, 'NOT_FOUND', 'Watchlist not found');
    }

    if (req.body.name) {
        watchlist.name = req.body.name;
    }

    if (Array.isArray(req.body.reorder)) {
        const reorderOps = req.body.reorder.map((itemId, index) =>
            WatchlistItem.updateOne({ _id: itemId, watchlist_id: watchlist._id }, { sort_order: index })
        );
        await Promise.all(reorderOps);
    }

    await watchlist.save();
    res.json({ data: await serializeWatchlistWithItems(watchlist) });
}));

router.delete('/:watchlistId', authenticate(true), asyncHandler(async (req, res) => {
    const watchlist = await Watchlist.findOne({ _id: req.params.watchlistId, user_id: req.user._id });
    if (watchlist) {
        await WatchlistItem.deleteMany({ watchlist_id: watchlist._id });
        await Watchlist.deleteOne({ _id: watchlist._id });
    }
    res.status(204).send();
}));

router.post('/:watchlistId/items', authenticate(true), asyncHandler(async (req, res) => {
    const { instrument_id } = req.body;
    if (!instrument_id) {
        throw new HttpError(400, 'VALIDATION_FAILED', 'instrument_id is required');
    }

    const watchlist = await Watchlist.findOne({ _id: req.params.watchlistId, user_id: req.user._id });
    if (!watchlist) {
        throw new HttpError(404, 'NOT_FOUND', 'Watchlist not found');
    }

    const instrument = await Instrument.findById(instrument_id);
    if (!instrument) {
        throw new HttpError(404, 'NOT_FOUND', 'Instrument not found');
    }

    const existingCount = await WatchlistItem.countDocuments({ watchlist_id: watchlist._id });

    const watchlistItem = new WatchlistItem({
        watchlist_id: watchlist._id,
        instrument_id: instrument._id,
        sort_order: existingCount,
    });
    await watchlistItem.save();
    res.status(201).json({ data: watchlistItem.toObject() });
}));

router.delete('/:watchlistId/items/:itemId', authenticate(true), asyncHandler(async (req, res) => {
    const watchlist = await Watchlist.findOne({ _id: req.params.watchlistId, user_id: req.user._id });
    if (watchlist) {
        await WatchlistItem.deleteOne({ _id: req.params.itemId, watchlist_id: watchlist._id });
    }
    res.status(204).send();
}));

router.post(
  '/:watchlistId/items/:itemId/order',
  authenticate(true),
  asyncHandler(async (req, res) => {
    const item = await WatchlistItem.findOne({ _id: req.params.itemId, watchlist_id: req.params.watchlistId });
    if (!item) {
      throw new HttpError(404, 'NOT_FOUND', 'Watchlist item not found');
    }
    const { order, trade } = await placeOrder(req.user, {
      ...req.body,
      instrument_id: item.instrument_id.toString()
    });
    res.status(201).json({ data: { order, trades: trade ? [trade] : [] } });
  })
);

module.exports = router;