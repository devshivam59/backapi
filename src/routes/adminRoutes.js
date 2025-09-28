const express = require('express');
const { auth, authorizeAdmin } = require('../middleware/auth');
const adminController = require('../controllers/adminController');

const router = express.Router();

router.use(auth, authorizeAdmin);
router.get('/users', adminController.listUsers);
router.put('/users/:id/block', adminController.toggleBlockUser);
router.get('/monitor/orders', adminController.monitorOrders);

module.exports = router;
