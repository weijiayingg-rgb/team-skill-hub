const { getDb } = require('./db');

class InteractionModel {
  create(userId, resourceId, type) {
    const db = getDb();
    try {
      db.prepare(`
        INSERT OR IGNORE INTO interactions (user_id, resource_id, type)
        VALUES (?, ?, ?)
      `).run(userId, resourceId, type);

      // 更新资源计数
      const countField = type === 'like' ? 'like_count'
        : type === 'favorite' ? 'favorite_count'
        : type === 'download' ? 'download_count'
        : null;

      if (countField) {
        db.prepare(`UPDATE resources SET ${countField} = (SELECT COUNT(*) FROM interactions WHERE resource_id = ? AND type = ?) WHERE id = ?`)
          .run(resourceId, type, resourceId);
      }

      // 更新热度
      db.prepare(`
        UPDATE resources SET hot_score = (
          SELECT CAST(
            (r.download_count * 2.0 + r.like_count * 3.0 + r.favorite_count * 5.0 + r.comment_count * 4.0)
            / POWER((julianday('now') - julianday(r.created_at)) * 24.0 + 2.0, 1.5)
          AS REAL)
          FROM resources r WHERE r.id = ?
        ) WHERE id = ?
      `).run(resourceId, resourceId);

      return true;
    } catch (e) {
      return false;
    }
  }

  remove(userId, resourceId, type) {
    const db = getDb();
    const result = db.prepare(`
      DELETE FROM interactions WHERE user_id = ? AND resource_id = ? AND type = ?
    `).run(userId, resourceId, type);

    if (result.changes > 0) {
      const countField = type === 'like' ? 'like_count'
        : type === 'favorite' ? 'favorite_count'
        : type === 'download' ? 'download_count'
        : null;

      if (countField) {
        db.prepare(`UPDATE resources SET ${countField} = (SELECT COUNT(*) FROM interactions WHERE resource_id = ? AND type = ?) WHERE id = ?`)
          .run(resourceId, type, resourceId);
      }

      db.prepare(`
        UPDATE resources SET hot_score = (
          SELECT CAST(
            (r.download_count * 2.0 + r.like_count * 3.0 + r.favorite_count * 5.0 + r.comment_count * 4.0)
            / POWER((julianday('now') - julianday(r.created_at)) * 24.0 + 2.0, 1.5)
          AS REAL)
          FROM resources r WHERE r.id = ?
        ) WHERE id = ?
      `).run(resourceId, resourceId);

      return true;
    }
    return false;
  }

  checkExists(userId, resourceId, type) {
    const db = getDb();
    const row = db.prepare(`
      SELECT id FROM interactions WHERE user_id = ? AND resource_id = ? AND type = ?
    `).get(userId, resourceId, type);
    return !!row;
  }

  getUserInteractions(userId, resourceId) {
    const db = getDb();
    const rows = db.prepare(`
      SELECT type FROM interactions WHERE user_id = ? AND resource_id = ?
    `).all(userId, resourceId);
    return {
      liked: rows.some(r => r.type === 'like'),
      favorited: rows.some(r => r.type === 'favorite'),
    };
  }
}

module.exports = new InteractionModel();
