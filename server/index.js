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
app.listen(config.port, '0.0.0.0', async () => {
  console.log(`SkillHub Server running at http://localhost:${config.port}`);
  console.log(`LAN access: ${config.hubUrl}`);

  // 一次性迁移：重算已有 Expert 的 content_hash（排除 skills/ 目录）
  // 修复旧版哈希包含自动嵌入 Skill 文件导致重扫误判"有更新"的问题
  try {
    const { getDb } = require('./models/db');
    const gitStore = require('./services/git-store');
    const crypto = require('crypto');
    const db = getDb();

    const experts = db.prepare(
      "SELECT id, name, current_version, content_hash FROM resources WHERE type = 'expert' AND content_hash IS NOT NULL AND content_hash != ''"
    ).all();

    let updated = 0;
    for (const expert of experts) {
      try {
        const files = await gitStore.readResourceFiles(expert.name, expert.current_version);
        // 排除 skills/ 目录，与新版 computeContentHash 对齐
        const sourceFiles = files.filter(f => !f.path || !f.path.startsWith('skills/'));
        if (sourceFiles.length === 0) continue;

        const sorted = [...sourceFiles].sort((a, b) => (a.path || a.filename).localeCompare(b.path || b.filename));
        const combined = sorted.map(f => f.content || '').join('\n---FILE_BOUNDARY---\n');
        const newHash = crypto.createHash('sha256').update(combined, 'utf-8').digest('hex');

        if (newHash !== expert.content_hash) {
          db.prepare('UPDATE resources SET content_hash = ? WHERE id = ?').run(newHash, expert.id);
          updated++;
        }
      } catch { /* 单个 Expert 迁移失败不影响其他 */ }
    }
    if (updated > 0) {
      console.log(`[migration] 已重算 ${updated} 个 Expert 的 content_hash（排除 skills/）`);
    }
  } catch (e) {
    console.warn('[migration] Expert 哈希重算跳过:', e.message);
  }
});

module.exports = app;
