const { HttpError } = require('../utils/httpError');
const Instrument = require('../models/Instrument');
const { getState, withState } = require('../store/dataStore'); // Keep for market snapshots

async function getInstrument(instrumentId) {
  const instrument = await Instrument.findById(instrumentId);
  if (!instrument) {
    throw new HttpError(404, 'NOT_FOUND', 'Instrument not found');
  }
  return instrument;
}

function ensureSnapshot(instrumentId) {
  const state = getState();
  let snapshot = state.marketSnapshots[instrumentId];
  if (!snapshot) {
    snapshot = createSnapshot();
  } else {
    snapshot = { ...snapshot, ...jitterSnapshot(snapshot) };
  }
  withState((s) => {
    s.marketSnapshots[instrumentId] = snapshot;
  });
  return snapshot;
}

function createSnapshot() {
  const base = 100 + Math.random() * 900;
  const price = Number(base.toFixed(2));
  return {
    ltp: price,
    bid: [[Number((price - 0.1).toFixed(2)), 100]],
    ask: [[Number((price + 0.1).toFixed(2)), 100]],
    depth: {
      buy: [[Number((price - 0.1).toFixed(2)), 100]],
      sell: [[Number((price + 0.1).toFixed(2)), 100]]
    },
    ohlc: buildOhlc(price),
    updatedAt: new Date().toISOString()
  };
}

function jitterSnapshot(snapshot) {
  const delta = (Math.random() - 0.5) * 2;
  const ltp = Number((snapshot.ltp + delta).toFixed(2));
  const bidPrice = Number((ltp - 0.1).toFixed(2));
  const askPrice = Number((ltp + 0.1).toFixed(2));
  return {
    ltp,
    bid: [[bidPrice, 100 + Math.floor(Math.random() * 10)]],
    ask: [[askPrice, 100 + Math.floor(Math.random() * 10)]],
    depth: {
      buy: [[bidPrice, 100 + Math.floor(Math.random() * 10)]],
      sell: [[askPrice, 100 + Math.floor(Math.random() * 10)]]
    },
    updatedAt: new Date().toISOString()
  };
}

function buildOhlc(price) {
  return [
    {
      ts: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      open: Number((price - 2).toFixed(2)),
      high: Number((price + 3).toFixed(2)),
      low: Number((price - 3).toFixed(2)),
      close: Number((price - 1).toFixed(2))
    },
    {
      ts: new Date().toISOString(),
      open: Number((price - 1).toFixed(2)),
      high: Number((price + 2).toFixed(2)),
      low: Number((price - 2).toFixed(2)),
      close: price
    }
  ];
}

module.exports = {
  getInstrument,
  ensureSnapshot
};