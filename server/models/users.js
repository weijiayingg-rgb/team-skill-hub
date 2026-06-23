const { getDb } = require('./db');

function deserializeResources(rows) {
  return rows.map(row => ({
    ...row,
    tags: safeParse(row.tags, []),
    files: safeParse(row.files, []),
  }));
}

function safeParse(str, defaultVal) {
  try { return JSON.parse(str); } catch { return defaultVal; }
}

class UserModel {
  findAll() {
    const db = getDb();
    return db.prepare('SELECT * FROM users ORDER BY id').all();
  }

  findById(id) {
    const db = getDb();
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  }

  findByUsername(username) {
    const db = getDb();
    return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  }

  create(data) {
    const db = getDb();
    const { username, display_name, avatar_url = null, role = 'member' } = data;
    const result = db.prepare(`
      INSERT INTO users (username, display_name, avatar_url, role)
      VALUES (?, ?, ?, ?)
    `).run(username, display_name, avatar_url, role);
    return this.findById(result.lastInsertRowid);
  }

  update(id, data) {
    const db = getDb();
    const fields = [];
    const params = [];
    const allowedFields = ['display_name', 'avatar_url', 'role'];
    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        fields.push(`${field} = ?`);
        params.push(data[field]);
      }
    }
    if (fields.length === 0) return this.findById(id);
    fields.push(`updated_at = datetime('now')`);
    params.push(id);
    db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...params);
    return this.findById(id);
  }

  getResources(userId, type) {
    const db = getDb();
    let sql = 'SELECT * FROM resources WHERE author_id = ? ORDER BY created_at DESC';
    const params = [userId];
    if (type) {
      sql = 'SELECT * FROM resources WHERE author_id = ? AND type = ? ORDER BY created_at DESC';
      params.push(type);
    }
    return deserializeResources(db.prepare(sql).all(...params));
  }

  getFavorites(userId) {
    const db = getDb();
    return deserializeResources(db.prepare(`
      SELECT r.* FROM resources r
      JOIN interactions i ON r.id = i.resource_id AND i.type = 'favorite'
      WHERE i.user_id = ?
      ORDER BY i.created_at DESC
    `).all(userId));
  }

  getDownloads(userId) {
    const db = getDb();
    return deserializeResources(db.prepare(`
      SELECT r.* FROM resources r
      JOIN interactions i ON r.id = i.resource_id AND i.type = 'download'
      WHERE i.user_id = ?
      ORDER BY i.created_at DESC
    `).all(userId));
  }

  getStats(userId) {
    const db = getDb();
    const uploaded = db.prepare("SELECT COUNT(*) as count FROM resources WHERE author_id = ? AND status = 'published'").get(userId);
    const favorites = db.prepare("SELECT COUNT(*) as count FROM interactions WHERE user_id = ? AND type = 'favorite'").get(userId);
    const downloads = db.prepare("SELECT COUNT(*) as count FROM interactions WHERE user_id = ? AND type = 'download'").get(userId);
    const totalDownloads = db.prepare("SELECT SUM(download_count) as total FROM resources WHERE author_id = ? AND status = 'published'").get(userId);
    return {
      uploadedCount: uploaded.count,
      favoritesCount: favorites.count,
      downloadsCount: downloads.count,
      totalDownloads: totalDownloads.total || 0,
    };
  }
}

module.exports = new UserModel();
