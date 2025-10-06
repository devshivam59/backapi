const express = require('express');
const asyncHandler = require('../../utils/asyncHandler');
const { HttpError } = require('../../utils/httpError');
const { authenticate } = require('../../middleware/auth');
const idempotency = require('../../middleware/idempotency');
const { placeOrder } = require('../../services/orderEngine');
const Order = require('../../models/Order');
const Trade = require('../../models/Trade');

const router = express.Router();

router.post(
  '/',
  authenticate(true),
  idempotency('orders:create'),
  asyncHandler(async (req, res) => {
    const { order, trade } = await placeOrder(req.user, { ...req.body, idempotency_key: res.locals.idempotencyRecordKey });
    const payload = { data: { order, trades: trade ? [trade] : [] } };

    if (res.locals.persistIdempotentResponse) {
      await res.locals.persistIdempotentResponse(201, payload);
    }

    res.status(201).json(payload);
  })
);

router.get(
  '/',
  authenticate(true),
  asyncHandler(async (req, res) => {
    const { status, from, to } = req.query;
    const query = { user_id: req.user._id };
    if (status) query.status = status.toUpperCase();
    if (from) query.createdAt = { ...query.createdAt, $gte: new Date(from) };
    if (to) query.createdAt = { ...query.createdAt, $lte: new Date(to) };

    const orders = await Order.find(query);
    res.json({ data: orders.map(o => o.toObject()) });
  })
);

router.get(
  '/:orderId',
  authenticate(true),
  asyncHandler(async (req, res) => {
    const order = await findUserOrder(req.user._id, req.params.orderId);
    res.json({ data: order.toObject() });
  })
);

router.put(
  '/:orderId',
  authenticate(true),
  asyncHandler(async (req, res) => {
    const order = await findUserOrder(req.user._id, req.params.orderId);
    if (order.status !== 'OPEN') {
      throw new HttpError(400, 'ORDER_NOT_MODIFIABLE', 'Only open orders can be modified');
    }

    if (typeof req.body.price !== 'undefined') {
        const price = Number(req.body.price);
        if (!Number.isFinite(price) || price <= 0) {
          throw new HttpError(400, 'VALIDATION_FAILED', 'Price must be positive');
        }
        order.price = price;
    }
    if (typeof req.body.qty !== 'undefined') {
        const qty = Number(req.body.qty);
        if (!Number.isFinite(qty) || qty <= 0) {
          throw new HttpError(400, 'VALIDATION_FAILED', 'Qty must be positive');
        }
        order.qty = qty;
    }

    await order.save();
    res.json({ data: order.toObject() });
  })
);

router.post(
  '/:orderId/cancel',
  authenticate(true),
  asyncHandler(async (req, res) => {
    const order = await findUserOrder(req.user._id, req.params.orderId);
    if (order.status !== 'OPEN') {
      throw new HttpError(400, 'ORDER_NOT_CANCELABLE', 'Order cannot be cancelled');
    }

    order.status = 'CANCELLED';
    await order.save();
    res.json({ data: order.toObject() });
  })
);

router.get(
  '/:orderId/trades',
  authenticate(true),
  asyncHandler(async (req, res) => {
    const order = await findUserOrder(req.user._id, req.params.orderId);
    const trades = await Trade.find({ order_id: order._id });
    res.json({ data: trades.map(t => t.toObject()) });
  })
);

async function findUserOrder(userId, orderId) {
  const order = await Order.findOne({ _id: orderId, user_id: userId });
  if (!order) {
    throw new HttpError(404, 'NOT_FOUND', 'Order not found');
  }
  return order;
}

module.exports = router;