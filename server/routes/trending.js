const express = require('express');
const router = express.Router();
const trendingModel = require('../models/trending');

// GET /api/trending
router.get('/', (req, res, next) => {
  try {
    const { period, type, limit } = req.query;
    const resources = trendingModel.getTrending({
      period: period || 'all',
      type: type || null,
      limit: parseInt(limit) || 20,
    });
    res.json({ success: true, data: resources });
  } catch (err) { next(err); }
});

// GET /api/trending/weekly
router.get('/weekly', (req, res, next) => {
  try {
    const { type, limit } = req.query;
    const resources = trendingModel.getTrending({
      period: 'weekly',
      type: type || null,
      limit: parseInt(limit) || 20,
    });
    res.json({ success: true, data: resources });
  } catch (err) { next(err); }
});

module.exports = router;
