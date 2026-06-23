const express = require('express');
const router = express.Router();
const { getDb } = require('../models/db');
const tagModel = require('../models/tags');

/**
 * GET /api/tags — 标签列表（支持 category 筛选）
 */
router.get('/', (req, res, next) => {
  try {
    const { category } = req.query;
    let tags;

    if (category) {
      const db = getDb();
      tags = db.prepare(`
        SELECT t.*, COUNT(rt.resource_id) as resource_count
        FROM tags t
        LEFT JOIN resource_tags rt ON t.id = rt.tag_id
        WHERE t.category = ?
        GROUP BY t.id
        ORDER BY resource_count DESC
      `).all(category);
    } else {
      tags = tagModel.findAll();
    }

    res.json({ success: true, data: tags });
  } catch (err) { next(err); }
});

/**
 * POST /api/tags — 创建标签（支持 category）
 */
router.post('/', (req, res, next) => {
  try {
    const { name, category } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: '缺少 name 字段' } });
    }

    const db = getDb();
    const existing = db.prepare('SELECT * FROM tags WHERE name = ?').get(name);
    if (existing) {
      if (category && existing.category !== category) {
        db.prepare('UPDATE tags SET category = ? WHERE id = ?').run(category, existing.id);
        existing.category = category;
      }
      return res.json({ success: true, data: existing });
    }

    const result = db.prepare('INSERT INTO tags (name, category) VALUES (?, ?)').run(name, category || 'general');
    const tag = db.prepare('SELECT * FROM tags WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ success: true, data: tag });
  } catch (err) { next(err); }
});

/**
 * GET /api/tags/popular
 * 获取热门标签，按使用次数降序排列
 *
 * Query params:
 *   type  - 资源类型筛选（skill / expert / rule / hook）
 *   limit - 返回数量上限，默认 10
 */
router.get('/popular', (req, res, next) => {
  try {
    const { type, limit } = req.query;
    const maxCount = Math.min(parseInt(limit) || 10, 50); // 上限 50

    let sql, params;

    if (type) {
      // 按资源类型筛选标签
      sql = `
        SELECT t.name, COUNT(rt.resource_id) as count
        FROM tags t
        JOIN resource_tags rt ON t.id = rt.tag_id
        JOIN resources r ON r.id = rt.resource_id
        WHERE r.status = 'published' AND r.type = ?
        GROUP BY t.id
        ORDER BY count DESC
        LIMIT ?
      `;
      params = [type, maxCount];
    } else {
      // 不筛选类型，返回全局热门标签
      sql = `
        SELECT t.name, COUNT(rt.resource_id) as count
        FROM tags t
        JOIN resource_tags rt ON t.id = rt.tag_id
        JOIN resources r ON r.id = rt.resource_id
        WHERE r.status = 'published'
        GROUP BY t.id
        ORDER BY count DESC
        LIMIT ?
      `;
      params = [maxCount];
    }

    const db = getDb();
    const tags = db.prepare(sql).all(...params);

    res.json({ success: true, data: tags });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
