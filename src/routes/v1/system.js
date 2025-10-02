const express = require('express');
const asyncHandler = require('../../utils/asyncHandler');

const router = express.Router();

router.get(
  '/healthz',
  asyncHandler((_req, res) => {
    res.json({
      data: {
        status: 'ok',
        timestamp: new Date().toISOString()
      }
    });
  })
);

router.get(
  '/config',
  asyncHandler((_req, res) => {
    res.json({
      data: {
        banners: [],
        market_calendar_updated_at: new Date().toISOString()
      }
    });
  })
);

router.get(
  '/markets/calendar',
  asyncHandler((_req, res) => {
    res.json({
      data: {
        open_days: ['2025-01-02', '2025-01-03'],
        holidays: ['2025-01-26']
      }
    });
  })
);

module.exports = router;
