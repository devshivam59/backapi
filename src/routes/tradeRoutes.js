const express = require('express');
const { auth } = require('../middleware/auth');
const orderController = require('../controllers/orderController');

const router = express.Router();

router.get('/', auth, orderController.getTrades);

module.exports = router;
