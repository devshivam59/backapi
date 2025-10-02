const express = require('express');
const router = express.Router();
const {
  initializeZerodha,
  getMarketStatus,
  getWatchlists,
  createWatchlist,
  getWatchlist,
  addInstrumentToWatchlist,
  removeInstrumentFromWatchlist,
  deleteWatchlist,
  refreshZerodhaToken,
  getLivePrices
} = require('../controllers/watchlistController');

// Zerodha service management routes
router.post('/', initializeZerodha);
router.get('/market-status', getMarketStatus);
router.post('/refresh-token', refreshZerodhaToken);
router.post('/live-prices', getLivePrices);

// Watchlist management routes
router.get('/watchlists', getWatchlists);
router.post('/watchlists', createWatchlist);
router.get('/watchlists/:id', getWatchlist);
router.delete('/watchlists/:id', deleteWatchlist);

// Instrument management routes
router.post('/watchlists/:id/instruments', addInstrumentToWatchlist);
router.delete('/watchlists/:id/instruments/:instrumentToken', removeInstrumentFromWatchlist);

module.exports = router;
