const User = require('../models/User');
const Order = require('../models/Order');
const Trade = require('../models/Trade');
const zerodhaService = require('../services/zerodhaServiceInstance');

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

exports.updateZerodhaCredentials = async (req, res, next) => {
  try {
    const { apiKey, apiSecret } = req.body;

    if (!apiKey || !apiSecret) {
      return res.status(400).json({ message: 'apiKey and apiSecret are required' });
    }

    const result = await zerodhaService.updateCredentials({ apiKey, apiSecret });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

exports.generateZerodhaAccessToken = async (req, res, next) => {
  try {
    const { requestToken } = req.body;

    if (!requestToken) {
      return res.status(400).json({ message: 'requestToken is required' });
    }

    const tokenData = await zerodhaService.generateAccessToken(requestToken);

    res.json({
      message: 'Access token generated successfully',
      ...tokenData
    });
  } catch (error) {
    next(error);
  }
};

exports.refreshZerodhaAccessToken = async (req, res, next) => {
  try {
    const result = await zerodhaService.refreshAccessToken({ reason: 'manual' });

    res.json({
      message: 'Access token refreshed successfully',
      ...result
    });
  } catch (error) {
    next(error);
  }
};

exports.setZerodhaAccessToken = async (req, res, next) => {
  try {
    const {
      accessToken,
      userId,
      userName,
      userShortName,
      email,
      publicToken,
      loginTime,
      generatedAt,
      skipValidation = false,
      forceTickerConnect = false
    } = req.body;

    if (!accessToken) {
      return res.status(400).json({ message: 'accessToken is required' });
    }

    const skipValidationFlag = skipValidation === true || skipValidation === 'true';
    const forceTickerConnectFlag = forceTickerConnect === true || forceTickerConnect === 'true';

    const result = await zerodhaService.setManualAccessToken({
      accessToken,
      userId,
      userName,
      userShortName,
      email,
      publicToken,
      loginTime,
      generatedAt,
      skipValidation: skipValidationFlag,
      forceTickerConnect: forceTickerConnectFlag
    });

    res.json({
      message: skipValidationFlag
        ? 'Access token stored without validation'
        : 'Access token validated and stored successfully',
      ...result
    });
  } catch (error) {
    next(error);
  }
};

exports.getZerodhaStatus = async (req, res, next) => {
  try {
    const status = await zerodhaService.getCredentialStatus();
    res.json(status);
  } catch (error) {
    next(error);
  }
};
