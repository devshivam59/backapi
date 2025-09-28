const express = require('express');
const authRoutes = require('./authRoutes');
const marketRoutes = require('./marketRoutes');
const watchlistRoutes = require('./watchlistRoutes');
const orderRoutes = require('./orderRoutes');
const tradeRoutes = require('./tradeRoutes');
const portfolioRoutes = require('./portfolioRoutes');
const accountRoutes = require('./accountRoutes');
const adminRoutes = require('./adminRoutes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/market', marketRoutes);
router.use('/watchlist', watchlistRoutes);
router.use('/orders', orderRoutes);
router.use('/trades', tradeRoutes);
router.use('/portfolio', portfolioRoutes);
router.use('/account', accountRoutes);
router.use('/admin', adminRoutes);

module.exports = router;
