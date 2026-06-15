const express = require('express');
const router = express.Router();
const { getDb } = require('../models/db');

/**
 * GET /fingerprint-map
 * 返回所有资源的指纹映射：{ name: { hash, id, version, type } }
 * 用于客户端比对本地资源与注册中心的差异，实现增量更新
 *
 * 注意：此路由直接挂到 /api 下，避免被 resources 的 /:id 路径抢先匹配
 */
router.get('/fingerprint-map', (req, res, next) => {
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT id, name, type, content_hash, current_version
      FROM resources
      WHERE status = 'published' AND content_hash IS NOT NULL AND content_hash != ''
    `).all();

    // 构建 { name: { hash, id, version, type } } 映射
    const fingerprintMap = {};
    for (const row of rows) {
      fingerprintMap[row.name] = {
        hash: row.content_hash,
        id: row.id,
        version: row.current_version,
        type: row.type,
      };
    }

    res.json({
      success: true,
      data: fingerprintMap,
      meta: { count: rows.length },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;