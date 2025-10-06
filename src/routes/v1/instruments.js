const express = require('express');
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const asyncHandler = require('../../utils/asyncHandler');
const { HttpError } = require('../../utils/httpError');
const { authenticate, requireRoles } = require('../../middleware/auth');
const Instrument = require('../../models/Instrument');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

function normalise(value) {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string' && value.trim() === '') return undefined;
  return value;
}

router.post(
  '/import',
  authenticate(true),
  requireRoles('admin'),
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new HttpError(400, 'VALIDATION_FAILED', 'CSV file is required');
    }

    const source = req.body.source || 'custom';
    let records;
    try {
      records = parse(req.file.buffer.toString('utf8'), {
        columns: true,
        skip_empty_lines: true,
        trim: true
      });
    } catch (error) {
      throw new HttpError(400, 'VALIDATION_FAILED', `Unable to parse CSV: ${error.message}`);
    }

    let rowsOk = 0;
    const rejects = [];
    const bulkOps = [];

    records.forEach((row, index) => {
      const tradingsymbol = normalise(row.tradingsymbol || row.trading_symbol || row.symbol);
      if (!tradingsymbol) {
        rejects.push({ index, reason: 'Missing tradingsymbol' });
        return;
      }

      const exchange = normalise(row.exchange) || 'NSE';
      const brokerToken = normalise(row.instrument_token || row.token || row.broker_token);

      const updateData = {
        name: normalise(row.name) || tradingsymbol,
        symbol: tradingsymbol,
        tradingsymbol,
        exchange,
        segment: normalise(row.segment) || exchange,
        type: normalise(row.instrument_type || row.type) || 'stock',
        lot_size: Number(row.lot_size || row.lotsize || 1),
        tick_size: Number(row.tick_size || row.ticksize || 0.05),
        expiry: normalise(row.expiry) || null,
        strike: row.strike ? Number(row.strike) : null,
        metadata: row,
      };

      if (brokerToken) {
        updateData[`broker_tokens.${source}`] = brokerToken;
      }

      bulkOps.push({
        updateOne: {
          filter: { tradingsymbol, exchange },
          update: { $set: updateData },
          upsert: true
        }
      });
      rowsOk++;
    });

    if (bulkOps.length > 0) {
      await Instrument.bulkWrite(bulkOps);
    }

    res.status(202).json({
      data: {
        run_id: `import-${Date.now()}`,
        rows_in: records.length,
        rows_ok: rowsOk,
        rows_err: rejects.length,
        rejects
      }
    });
  })
);

router.get(
  '/',
  authenticate(true),
  asyncHandler(async (req, res) => {
    const { q, segment, exchange, type, limit = 20, cursor } = req.query;
    const query = {};

    if (q) {
      query.$text = { $search: q };
    }
    if (segment) query.segment = segment;
    if (exchange) query.exchange = exchange;
    if (type) query.type = type;

    const offset = cursor ? parseInt(Buffer.from(cursor, 'base64').toString('utf8'), 10) : 0;
    const limitNum = parseInt(limit, 10);

    const instruments = await Instrument.find(query).skip(offset).limit(limitNum);
    const total = await Instrument.countDocuments(query);

    const nextCursor = (offset + limitNum) < total ? Buffer.from(String(offset + limitNum)).toString('base64') : null;

    res.json({
      data: instruments.map(i => i.toObject()),
      paging: {
        next_cursor: nextCursor,
        total
      }
    });
  })
);

router.get(
  '/map',
  authenticate(true),
  asyncHandler(async (req, res) => {
    const { broker, token } = req.query;
    if (!broker || !token) {
      throw new HttpError(400, 'VALIDATION_FAILED', 'Broker and token are required');
    }

    const instrument = await Instrument.findOne({ [`broker_tokens.${broker}`]: token });
    if (!instrument) {
      throw new HttpError(404, 'NOT_FOUND', 'Instrument not found for broker token');
    }
    res.json({ data: instrument.toObject() });
  })
);

router.get(
  '/:id',
  authenticate(true),
  asyncHandler(async (req, res) => {
    const instrument = await Instrument.findById(req.params.id);
    if (!instrument) {
      throw new HttpError(404, 'NOT_FOUND', 'Instrument not found');
    }
    res.json({ data: instrument.toObject() });
  })
);

module.exports = router;