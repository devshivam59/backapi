const express = require('express');
const asyncHandler = require('../../utils/asyncHandler');
const { authenticate } = require('../../middleware/auth');
const { getState } = require('../../store/dataStore');
const { ensureSnapshot } = require('../../services/marketDataService');

const router = express.Router();

router.get(
  '/holdings',
  authenticate(true),
  asyncHandler((req, res) => {
    const { holdings } = getState();
    const own = holdings.filter((holding) => holding.user_id === req.user.id);
    const enriched = own.map((holding) => {
      const snapshot = ensureSnapshot(holding.instrument_id);
      const lastPrice = snapshot.ltp;
      const pnlAbs = Number(((lastPrice - holding.avg_price) * holding.qty).toFixed(2));
      const pnlPct = holding.avg_price ? Number(((pnlAbs / (holding.avg_price * holding.qty)) * 100).toFixed(2)) : 0;
      return {
        ...holding,
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
  asyncHandler((req, res) => {
    const { positions } = getState();
    const own = positions.filter((position) => position.user_id === req.user.id);
    const enriched = own.map((position) => {
      const snapshot = ensureSnapshot(position.instrument_id);
      const mtm = Number((snapshot.ltp * position.qty - position.avg_price * position.qty).toFixed(2));
      return {
        ...position,
        mtm
      };
    });
    res.json({ data: enriched });
  })
);

router.get(
  '/pnl/daily',
  authenticate(true),
  asyncHandler((req, res) => {
    const { trades } = getState();
    const own = trades.filter((trade) => trade.user_id === req.user.id);
    const breakdown = own.reduce((acc, trade) => {
      const day = trade.ts.slice(0, 10);
      if (!acc[day]) {
        acc[day] = { date: day, realized: 0 };
      }
      const direction = trade.side === 'BUY' ? -1 : 1;
      acc[day].realized += direction * trade.qty * trade.price;
      return acc;
    }, {});
    res.json({ data: Object.values(breakdown) });
  })
);

router.get(
  '/trades',
  authenticate(true),
  asyncHandler((req, res) => {
    const { trades } = getState();
    const own = trades.filter((trade) => trade.user_id === req.user.id);
    res.json({ data: own });
  })
);

module.exports = router;
