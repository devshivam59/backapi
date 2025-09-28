const mongoose = require('mongoose');
const Instrument = require('../models/Instrument');
const Order = require('../models/Order');
const Trade = require('../models/Trade');
const Holding = require('../models/Holding');
const Transaction = require('../models/Transaction');

const executeOrder = async (user, payload) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const instrument = await Instrument.findOne({ symbol: payload.symbol.toUpperCase() }).session(session);
    if (!instrument) {
      const err = new Error('Instrument not found');
      err.status = 404;
      throw err;
    }

    const price = payload.price || instrument.lastPrice || 1;
    const amount = price * payload.quantity;

    if (payload.side === 'BUY' && user.fundsBalance < amount) {
      const err = new Error('Insufficient funds');
      err.status = 400;
      throw err;
    }

    const [order] = await Order.create(
      [
        {
          user: user._id,
          instrument: instrument._id,
          side: payload.side,
          quantity: payload.quantity,
          price,
          orderType: payload.orderType,
          productType: payload.productType,
          validity: payload.validity,
          notes: payload.notes,
        },
      ],
      { session }
    );

    const [trade] = await Trade.create(
      [
        {
          user: user._id,
          order: order._id,
          instrument: instrument._id,
          side: payload.side,
          quantity: payload.quantity,
          price,
        },
      ],
      { session }
    );

    let fundsBalance = user.fundsBalance;
    if (payload.side === 'BUY') {
      fundsBalance -= amount;
    } else {
      fundsBalance += amount;
    }

    const holding = await Holding.findOne({ user: user._id, instrument: instrument._id }).session(session);

    if (payload.side === 'BUY') {
      const totalQuantity = (holding ? holding.quantity : 0) + payload.quantity;
      const totalCost = (holding ? holding.quantity * holding.averagePrice : 0) + amount;
      if (holding) {
        holding.quantity = totalQuantity;
        holding.averagePrice = totalCost / totalQuantity;
        await holding.save({ session });
      } else {
        await Holding.create(
          [
            {
              user: user._id,
              instrument: instrument._id,
              quantity: totalQuantity,
              averagePrice: totalCost / totalQuantity,
            },
          ],
          { session }
        );
      }
    } else if (payload.side === 'SELL') {
      if (!holding || holding.quantity < payload.quantity) {
        const err = new Error('Not enough quantity to sell');
        err.status = 400;
        throw err;
      }
      holding.quantity -= payload.quantity;
      if (holding.quantity === 0) {
        await holding.deleteOne({ session });
      } else {
        await holding.save({ session });
      }
    }

    const transactionType = payload.side === 'BUY' ? 'DEBIT' : 'CREDIT';
    await Transaction.create(
      [
        {
          user: user._id,
          type: transactionType,
          amount,
          balanceAfter: fundsBalance,
          description: `${payload.side} ${payload.quantity} ${instrument.symbol} @ ${price}`,
        },
      ],
      { session }
    );

    user.fundsBalance = fundsBalance;
    await user.save({ session });

    await session.commitTransaction();
    session.endSession();

    return { order, trade, instrument };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

module.exports = { executeOrder };
