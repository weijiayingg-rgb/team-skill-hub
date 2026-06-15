const express = require('express');
const router = express.Router();
const interactionModel = require('../models/interactions');
const commentModel = require('../models/comments');
const notificationModel = require('../models/notifications');
const resourceModel = require('../models/resources');

// POST /api/resources/:id/like - 点赞
router.post('/resources/:id/like', (req, res, next) => {
  try {
    if (!req.user?.id) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: '请先登录' } });
    interactionModel.create(req.user.id, req.params.id, 'like');
    res.json({ success: true, data: { liked: true } });
  } catch (err) { next(err); }
});

// DELETE /api/resources/:id/like - 取消点赞
router.delete('/resources/:id/like', (req, res, next) => {
  try {
    if (!req.user?.id) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: '请先登录' } });
    interactionModel.remove(req.user.id, req.params.id, 'like');
    res.json({ success: true, data: { liked: false } });
  } catch (err) { next(err); }
});

// POST /api/resources/:id/favorite - 收藏
router.post('/resources/:id/favorite', (req, res, next) => {
  try {
    if (!req.user?.id) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: '请先登录' } });
    interactionModel.create(req.user.id, req.params.id, 'favorite');
    res.json({ success: true, data: { favorited: true } });
  } catch (err) { next(err); }
});

// DELETE /api/resources/:id/favorite - 取消收藏
router.delete('/resources/:id/favorite', (req, res, next) => {
  try {
    if (!req.user?.id) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: '请先登录' } });
    interactionModel.remove(req.user.id, req.params.id, 'favorite');
    res.json({ success: true, data: { favorited: false } });
  } catch (err) { next(err); }
});

// POST /api/resources/:id/comment - 添加评论
router.post('/resources/:id/comment', (req, res, next) => {
  try {
    if (!req.user?.id) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: '请先登录' } });
    const { content } = req.body;
    if (!content) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: '评论内容不能为空' } });
    const comment = commentModel.create({ user_id: req.user.id, resource_id: req.params.id, content });
    res.status(201).json({ success: true, data: comment });
  } catch (err) { next(err); }
});

// GET /api/resources/:id/comments - 评论列表
router.get('/resources/:id/comments', (req, res, next) => {
  try {
    const { page, pageSize } = req.query;
    const result = commentModel.findByResourceId(req.params.id, parseInt(page) || 1, parseInt(pageSize) || 20);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
});

// DELETE /api/comments/:id - 删除评论
router.delete('/comments/:id', (req, res, next) => {
  try {
    commentModel.delete(req.params.id);
    res.json({ success: true, data: { deleted: true } });
  } catch (err) { next(err); }
});

// POST /api/resources/:id/thanks - 感谢资源作者
router.post('/resources/:id/thanks', (req, res, next) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: '请先登录' } });
    }

    const { message } = req.body || {};
    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: '感谢留言不能为空' } });
    }

    // 获取资源信息，验证资源存在
    const resource = resourceModel.findById(req.params.id);
    if (!resource) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '资源不存在' } });
    }

    // 不能感谢自己的资源
    if (resource.author_id === req.user.id) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_OPERATION', message: '不能感谢自己的资源' } });
    }

    // 创建感谢通知
    notificationModel.create(
      resource.author_id,
      req.user.id,
      resource.id,
      'thanks',
      message.trim()
    );

    res.json({ success: true, data: { thanked: true } });
  } catch (err) { next(err); }
});

module.exports = router;
