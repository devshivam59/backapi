const express = require('express');
const asyncHandler = require('../../utils/asyncHandler');
const { authenticate, requireRoles } = require('../../middleware/auth');
const idempotency = require('../../middleware/idempotency');
const { getState, withState, createId } = require('../../store/dataStore');
const { HttpError } = require('../../utils/httpError');

const router = express.Router();

router.get(
  '/',
  authenticate(true),
  asyncHandler((req, res) => {
    const { walletAccounts } = getState();
    const account = walletAccounts[req.user.id] || { balance: 0, margin: 0, collateral: 0 };
    res.json({ data: account });
  })
);

router.get(
  '/transactions',
  authenticate(true),
  asyncHandler((req, res) => {
    const { walletTransactions } = getState();
    const filtered = walletTransactions.filter((txn) => txn.user_id === req.user.id);
    res.json({ data: filtered });
  })
);

router.post(
  '/credit',
  authenticate(true),
  requireRoles('admin'),
  idempotency('wallet:credit'),
  asyncHandler((req, res) => {
    const { user_id: userId = req.user.id, amount, note } = req.body;
    applyWalletAdjustment(userId, Number(amount), 'credit', note || 'Manual credit');
    const payload = { data: { success: true } };
    res.locals.persistIdempotentResponse?.(200, payload);
    res.json(payload);
  })
);

router.post(
  '/debit',
  authenticate(true),
  requireRoles('admin'),
  idempotency('wallet:debit'),
  asyncHandler((req, res) => {
    const { user_id: userId = req.user.id, amount, note } = req.body;
    applyWalletAdjustment(userId, Number(amount), 'debit', note || 'Manual debit');
    const payload = { data: { success: true } };
    res.locals.persistIdempotentResponse?.(200, payload);
    res.json(payload);
  })
);

function applyWalletAdjustment(userId, amount, type, note) {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new HttpError(400, 'VALIDATION_FAILED', 'Amount must be positive');
  }
  const now = new Date().toISOString();
  withState((state) => {
    if (!state.walletAccounts[userId]) {
      state.walletAccounts[userId] = { balance: 0, margin: 0, collateral: 0, updatedAt: now };
    }
    const account = state.walletAccounts[userId];
    if (type === 'credit') {
      account.balance += amount;
    } else {
      account.balance -= amount;
    }
    account.balance = Number(account.balance.toFixed(2));
    account.updatedAt = now;
    state.walletTransactions.push({
      id: createId('wallet_txn'),
      user_id: userId,
      type,
      amount,
      ref: createId('wallet_ref'),
      note,
      createdAt: now
    });
  });
}

module.exports = router;
