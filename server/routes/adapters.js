/**
 * 适配器路由模块
 *
 * 提供平台适配器信息的查询接口，供前端安装引导组件使用。
 */

const express = require('express');
const router = express.Router();
const adapterRegistry = require('../services/adapter-registry');

// GET /api/adapters/platforms - 获取所有平台列表和安装指南
router.get('/platforms', (req, res, next) => {
  try {
    const platforms = adapterRegistry.getPlatforms();
    res.json({ success: true, data: platforms });
  } catch (err) {
    next(err);
  }
});

// GET /api/adapters/platforms/:id - 获取指定平台的安装指南
router.get('/platforms/:id', (req, res, next) => {
  try {
    const guide = adapterRegistry.getInstallGuide(req.params.id);
    if (!guide) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: `平台 "${req.params.id}" 不存在` },
      });
    }
    res.json({ success: true, data: guide });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
