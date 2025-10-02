const express = require('express');
const authRoutes = require('./auth');
const instrumentRoutes = require('./instruments');
const marketRoutes = require('./market');
const watchlistRoutes = require('./watchlists');
const orderRoutes = require('./orders');
const portfolioRoutes = require('./portfolio');
const walletRoutes = require('./wallet');
const ledgerRoutes = require('./ledger');
const notificationRoutes = require('./notifications');
const adminRoutes = require('./admin');
const reportRoutes = require('./reports');
const systemRoutes = require('./system');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/instruments', instrumentRoutes);
router.use('/market', marketRoutes);
router.use('/watchlists', watchlistRoutes);
router.use('/orders', orderRoutes);
router.use('/portfolio', portfolioRoutes);
router.use('/wallet', walletRoutes);
router.use('/ledger', ledgerRoutes);
router.use('/notifications', notificationRoutes);
router.use('/admin', adminRoutes);
router.use('/reports', reportRoutes);
router.use('/', systemRoutes);

module.exports = router;
