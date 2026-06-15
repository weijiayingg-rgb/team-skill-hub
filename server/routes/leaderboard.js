/**
 * leaderboard.js - 贡献榜 API 路由
 *
 * GET /api/leaderboard - 获取贡献榜排名
 *   query params:
 *     period  — all(全部) / weekly(最近7天) / monthly(最近30天)
 *     limit   — 返回条数上限，默认20，最大100
 */

const express = require('express');
const router = express.Router();
const leaderboardModel = require('../models/leaderboard');

// GET /api/leaderboard - 获取贡献榜
router.get('/', (req, res, next) => {
  try {
    const period = req.query.period || 'all';
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);

    // 验证 period 参数
    if (!['all', 'weekly', 'monthly'].includes(period)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_PERIOD', message: 'period 必须为 all、weekly 或 monthly' }
      });
    }

    const leaderboard = leaderboardModel.getLeaderboard({ period, limit });
    res.json({
      success: true,
      data: leaderboard,
      meta: { period, count: leaderboard.length }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
