/**
 * 标签 API 路由
 * 支持按分类筛选标签
 */
const express = require('express');
const router = express.Router();
const tagModel = require('../models/tags');

// GET /api/tags — 标签列表（支持 category 筛选）
router.get('/', (req, res, next) => {
  try {
    const { category } = req.query;
    let tags;

    if (category) {
      // 按分类筛选
      const db = require('../models/db').getDb();
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

// POST /api/tags — 创建标签（支持 category）
router.post('/', (req, res, next) => {
  try {
    const { name, category } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: '缺少 name 字段' } });
    }

    const db = require('../models/db').getDb();
    const existing = db.prepare('SELECT * FROM tags WHERE name = ?').get(name);
    if (existing) {
      // 如果已存在但 category 不同，更新 category
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

module.exports = router;