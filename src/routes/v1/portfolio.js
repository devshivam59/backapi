const express = require('express');
const asyncHandler = require('../../utils/asyncHandler');
const { authenticate } = require('../../middleware/auth');
const Holding = require('../../models/Holding');
const Position = require('../../models/Position');
const Trade = require('../../models/Trade');
const { getInstrument, ensureSnapshot } = require('../../services/marketDataService');

const router = express.Router();

router.get(
  '/holdings',
  authenticate(true),
  asyncHandler(async (req, res) => {
    const holdings = await Holding.find({ user: req.user._id }).populate('instrument');
    const enriched = holdings.map((holding) => {
      const snapshot = ensureSnapshot(holding.instrument.id);
      const lastPrice = snapshot.ltp;
      const pnlAbs = Number(((lastPrice - holding.averagePrice) * holding.quantity).toFixed(2));
      const pnlPct = holding.averagePrice ? Number(((pnlAbs / (holding.averagePrice * holding.quantity)) * 100).toFixed(2)) : 0;
      return {
        ...holding.toObject(),
        last_price: lastPrice,
        pnl_abs: pnlAbs,
        pnl_pct: pnlPct
      };
    });
    res.json({ data: enriched });
  })
);

router.get(
  '/positions',
  authenticate(true),
  asyncHandler(async (req, res) => {
    const positions = await Position.find({ user_id: req.user._id }).populate('instrument_id');
    const enriched = positions.map((position) => {
      const snapshot = ensureSnapshot(position.instrument_id.id);
      const mtm = Number((snapshot.ltp * position.qty - position.avg_price * position.qty).toFixed(2));
      return {
        ...position.toObject(),
        instrument: position.instrument_id.toObject(),
        mtm
      };
    });
    res.json({ data: enriched });
  })
);

router.get(
    '/trades',
    authenticate(true),
    asyncHandler(async (req, res) => {
      const trades = await Trade.find({ user_id: req.user._id }).populate('instrument_id');
      res.json({ data: trades.map(t => t.toObject()) });
    })
);

module.exports = router;