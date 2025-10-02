const express = require('express');
const asyncHandler = require('../../utils/asyncHandler');
const { HttpError } = require('../../utils/httpError');
const { authenticate } = require('../../middleware/auth');
const { getInstrument, ensureSnapshot } = require('../../services/marketDataService');

const router = express.Router();

router.get(
  '/quote/:instrumentId',
  authenticate(true),
  asyncHandler((req, res) => {
    const instrument = getInstrument(req.params.instrumentId);
    const snapshot = ensureSnapshot(instrument.id);
    res.json({
      data: {
        instrument_id: instrument.id,
        ltp: snapshot.ltp,
        bid: snapshot.bid,
        ask: snapshot.ask,
        ts: snapshot.updatedAt
      }
    });
  })
);

router.post(
  '/quotes',
  authenticate(true),
  asyncHandler((req, res) => {
    const { instrument_ids: instrumentIds } = req.body;
    if (!Array.isArray(instrumentIds) || instrumentIds.length === 0) {
      throw new HttpError(400, 'VALIDATION_FAILED', 'instrument_ids array is required');
    }
    const payload = instrumentIds.map((instrumentId) => {
      try {
        const instrument = getInstrument(instrumentId);
        const snapshot = ensureSnapshot(instrument.id);
        return {
          instrument_id: instrument.id,
          ltp: snapshot.ltp,
          bid: snapshot.bid,
          ask: snapshot.ask,
          ts: snapshot.updatedAt
        };
      } catch (error) {
        return { instrument_id: instrumentId, error: error.code || 'NOT_FOUND' };
      }
    });
    res.json({ data: payload });
  })
);

router.get(
  '/depth/:instrumentId',
  authenticate(true),
  asyncHandler((req, res) => {
    const instrument = getInstrument(req.params.instrumentId);
    const snapshot = ensureSnapshot(instrument.id);
    res.json({
      data: {
        instrument_id: instrument.id,
        bid: snapshot.depth.buy,
        ask: snapshot.depth.sell,
        ts: snapshot.updatedAt
      }
    });
  })
);

router.get(
  '/ohlc/:instrumentId',
  authenticate(true),
  asyncHandler((req, res) => {
    const instrument = getInstrument(req.params.instrumentId);
    const snapshot = ensureSnapshot(instrument.id);
    const from = req.query.from ? new Date(req.query.from) : null;
    const to = req.query.to ? new Date(req.query.to) : null;
    let data = snapshot.ohlc || [];
    if (from) {
      data = data.filter((item) => new Date(item.ts) >= from);
    }
    if (to) {
      data = data.filter((item) => new Date(item.ts) <= to);
    }
    res.json({
      data,
      instrument_id: instrument.id
    });
  })
);

module.exports = router;
