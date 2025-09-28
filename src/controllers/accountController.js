const { validationResult } = require('express-validator');
const Transaction = require('../models/Transaction');

exports.getFunds = (req, res) => {
  res.json({ balance: req.user.fundsBalance });
};

exports.addFunds = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { amount } = req.body;
    req.user.fundsBalance += amount;
    await req.user.save();
    const transaction = await Transaction.create({
      user: req.user._id,
      type: 'ADD_FUNDS',
      amount,
      balanceAfter: req.user.fundsBalance,
      description: 'Virtual funds added',
    });
    res.status(201).json({ balance: req.user.fundsBalance, transaction });
  } catch (error) {
    next(error);
  }
};

exports.getTransactions = async (req, res, next) => {
  try {
    const transactions = await Transaction.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json(transactions);
  } catch (error) {
    next(error);
  }
};
