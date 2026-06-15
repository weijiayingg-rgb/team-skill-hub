/**
 * 场景（Scene）API 路由
 *
 * 场景 = Rules + Skills + Hook 的组合，用于企业工作流场景。
 * 创建场景不需要上传文件，只需在页面上勾选已有资源。
 */
const express = require('express');
const router = express.Router();
const sceneModel = require('../models/scenes');
const resourceModel = require('../models/resources');

// GET /api/scenes — 场景列表
router.get('/', (req, res, next) => {
  try {
    const { status, sort, page, pageSize, tag } = req.query;
    const result = sceneModel.findAll({
      status: status || 'published',
      sort: sort || 'hot',
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || 20,
      tag,
    });

    // 为每个场景解析关联资源的简要信息
    const data = result.data.map(scene => {
      const resolved = { ...scene };
      if (scene.rules_id) {
        const rules = resourceModel.findById(scene.rules_id);
        resolved.rules = rules ? { id: rules.id, name: rules.name, display_name: rules.display_name } : null;
      }
      if (scene.skills && scene.skills.length > 0) {
        resolved.skills_detail = scene.skills
          .map(id => resourceModel.findById(id))
          .filter(Boolean)
          .map(r => ({ id: r.id, name: r.name, display_name: r.display_name, type: r.type }));
      }
      if (scene.hooks_id) {
        const hook = resourceModel.findById(scene.hooks_id);
        resolved.hook = hook ? { id: hook.id, name: hook.name, display_name: hook.display_name } : null;
      }
      return resolved;
    });

    res.json({ success: true, data, meta: result.meta });
  } catch (err) { next(err); }
});

// GET /api/scenes/:id — 场景详情
router.get('/:id', (req, res, next) => {
  try {
    const scene = sceneModel.findById(req.params.id);
    if (!scene) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '场景不存在' } });
    }

    // 解析关联资源的完整信息
    const resolved = { ...scene };

    if (scene.rules_id) {
      const rules = resourceModel.findById(scene.rules_id);
      resolved.rules = rules ? { id: rules.id, name: rules.name, display_name: rules.display_name, description: rules.description, current_version: rules.current_version } : null;
    }

    if (scene.skills && scene.skills.length > 0) {
      resolved.skills_detail = scene.skills
        .map(id => resourceModel.findById(id))
        .filter(Boolean)
        .map(r => ({ id: r.id, name: r.name, display_name: r.display_name, description: r.description, type: r.type, current_version: r.current_version }));
    }

    if (scene.hooks_id) {
      const hook = resourceModel.findById(scene.hooks_id);
      resolved.hook = hook ? { id: hook.id, name: hook.name, display_name: hook.display_name, description: hook.description, current_version: hook.current_version } : null;
    }

    res.json({ success: true, data: resolved });
  } catch (err) { next(err); }
});

// POST /api/scenes — 创建场景
router.post('/', (req, res, next) => {
  try {
    const { name, display_name, description, rules_id, skills, hooks_id, tags } = req.body;

    if (!name || !display_name) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: '缺少 name 或 display_name 字段' },
      });
    }

    // 校验关联资源是否存在
    if (rules_id) {
      const rules = resourceModel.findById(rules_id);
      if (!rules) {
        return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: `规范资源 ${rules_id} 不存在` } });
      }
    }

    if (skills && skills.length > 0) {
      for (const skillId of skills) {
        const skill = resourceModel.findById(skillId);
        if (!skill) {
          return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: `技能资源 ${skillId} 不存在` } });
        }
      }
    }

    if (hooks_id) {
      const hook = resourceModel.findById(hooks_id);
      if (!hook) {
        return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: `Hook 资源 ${hooks_id} 不存在` } });
      }
    }

    const scene = sceneModel.create({
      name, display_name, description,
      author_id: req.user?.id || 1,
      rules_id, skills: skills || [], hooks_id,
      tags: tags || [],
    });

    res.status(201).json({ success: true, data: scene });
  } catch (err) {
    if (err.message?.includes('UNIQUE constraint')) {
      return res.status(409).json({ success: false, error: { code: 'CONFLICT', message: '场景名称已存在' } });
    }
    next(err);
  }
});

// PUT /api/scenes/:id — 更新场景
router.put('/:id', (req, res, next) => {
  try {
    const existing = sceneModel.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '场景不存在' } });
    }

    const scene = sceneModel.update(req.params.id, req.body);
    res.json({ success: true, data: scene });
  } catch (err) { next(err); }
});

// DELETE /api/scenes/:id — 删除场景
router.delete('/:id', (req, res, next) => {
  try {
    const existing = sceneModel.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '场景不存在' } });
    }
    sceneModel.delete(req.params.id);
    res.json({ success: true, data: { deleted: true } });
  } catch (err) { next(err); }
});

module.exports = router;