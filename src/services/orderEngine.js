const { HttpError } = require('../utils/httpError');
const { getInstrument, ensureSnapshot } = require('./marketDataService');
const Order = require('../models/Order');
const Trade = require('../models/Trade');
const Holding = require('../models/Holding');
const Position = require('../models/Position');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const Ledger = require('../models/Ledger');
const mongoose = require('mongoose');

function parseNumber(value, field) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) {
    throw new HttpError(400, 'VALIDATION_FAILED', `${field} must be a positive number`);
  }
  return num;
}

async function placeOrder(user, payload) {
  const instrumentId = payload.instrument_id;
  if (!instrumentId) {
    throw new HttpError(400, 'VALIDATION_FAILED', 'instrument_id is required');
  }

  const instrument = await getInstrument(instrumentId);
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

  const shouldFill = payload.execute_immediately !== false;

  const order = new Order({
    user_id: user._id,
    instrument_id: instrument._id,
    side,
    qty,
    price: Number(price.toFixed(2)),
    type: orderType.toUpperCase(),
    validity,
    product,
    status: shouldFill ? 'COMPLETE' : 'OPEN',
    filled_qty: shouldFill ? qty : 0,
    average_price: shouldFill ? Number(price.toFixed(2)) : 0,
    idempotency_key: payload.idempotency_key
  });

  let trade = null;
  if (shouldFill) {
    trade = new Trade({
      order_id: order._id,
      user_id: user._id,
      instrument_id: instrument._id,
      side,
      qty,
      price: order.average_price,
    });
  }

  await executeOrderPlacement(user, instrument, order, trade);

  return { order: order.toObject(), trade: trade ? trade.toObject() : null };
}

async function executeOrderPlacement(user, instrument, order, trade) {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await order.save({ session });

      if (trade) {
        await trade.save({ session });

        const gross = Number((trade.qty * trade.price).toFixed(2));
        const direction = order.side === 'BUY' ? 1 : -1;

        const updatedUser = await User.findByIdAndUpdate(
          user._id,
          { $inc: { fundsBalance: -direction * gross } },
          { session, new: true }
        );

        if (updatedUser.fundsBalance < 0) {
            throw new HttpError(400, 'INSUFFICIENT_FUNDS', 'Insufficient funds to place order');
        }

        await Transaction.create([{
          user_id: user._id,
          type: direction === 1 ? 'debit' : 'credit',
          amount: gross,
          ref: order._id.toString(),
          note: 'Order fill',
        }], { session });

        await Ledger.create([{
            user_id: user._id,
            ref: order._id.toString(),
            type: direction === 1 ? 'DEBIT' : 'CREDIT',
            debit: direction === 1 ? gross : 0,
            credit: direction === -1 ? gross : 0,
            balance: updatedUser.fundsBalance,
            note: `${order.side} ${instrument.tradingsymbol}`
        }], { session });

        if (order.product === 'CNC') {
          await updateHoldings(user._id, instrument._id, trade, direction, session);
        } else {
          await updatePositions(user._id, instrument._id, order.product, trade, direction, session);
        }
      }
    });
  } finally {
    session.endSession();
  }
}

async function updateHoldings(userId, instrumentId, trade, direction, session) {
    const holding = await Holding.findOne({ user: userId, instrument: instrumentId }).session(session);

    if (!holding) {
        if(direction > 0){
            await Holding.create([{
                user: userId,
                instrument: instrumentId,
                quantity: trade.qty,
                averagePrice: trade.price,
            }], { session });
        } else {
            throw new HttpError(400, 'NO_HOLDING', 'Cannot sell instrument not in holdings.');
        }
    } else {
        const newQty = holding.quantity + direction * trade.qty;
        if (newQty < 0) {
            throw new HttpError(400, 'INSUFFICIENT_HOLDING', 'Insufficient quantity in holdings to sell.');
        }

        const totalCost = (holding.averagePrice * holding.quantity) + (trade.price * trade.qty * direction);
        holding.quantity = newQty;
        holding.averagePrice = newQty > 0 ? Number(Math.abs(totalCost / newQty).toFixed(2)) : 0;

        await holding.save({ session });
    }
}

async function updatePositions(userId, instrumentId, product, trade, direction, session) {
    const signedQty = direction * trade.qty;

    const position = await Position.findOneAndUpdate(
        { user_id: userId, instrument_id: instrumentId, product: product },
        {
            $inc: {
                qty: signedQty,
                day_buy: direction === 1 ? trade.qty : 0,
                day_sell: direction === -1 ? trade.qty : 0,
            }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true, session }
    );

    if (position.qty !== 0) {
        const totalCost = (position.avg_price * (position.qty - signedQty)) + (trade.price * signedQty);
        position.avg_price = Number((totalCost / position.qty).toFixed(2));
    } else {
        position.avg_price = 0;
    }
    await position.save({ session });
}

module.exports = {
  placeOrder
};