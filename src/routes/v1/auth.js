const express = require('express');
const { authenticate, issueToken, hashPassword, verifyPassword } = require('../../middleware/auth');
const { HttpError } = require('../../utils/httpError');
const asyncHandler = require('../../utils/asyncHandler');
const { getState, withState, createId } = require('../../store/dataStore');

const router = express.Router();

function sanitizeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    roles: user.roles,
    profile: user.profile || {},
    approved: Boolean(user.approved),
    isBlocked: Boolean(user.isBlocked),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

router.post(
  '/register',
  asyncHandler((req, res) => {
    const { name, email, password, roles } = req.body;
    if (!name || !email || !password) {
      throw new HttpError(400, 'VALIDATION_FAILED', 'Name, email, and password are required');
    }

    const { users, walletAccounts } = getState();
    if (users.some((user) => user.email === email.toLowerCase())) {
      throw new HttpError(409, 'EMAIL_EXISTS', 'Email already registered');
    }

    const now = new Date().toISOString();
    const id = createId('usr');
    const user = {
      id,
      name,
      email: email.toLowerCase(),
      passwordHash: hashPassword(password),
      roles: Array.isArray(roles) && roles.length ? roles : ['client'],
      profile: {},
      isBlocked: false,
      approved: false,
      createdAt: now,
      updatedAt: now
    };

    withState((state) => {
      state.users.push(user);
      if (!state.walletAccounts[id]) {
        state.walletAccounts[id] = {
          balance: 0,
          margin: 0,
          collateral: 0,
          updatedAt: now
        };
      }
      state.auditLogs.push({
        id: createId('audit'),
        actor_user_id: id,
        action: 'auth.register',
        entity: 'user',
        entity_id: id,
        patch: null,
        ts: now
      });
    });

    const token = issueToken(user);
    res.status(201).json({
      data: {
        token,
        user: sanitizeUser(user)
      }
    });
  })
);

router.post(
  '/login',
  asyncHandler((req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      throw new HttpError(400, 'VALIDATION_FAILED', 'Email and password are required');
    }

    const { users } = getState();
    const user = users.find((item) => item.email === email.toLowerCase());
    if (!user || !verifyPassword(password, user.passwordHash)) {
      throw new HttpError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    if (user.isBlocked) {
      throw new HttpError(403, 'ACCESS_DENIED', 'Account blocked');
    }

    const token = issueToken(user);
    const now = new Date().toISOString();
    withState((state) => {
      state.sessions.push({
        id: createId('session'),
        userId: user.id,
        token,
        createdAt: now,
        revokedAt: null
      });
    });

    res.json({
      data: {
        token,
        user: sanitizeUser(user)
      }
    });
  })
);

router.post(
  '/logout',
  authenticate(true),
  asyncHandler((req, res) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.substring(7) : null;
    const now = new Date().toISOString();

    withState((state) => {
      const session = state.sessions.find((item) => item.token === token);
      if (session) {
        session.revokedAt = now;
      }
    });

    res.json({ data: { success: true } });
  })
);

router.get(
  '/me',
  authenticate(true),
  asyncHandler((req, res) => {
    res.json({ data: sanitizeUser(req.user) });
  })
);

router.put(
  '/me',
  authenticate(true),
  asyncHandler((req, res) => {
    const allowed = ['name', 'phone', 'address', 'pan'];
    const updates = {};
    allowed.forEach((field) => {
      if (typeof req.body[field] !== 'undefined') {
        updates[field] = req.body[field];
      }
    });

    withState((state) => {
      const user = state.users.find((item) => item.id === req.user.id);
      if (!user) {
        throw new HttpError(404, 'NOT_FOUND', 'User not found');
      }
      if (updates.name) {
        user.name = updates.name;
      }
      user.profile = {
        ...(user.profile || {}),
        phone: updates.phone ?? user.profile?.phone,
        address: updates.address ?? user.profile?.address,
        pan: updates.pan ?? user.profile?.pan
      };
      user.updatedAt = new Date().toISOString();
    });

    const { users } = getState();
    const updated = users.find((item) => item.id === req.user.id);
    res.json({ data: sanitizeUser(updated) });
  })
);

router.post(
  '/password/change',
  authenticate(true),
  asyncHandler((req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      throw new HttpError(400, 'VALIDATION_FAILED', 'Current and new passwords are required');
    }

    const { users } = getState();
    const user = users.find((item) => item.id === req.user.id);
    if (!user || !verifyPassword(currentPassword, user.passwordHash)) {
      throw new HttpError(400, 'INVALID_CREDENTIALS', 'Current password is incorrect');
    }

    withState((state) => {
      const target = state.users.find((item) => item.id === req.user.id);
      target.passwordHash = hashPassword(newPassword);
      target.updatedAt = new Date().toISOString();
    });

    res.json({ data: { success: true } });
  })
);

router.post(
  '/password/reset',
  asyncHandler((req, res) => {
    const { email, token, newPassword } = req.body;
    const now = new Date().toISOString();

    if (token && newPassword) {
      const { passwordResets, users } = getState();
      const record = passwordResets.find((item) => item.token === token && !item.usedAt);
      if (!record) {
        throw new HttpError(400, 'INVALID_TOKEN', 'Reset token invalid or already used');
      }
      if (new Date(record.expiresAt) < new Date()) {
        throw new HttpError(400, 'TOKEN_EXPIRED', 'Reset token expired');
      }
      const user = users.find((item) => item.id === record.userId);
      if (!user) {
        throw new HttpError(404, 'NOT_FOUND', 'User not found');
      }
      withState((state) => {
        const target = state.users.find((item) => item.id === record.userId);
        target.passwordHash = hashPassword(newPassword);
        target.updatedAt = now;
        const resetRecord = state.passwordResets.find((item) => item.token === token);
        resetRecord.usedAt = now;
      });

      res.json({ data: { success: true } });
      return;
    }

    if (!email) {
      throw new HttpError(400, 'VALIDATION_FAILED', 'Email is required to initiate reset');
    }

    const { users } = getState();
    const user = users.find((item) => item.email === email.toLowerCase());
    if (!user) {
      throw new HttpError(404, 'NOT_FOUND', 'User not found');
    }

    const resetToken = createId('reset');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    withState((state) => {
      state.passwordResets.push({
        id: createId('resetreq'),
        userId: user.id,
        token: resetToken,
        createdAt: now,
        expiresAt,
        usedAt: null
      });
    });

    res.json({
      data: {
        token: resetToken,
        expiresAt
      }
    });
  })
);

router.get(
  '/roles',
  authenticate(true),
  asyncHandler((req, res) => {
    res.json({ data: { roles: req.user.roles || [] } });
  })
);

module.exports = router;
