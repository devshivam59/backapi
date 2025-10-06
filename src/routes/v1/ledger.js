const express = require('express');
const asyncHandler = require('../../utils/asyncHandler');
const { authenticate, requireRoles } = require('../../middleware/auth');
const Ledger = require('../../models/Ledger');
const User = require('../../models/User');
const { HttpError } = require('../../utils/httpError');

const router = express.Router();

router.get(
  '/',
  authenticate(true),
  asyncHandler(async (req, res) => {
    const ledgerEntries = await Ledger.find({ user_id: req.user._id });
    res.json({ data: ledgerEntries.map(e => e.toObject()) });
  })
);

router.post(
  '/adjustment',
  authenticate(true),
  requireRoles('admin'),
  asyncHandler(async (req, res) => {
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

    const user = await User.findById(userId);
    if (!user) {
        throw new HttpError(404, 'NOT_FOUND', 'User not found');
    }

    const adjustment = normalizedType === 'DEBIT' ? -numericAmount : numericAmount;
    user.fundsBalance += adjustment;

    await Ledger.create({
        user_id: userId,
        ref: `adj_${Date.now()}`,
        type: normalizedType,
        debit: normalizedType === 'DEBIT' ? numericAmount : 0,
        credit: normalizedType === 'CREDIT' ? numericAmount : 0,
        balance: user.fundsBalance,
        note: note || 'Admin Adjustment'
    });

    await user.save();

    res.json({ data: { success: true } });
  })
);

module.exports = router;