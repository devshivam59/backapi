const express = require('express');
const asyncHandler = require('../../utils/asyncHandler');
const { authenticate, requireRoles } = require('../../middleware/auth');
const { getState, withState, createId } = require('../../store/dataStore');
const { HttpError } = require('../../utils/httpError');

const router = express.Router();

router.get(
  '/',
  authenticate(true),
  asyncHandler((req, res) => {
    const { notifications } = getState();
    const filtered = notifications.filter((notification) =>
      !notification.user_id || notification.user_id === req.user.id
    );
    res.json({ data: filtered });
  })
);

router.post(
  '/',
  authenticate(true),
  requireRoles('admin'),
  asyncHandler((req, res) => {
    const { user_id: userId = null, title, body, segment } = req.body;
    if (!title || !body) {
      throw new HttpError(400, 'VALIDATION_FAILED', 'title and body are required');
    }
    const now = new Date().toISOString();
    const notification = {
      id: createId('notif'),
      user_id: userId,
      title,
      body,
      segment: segment || null,
      read: false,
      createdAt: now
    };
    withState((state) => {
      state.notifications.push(notification);
    });
    res.status(201).json({ data: notification });
  })
);

module.exports = router;
