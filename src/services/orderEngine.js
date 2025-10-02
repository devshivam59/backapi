const { HttpError } = require('../utils/httpError');
const { getState, withState, createId } = require('../store/dataStore');
const { getInstrument, ensureSnapshot } = require('./marketDataService');

function parseNumber(value, field) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) {
    throw new HttpError(400, 'VALIDATION_FAILED', `${field} must be a positive number`);
  }
  return num;
}

function placeOrder(user, payload) {
  const instrumentId = payload.instrument_id;
  if (!instrumentId) {
    throw new HttpError(400, 'VALIDATION_FAILED', 'instrument_id is required');
  }

  const instrument = getInstrument(instrumentId);
  const qty = parseNumber(payload.qty, 'qty');
  const side = (payload.side || '').toUpperCase();
  if (!['BUY', 'SELL'].includes(side)) {
    throw new HttpError(400, 'VALIDATION_FAILED', 'side must be BUY or SELL');
  }
  const orderType = (payload.order_type || 'market').toLowerCase();
  const product = (payload.product || 'CNC').toUpperCase();
  const validity = (payload.validity || 'DAY').toUpperCase();

  const snapshot = ensureSnapshot(instrument.id);
  let price = Number(payload.price || snapshot.ltp);
  if (orderType === 'market') {
    price = snapshot.ltp;
  }
  if (!Number.isFinite(price) || price <= 0) {
    throw new HttpError(400, 'VALIDATION_FAILED', 'price must be positive');
  }

  const now = new Date().toISOString();
  const orderId = createId('ord');
  const shouldFill = payload.execute_immediately !== false && orderType !== 'stop';

  const order = {
    id: orderId,
    user_id: user.id,
    instrument_id: instrument.id,
    side,
    qty,
    price: Number(price.toFixed(2)),
    filled_qty: shouldFill ? qty : 0,
    avg_price: shouldFill ? Number(price.toFixed(2)) : null,
    order_type: orderType.toUpperCase(),
    validity,
    product,
    status: shouldFill ? 'FILLED' : 'OPEN',
    createdAt: now,
    updatedAt: now,
    filledAt: shouldFill ? now : null,
    trigger_price: payload.trigger || null,
    disclosed_qty: payload.disclosed_qty || null
  };

  let trade = null;
  if (shouldFill) {
    trade = {
      id: createId('trade'),
      order_id: orderId,
      user_id: user.id,
      instrument_id: instrument.id,
      side,
      qty,
      price: order.avg_price,
      ts: now
    };
    applyFillEffects(user, instrument, order, trade);
  }

  withState((state) => {
    state.orders.push(order);
    if (trade) {
      state.trades.push(trade);
    }
  });

  return { order, trade };
}

function applyFillEffects(user, instrument, order, trade) {
  const gross = Number((trade.qty * trade.price).toFixed(2));
  const direction = order.side === 'BUY' ? 1 : -1;
  const now = new Date().toISOString();

  withState((state) => {
    if (!state.walletAccounts[user.id]) {
      state.walletAccounts[user.id] = {
        balance: 0,
        margin: 0,
        collateral: 0,
        updatedAt: now
      };
    }
    const account = state.walletAccounts[user.id];
    account.balance = Number((account.balance - direction * gross).toFixed(2));
    account.updatedAt = now;

    state.walletTransactions.push({
      id: createId('wallet_txn'),
      user_id: user.id,
      type: direction === 1 ? 'debit' : 'credit',
      amount: gross,
      ref: order.id,
      note: 'Order fill',
      createdAt: now
    });

    state.ledgerEntries.push({
      id: createId('ledger'),
      user_id: user.id,
      date: now,
      ref: order.id,
      type: direction === 1 ? 'DEBIT' : 'CREDIT',
      debit: direction === 1 ? gross : 0,
      credit: direction === -1 ? gross : 0,
      balance: account.balance,
      note: `${order.side} ${instrument.tradingsymbol}`
    });

    if (order.product === 'CNC') {
      updateHoldings(state, user.id, instrument.id, trade, direction, now);
    } else {
      updatePositions(state, user.id, instrument.id, order.product, trade, direction, now);
    }
  });
}

function updateHoldings(state, userId, instrumentId, trade, direction, now) {
  let holding = state.holdings.find((item) => item.user_id === userId && item.instrument_id === instrumentId);
  if (!holding) {
    holding = {
      id: createId('holding'),
      user_id: userId,
      instrument_id: instrumentId,
      qty: 0,
      avg_price: 0,
      last_price: trade.price,
      updatedAt: now
    };
    state.holdings.push(holding);
  }
  const newQty = holding.qty + direction * trade.qty;
  if (newQty <= 0) {
    holding.qty = 0;
    holding.avg_price = 0;
  } else {
    const totalCost = holding.avg_price * holding.qty + trade.price * trade.qty * direction;
    holding.qty = newQty;
    holding.avg_price = Number(Math.abs(totalCost / holding.qty).toFixed(2));
  }
  holding.last_price = trade.price;
  holding.updatedAt = now;
}

function updatePositions(state, userId, instrumentId, product, trade, direction, now) {
  let position = state.positions.find(
    (item) => item.user_id === userId && item.instrument_id === instrumentId && item.product === product
  );
  if (!position) {
    position = {
      id: createId('pos'),
      user_id: userId,
      instrument_id: instrumentId,
      product,
      qty: 0,
      avg_price: 0,
      createdAt: now,
      updatedAt: now,
      day_buy: 0,
      day_sell: 0
    };
    state.positions.push(position);
  }
  const signedQty = direction * trade.qty;
  position.qty += signedQty;
  position.day_buy += direction === 1 ? trade.qty : 0;
  position.day_sell += direction === -1 ? trade.qty : 0;
  if (position.qty === 0) {
    position.avg_price = 0;
  } else {
    const totalCost = position.avg_price * (position.qty - signedQty) + trade.price * signedQty;
    position.avg_price = Number((totalCost / position.qty).toFixed(2));
  }
  position.updatedAt = now;
}

module.exports = {
  placeOrder
};
