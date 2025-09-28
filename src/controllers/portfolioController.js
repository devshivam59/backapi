const Holding = require('../models/Holding');
const Instrument = require('../models/Instrument');
const Trade = require('../models/Trade');

const mapHoldingWithInstrument = async (holdings) => {
  const instrumentIds = holdings.map((h) => h.instrument);
  const instruments = await Instrument.find({ _id: { $in: instrumentIds } });
  const instrumentMap = instruments.reduce((acc, inst) => {
    acc[inst._id.toString()] = inst;
    return acc;
  }, {});

  return holdings.map((holding) => {
    const instrument = instrumentMap[holding.instrument.toString()];
    const markPrice = instrument?.lastPrice || holding.averagePrice;
    const pnl = (markPrice - holding.averagePrice) * holding.quantity;
    return {
      id: holding._id,
      instrument,
      quantity: holding.quantity,
      averagePrice: holding.averagePrice,
      markPrice,
      pnl,
    };
  });
};

exports.getHoldings = async (req, res, next) => {
  try {
    const holdings = await Holding.find({ user: req.user._id });
    const enriched = await mapHoldingWithInstrument(holdings);
    res.json(enriched);
  } catch (error) {
    next(error);
  }
};

exports.getPositions = async (req, res, next) => {
  try {
    const holdings = await Holding.find({ user: req.user._id });
    const enriched = await mapHoldingWithInstrument(holdings);
    const positions = enriched
      .filter((item) => item.quantity !== 0)
      .map((item) => ({
        instrument: item.instrument,
        side: item.quantity >= 0 ? 'LONG' : 'SHORT',
        quantity: Math.abs(item.quantity),
        averagePrice: item.averagePrice,
        markPrice: item.markPrice,
        pnl: item.pnl,
      }));
    res.json(positions);
  } catch (error) {
    next(error);
  }
};

exports.getPnlSummary = async (req, res, next) => {
  try {
    const holdings = await Holding.find({ user: req.user._id });
    const enriched = await mapHoldingWithInstrument(holdings);
    const realized = await Trade.aggregate([
      { $match: { user: req.user._id } },
      {
        $group: {
          _id: '$side',
          amount: { $sum: { $multiply: ['$quantity', '$price'] } },
        },
      },
    ]);
    const realizedMap = realized.reduce((acc, item) => {
      acc[item._id] = item.amount;
      return acc;
    }, {});
    const invested = enriched.reduce((sum, item) => sum + item.averagePrice * item.quantity, 0);
    const currentValue = enriched.reduce((sum, item) => sum + item.markPrice * item.quantity, 0);
    const unrealized = currentValue - invested;
    const realizedPnl = (realizedMap.SELL || 0) - (realizedMap.BUY || 0);
    res.json({ invested, currentValue, unrealized, realized: realizedPnl, total: unrealized + realizedPnl });
  } catch (error) {
    next(error);
  }
};
