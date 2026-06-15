const { getDb } = require('./db');

class TrendingModel {
  getTrending({ period = 'all', type = null, limit = 20 } = {}) {
    const db = getDb();
    let where = "WHERE r.status = 'published'";
    const params = [];

    if (type) {
      where += ' AND r.type = ?';
      params.push(type);
    }

    if (period === 'weekly') {
      where += " AND r.created_at >= datetime('now', '-7 days')";
    } else if (period === 'monthly') {
      where += " AND r.created_at >= datetime('now', '-30 days')";
    }

    const rows = db.prepare(`
      SELECT r.id, r.name, r.display_name, r.type, r.description,
             r.tags, r.current_version,
             r.download_count, r.like_count, r.favorite_count, r.comment_count,
             r.hot_score, r.author_id, r.created_at,
             u.username as author_name, u.display_name as author_display_name
      FROM resources r
      LEFT JOIN users u ON r.author_id = u.id
      ${where}
      ORDER BY r.hot_score DESC
      LIMIT ?
    `).all(...params, limit);

    return rows.map(deserialize);
  }

  getStats() {
    const db = getDb();
    const totalResources = db.prepare("SELECT COUNT(*) as count FROM resources WHERE status = 'published'").get();
    const totalDownloads = db.prepare('SELECT SUM(download_count) as total FROM resources').get();
    const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get();
    const typeStats = db.prepare('SELECT type, COUNT(*) as count FROM resources WHERE status = ? GROUP BY type').all('published');

    return {
      totalResources: totalResources.count,
      totalDownloads: totalDownloads.total || 0,
      totalUsers: totalUsers.count,
      typeDistribution: typeStats,
    };
  }
}

function deserialize(row) {
  return {
    ...row,
    tags: safeParse(row.tags, []),
  };
}

function safeParse(str, defaultVal) {
  try { return JSON.parse(str); } catch { return defaultVal; }
}

module.exports = new TrendingModel();