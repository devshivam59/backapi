const express = require('express');
const multer = require('multer');
const { auth, authorizeAdmin } = require('../middleware/auth');
const marketController = require('../controllers/marketController');

const upload = multer({ dest: 'uploads/' });
const router = express.Router();

router.get('/instruments', marketController.searchInstruments);
router.get('/live/:symbol', marketController.getLivePrice);
router.post('/instruments/import', auth, authorizeAdmin, upload.single('file'), marketController.importInstruments);

module.exports = router;
