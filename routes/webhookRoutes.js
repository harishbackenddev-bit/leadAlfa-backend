// routes/webhookRoutes.js
const express = require('express');
const router = express.Router();
const { handleTradeSafeWebhook } = require('../controllers/webhookController');

router.post('/tradesafe', handleTradeSafeWebhook);

module.exports = router;