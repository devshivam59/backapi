const express = require('express');
const asyncHandler = require('../../utils/asyncHandler');
const { authenticate } = require('../../middleware/auth');
const { getState, createId, withState } = require('../../store/dataStore');

const router = express.Router();

router.get(
  '/pnl',
  authenticate(true),
  asyncHandler((req, res) => {
    const { trades } = getState();
    const own = trades.filter((trade) => trade.user_id === req.user.id);
    const summary = own.reduce(
      (acc, trade) => {
        const direction = trade.side === 'BUY' ? -1 : 1;
        acc.realized += direction * trade.qty * trade.price;
        acc.trades += 1;
        return acc;
      },
      { realized: 0, trades: 0 }
    );
    res.json({ data: summary });
  })
);

router.get(
  '/contract-notes',
  authenticate(true),
  asyncHandler((req, res) => {
    const { trades } = getState();
    const own = trades.filter((trade) => trade.user_id === req.user.id);
    const grouped = own.reduce((acc, trade) => {
      const date = trade.ts.slice(0, 10);
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(trade);
      return acc;
    }, {});
    const notes = Object.keys(grouped).map((date) => ({
      id: createId('contract'),
      date,
      trade_count: grouped[date].length,
      url: `https://example.com/contracts/${date}.pdf`
    }));
    res.json({ data: notes });
  })
);

router.get(
  '/export',
  authenticate(true),
  asyncHandler((_req, res) => {
    const job = {
      id: createId('export'),
      status: 'queued',
      requestedAt: new Date().toISOString()
    };
    withState((state) => {
      state.automationJobs.push(job);
    });
    res.json({ data: job });
  })
);

module.exports = router;
