const User = require('../models/User');
const Order = require('../models/Order');
const Trade = require('../models/Trade');

exports.listUsers = async (req, res, next) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (error) {
    next(error);
  }
};

exports.toggleBlockUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    user.isBlocked = !user.isBlocked;
    await user.save();
    res.json({ message: user.isBlocked ? 'User blocked' : 'User unblocked', user });
  } catch (error) {
    next(error);
  }
};

exports.monitorOrders = async (req, res, next) => {
  try {
    const orders = await Order.find().populate('instrument user').sort({ createdAt: -1 }).limit(100);
    const trades = await Trade.find().populate('instrument user order').sort({ createdAt: -1 }).limit(100);
    res.json({ orders, trades });
  } catch (error) {
    next(error);
  }
};
