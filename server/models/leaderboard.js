/**
 * leaderboard.js - 贡献榜数据模型
 *
 * 贡献度算法：
 * contributionScore = uploadedCount×10 + totalDownloads×0.5 + receivedLikes×3 + receivedFavorites×5 + receivedComments×4
 *
 * 支持 period 过滤：all(全部)、weekly(最近7天)、monthly(最近30天)
 */

const { getDb } = require('./db');

class LeaderboardModel {
  /**
   * 获取贡献榜列表
   * @param {Object} options
   * @param {string} options.period - 时间范围：all / weekly / monthly
   * @param {number} options.limit - 返回条数上限
   * @returns {Array} 贡献榜排名列表
   */
  getLeaderboard({ period = 'all', limit = 20 }) {
    const db = getDb();

    // period 过滤条件
    let periodFilter = '';
    if (period === 'weekly') {
      periodFilter = "AND r.created_at >= datetime('now', '-7 days')";
    } else if (period === 'monthly') {
      periodFilter = "AND r.created_at >= datetime('now', '-30 days')";
    }

    const sql = `
      SELECT
        u.id,
        u.username,
        u.display_name,
        u.avatar_url,
        COUNT(r.id) as uploaded_count,
        COALESCE(SUM(r.download_count), 0) as total_downloads,
        COALESCE(SUM(r.like_count), 0) as total_likes,
        COALESCE(SUM(r.favorite_count), 0) as total_favorites,
        COALESCE(SUM(r.comment_count), 0) as total_comments,
        (COUNT(r.id) * 10
         + COALESCE(SUM(r.download_count), 0) * 0.5
         + COALESCE(SUM(r.like_count), 0) * 3
         + COALESCE(SUM(r.favorite_count), 0) * 5
         + COALESCE(SUM(r.comment_count), 0) * 4) as contribution_score
      FROM users u
      LEFT JOIN resources r ON r.author_id = u.id AND r.status = 'published' ${periodFilter}
      GROUP BY u.id
      HAVING contribution_score > 0
      ORDER BY contribution_score DESC
      LIMIT ?
    `;

    const rows = db.prepare(sql).all(limit);
    return rows.map(row => ({
      ...row,
      contribution_score: Math.round(row.contribution_score * 10) / 10, // 保留1位小数
    }));
  }
}

module.exports = new LeaderboardModel();
