/**
 * 认证路由模块
 *
 * 提供快捷登录接口：通过花名(nickname) 免密登录。
 * 用户不存在时自动创建（username 和 display_name 均使用花名），
 * 登录成功后生成 UUID token 存入 settings 表。
 * Token 格式：{ userId, createdAt }，有效期 7 天。
 */

const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const userModel = require('../models/users');
const { getDb } = require('../models/db');

// Token 有效期（毫秒）
const TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * POST /api/auth/login
 *
 * 快捷登录（无需密码）
 * - 请求体: { nickname }
 * - nickname 为空返回 400
 * - 用户不存在则自动创建（username=nickname, display_name=nickname）
 * - 生成 uuid token 存入 settings 表 (key: token:{token}, value: JSON{userId,createdAt})
 * - 清理该用户的过期旧 token
 * - 返回 { success: true, data: { token, user }, message: string }
 */
router.post('/login', (req, res) => {
  try {
    const { nickname } = req.body;

    // 参数校验：nickname 必填
    if (!nickname || !String(nickname).trim()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: '花名不能为空',
        },
      });
    }

    const trimmedNickname = String(nickname).trim();

    // 查找或创建用户（username 和 display_name 都使用花名）
    let user = userModel.findByUsername(trimmedNickname);
    let isNewUser = false;

    if (!user) {
      user = userModel.create({
        username: trimmedNickname,
        display_name: trimmedNickname,
        role: 'member',
      });
      isNewUser = true;
    }

    // 生成 UUID token
    const token = crypto.randomUUID();

    // 将 token 存入 settings 表，value 为 JSON 格式包含创建时间
    const db = getDb();
    const tokenValue = JSON.stringify({
      userId: user.id,
      createdAt: new Date().toISOString(),
    });

    db.prepare(`
      INSERT INTO settings (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(`token:${token}`, tokenValue);

    // 清理该用户的过期旧 token（顺便维护）
    cleanupExpiredTokens(db, user.id);

    // 记录登录日志
    console.log(`[Auth] 用户登录成功: ${trimmedNickname} (id=${user.id}, 新用户=${isNewUser})`);

    // 返回成功响应
    return res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          display_name: user.display_name,
          role: user.role,
        },
      },
      message: `欢迎 ${trimmedNickname}`,
    });

  } catch (err) {
    console.error('[Auth] 登录失败:', err.message);
    return res.status(500).json({
      success: false,
      error: {
        code: 'LOGIN_FAILED',
        message: '登录失败，请稍后重试',
      },
    });
  }
});

/**
 * 清理指定用户的过期 token
 * @param {Database} db - SQLite 数据库实例
 * @param {number} userId - 用户 ID
 */
function cleanupExpiredTokens(db, userId) {
  try {
    const rows = db.prepare("SELECT key, value FROM settings WHERE key LIKE 'token:%'").all();
    for (const row of rows) {
      try {
        const parsed = JSON.parse(row.value);
        if (parsed.userId === userId && parsed.createdAt) {
          const age = Date.now() - new Date(parsed.createdAt).getTime();
          if (age > TOKEN_EXPIRY_MS) {
            db.prepare('DELETE FROM settings WHERE key = ?').run(row.key);
          }
        }
      } catch {
        // 旧格式 token，跳过
      }
    }
  } catch (e) {
    // 清理失败不影响登录
    console.warn('[Auth] 清理过期 token 失败:', e.message);
  }
}

module.exports = router;
