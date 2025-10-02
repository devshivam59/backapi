const express = require('express');
const asyncHandler = require('../../utils/asyncHandler');
const { HttpError } = require('../../utils/httpError');
const { authenticate } = require('../../middleware/auth');
const { getState, withState, createId } = require('../../store/dataStore');
const { placeOrder } = require('../../services/orderEngine');

const router = express.Router();

function serializeWatchlist(watchlist, items) {
  return {
    ...watchlist,
    items: items
      .filter((item) => item.watchlist_id === watchlist.id)
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
  };
}

router.get(
  '/',
  authenticate(true),
  asyncHandler((req, res) => {
    const { watchlists, watchlistItems } = getState();
    const ownLists = watchlists.filter((list) => list.user_id === req.user.id);
    res.json({ data: ownLists.map((list) => serializeWatchlist(list, watchlistItems)) });
  })
);

router.post(
  '/',
  authenticate(true),
  asyncHandler((req, res) => {
    const { name } = req.body;
    if (!name) {
      throw new HttpError(400, 'VALIDATION_FAILED', 'name is required');
    }
    const now = new Date().toISOString();
    const watchlist = {
      id: createId('wl'),
      user_id: req.user.id,
      name,
      createdAt: now,
      updatedAt: now
    };
    withState((state) => {
      state.watchlists.push(watchlist);
    });
    res.status(201).json({ data: serializeWatchlist(watchlist, []) });
  })
);

router.put(
  '/:watchlistId',
  authenticate(true),
  asyncHandler((req, res) => {
    const { watchlists, watchlistItems } = getState();
    const watchlist = watchlists.find((item) => item.id === req.params.watchlistId && item.user_id === req.user.id);
    if (!watchlist) {
      throw new HttpError(404, 'NOT_FOUND', 'Watchlist not found');
    }
    withState((state) => {
      const target = state.watchlists.find((item) => item.id === watchlist.id);
      if (req.body.name) {
        target.name = req.body.name;
      }
      if (Array.isArray(req.body.reorder)) {
        req.body.reorder.forEach((itemId, index) => {
          const item = state.watchlistItems.find((entry) => entry.id === itemId && entry.watchlist_id === target.id);
          if (item) {
            item.sort_order = index;
          }
        });
      }
      target.updatedAt = new Date().toISOString();
    });
    const { watchlists: updatedLists, watchlistItems: updatedItems } = getState();
    const updated = updatedLists.find((item) => item.id === watchlist.id);
    res.json({ data: serializeWatchlist(updated, updatedItems) });
  })
);

router.delete(
  '/:watchlistId',
  authenticate(true),
  asyncHandler((req, res) => {
    withState((state) => {
      state.watchlists = state.watchlists.filter(
        (item) => !(item.id === req.params.watchlistId && item.user_id === req.user.id)
      );
      state.watchlistItems = state.watchlistItems.filter((item) => item.watchlist_id !== req.params.watchlistId);
    });
    res.status(204).send();
  })
);

router.post(
  '/:watchlistId/items',
  authenticate(true),
  asyncHandler((req, res) => {
    const { instrument_id: instrumentId } = req.body;
    if (!instrumentId) {
      throw new HttpError(400, 'VALIDATION_FAILED', 'instrument_id is required');
    }
    const { watchlists, watchlistItems } = getState();
    const watchlist = watchlists.find((item) => item.id === req.params.watchlistId && item.user_id === req.user.id);
    if (!watchlist) {
      throw new HttpError(404, 'NOT_FOUND', 'Watchlist not found');
    }
    const existing = watchlistItems.filter((item) => item.watchlist_id === watchlist.id);
    const now = new Date().toISOString();
    const watchlistItem = {
      id: createId('wli'),
      watchlist_id: watchlist.id,
      instrument_id: instrumentId,
      sort_order: existing.length,
      createdAt: now,
      updatedAt: now
    };
    withState((state) => {
      state.watchlistItems.push(watchlistItem);
    });
    res.status(201).json({ data: watchlistItem });
  })
);

router.delete(
  '/:watchlistId/items/:itemId',
  authenticate(true),
  asyncHandler((req, res) => {
    withState((state) => {
      state.watchlistItems = state.watchlistItems.filter(
        (item) => !(item.id === req.params.itemId && item.watchlist_id === req.params.watchlistId)
      );
    });
    res.status(204).send();
  })
);

router.post(
  '/:watchlistId/items/:itemId/order',
  authenticate(true),
  asyncHandler((req, res) => {
    const { watchlists, watchlistItems } = getState();
    const watchlist = watchlists.find((item) => item.id === req.params.watchlistId && item.user_id === req.user.id);
    if (!watchlist) {
      throw new HttpError(404, 'NOT_FOUND', 'Watchlist not found');
    }
    const item = watchlistItems.find((entry) => entry.id === req.params.itemId && entry.watchlist_id === watchlist.id);
    if (!item) {
      throw new HttpError(404, 'NOT_FOUND', 'Watchlist item not found');
    }
    const { order, trade } = placeOrder(req.user, {
      ...req.body,
      instrument_id: item.instrument_id
    });
    res.status(201).json({ data: { order, trades: trade ? [trade] : [] } });
  })
);

module.exports = router;
