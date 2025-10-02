const express = require('express');
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const asyncHandler = require('../../utils/asyncHandler');
const { HttpError } = require('../../utils/httpError');
const { authenticate, requireRoles } = require('../../middleware/auth');
const { getState, withState, createId } = require('../../store/dataStore');

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
  asyncHandler((req, res) => {
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

    const startedAt = new Date().toISOString();
    const runId = createId('import');
    let rowsOk = 0;
    const rejects = [];

    withState((state) => {
      const { instruments } = state;
      records.forEach((row, index) => {
        const tradingSymbol = normalise(row.tradingsymbol || row.trading_symbol || row.symbol);
        if (!tradingSymbol) {
          rejects.push({ index, reason: 'Missing tradingsymbol' });
          return;
        }
        const exchange = normalise(row.exchange) || 'NSE';
        const segment = normalise(row.segment) || exchange;
        const type = normalise(row.instrument_type || row.type) || 'stock';
        const lotSize = Number(row.lot_size || row.lotsize || 1);
        const tickSize = Number(row.tick_size || row.ticksize || 0.05);
        const expiry = normalise(row.expiry) || null;
        const strike = row.strike ? Number(row.strike) : null;
        const name = normalise(row.name) || tradingSymbol;
        const brokerToken = normalise(row.instrument_token || row.token || row.broker_token);

        const existing = instruments.find((item) => item.tradingsymbol === tradingSymbol && item.exchange === exchange);
        const now = new Date().toISOString();
        if (existing) {
          existing.name = name;
          existing.segment = segment;
          existing.type = type;
          existing.lot_size = lotSize;
          existing.tick_size = tickSize;
          existing.expiry = expiry;
          existing.strike = strike;
          existing.updatedAt = now;
          existing.broker_tokens = {
            ...(existing.broker_tokens || {}),
            [source]: brokerToken || existing.broker_tokens?.[source]
          };
        } else {
          instruments.push({
            id: createId('ins'),
            name,
            symbol: tradingSymbol,
            tradingsymbol: tradingSymbol,
            exchange,
            segment,
            type,
            lot_size: lotSize,
            tick_size: tickSize,
            expiry,
            strike,
            broker_tokens: brokerToken ? { [source]: brokerToken } : {},
            metadata: row,
            createdAt: now,
            updatedAt: now
          });
        }
        rowsOk += 1;
      });

      state.instrumentImportRuns.push({
        id: runId,
        source,
        startedAt,
        finishedAt: new Date().toISOString(),
        rowsIn: records.length,
        rowsOk,
        rowsErr: rejects.length,
        rejects
      });
    });

    res.status(202).json({
      data: {
        run_id: runId,
        rows_in: records.length,
        rows_ok: rowsOk,
        rows_err: rejects.length,
        rejects
      }
    });
  })
);

router.get(
  '/imports',
  authenticate(true),
  requireRoles('admin'),
  asyncHandler((_req, res) => {
    const { instrumentImportRuns } = getState();
    res.json({ data: instrumentImportRuns });
  })
);

router.get(
  '/imports/:id',
  authenticate(true),
  requireRoles('admin'),
  asyncHandler((req, res) => {
    const { instrumentImportRuns } = getState();
    const run = instrumentImportRuns.find((item) => item.id === req.params.id);
    if (!run) {
      throw new HttpError(404, 'NOT_FOUND', 'Import run not found');
    }
    res.json({ data: run });
  })
);

router.post(
  '/sources',
  authenticate(true),
  requireRoles('admin'),
  asyncHandler((req, res) => {
    const { name, type, config, schedule_cron } = req.body;
    if (!name || !type) {
      throw new HttpError(400, 'VALIDATION_FAILED', 'Name and type are required');
    }
    const now = new Date().toISOString();
    const source = {
      id: createId('source'),
      name,
      type,
      config: config || {},
      schedule_cron: schedule_cron || null,
      enabled: true,
      createdAt: now,
      updatedAt: now
    };

    withState((state) => {
      state.instrumentSources.push(source);
    });

    res.status(201).json({ data: source });
  })
);

router.get(
  '/sources',
  authenticate(true),
  requireRoles('admin'),
  asyncHandler((_req, res) => {
    const { instrumentSources } = getState();
    res.json({ data: instrumentSources });
  })
);

router.put(
  '/sources/:id',
  authenticate(true),
  requireRoles('admin'),
  asyncHandler((req, res) => {
    const updates = req.body;
    let updated;
    withState((state) => {
      const source = state.instrumentSources.find((item) => item.id === req.params.id);
      if (!source) {
        throw new HttpError(404, 'NOT_FOUND', 'Instrument source not found');
      }
      Object.assign(source, updates, { updatedAt: new Date().toISOString() });
      updated = source;
    });
    res.json({ data: updated });
  })
);

router.post(
  '/sources/:id/run-now',
  authenticate(true),
  requireRoles('admin'),
  asyncHandler((req, res) => {
    const { instrumentSources } = getState();
    const source = instrumentSources.find((item) => item.id === req.params.id);
    if (!source) {
      throw new HttpError(404, 'NOT_FOUND', 'Instrument source not found');
    }
    const job = {
      id: createId('job'),
      sourceId: source.id,
      enqueuedAt: new Date().toISOString(),
      status: 'queued'
    };
    withState((state) => {
      state.automationJobs.push(job);
    });
    res.status(202).json({ data: job });
  })
);

router.get(
  '/',
  authenticate(true),
  asyncHandler((req, res) => {
    const { q, segment, exchange, type, limit = 20, cursor } = req.query;
    const { instruments } = getState();

    let filtered = instruments;
    if (q) {
      const term = q.toLowerCase();
      filtered = filtered.filter((instrument) =>
        [instrument.name, instrument.tradingsymbol, instrument.symbol]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(term))
      );
    }
    if (segment) {
      filtered = filtered.filter((instrument) => instrument.segment === segment);
    }
    if (exchange) {
      filtered = filtered.filter((instrument) => instrument.exchange === exchange);
    }
    if (type) {
      filtered = filtered.filter((instrument) => instrument.type === type);
    }

    const offset = cursor ? parseInt(Buffer.from(cursor, 'base64').toString('utf8'), 10) : 0;
    const sliced = filtered.slice(offset, offset + Number(limit));
    const nextCursor = offset + Number(limit) < filtered.length ? Buffer.from(String(offset + Number(limit))).toString('base64') : null;

    res.json({
      data: sliced,
      paging: {
        next_cursor: nextCursor,
        total: filtered.length
      }
    });
  })
);

router.get(
  '/map',
  authenticate(true),
  asyncHandler((req, res) => {
    const { broker, token } = req.query;
    if (!broker || !token) {
      throw new HttpError(400, 'VALIDATION_FAILED', 'Broker and token are required');
    }
    const { instruments } = getState();
    const instrument = instruments.find((item) => (item.broker_tokens || {})[broker] === token);
    if (!instrument) {
      throw new HttpError(404, 'NOT_FOUND', 'Instrument not found for broker token');
    }
    res.json({ data: instrument });
  })
);

router.get(
  '/:id',
  authenticate(true),
  asyncHandler((req, res) => {
    const { instruments } = getState();
    const instrument = instruments.find((item) => item.id === req.params.id);
    if (!instrument) {
      throw new HttpError(404, 'NOT_FOUND', 'Instrument not found');
    }
    res.json({ data: instrument });
  })
);

module.exports = router;
