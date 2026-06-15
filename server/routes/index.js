const express = require('express');
const router = express.Router();

// auth 路由在 server/index.js 中认证中间件之前单独注册，此处不再重复引入
const resourcesRouter = require('./resources');
const fingerprintRouter = require('./fingerprint');
const usersRouter = require('./users');
const interactionsRouter = require('./interactions');
const bundlesRouter = require('./bundles');
const trendingRouter = require('./trending');
const statsRouter = require('./stats');
const adaptersRouter = require('./adapters');
const notificationsRouter = require('./notifications');
const syncSessionsRouter = require('./sync-sessions');
const scenesRouter = require('./scenes');
const tagsRouter = require('./tags');
const leaderboardRouter = require('./leaderboard');

router.use('/resources', resourcesRouter);
router.use('/', fingerprintRouter); // fingerprint-map 挂到 /api 下，避免 /:id 冲突
router.use('/users', usersRouter);
router.use('/', interactionsRouter); // interactions routes include /resources/:id/... paths
router.use('/bundles', bundlesRouter);
router.use('/scenes', scenesRouter);
router.use('/tags', tagsRouter);
router.use('/trending', trendingRouter);
router.use('/stats', statsRouter);
router.use('/adapters', adaptersRouter);
router.use('/notifications', notificationsRouter);
router.use('/sync-sessions', syncSessionsRouter);
router.use('/leaderboard', leaderboardRouter);

module.exports = router;
