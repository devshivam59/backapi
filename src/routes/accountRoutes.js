const express = require('express');
const { body } = require('express-validator');
const { auth } = require('../middleware/auth');
const accountController = require('../controllers/accountController');

const router = express.Router();

router.get('/funds', auth, accountController.getFunds);
router.post(
  '/funds/add',
  auth,
  [body('amount').isFloat({ min: 1 }).withMessage('Amount must be at least 1')],
  accountController.addFunds
);
router.get('/transactions', auth, accountController.getTransactions);

module.exports = router;
