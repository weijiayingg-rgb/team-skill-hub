const express = require('express');
const router = express.Router();
const trendingModel = require('../models/trending');
const resourceModel = require('../models/resources');

// GET /api/stats
router.get('/', (req, res, next) => {
  try {
    const stats = trendingModel.getStats();
    res.json({ success: true, data: stats });
  } catch (err) { next(err); }
});

module.exports = router;
