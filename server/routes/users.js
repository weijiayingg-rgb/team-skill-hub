const express = require('express');
const router = express.Router();
const userModel = require('../models/users');

// GET /api/users/me
router.get('/me', (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false, error: { code: 'UNAUTHORIZED', message: '未认证' },
      });
    }
    const user = userModel.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false, error: { code: 'NOT_FOUND', message: '用户不存在' },
      });
    }
    const stats = userModel.getStats(user.id);
    const resources = userModel.getResources(user.id);
    const favorites = userModel.getFavorites(user.id);
    const downloads = userModel.getDownloads(user.id);
    res.json({ success: true, data: { ...user, stats, resources, favorites, downloads } });
  } catch (err) {
    next(err);
  }
});

// GET /api/users/:id
router.get('/:id', (req, res, next) => {
  try {
    const user = userModel.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false, error: { code: 'NOT_FOUND', message: '用户不存在' },
      });
    }
    const stats = userModel.getStats(user.id);
    const resources = userModel.getResources(user.id);
    const favorites = userModel.getFavorites(user.id);
    const downloads = userModel.getDownloads(user.id);

    res.json({
      success: true,
      data: {
        ...user,
        stats,
        resources,
        favorites,
        downloads,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
