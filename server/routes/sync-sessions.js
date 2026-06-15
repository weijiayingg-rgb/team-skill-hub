const express = require('express');
const router = express.Router();
const { getDb } = require('../models/db');
const { requireAuth } = require('../middleware/auth');
const crypto = require('crypto');
const path = require('path');
const os = require('os');
const fs = require('fs');
const scanner = require('../../cli/utils/scanner');
const fingerprint = require('../../cli/utils/fingerprint');
const resourceManager = require('../services/resource-manager');
const { incrementVersion: incrementSemver } = require('../services/resource-manager');
const resourceModel = require('../models/resources');

/**
 * 计算本地文件集合的哈希值（与 resource-manager.js 的 computeContentHash 对齐）
 *
 * 算法：将文件按路径排序，读取 UTF-8 内容，用 FILE_BOUNDARY 分隔符拼接后计算 SHA256。
 * 确保与服务端存储的 content_hash 一致，避免上传后重新扫描误判为"已更新"。
 *
 * @param {string[]} filePaths - 文件绝对路径数组
 * @returns {string|null} SHA256 hex digest，文件列表为空时返回 null
 */
function computeLocalHash(filePaths) {
  if (!filePaths || filePaths.length === 0) return null;
  const sorted = [...filePaths].sort();
  const contents = [];
  for (const fp of sorted) {
    try {
      contents.push(fs.readFileSync(fp, 'utf-8'));
    } catch {
      // 跳过不可读文件
    }
  }
  if (contents.length === 0) return null;
  return crypto.createHash('sha256').update(contents.join('\n---FILE_BOUNDARY---\n'), 'utf-8').digest('hex');
}

// 所有端点需要认证
router.use(requireAuth);

/**
 * 辅助：检查会话是否存在、未过期、且属于当前用户
 * @returns {object|null} 会话记录，不符合条件时返回 null 并自动发送错误响应
 */
function validateSession(req, res) {
  const db = getDb();
  const session = db.prepare('SELECT * FROM sync_sessions WHERE id = ?').get(req.params.id);

  if (!session) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: '同步会话不存在' },
    });
    return null;
  }

  // 检查过期：expires_at 是 SQLite datetime 格式 (YYYY-MM-DD HH:MM:SS)
  // 用 SQLite 函数获取当前时间做比较，避免 JS/SQLite 时间格式不一致
  if (session.expires_at) {
    const isExpired = db.prepare(
      "SELECT ? < datetime('now') AS expired"
    ).get(session.expires_at);
    if (isExpired.expired) {
      // 过期会话直接删除
      db.prepare('DELETE FROM sync_sessions WHERE id = ?').run(session.id);
      res.status(404).json({
        success: false,
        error: { code: 'EXPIRED', message: '同步会话已过期' },
      });
      return null;
    }
  }

  // 检查 user_id 匹配
  if (session.user_id !== req.user.id) {
    res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: '无权操作此会话' },
    });
    return null;
  }

  return session;
}

/**
 * 辅助：更新 updated_at
 */
function touchSession(db, id) {
  db.prepare("UPDATE sync_sessions SET updated_at = datetime('now') WHERE id = ?").run(id);
}

// ============================================================
// POST / - 创建同步会话
// ============================================================
router.post('/', (req, res, next) => {
  try {
    const db = getDb();
    const userId = req.user.id;

    // 检查同一用户是否有活跃（未过期）session
    const activeSession = db.prepare(
      "SELECT id FROM sync_sessions WHERE user_id = ? AND status IN ('waiting','scanned','planned','pushing') AND expires_at > datetime('now')"
    ).get(userId);

    if (activeSession) {
      return res.status(409).json({
        success: false,
        error: { code: 'CONFLICT', message: '已有活跃的同步会话', data: { session_id: activeSession.id } },
      });
    }

    const id = crypto.randomUUID();
    db.prepare(`
      INSERT INTO sync_sessions (id, user_id, status, expires_at)
      VALUES (?, ?, 'waiting', datetime('now', '+30 minutes'))
    `).run(id, userId);

    const session = db.prepare('SELECT * FROM sync_sessions WHERE id = ?').get(id);
    res.status(201).json({ success: true, data: session });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// GET /:id - 查询会话状态
// ============================================================
router.get('/:id', (req, res, next) => {
  try {
    const session = validateSession(req, res);
    if (!session) return;

    res.json({ success: true, data: session });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// POST /:id/scan - CLI 提交 scan 结果
// ============================================================
router.post('/:id/scan', (req, res, next) => {
  try {
    const session = validateSession(req, res);
    if (!session) return;

    // 只有 waiting 状态才能提交 scan
    if (session.status !== 'waiting') {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_STATUS', message: `当前状态为 ${session.status}，无法提交 scan 结果` },
      });
    }

    const { scan_result } = req.body;
    if (!scan_result) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: '缺少 scan_result 字段' },
      });
    }

    const db = getDb();
    const scanResultJson = typeof scan_result === 'string' ? scan_result : JSON.stringify(scan_result);

    db.prepare(`
      UPDATE sync_sessions
      SET scan_result = ?, status = 'scanned', updated_at = datetime('now')
      WHERE id = ?
    `).run(scanResultJson, session.id);

    const updated = db.prepare('SELECT * FROM sync_sessions WHERE id = ?').get(session.id);
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// POST /:id/auto-scan - 服务端自动扫描本地 AI 资源
//
// 性能优化：scanner.scanAll() 和 fingerprint 计算是同步阻塞 I/O，
// 如果本地文件很多会长时间阻塞 Express 事件循环。
// 使用 setImmediate 将扫描逻辑推迟到下一个事件循环 tick，
// 让 Express 先处理积压的其他请求，再执行扫描。
// ============================================================
router.post('/:id/auto-scan', (req, res, next) => {
  // 先做轻量的状态校验（同步，很快）
  const session = validateSession(req, res);
  if (!session) return;

  if (session.status !== 'waiting') {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_STATUS', message: `当前状态为 ${session.status}，无法自动扫描` },
    });
  }

  // 将耗时的扫描逻辑推迟到下一个事件循环 tick
  setImmediate(() => {
    try {
      // 1. 扫描本地 HOME 目录下所有 AI 平台配置（同步阻塞 I/O）
      const scanItems = scanner.scanAll();

      // 2. 对每个扫描到的 item 计算指纹
      const items = [];
      const summary = { total: 0, new: 0, updated: 0, synced: 0 };

      // 3. 构建远端指纹映射：用 platform:type:name 作为 key，区分不同平台的同名资源
      const db = getDb();
      const remoteRows = db.prepare(`
        SELECT id, name, type, platform, content_hash, current_version
        FROM resources
        WHERE status = 'published' AND content_hash IS NOT NULL AND content_hash != ''
      `).all();

      const remoteMap = {};
      for (const row of remoteRows) {
        // 兼容旧数据：无 platform 时用 type:name 作为 key
        const key = row.platform ? `${row.platform}:${row.type}:${row.name}` : `${row.type}:${row.name}`;
        remoteMap[key] = {
          hash: row.content_hash,
          id: row.id,
          version: row.current_version,
          type: row.type,
          platform: row.platform,
        };
      }

      // 4. 逐个比对，确定状态
      for (const scanItem of scanItems) {
        const fp = fingerprint.generateFingerprint(scanItem);
        // 使用与服务端 computeContentHash 相同的算法，避免上传后重扫误判为"已更新"
        const localHash = computeLocalHash(scanItem.files);
        // 优先用 platform:type:name 查找，兼容旧数据用 type:name
        const lookupKey = `${scanItem.platform}:${scanItem.type}:${scanItem.name}`;
        const fallbackKey = `${scanItem.type}:${scanItem.name}`;
        const remoteInfo = remoteMap[lookupKey] || remoteMap[fallbackKey];

        let status;
        let remoteId = null;
        let remoteVersion = null;

        if (!remoteInfo) {
          status = 'new';
        } else if (localHash === remoteInfo.hash) {
          status = 'synced';
          remoteId = remoteInfo.id;
          remoteVersion = remoteInfo.version;
        } else {
          status = 'updated';
          remoteId = remoteInfo.id;
          remoteVersion = remoteInfo.version;
        }

        summary.total++;
        summary[status]++;

        // 提取 description：优先从 frontmatter，其次从首段文字
        // 安全校验：确保路径在 HOME 目录内，且文件大小可控
        let description = '';
        if (scanItem.files && scanItem.files.length > 0) {
          // 找到第一个 .md 文件
          const mdFile = scanItem.files.find(f => typeof f === 'string' && f.endsWith('.md'));
          if (mdFile) {
            try {
              const resolved = path.resolve(mdFile);
              const homeDir = os.homedir();
              // 路径必须在 HOME 目录内，且不含路径回溯
              if (!resolved.startsWith(homeDir) || mdFile.includes('..')) {
                // 跳过可疑路径
              } else {
                // 限制文件大小，避免读取超大文件阻塞
                const stat = fs.statSync(resolved);
                if (stat.size > 100 * 1024) { // 100KB 上限
                  // 跳过超大文件
                } else {
                  const content = fs.readFileSync(resolved, 'utf-8');
                  // 尝试提取 YAML frontmatter 的 description
                  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
                  if (fmMatch) {
                    const descMatch = fmMatch[1].match(/^description:\s*(.+)$/m);
                    if (descMatch) {
                      const val = descMatch[1].trim();
                      // 过滤 YAML 多行指示符（|, >, |-, >-）
                      if (val !== '|' && val !== '>' && val !== '|-' && val !== '>-') {
                        description = val.slice(0, 200);
                      }
                    }
                  }
                  // 没有 frontmatter description 时取第一段非空文字
                  if (!description) {
                    const lines = content.replace(/^---[\s\S]*?---/, '').split('\n');
                    const firstContent = lines.find(l => l.trim() && !l.startsWith('#') && !l.startsWith('!'));
                    if (firstContent) description = firstContent.trim().slice(0, 200);
                  }
                }
              }
            } catch (e) {
              // 静默失败，description 留空
            }
          }
        }

        items.push({
          id: `${scanItem.platform}:${scanItem.type}:${scanItem.name}`,
          name: scanItem.name,
          displayName: scanItem.displayName,
          platform: scanItem.platform,
          type: scanItem.type,
          status,
          fileCount: scanItem.files.length,
          remoteId,
          remoteVersion,
          contentHashShort: localHash ? localHash.slice(0, 8) : null,
          description,
        });
      }

      // 4.5 检测 Expert-Skill 关联：标记被 Expert 包含的 Skill
      // 构建 expert 的文件路径集合，再检查 skill 文件是否在其中
      const expertFileSets = [];
      for (const scanItem of scanItems) {
        if (scanItem.type === 'expert') {
          const fileSet = new Set(scanItem.files.map(f => path.resolve(f)));
          expertFileSets.push({
            name: scanItem.name,
            displayName: scanItem.displayName,
            platform: scanItem.platform,
            fileSet,
          });
        }
      }
      if (expertFileSets.length > 0) {
        for (let i = 0; i < items.length; i++) {
          if (items[i].type !== 'skill') continue;
          const skillScanItem = scanItems.find(
            si => si.type === 'skill' && si.name === items[i].name && si.platform === items[i].platform
          );
          if (!skillScanItem) continue;
          for (const expert of expertFileSets) {
            // 如果 skill 的任一文件在 expert 的文件集合中，则标记关联
            const isBundled = skillScanItem.files.some(f => expert.fileSet.has(path.resolve(f)));
            if (isBundled) {
              items[i].bundledIn = { name: expert.name, displayName: expert.displayName };
              break;
            }
          }
        }
      }

      // 5. 写入 scan_result 并更新状态为 scanned
      const scanResult = { items, summary };
      const scanResultJson = JSON.stringify(scanResult);

      db.prepare(`
        UPDATE sync_sessions
        SET scan_result = ?, status = 'scanned', updated_at = datetime('now')
        WHERE id = ?
      `).run(scanResultJson, session.id);

      const updated = db.prepare('SELECT * FROM sync_sessions WHERE id = ?').get(session.id);
      // 客户端可能已断开连接，避免写入已关闭的 socket
      if (req.socket.destroyed) return;
      res.json({ success: true, data: updated });
    } catch (err) {
      if (!req.socket.destroyed) next(err);
    }
  });
});

// ============================================================
// POST /:id/plan - Web 提交推送计划
// ============================================================
router.post('/:id/plan', (req, res, next) => {
  try {
    const session = validateSession(req, res);
    if (!session) return;

    // 只有 scanned 状态才能提交 plan
    if (session.status !== 'scanned') {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_STATUS', message: `当前状态为 ${session.status}，无法提交推送计划` },
      });
    }

    const { push_plan } = req.body;
    if (!push_plan) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: '缺少 push_plan 字段' },
      });
    }

    const db = getDb();
    const pushPlanJson = typeof push_plan === 'string' ? push_plan : JSON.stringify(push_plan);

    db.prepare(`
      UPDATE sync_sessions
      SET push_plan = ?, status = 'planned', updated_at = datetime('now')
      WHERE id = ?
    `).run(pushPlanJson, session.id);

    const updated = db.prepare('SELECT * FROM sync_sessions WHERE id = ?').get(session.id);
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// POST /:id/execute - 服务端直接执行推送（无需 CLI）
//
// 接收 push_plan → 重新扫描本地文件获取路径 → 逐个推送 → 写入结果
// 使用 setImmediate 避免阻塞事件循环
// ============================================================
router.post('/:id/execute', (req, res, next) => {
  const session = validateSession(req, res);
  if (!session) return;

  // 允许 scanned 或 planned 状态触发执行
  if (session.status !== 'scanned' && session.status !== 'planned') {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_STATUS', message: `当前状态为 ${session.status}，无法执行推送` },
    });
  }

  // 从请求体获取 push_plan（如果未传则使用已保存的 plan）
  const { push_plan } = req.body;
  if (!push_plan && !session.push_plan) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: '缺少 push_plan' },
    });
  }

  if (!session.scan_result) {
    return res.status(400).json({
      success: false,
      error: { code: 'NO_SCAN_RESULT', message: '缺少扫描结果，请先执行扫描' },
    });
  }

  // 保存 plan 并标记为 pushing，防止重复触发
  const db = getDb();
  const planJson = push_plan
    ? (typeof push_plan === 'string' ? push_plan : JSON.stringify(push_plan))
    : session.push_plan;
  db.prepare("UPDATE sync_sessions SET push_plan = ?, status = 'pushing', updated_at = datetime('now') WHERE id = ?")
    .run(planJson, session.id);

  setImmediate(async () => {
    // 超时保护：5 分钟后自动结束，避免长时间占用连接
    const EXECUTE_TIMEOUT_MS = 5 * 60 * 1000;
    const timeout = setTimeout(() => {
      if (!req.socket.destroyed && !res.headersSent) {
        db.prepare("UPDATE sync_sessions SET status = 'failed', error_message = ? WHERE id = ?")
          .run('推送执行超时（5分钟）', session.id);
        res.status(504).json({ success: false, error: { code: 'TIMEOUT', message: '推送执行超时，请重试' } });
      }
    }, EXECUTE_TIMEOUT_MS);

    try {
      const pushPlan = JSON.parse(planJson);
      const pushItems = Array.isArray(pushPlan.items) ? pushPlan.items : [];

      // 结构校验：过滤掉缺少必要字段的无效项
      const validItems = pushItems.filter(item =>
        item && typeof item.platform === 'string' && typeof item.type === 'string' && typeof item.name === 'string'
      );

      if (validItems.length === 0) {
        db.prepare("UPDATE sync_sessions SET status = 'done', push_result = ?, updated_at = datetime('now') WHERE id = ?")
          .run(JSON.stringify({ items: [], summary: { success: 0, fail: 0, total: 0 } }), session.id);
        clearTimeout(timeout);
        if (!req.socket.destroyed) res.json({ success: true, data: { results: [], summary: { success: 0, fail: 0 } } });
        return;
      }

      // 1. 重新扫描获取本地文件路径
      const allScanItems = scanner.scanAll();

      // 2. 构建映射：platform:type:name → scanItem（含完整文件路径）
      const scanItemMap = {};
      for (const item of allScanItems) {
        const key = `${item.platform}:${item.type}:${item.name}`;
        scanItemMap[key] = item;
      }

      // 3. 逐个推送
      const results = [];

      for (const planItem of validItems) {
        const scanKey = `${planItem.platform}:${planItem.type}:${planItem.name}`;
        const scanItem = scanItemMap[scanKey];

        if (!scanItem) {
          results.push({ success: false, name: planItem.name, displayName: planItem.displayName, error: '本地文件未找到（可能在扫描后已被删除）' });
          continue;
        }

        try {
          // 构建文件对象（模拟 multer memoryStorage 格式）
          const files = prepareFiles(scanItem);

          if (planItem.status === 'new') {
            // ── 新增资源 ──
            const metadata = {
              name: planItem.name,
              display_name: planItem.displayName || planItem.name,
              type: planItem.type,
              description: planItem.description || `从 ${planItem.platform} 同步导入`,
              author_id: session.user_id,
              tags: [],
              platform: planItem.platform,  // 记录来源平台，区分不同平台的同名资源
            };
            const created = await resourceManager.create(metadata, files);
            results.push({
              success: true,
              name: planItem.name,
              displayName: planItem.displayName,
              action: '创建新资源',
              id: created.id,
              version: created.current_version,
            });

          } else if (planItem.status === 'updated') {
            // ── 更新资源：添加新版本 ──
            const existing = planItem.remoteId
              ? resourceModel.findById(planItem.remoteId)
              : resourceModel.findByName(planItem.name);

            if (!existing) {
              results.push({ success: false, name: planItem.name, displayName: planItem.displayName, error: '远端资源未找到' });
              continue;
            }

            const nextVersion = incrementSemver(existing.current_version, 'patch');
            const updated = await resourceManager.addVersion(
              existing.id,
              nextVersion,
              `从 ${planItem.platform} 同步更新`,
              files
            );

            // 如果扫描提取到了 description，且当前资源 description 为空或为 fallback 文本，则更新
            if (planItem.description && planItem.description !== `从 ${planItem.platform} 同步导入`) {
              resourceModel.update(existing.id, { description: planItem.description });
            }

            results.push({
              success: true,
              name: planItem.name,
              displayName: planItem.displayName,
              action: '添加新版本',
              id: existing.id,
              version: updated.current_version,
            });

          } else {
            results.push({ success: false, name: planItem.name, displayName: planItem.displayName, error: `不支持的状态: ${planItem.status}` });
          }
        } catch (err) {
          results.push({
            success: false,
            name: planItem.name,
            displayName: planItem.displayName,
            error: err.message || '推送失败',
          });
        }
      }

      // 4. 写入结果
      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;
      const finalStatus = failCount === validItems.length ? 'failed' : 'done';

      const pushResult = { items: results, summary: { success: successCount, fail: failCount, total: validItems.length } };

      db.prepare("UPDATE sync_sessions SET push_result = ?, status = ?, updated_at = datetime('now') WHERE id = ?")
        .run(JSON.stringify(pushResult), finalStatus, session.id);

      clearTimeout(timeout);
      if (!req.socket.destroyed) {
        res.json({ success: true, data: pushResult });
      }
    } catch (err) {
      // 整体失败
      clearTimeout(timeout);
      db.prepare("UPDATE sync_sessions SET status = 'failed', error_message = ?, updated_at = datetime('now') WHERE id = ?")
        .run(err.message, session.id);
      if (!req.socket.destroyed && !res.headersSent) next(err);
    }
  });
});

/**
 * 辅助：从扫描项构建 multer 兼容的文件对象数组
 *
 * 安全防护：所有文件路径必须在 HOME 目录内，拒绝路径回溯和外部符号链接。
 *
 * @param {object} scanItem - scanner.scanAll() 返回的条目 { platform, type, name, files: [absPath...] }
 * @returns {Array<{originalname: string, buffer: Buffer, path: string}>}
 */
function prepareFiles(scanItem) {
  const filePaths = scanItem.files || [];
  const homeDir = os.homedir();

  // 对于 expert 类型（多文件 + 目录结构），计算相对路径
  // 找到所有文件的公共父目录，作为基准计算相对路径
  const baseDir = findCommonBaseDir(filePaths);

  return filePaths.filter(fp => {
    try {
      const resolved = path.resolve(fp);
      // 路径必须在 HOME 目录内，且不含路径回溯
      if (!resolved.startsWith(homeDir) || fp.includes('..')) return false;
      return fs.statSync(resolved).isFile();
    } catch { return false; }
  }).map(fp => {
    const resolved = path.resolve(fp);
    const content = fs.readFileSync(resolved);
    // 计算相对路径（expert 保留子目录结构，skill 直接用文件名）
    const relativePath = baseDir
      ? path.relative(baseDir, resolved)
      : path.basename(resolved);

    return {
      originalname: path.basename(resolved),
      buffer: content,
      path: relativePath,
    };
  });
}

/**
 * 辅助：找到文件路径列表的公共父目录
 * 如果文件在不同目录下，返回 null（使用文件名）
 *
 * @param {string[]} filePaths - 绝对路径数组
 * @returns {string|null} 公共父目录路径，或 null
 */
function findCommonBaseDir(filePaths) {
  if (filePaths.length === 0) return null;
  if (filePaths.length === 1) return path.dirname(filePaths[0]);

  const dirs = filePaths.map(fp => path.dirname(fp));
  const uniqueDirs = [...new Set(dirs)];

  // 所有文件在同一目录
  if (uniqueDirs.length === 1) return uniqueDirs[0];

  // 多个目录：找最长公共前缀目录
  const parts0 = dirs[0].split(path.sep);
  let commonParts = [...parts0];

  for (let i = 1; i < dirs.length; i++) {
    const partsI = dirs[i].split(path.sep);
    const newCommon = [];
    for (let j = 0; j < Math.min(commonParts.length, partsI.length); j++) {
      if (commonParts[j] === partsI[j]) {
        newCommon.push(commonParts[j]);
      } else {
        break;
      }
    }
    commonParts = newCommon;
  }

  const commonDir = commonParts.join(path.sep);
  return commonDir || null;
}

// ============================================================
// POST /:id/result - CLI 提交推送结果（支持增量更新）
// ============================================================
router.post('/:id/result', (req, res, next) => {
  try {
    const session = validateSession(req, res);
    if (!session) return;

    // 只有 planned 或 pushing 状态才能提交 result
    if (session.status !== 'planned' && session.status !== 'pushing') {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_STATUS', message: `当前状态为 ${session.status}，无法提交推送结果` },
      });
    }

    const { push_result, status, error_message } = req.body;
    if (!push_result) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: '缺少 push_result 字段' },
      });
    }

    const newResult = typeof push_result === 'string' ? JSON.parse(push_result) : push_result;

    // 增量合并：如果已有 push_result，合并新数据到已有数据中
    let mergedResult;
    if (session.push_result) {
      try {
        const existingResult = JSON.parse(session.push_result);
        mergedResult = { ...existingResult, ...newResult };
      } catch {
        mergedResult = newResult;
      }
    } else {
      mergedResult = newResult;
    }

    // 决定最终状态：如果传入 status='done' 或 'failed'，使用传入值；否则设为 'pushing'
    const finalStatus = status || 'pushing';

    const db = getDb();
    db.prepare(`
      UPDATE sync_sessions
      SET push_result = ?, status = ?, error_message = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(
      JSON.stringify(mergedResult),
      finalStatus,
      error_message || null,
      session.id
    );

    const updated = db.prepare('SELECT * FROM sync_sessions WHERE id = ?').get(session.id);
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// DELETE /:id - 清理会话
// ============================================================
router.delete('/:id', (req, res, next) => {
  try {
    const session = validateSession(req, res);
    if (!session) return;

    const db = getDb();
    db.prepare('DELETE FROM sync_sessions WHERE id = ?').run(session.id);

    res.json({ success: true, data: { deleted: true } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;