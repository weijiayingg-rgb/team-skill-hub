/**
 * 本地状态数据库管理模块
 *
 * 管理 ~/.skhub/local-state.db SQLite 数据库，跟踪本地扫描出的 Skill
 * 与远程 SkillHub 服务器之间的同步状态。
 *
 * 表结构：local_skills
 *   - name            本地资源唯一名称（platform:type:name 组合键的一部分）
 *   - type            资源类型（skill / expert）
 *   - platform        来源平台（claude-code / cursor / workbuddy）
 *   - display_name    用户可读的显示名称
 *   - content_hash    本地文件内容的 SHA256 组合指纹
 *   - remote_hash     远端同名资源的最新 content_hash
 *   - remote_id       远端资源记录的数据库 ID
 *   - remote_version  远端资源的最新版本号
 *   - status          同步状态：new / synced / updated / local
 *                     new      — 本地新增，远端不存在
 *                     synced   — 本地与远端指纹一致
 *                     updated  — 本地内容有更新（指纹不一致）
 *                     local    — 仅本地存在，未与远端比对过
 *   - file_paths      本地文件路径列表（JSON 数组字符串）
 *   - scanned_at      最近一次本地扫描时间
 *   - synced_at       最近一次与远端比对时间
 *
 * 使用 better-sqlite3 同步 API，require 语法，单例模式。
 * 首次调用 getDb() 时自动确保目录存在并创建表。
 */

const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');
const fs = require('fs');

/** 数据库文件路径：~/.skhub/local-state.db */
const DB_PATH = path.join(os.homedir(), '.skhub', 'local-state.db');

/** 数据库单例，避免重复打开连接 */
let dbInstance = null;

/**
 * 获取数据库单例连接
 *
 * 首次调用时：
 *   1. 确保 ~/.skhub/ 目录存在
 *   2. 打开 SQLite 连接，启用 WAL 模式
 *   3. 执行建表和索引迁移
 *
 * @returns {Database} better-sqlite3 数据库实例
 */
function getDb() {
  if (dbInstance) return dbInstance;

  // 确保数据库目录存在
  const dbDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  dbInstance = new Database(DB_PATH);
  dbInstance.pragma('journal_mode = WAL');

  runMigrations(dbInstance);

  return dbInstance;
}

/**
 * 执行数据库迁移：建表和索引
 *
 * @param {Database} db - better-sqlite3 数据库实例
 */
function runMigrations(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS local_skills (
      name            TEXT    NOT NULL,
      type            TEXT    NOT NULL,
      platform        TEXT    NOT NULL,
      display_name    TEXT    NOT NULL DEFAULT '',
      content_hash    TEXT,
      remote_hash     TEXT,
      remote_id       INTEGER,
      remote_version  TEXT,
      status          TEXT    NOT NULL DEFAULT 'local',
      file_paths      TEXT    NOT NULL DEFAULT '[]',
      scanned_at      TEXT    NOT NULL DEFAULT (datetime('now')),
      synced_at       TEXT,
      PRIMARY KEY (platform, type, name)
    );
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_local_skills_status
      ON local_skills(status);
    CREATE INDEX IF NOT EXISTS idx_local_skills_name
      ON local_skills(name);
    CREATE INDEX IF NOT EXISTS idx_local_skills_content_hash
      ON local_skills(content_hash);
  `);
}

/**
 * 插入或更新一条本地 Skill 记录
 *
 * 如果 (platform, type, name) 组合已存在则更新，否则插入。
 * 更新时保留已有的 remote_hash / remote_id / remote_version / status / synced_at 字段，
 * 仅覆盖本地扫描相关的字段。
 *
 * @param {object} skill - Skill 记录对象
 * @param {string} skill.name        - 资源名称
 * @param {string} skill.type        - 资源类型（skill / expert）
 * @param {string} skill.platform    - 来源平台
 * @param {string} [skill.display_name]  - 显示名称，默认等于 name
 * @param {string} [skill.content_hash]  - 本地内容指纹
 * @param {string[]} [skill.file_paths]  - 本地文件路径数组
 * @param {string} [skill.status]        - 同步状态，默认 'local'
 * @returns {object} better-sqlite3 run() 的返回信息（changes 等）
 */
function upsertSkill(skill) {
  const db = getDb();

  const stmt = db.prepare(`
    INSERT INTO local_skills (name, type, platform, display_name, content_hash, file_paths, status, scanned_at)
    VALUES (:name, :type, :platform, :display_name, :content_hash, :file_paths, :status, datetime('now'))
    ON CONFLICT(platform, type, name) DO UPDATE SET
      display_name  = excluded.display_name,
      content_hash  = excluded.content_hash,
      file_paths    = excluded.file_paths,
      status        = CASE
                        WHEN excluded.content_hash = local_skills.remote_hash AND local_skills.remote_hash IS NOT NULL
                          THEN 'synced'
                        WHEN local_skills.remote_hash IS NOT NULL AND excluded.content_hash != local_skills.remote_hash
                          THEN 'updated'
                        ELSE excluded.status
                      END,
      scanned_at    = datetime('now')
  `);

  return stmt.run({
    name: skill.name,
    type: skill.type,
    platform: skill.platform,
    display_name: skill.display_name || skill.name || '',
    content_hash: skill.content_hash || null,
    file_paths: JSON.stringify(skill.file_paths || []),
    status: skill.status || 'local',
  });
}

/**
 * 获取所有本地 Skill 记录
 *
 * @returns {object[]} 所有记录数组，每条记录的 file_paths 字段会从 JSON 字符串反序列化为数组
 */
function getAllSkills() {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM local_skills ORDER BY platform, type, name').all();
  return rows.map(deserializeRow);
}

/**
 * 按名称查询本地 Skill 记录
 *
 * name 在不同 platform/type 下可能重复，因此返回匹配的所有记录。
 *
 * @param {string} name - 资源名称
 * @returns {object[]} 匹配的记录数组，file_paths 已反序列化
 */
function getSkillByName(name) {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM local_skills WHERE name = ?').all(name);
  return rows.map(deserializeRow);
}

/**
 * 更新本地 Skill 的远端信息
 *
 * 在上传/更新资源成功后调用，更新 remote_hash / remote_id / remote_version / status / synced_at。
 * 使用 (platform, type, name) 复合主键定位记录，避免同名资源在不同平台下误更新。
 *
 * @param {string} name         - 资源名称
 * @param {string} remoteHash   - 远端资源的 content_hash（推送后等于本地哈希）
 * @param {number} remoteId     - 远端资源的数据库 ID
 * @param {string} remoteVersion - 远端资源的版本号
 * @param {string} [status]     - 强制指定的状态（可选，不传则自动判定）
 * @param {string} [platform]   - 来源平台（可选，默认更新所有同名记录；建议传入以精确匹配）
 * @param {string} [type]       - 资源类型（可选，配合 platform 精确匹配）
 * @returns {object} better-sqlite3 run() 的返回信息
 */
function updateRemoteInfo(name, remoteHash, remoteId, remoteVersion, status, platform, type) {
  const db = getDb();

  if (platform && type) {
    // 精确匹配复合主键 (platform, type, name)
    const stmt = db.prepare(`
      UPDATE local_skills
      SET remote_hash    = :remote_hash,
          remote_id      = :remote_id,
          remote_version = :remote_version,
          status         = :status,
          synced_at      = datetime('now')
      WHERE platform = :platform AND type = :type AND name = :name
    `);

    return stmt.run({
      name,
      platform,
      type,
      remote_hash: remoteHash || null,
      remote_id: remoteId || null,
      remote_version: remoteVersion || null,
      status: status || null,
    });
  }

  // 无 platform/type 时按 name 匹配（兼容旧调用方式）
  const stmt = db.prepare(`
    UPDATE local_skills
    SET remote_hash    = :remote_hash,
        remote_id      = :remote_id,
        remote_version = :remote_version,
        status         = :status,
        synced_at      = datetime('now')
    WHERE name = :name
  `);

  return stmt.run({
    name,
    remote_hash: remoteHash || null,
    remote_id: remoteId || null,
    remote_version: remoteVersion || null,
    status: status || null,
  });
}

/**
 * 按同步状态筛选本地 Skill 记录
 *
 * @param {string} status - 同步状态（new / synced / updated / local）
 * @returns {object[]} 匹配的记录数组，file_paths 已反序列化
 */
function getSkillsByStatus(status) {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM local_skills WHERE status = ? ORDER BY platform, type, name').all(status);
  return rows.map(deserializeRow);
}

/**
 * 将本地 Skills 与远端指纹映射比对，自动更新同步状态
 *
 * 比对逻辑：
 *   1. 本地存在 + 远端存在 + 指纹一致      → status = 'synced'
 *   2. 本地存在 + 远端存在 + 指纹不一致    → status = 'updated'
 *   3. 本地存在 + 远端不存在               → status = 'new'
 *   4. 本地记录在远端指纹映射中无匹配       → status = 'local'（保留原状态）
 *
 * fingerprintMap 结构示例：
 *   {
 *     "claude-code:skill:review": { hash: "abc123", id: 42, version: "1.2.0" },
 *     "cursor:skill:debug":       { hash: "def456", id: 15, version: "2.0.0" }
 *   }
 *
 * 键的格式为 "platform:type:name"，与 scanner 输出的指纹 id 字段一致。
 *
 * @param {object} fingerprintMap - 远端指纹映射，键为 "platform:type:name"，值为 { hash, id, version }
 * @returns {object} 比对结果摘要：
 *   {
 *     synced:   number,  — 指纹一致的记录数
 *     updated:  number,  — 指纹不一致的记录数
 *     new:      number,  — 远端不存在的记录数
 *     local:    number,  — 未比对的记录数（保留原状态）
 *   }
 */
function compareWithRemote(fingerprintMap) {
  const db = getDb();
  const allSkills = db.prepare('SELECT * FROM local_skills').all();

  const summary = { synced: 0, updated: 0, new: 0, local: 0 };

  // 使用事务批量更新，提升性能
  const updateStmt = db.prepare(`
    UPDATE local_skills
    SET remote_hash    = :remote_hash,
        remote_id      = :remote_id,
        remote_version = :remote_version,
        status         = :status,
        synced_at      = datetime('now')
    WHERE platform = :platform AND type = :type AND name = :name
  `);

  const transaction = db.transaction((skills) => {
    for (const skill of skills) {
      const key = `${skill.platform}:${skill.type}:${skill.name}`;
      const remote = fingerprintMap[key];

      if (!remote) {
        // 远端不存在此资源
        if (skill.status === 'local') {
          // 保留 local 状态，不做更新——尚未与远端比对过
          summary.local++;
        } else {
          // 曾经比对过但远端现已不存在，标记为 new
          updateStmt.run({
            platform: skill.platform,
            type: skill.type,
            name: skill.name,
            remote_hash: null,
            remote_id: null,
            remote_version: null,
            status: 'new',
          });
          summary.new++;
        }
        continue;
      }

      // 远端存在，比对指纹
      const isSame = skill.content_hash === remote.hash;

      const newStatus = isSame ? 'synced' : 'updated';
      updateStmt.run({
        platform: skill.platform,
        type: skill.type,
        name: skill.name,
        remote_hash: remote.hash,
        remote_id: remote.id,
        remote_version: remote.version,
        status: newStatus,
      });

      summary[newStatus]++;
    }
  });

  transaction(allSkills);

  return summary;
}

/**
 * 清空所有本地 Skill 记录
 *
 * 通常在需要重新全量扫描时调用。使用 DELETE 而非 DROP TABLE，
 * 保留表结构和索引。
 *
 * @returns {object} better-sqlite3 run() 的返回信息
 */
function clearAll() {
  const db = getDb();
  return db.prepare('DELETE FROM local_skills').run();
}

/**
 * 反序列化行数据：将 file_paths 从 JSON 字符串还原为数组
 *
 * @param {object} row - 数据库查询返回的原始行对象
 * @returns {object} 处理后的行对象，file_paths 为数组类型
 */
function deserializeRow(row) {
  return {
    ...row,
    file_paths: JSON.parse(row.file_paths || '[]'),
  };
}

module.exports = {
  getDb,
  upsertSkill,
  getAllSkills,
  getSkillByName,
  updateRemoteInfo,
  getSkillsByStatus,
  compareWithRemote,
  clearAll,
};