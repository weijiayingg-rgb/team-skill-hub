#!/usr/bin/env node
/**
 * migrate-db.js — 将旧命名 (agenthub) 的数据库和注册中心迁移到新命名 (skillhub)
 *
 * 执行内容：
 *   - data/agenthub.db      → data/skillhub.db
 *   - data/agenthub.db-shm  → data/skillhub.db-shm
 *   - data/agenthub.db-wal  → data/skillhub.db-wal
 *   - data/agenthub-registry/ → data/skillhub-registry/
 *
 * 安全措施：
 *   - 如果新路径已存在，跳过对应步骤（不会覆盖）
 *   - 如果旧路径不存在，跳过对应步骤（无需迁移）
 *   - 所有操作都有明确的日志输出
 *
 * 用法：node scripts/migrate-db.js
 */

const fs = require('fs');
const path = require('path');

// 项目根目录下的 data 文件夹
const DATA_DIR = path.join(__dirname, '..', 'server', 'data');

/**
 * 安全重命名单个文件
 * @param {string} oldPath - 旧文件绝对路径
 * @param {string} newPath - 新文件绝对路径
 * @param {string} label   - 用于日志的描述标签
 */
function renameFile(oldPath, newPath, label) {
  if (!fs.existsSync(oldPath)) {
    console.log(`[SKIP] ${label}: 旧文件不存在 (${oldPath})`);
    return;
  }

  if (fs.existsSync(newPath)) {
    console.log(`[SKIP] ${label}: 新文件已存在 (${newPath})，避免覆盖`);
    return;
  }

  try {
    fs.renameSync(oldPath, newPath);
    console.log(`[DONE] ${label}: ${oldPath} → ${newPath}`);
  } catch (err) {
    console.error(`[ERROR] ${label}: 重命名失败 — ${err.message}`);
    // 不中断流程，继续尝试其他迁移步骤
  }
}

/**
 * 安全重命名目录
 * @param {string} oldDir - 旧目录绝对路径
 * @param {string} newDir - 新目录绝对路径
 * @param {string} label  - 用于日志的描述标签
 */
function renameDir(oldDir, newDir, label) {
  if (!fs.existsSync(oldDir)) {
    console.log(`[SKIP] ${label}: 旧目录不存在 (${oldDir})`);
    return;
  }

  if (fs.existsSync(newDir)) {
    console.log(`[SKIP] ${label}: 新目录已存在 (${newDir})，避免覆盖`);
    return;
  }

  try {
    fs.renameSync(oldDir, newDir);
    console.log(`[DONE] ${label}: ${oldDir} → ${newDir}`);
  } catch (err) {
    console.error(`[ERROR] ${label}: 重命名失败 — ${err.message}`);
    // 目录重命名可能因为内部文件锁定失败，提示用户手动处理
    console.error(`        请手动执行: mv "${oldDir}" "${newDir}"`);
  }
}

/**
 * 主迁移流程
 */
function migrate() {
  console.log('=== AgentHub → SkillHub 数据迁移 ===');
  console.log(`数据目录: ${DATA_DIR}\n`);

  // 确保 data 目录存在
  if (!fs.existsSync(DATA_DIR)) {
    console.log('[INFO] data 目录不存在，无需迁移');
    return;
  }

  // 1. 重命名 SQLite 数据库主文件
  renameFile(
    path.join(DATA_DIR, 'agenthub.db'),
    path.join(DATA_DIR, 'skillhub.db'),
    '数据库主文件'
  );

  // 2. 重命名 SQLite 共享内存文件 (-shm)
  renameFile(
    path.join(DATA_DIR, 'agenthub.db-shm'),
    path.join(DATA_DIR, 'skillhub.db-shm'),
    '数据库 SHM 文件'
  );

  // 3. 重命名 SQLite 写前日志文件 (-wal)
  renameFile(
    path.join(DATA_DIR, 'agenthub.db-wal'),
    path.join(DATA_DIR, 'skillhub.db-wal'),
    '数据库 WAL 文件'
  );

  // 4. 重命名注册中心目录
  renameDir(
    path.join(DATA_DIR, 'agenthub-registry'),
    path.join(DATA_DIR, 'skillhub-registry'),
    '注册中心目录'
  );

  console.log('\n=== 迁移完成 ===');
  console.log('提示：迁移后请重启服务，config.js 会自动检测新路径。');
  console.log('      如果部分步骤失败，请按日志中的手动命令执行后重试。');
}

migrate();