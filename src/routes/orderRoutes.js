const express = require('express');
const { body } = require('express-validator');
const { auth } = require('../middleware/auth');
const orderController = require('../controllers/orderController');

const router = express.Router();

router.post(
  '/',
  auth,
  [
    body('symbol').notEmpty().withMessage('Symbol is required'),
    body('side').isIn(['BUY', 'SELL']).withMessage('Side must be BUY or SELL'),
    body('quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
    body('price').optional().isFloat({ min: 0 }).withMessage('Price must be positive'),
  ],
  orderController.placeOrder
);
router.put('/:id', auth, orderController.modifyOrder);
router.delete('/:id', auth, orderController.cancelOrder);
router.get('/', auth, orderController.getOrders);

module.exports = router;
