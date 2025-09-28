const { validationResult } = require('express-validator');
const Order = require('../models/Order');
const Trade = require('../models/Trade');
const { executeOrder } = require('../services/orderService');

exports.placeOrder = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const result = await executeOrder(req.user, req.body);
    res.status(201).json({ order: result.order, trade: result.trade });
  } catch (error) {
    next(error);
  }
};

exports.modifyOrder = async (req, res, next) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, user: req.user._id });
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    if (order.status !== 'PENDING') {
      return res.status(400).json({ message: 'Only pending orders can be modified' });
    }
    const updates = ['quantity', 'price', 'validity', 'notes'];
    updates.forEach((field) => {
      if (req.body[field] !== undefined) {
        order[field] = req.body[field];
      }
    });
    await order.save();
    res.json(order);
  } catch (error) {
    next(error);
  }
};

exports.cancelOrder = async (req, res, next) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, user: req.user._id });
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    if (order.status === 'CANCELLED') {
      return res.status(400).json({ message: 'Order already cancelled' });
    }
    order.status = 'CANCELLED';
    await order.save();
    res.json({ message: 'Order cancelled', order });
  } catch (error) {
    next(error);
  }
};

exports.getOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({ user: req.user._id }).populate('instrument');
    res.json(orders);
  } catch (error) {
    next(error);
  }
};

exports.getTrades = async (req, res, next) => {
  try {
    const trades = await Trade.find({ user: req.user._id }).populate('instrument order');
    res.json(trades);
  } catch (error) {
    next(error);
  }
};
