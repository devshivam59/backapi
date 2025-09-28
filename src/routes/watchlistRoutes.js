const express = require('express');
const { body } = require('express-validator');
const { auth } = require('../middleware/auth');
const watchlistController = require('../controllers/watchlistController');

const router = express.Router();

router.post(
  '/',
  auth,
  [body('symbol').notEmpty().withMessage('Symbol is required')],
  watchlistController.addToWatchlist
);
router.delete('/:id', auth, watchlistController.removeFromWatchlist);
router.get('/', auth, watchlistController.getWatchlist);

module.exports = router;
