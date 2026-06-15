const config = require('../config');

/**
 * 认证中间件
 *
 * Token 解析优先级：
 * 1. 硬编码白名单 (config.allowedTokens) — 向后兼容开发调试
 * 2. settings 表动态 token (key: token:{uuid}, value: JSON{userId,createdAt}) — 快捷登录生成
 * 3. users 表 username 直接匹配 — 旧逻辑兜底
 * 4. 无 token 时返回 401（不再 fallback 到 anonymous）
 */

// Token 默认有效期：7 天（毫秒）
const TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  // 没有 token 时标记为未认证用户（id=null, role=guest）
  if (!authHeader) {
    req.user = { id: null, username: 'anonymous', role: 'guest' };
    return next();
  }

  const token = authHeader.replace('Bearer ', '').trim();

  // 1. 硬编码白名单检查（向后兼容）
  if (config.allowedTokens.includes(token)) {
    const userMap = {
      'dev-token-1': { id: 1, username: 'zhangsan', role: 'admin' },
      'dev-token-2': { id: 2, username: 'lisi', role: 'member' },
    };
    req.user = userMap[token] || { id: null, username: 'anonymous', role: 'guest' };
    return next();
  }

  // 2. 从 settings 表查找动态 token（快捷登录生成的 UUID token）
  try {
    const { getDb } = require('../models/db');
    const db = getDb();
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(`token:${token}`);
    if (row) {
      // 解析 token 值（支持新格式 JSON 和旧格式纯 userId）
      let userId, createdAt;
      try {
        const parsed = JSON.parse(row.value);
        userId = parsed.userId;
        createdAt = parsed.createdAt;
      } catch {
        // 旧格式：纯数字 userId
        userId = parseInt(row.value, 10);
        createdAt = null;
      }

      // 检查 token 是否过期（如果有创建时间）
      if (createdAt) {
        const age = Date.now() - new Date(createdAt).getTime();
        if (age > TOKEN_EXPIRY_MS) {
          // Token 已过期，删除并拒绝
          db.prepare('DELETE FROM settings WHERE key = ?').run(`token:${token}`);
          return res.status(401).json({
            success: false,
            error: {
              code: 'TOKEN_EXPIRED',
              message: '登录已过期，请重新登录',
            },
          });
        }
      }

      const userModel = require('../models/users');
      const user = userModel.findById(userId);
      if (user) {
        req.user = { id: user.id, username: user.username, role: user.role };
        return next();
      }
    }
  } catch (e) {
    // settings 表未就绪或查询异常，继续尝试其他方式
  }

  // 3. 尝试从 users 表按 username 直接匹配（旧逻辑兜底）
  try {
    const userModel = require('../models/users');
    const user = userModel.findByUsername(token);
    if (user) {
      req.user = { id: user.id, username: user.username, role: user.role };
      return next();
    }
  } catch (e) {
    // db not ready yet, fall through
  }

  // 所有方式均失败，返回 401
  res.status(401).json({
    success: false,
    error: {
      code: 'UNAUTHORIZED',
      message: '无效的认证令牌',
    },
  });
}

function requireAuth(req, res, next) {
  if (!req.user || !req.user.id) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: '请先登录' },
    });
  }
  next();
}

module.exports = { authMiddleware, requireAuth };
