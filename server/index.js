const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const config = require('./config');
const { errorHandler, notFound } = require('./middleware/error-handler');
const { authMiddleware } = require('./middleware/auth');
const routes = require('./routes');

const app = express();

// 基础中间件
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态文件
app.use('/uploads', express.static(path.join(__dirname, config.uploadDir)));

// API 健康检查（无需认证）
app.get('/api/health', (req, res) => {
  res.json({ success: true, data: { status: 'ok', version: '1.0.0' } });
});

// 认证相关路由在认证中间件之前注册（登录接口本身不需要认证）
const authRouter = require('./routes/auth');
app.use('/api/auth', authRouter);

// 认证中间件（应用于除 /api/auth 和 /api/health 之外的所有 API 路由）
app.use('/api', authMiddleware);

// 业务 API 路由
app.use('/api', routes);

// 404 处理
app.use(notFound);

// 错误处理
app.use(errorHandler);

// 启动服务
app.listen(config.port, () => {
  console.log(`SkillHub Server running at http://localhost:${config.port}`);
});

module.exports = app;
