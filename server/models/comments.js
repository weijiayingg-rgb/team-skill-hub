const { getDb } = require('./db');

class CommentModel {
  findByResourceId(resourceId, page = 1, pageSize = 20) {
    const db = getDb();
    const limit = Math.min(pageSize, 100);
    const offset = (page - 1) * limit;

    const countStmt = db.prepare('SELECT COUNT(*) as total FROM comments WHERE resource_id = ?');
    const { total } = countStmt.get(resourceId);

    const rows = db.prepare(`
      SELECT c.*, u.username as author_name, u.display_name as author_display_name, u.avatar_url as author_avatar
      FROM comments c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.resource_id = ?
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?
    `).all(resourceId, limit, offset);

    return { data: rows, meta: { total, page, pageSize: limit } };
  }

  findById(id) {
    const db = getDb();
    return db.prepare(`
      SELECT c.*, u.username as author_name, u.display_name as author_display_name
      FROM comments c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.id = ?
    `).get(id);
  }

  create(data) {
    const db = getDb();
    const { user_id, resource_id, content } = data;

    const result = db.prepare(`
      INSERT INTO comments (user_id, resource_id, content)
      VALUES (?, ?, ?)
    `).run(user_id, resource_id, content);

    // 更新资源的 comment_count
    db.prepare(`
      UPDATE resources SET comment_count = (SELECT COUNT(*) FROM comments WHERE resource_id = ?), updated_at = datetime('now')
      WHERE id = ?
    `).run(resource_id, resource_id);

    // 更新热度
    db.prepare(`
      UPDATE resources SET hot_score = (
        SELECT CAST(
          (r.download_count * 2.0 + r.like_count * 3.0 + r.favorite_count * 5.0 + r.comment_count * 4.0)
          / POWER((julianday('now') - julianday(r.created_at)) * 24.0 + 2.0, 1.5)
        AS REAL)
        FROM resources r WHERE r.id = ?
      ) WHERE id = ?
    `).run(resource_id, resource_id);

    return this.findById(result.lastInsertRowid);
  }

  delete(id) {
    const db = getDb();
    const comment = db.prepare('SELECT resource_id FROM comments WHERE id = ?').get(id);
    if (comment) {
      db.prepare('DELETE FROM comments WHERE id = ?').run(id);

      // 更新计数
      db.prepare(`
        UPDATE resources SET comment_count = (SELECT COUNT(*) FROM comments WHERE resource_id = ?), updated_at = datetime('now')
        WHERE id = ?
      `).run(comment.resource_id, comment.resource_id);
    }
  }
}

module.exports = new CommentModel();
