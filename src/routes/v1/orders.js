const express = require('express');
const asyncHandler = require('../../utils/asyncHandler');
const { HttpError } = require('../../utils/httpError');
const { authenticate } = require('../../middleware/auth');
const idempotency = require('../../middleware/idempotency');
const { placeOrder } = require('../../services/orderEngine');
const { getState, withState } = require('../../store/dataStore');

const router = express.Router();

router.post(
  '/',
  authenticate(true),
  idempotency('orders:create'),
  asyncHandler((req, res) => {
    const { order, trade } = placeOrder(req.user, req.body);
    const payload = { data: { order, trades: trade ? [trade] : [] } };
    if (res.locals.persistIdempotentResponse) {
      res.locals.persistIdempotentResponse(201, payload);
    }
    res.status(201).json(payload);
  })
);

router.get(
  '/',
  authenticate(true),
  asyncHandler((req, res) => {
    const { orders } = getState();
    const { status, from, to } = req.query;
    let filtered = orders.filter((order) => order.user_id === req.user.id);
    if (status) {
      filtered = filtered.filter((order) => order.status === status.toUpperCase());
    }
    if (from) {
      filtered = filtered.filter((order) => new Date(order.createdAt) >= new Date(from));
    }
    if (to) {
      filtered = filtered.filter((order) => new Date(order.createdAt) <= new Date(to));
    }
    res.json({ data: filtered });
  })
);

router.get(
  '/:orderId',
  authenticate(true),
  asyncHandler((req, res) => {
    const order = findUserOrder(req.user.id, req.params.orderId);
    res.json({ data: order });
  })
);

router.put(
  '/:orderId',
  authenticate(true),
  asyncHandler((req, res) => {
    const order = findUserOrder(req.user.id, req.params.orderId);
    if (order.status !== 'OPEN') {
      throw new HttpError(400, 'ORDER_NOT_MODIFIABLE', 'Only open orders can be modified');
    }
    withState((state) => {
      const target = state.orders.find((item) => item.id === order.id);
      if (typeof req.body.price !== 'undefined') {
        const price = Number(req.body.price);
        if (!Number.isFinite(price) || price <= 0) {
          throw new HttpError(400, 'VALIDATION_FAILED', 'Price must be positive');
        }
        target.price = price;
      }
      if (typeof req.body.qty !== 'undefined') {
        const qty = Number(req.body.qty);
        if (!Number.isFinite(qty) || qty <= 0) {
          throw new HttpError(400, 'VALIDATION_FAILED', 'Qty must be positive');
        }
        target.qty = qty;
      }
      target.updatedAt = new Date().toISOString();
    });
    const { orders } = getState();
    const updated = orders.find((item) => item.id === order.id);
    res.json({ data: updated });
  })
);

router.post(
  '/:orderId/cancel',
  authenticate(true),
  asyncHandler((req, res) => {
    const order = findUserOrder(req.user.id, req.params.orderId);
    if (order.status !== 'OPEN') {
      throw new HttpError(400, 'ORDER_NOT_CANCELABLE', 'Order cannot be cancelled');
    }
    withState((state) => {
      const target = state.orders.find((item) => item.id === order.id);
      target.status = 'CANCELLED';
      target.updatedAt = new Date().toISOString();
    });
    const { orders } = getState();
    const updated = orders.find((item) => item.id === order.id);
    res.json({ data: updated });
  })
);

router.get(
  '/:orderId/trades',
  authenticate(true),
  asyncHandler((req, res) => {
    const order = findUserOrder(req.user.id, req.params.orderId);
    const { trades } = getState();
    const filtered = trades.filter((trade) => trade.order_id === order.id);
    res.json({ data: filtered });
  })
);

function findUserOrder(userId, orderId) {
  const { orders } = getState();
  const order = orders.find((item) => item.id === orderId && item.user_id === userId);
  if (!order) {
    throw new HttpError(404, 'NOT_FOUND', 'Order not found');
  }
  return order;
}

module.exports = router;
