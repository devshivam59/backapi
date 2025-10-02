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
    const { ledgerEntries } = getState();
    const filtered = ledgerEntries.filter((entry) => entry.user_id === req.user.id);
    res.json({ data: filtered });
  })
);

router.post(
  '/adjustment',
  authenticate(true),
  requireRoles('admin'),
  asyncHandler((req, res) => {
    const { user_id: userId, type, amount, note } = req.body;
    if (!userId || !type || !amount) {
      throw new HttpError(400, 'VALIDATION_FAILED', 'user_id, type, and amount are required');
    }
    const normalizedType = type.toUpperCase();
    if (!['DEBIT', 'CREDIT'].includes(normalizedType)) {
      throw new HttpError(400, 'VALIDATION_FAILED', 'type must be DEBIT or CREDIT');
    }
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      throw new HttpError(400, 'VALIDATION_FAILED', 'amount must be positive');
    }
    const now = new Date().toISOString();
    withState((state) => {
      const account = state.walletAccounts[userId] || { balance: 0, margin: 0, collateral: 0 };
      const balance =
        normalizedType === 'DEBIT' ? account.balance - numericAmount : account.balance + numericAmount;
      account.balance = Number(balance.toFixed(2));
      account.updatedAt = now;
      state.walletAccounts[userId] = account;
      state.ledgerEntries.push({
        id: createId('ledger'),
        user_id: userId,
        date: now,
        ref: createId('ledger_ref'),
        type: normalizedType,
        debit: normalizedType === 'DEBIT' ? numericAmount : 0,
        credit: normalizedType === 'CREDIT' ? numericAmount : 0,
        balance: account.balance,
        note: note || 'Adjustment'
      });
    });
    res.json({ data: { success: true } });
  })
);

module.exports = router;
