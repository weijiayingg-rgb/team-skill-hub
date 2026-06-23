const Database = require('better-sqlite3');
const path = require('path');
const config = require('../config');

let db = null;

function getDb() {
  if (db) return db;

  const dbDir = path.dirname(config.dbPath);
  const fs = require('fs');
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  db = new Database(config.dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  runMigrations(db);

  return db;
}

function runMigrations(db) {
  // 用户表
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      username    TEXT    NOT NULL UNIQUE,
      display_name TEXT   NOT NULL,
      avatar_url  TEXT,
      role        TEXT    NOT NULL DEFAULT 'member',
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // 资源表
  db.exec(`
    CREATE TABLE IF NOT EXISTS resources (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      name            TEXT    NOT NULL,
      display_name    TEXT    NOT NULL,
      type            TEXT    NOT NULL,
      description     TEXT    DEFAULT '',
      author_id       INTEGER NOT NULL REFERENCES users(id),
      current_version TEXT    NOT NULL DEFAULT '1.0.0',
      tags            TEXT    DEFAULT '[]',
      status          TEXT    NOT NULL DEFAULT 'pending',
      git_path        TEXT    NOT NULL,
      files           TEXT    DEFAULT '[]',
      download_count  INTEGER NOT NULL DEFAULT 0,
      like_count      INTEGER NOT NULL DEFAULT 0,
      favorite_count  INTEGER NOT NULL DEFAULT 0,
      comment_count   INTEGER NOT NULL DEFAULT 0,
      hot_score       REAL    NOT NULL DEFAULT 0.0,
      content_hash    TEXT,
      created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // 资源版本表
  db.exec(`
    CREATE TABLE IF NOT EXISTS resource_versions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      resource_id INTEGER NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
      version     TEXT    NOT NULL,
      changelog   TEXT    DEFAULT '',
      git_tag     TEXT    NOT NULL,
      file_url    TEXT,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      UNIQUE(resource_id, version)
    );
  `);

  // 标签表
  db.exec(`
    CREATE TABLE IF NOT EXISTS tags (
      id   INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT    NOT NULL UNIQUE
    );
  `);

  // 资源-标签关联表
  db.exec(`
    CREATE TABLE IF NOT EXISTS resource_tags (
      resource_id INTEGER NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
      tag_id      INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (resource_id, tag_id)
    );
  `);

  // 交互记录表
  db.exec(`
    CREATE TABLE IF NOT EXISTS interactions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      resource_id INTEGER NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
      type        TEXT    NOT NULL,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, resource_id, type)
    );
  `);

  // 评论表
  db.exec(`
    CREATE TABLE IF NOT EXISTS comments (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      resource_id INTEGER NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
      content     TEXT    NOT NULL,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // 通知表
  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      recipient_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      actor_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      resource_id     INTEGER REFERENCES resources(id) ON DELETE SET NULL,
      type            TEXT    NOT NULL,
      message         TEXT    NOT NULL,
      is_read         INTEGER NOT NULL DEFAULT 0,
      created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Bundle 表
  db.exec(`
    CREATE TABLE IF NOT EXISTS bundles (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL,
      description TEXT    DEFAULT '',
      author_id   INTEGER NOT NULL REFERENCES users(id),
      version     TEXT    NOT NULL DEFAULT '1.0.0',
      resources   TEXT    NOT NULL DEFAULT '[]',
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Expert 引用的 Skill 关联表（引用模型：Expert 不内嵌 Skill 文件，只记录引用关系）
  db.exec(`
    CREATE TABLE IF NOT EXISTS expert_skill_refs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      expert_id   INTEGER NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
      skill_name  TEXT    NOT NULL,
      skill_id    INTEGER REFERENCES resources(id) ON DELETE SET NULL,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      UNIQUE(expert_id, skill_name)
    );
  `);

  // 配置表
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // 同步会话表
  db.exec(`
    CREATE TABLE IF NOT EXISTS sync_sessions (
      id            TEXT PRIMARY KEY,
      user_id       INTEGER NOT NULL REFERENCES users(id),
      status        TEXT    NOT NULL DEFAULT 'waiting',
      scan_result   TEXT    DEFAULT NULL,
      push_plan     TEXT    DEFAULT NULL,
      push_result   TEXT    DEFAULT NULL,
      error_message TEXT    DEFAULT NULL,
      created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT    NOT NULL DEFAULT (datetime('now')),
      expires_at    TEXT    NOT NULL DEFAULT (datetime('now', '+30 minutes'))
    );
  `);

  // sync_sessions 索引
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_sync_sessions_user    ON sync_sessions(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_sync_sessions_status  ON sync_sessions(status);
    CREATE INDEX IF NOT EXISTS idx_sync_sessions_expires ON sync_sessions(expires_at);
  `);

  // 索引
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_resources_type      ON resources(type);
    CREATE INDEX IF NOT EXISTS idx_resources_status    ON resources(status);
    CREATE INDEX IF NOT EXISTS idx_resources_author_id ON resources(author_id);
    CREATE INDEX IF NOT EXISTS idx_resources_hot_score ON resources(hot_score DESC);
    CREATE INDEX IF NOT EXISTS idx_resources_name      ON resources(name);
    CREATE INDEX IF NOT EXISTS idx_resources_type_hot  ON resources(type, hot_score DESC);
    CREATE INDEX IF NOT EXISTS idx_resources_status_time ON resources(status, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_interactions_resource ON interactions(resource_id, type);
    CREATE INDEX IF NOT EXISTS idx_interactions_user     ON interactions(user_id);
    CREATE INDEX IF NOT EXISTS idx_comments_resource ON comments(resource_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_versions_resource ON resource_versions(resource_id, version);
    CREATE INDEX IF NOT EXISTS idx_resource_tags_tag ON resource_tags(tag_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id, is_read, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_notifications_resource ON notifications(resource_id);
    CREATE INDEX IF NOT EXISTS idx_expert_skill_refs_expert ON expert_skill_refs(expert_id);
    CREATE INDEX IF NOT EXISTS idx_expert_skill_refs_skill  ON expert_skill_refs(skill_id);
  `);

  // sync_sessions 列安全迁移（兼容已有数据库）
  try {
    const syncCols = db.prepare("PRAGMA table_info(sync_sessions)").all();
    const syncColNames = syncCols.map(c => c.name);

    if (!syncColNames.includes('scan_result')) {
      db.exec(`ALTER TABLE sync_sessions ADD COLUMN scan_result TEXT DEFAULT NULL`);
    }
    if (!syncColNames.includes('push_plan')) {
      db.exec(`ALTER TABLE sync_sessions ADD COLUMN push_plan TEXT DEFAULT NULL`);
    }
    if (!syncColNames.includes('push_result')) {
      db.exec(`ALTER TABLE sync_sessions ADD COLUMN push_result TEXT DEFAULT NULL`);
    }
    if (!syncColNames.includes('error_message')) {
      db.exec(`ALTER TABLE sync_sessions ADD COLUMN error_message TEXT DEFAULT NULL`);
    }
    if (!syncColNames.includes('expires_at')) {
      db.exec(`ALTER TABLE sync_sessions ADD COLUMN expires_at TEXT NOT NULL DEFAULT (datetime('now', '+30 minutes'))`);
    }
  } catch (e) {
    // 表不存在时忽略迁移错误（首次创建时表已包含全部列）
  }

  // 安全添加 files 列（兼容已有数据库）
  try {
    const cols = db.prepare("PRAGMA table_info(resources)").all();
    if (!cols.some(c => c.name === 'files')) {
      db.exec(`ALTER TABLE resources ADD COLUMN files TEXT DEFAULT '[]'`);
    }
    if (!cols.some(c => c.name === 'content_hash')) {
      db.exec(`ALTER TABLE resources ADD COLUMN content_hash TEXT`);
    }
    if (!cols.some(c => c.name === 'platform')) {
      db.exec(`ALTER TABLE resources ADD COLUMN platform TEXT DEFAULT NULL`);
    }
    // Expert 技能/工具数量缓存列（避免列表接口每次读 Git）
    if (!cols.some(c => c.name === 'skill_count')) {
      db.exec(`ALTER TABLE resources ADD COLUMN skill_count INTEGER NOT NULL DEFAULT 0`);
    }
    if (!cols.some(c => c.name === 'tool_count')) {
      db.exec(`ALTER TABLE resources ADD COLUMN tool_count INTEGER NOT NULL DEFAULT 0`);
    }
  } catch (e) {
    // 忽略迁移错误
  }

  // content_hash 索引
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_resources_content_hash ON resources(content_hash);
  `);

  // FTS5 全文搜索
  try {
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS resources_fts USING fts5(
        name,
        display_name,
        description,
        content='resources',
        content_rowid='id'
      );
    `);
  } catch (e) {
    // FTS5 table may already exist with content sync; ignore
  }

  // 触发器：自动同步 FTS 索引
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS resources_ai AFTER INSERT ON resources BEGIN
      INSERT INTO resources_fts(rowid, name, display_name, description)
      VALUES (new.id, new.name, new.display_name, new.description);
    END;
  `);

  db.exec(`
    CREATE TRIGGER IF NOT EXISTS resources_ad AFTER DELETE ON resources BEGIN
      INSERT INTO resources_fts(resources_fts, rowid, name, display_name, description)
      VALUES ('delete', old.id, old.name, old.display_name, old.description);
    END;
  `);

  db.exec(`
    CREATE TRIGGER IF NOT EXISTS resources_au AFTER UPDATE ON resources BEGIN
      INSERT INTO resources_fts(resources_fts, rowid, name, display_name, description)
      VALUES ('delete', old.id, old.name, old.display_name, old.description);
      INSERT INTO resources_fts(rowid, name, display_name, description)
      VALUES (new.id, new.name, new.display_name, new.description);
    END;
  `);
}

module.exports = { getDb };
