const express = require('express');
const asyncHandler = require('../../utils/asyncHandler');
const { authenticate, requireRoles } = require('../../middleware/auth');
const { HttpError } = require('../../utils/httpError');
const { getState, withState, createId } = require('../../store/dataStore');

const router = express.Router();

router.use(authenticate(true), requireRoles('admin'));

router.get(
  '/orders',
  asyncHandler((req, res) => {
    const { orders } = getState();
    let filtered = orders;
    if (req.query.status) {
      filtered = filtered.filter((order) => order.status === req.query.status.toUpperCase());
    }
    if (req.query.user_id) {
      filtered = filtered.filter((order) => order.user_id === req.query.user_id);
    }
    res.json({ data: filtered });
  })
);

router.post(
  '/orders/:orderId/override',
  asyncHandler((req, res) => {
    const { orders } = getState();
    const order = orders.find((item) => item.id === req.params.orderId);
    if (!order) {
      throw new HttpError(404, 'NOT_FOUND', 'Order not found');
    }
    withState((state) => {
      const target = state.orders.find((item) => item.id === order.id);
      if (req.body.status) {
        target.status = req.body.status.toUpperCase();
      }
      target.updatedAt = new Date().toISOString();
      state.auditLogs.push({
        id: createId('audit'),
        actor_user_id: req.user.id,
        action: 'admin.order.override',
        entity: 'order',
        entity_id: order.id,
        patch: req.body,
        ts: new Date().toISOString()
      });
    });
    const updated = getState().orders.find((item) => item.id === order.id);
    res.json({ data: updated });
  })
);

router.get(
  '/users',
  asyncHandler((req, res) => {
    const { users } = getState();
    const term = (req.query.search || '').toLowerCase();
    const filtered = term
      ? users.filter((user) => user.email.toLowerCase().includes(term) || user.name.toLowerCase().includes(term))
      : users;
    res.json({ data: filtered.map(sanitizeUser) });
  })
);

router.get(
  '/users/:userId',
  asyncHandler((req, res) => {
    const { users } = getState();
    const user = users.find((item) => item.id === req.params.userId);
    if (!user) {
      throw new HttpError(404, 'NOT_FOUND', 'User not found');
    }
    res.json({ data: sanitizeUser(user) });
  })
);

router.put(
  '/users/:userId/approve',
  asyncHandler((req, res) => {
    withState((state) => {
      const user = state.users.find((item) => item.id === req.params.userId);
      if (!user) {
        throw new HttpError(404, 'NOT_FOUND', 'User not found');
      }
      user.approved = Boolean(req.body.approved);
      user.approval_note = req.body.note || null;
      user.updatedAt = new Date().toISOString();
    });
    const { users } = getState();
    const user = users.find((item) => item.id === req.params.userId);
    res.json({ data: sanitizeUser(user) });
  })
);

router.put(
  '/users/:userId/roles',
  asyncHandler((req, res) => {
    const roles = req.body.roles;
    if (!Array.isArray(roles) || roles.length === 0) {
      throw new HttpError(400, 'VALIDATION_FAILED', 'roles array required');
    }
    withState((state) => {
      const user = state.users.find((item) => item.id === req.params.userId);
      if (!user) {
        throw new HttpError(404, 'NOT_FOUND', 'User not found');
      }
      user.roles = roles;
      user.updatedAt = new Date().toISOString();
    });
    const user = getState().users.find((item) => item.id === req.params.userId);
    res.json({ data: sanitizeUser(user) });
  })
);

router.get(
  '/positions',
  asyncHandler((req, res) => {
    const { positions } = getState();
    const filtered = req.query.user_id ? positions.filter((p) => p.user_id === req.query.user_id) : positions;
    res.json({ data: filtered });
  })
);

router.post(
  '/positions',
  asyncHandler((req, res) => {
    const { user_id: userId, instrument_id: instrumentId, side, qty, avg_price: avgPrice, product, as_of_date } =
      req.body;
    if (!userId || !instrumentId || !qty || !avgPrice) {
      throw new HttpError(400, 'VALIDATION_FAILED', 'Missing required fields');
    }
    const now = new Date().toISOString();
    const position = {
      id: createId('pos'),
      user_id: userId,
      instrument_id: instrumentId,
      side: side || 'LONG',
      qty: Number(qty),
      avg_price: Number(avgPrice),
      product: product || 'NRML',
      createdAt: now,
      updatedAt: now,
      as_of_date: as_of_date || now
    };
    withState((state) => {
      state.positions.push(position);
      state.auditLogs.push({
        id: createId('audit'),
        actor_user_id: req.user.id,
        action: 'admin.position.create',
        entity: 'position',
        entity_id: position.id,
        patch: position,
        ts: now
      });
    });
    res.status(201).json({ data: position });
  })
);

router.put(
  '/positions/:positionId',
  asyncHandler((req, res) => {
    withState((state) => {
      const position = state.positions.find((item) => item.id === req.params.positionId);
      if (!position) {
        throw new HttpError(404, 'NOT_FOUND', 'Position not found');
      }
      const before = { ...position };
      if (typeof req.body.qty !== 'undefined') {
        position.qty = Number(req.body.qty);
      }
      if (typeof req.body.avg_price !== 'undefined') {
        position.avg_price = Number(req.body.avg_price);
      }
      position.updatedAt = new Date().toISOString();
      state.auditLogs.push({
        id: createId('audit'),
        actor_user_id: req.user.id,
        action: 'admin.position.update',
        entity: 'position',
        entity_id: position.id,
        patch: { before, after: position },
        ts: new Date().toISOString()
      });
    });
    const { positions } = getState();
    const updated = positions.find((item) => item.id === req.params.positionId);
    res.json({ data: updated });
  })
);

router.delete(
  '/positions/:positionId',
  asyncHandler((req, res) => {
    withState((state) => {
      state.positions = state.positions.filter((item) => item.id !== req.params.positionId);
      state.auditLogs.push({
        id: createId('audit'),
        actor_user_id: req.user.id,
        action: 'admin.position.delete',
        entity: 'position',
        entity_id: req.params.positionId,
        patch: null,
        ts: new Date().toISOString()
      });
    });
    res.status(204).send();
  })
);

router.get(
  '/brokers/zerodha/token',
  asyncHandler((_req, res) => {
    const { zerodha } = getState();
    res.json({ data: zerodha });
  })
);

router.post(
  '/brokers/zerodha/session/complete',
  asyncHandler((req, res) => {
    const { request_token: requestToken } = req.body;
    if (!requestToken) {
      throw new HttpError(400, 'VALIDATION_FAILED', 'request_token is required');
    }
    const now = new Date();
    const accessToken = `access_${requestToken}_${Date.now()}`;
    const validTill = new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString();
    withState((state) => {
      state.zerodha = {
        accessToken,
        validTill,
        profile: {
          user_id: 'MOCKUSER',
          email: 'mock@example.com'
        },
        source: 'manual_session',
        updatedAt: now.toISOString()
      };
    });
    res.json({
      data: {
        access_token: accessToken,
        valid_till: validTill
      }
    });
  })
);

router.post(
  '/brokers/zerodha/test',
  asyncHandler((_req, res) => {
    const { zerodha } = getState();
    const healthy = Boolean(zerodha.accessToken);
    res.json({ data: { healthy, checked_at: new Date().toISOString() } });
  })
);

function sanitizeUser(user) {
  if (!user) return null;
  const { passwordHash, ...rest } = user;
  return rest;
}

module.exports = router;
