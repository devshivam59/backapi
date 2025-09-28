const express = require('express');
const { auth } = require('../middleware/auth');
const portfolioController = require('../controllers/portfolioController');

const router = express.Router();

router.get('/holdings', auth, portfolioController.getHoldings);
router.get('/positions', auth, portfolioController.getPositions);
router.get('/pnl', auth, portfolioController.getPnlSummary);

module.exports = router;
