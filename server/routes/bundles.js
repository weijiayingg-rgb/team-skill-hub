const express = require('express');
const router = express.Router();
const bundleModel = require('../models/bundles');

// GET /api/bundles
router.get('/', (req, res, next) => {
  try {
    const bundles = bundleModel.findAll();
    res.json({ success: true, data: bundles });
  } catch (err) { next(err); }
});

// GET /api/bundles/:id
router.get('/:id', (req, res, next) => {
  try {
    const bundle = bundleModel.findById(req.params.id);
    if (!bundle) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Bundle 不存在' } });
    }
    res.json({ success: true, data: bundle });
  } catch (err) { next(err); }
});

// POST /api/bundles
router.post('/', (req, res, next) => {
  try {
    const { name, description, version, resources } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: '缺少 name 字段' } });
    }
    const bundle = bundleModel.create({
      name, description, author_id: req.user?.id || 1, version, resources,
    });
    res.status(201).json({ success: true, data: bundle });
  } catch (err) { next(err); }
});

// PUT /api/bundles/:id
router.put('/:id', (req, res, next) => {
  try {
    const bundle = bundleModel.update(req.params.id, req.body);
    if (!bundle) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Bundle 不存在' } });
    }
    res.json({ success: true, data: bundle });
  } catch (err) { next(err); }
});

// DELETE /api/bundles/:id
router.delete('/:id', (req, res, next) => {
  try {
    bundleModel.delete(req.params.id);
    res.json({ success: true, data: { deleted: true } });
  } catch (err) { next(err); }
});

module.exports = router;
