const express = require('express');
const router = express.Router();
const notificationModel = require('../models/notifications');

/**
 * 通知相关 API 路由
 * 所有需要认证的请求都通过 req.user 获取当前登录用户
 */

// GET /api/notifications - 获取通知列表，支持 ?type=download|thanks &page &pageSize
router.get('/', (req, res, next) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: '请先登录' } });
    }

    const { type, page, pageSize } = req.query;
    const result = notificationModel.findByUser(req.user.id, {
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || 20,
      type: type || undefined,
    });

    res.json({ success: true, ...result });
  } catch (err) { next(err); }
});

// GET /api/notifications/unread-count - 获取未读通知数量
router.get('/unread-count', (req, res, next) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: '请先登录' } });
    }

    const count = notificationModel.getUnreadCount(req.user.id);
    res.json({ success: true, data: { count } });
  } catch (err) { next(err); }
});

// POST /api/notifications/:id/read - 标记单条通知为已读
router.post('/:id/read', (req, res, next) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: '请先登录' } });
    }

    const ok = notificationModel.markAsRead(req.params.id, req.user.id);
    if (!ok) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '通知不存在或无权操作' } });
    }

    res.json({ success: true, data: { read: true } });
  } catch (err) { next(err); }
});

// POST /api/notifications/read-all - 标记全部已读
router.post('/read-all', (req, res, next) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: '请先登录' } });
    }

    const count = notificationModel.markAllAsRead(req.user.id);
    res.json({ success: true, data: { updated_count: count } });
  } catch (err) { next(err); }
});

module.exports = router;