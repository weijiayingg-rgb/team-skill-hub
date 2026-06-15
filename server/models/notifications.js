const { getDb } = require('./db');

/**
 * 通知数据模型
 * 管理通知的创建、查询、标记已读等操作
 */
class NotificationModel {
  /**
   * 创建一条通知记录
   * @param {number} recipientId - 接收者用户 ID
   * @param {number} actorId     - 触发操作的用户 ID
   * @param {number} resourceId  - 关联资源 ID
   * @param {string} type        - 通知类型：'download' | 'thanks'
   * @param {string} message     - 通知消息内容
   * @returns {object} 创建的记录
   */
  create(recipientId, actorId, resourceId, type, message) {
    const db = getDb();
    // 如果 resourceId 为 0 或假值，转为 null（SQLite 的 NULL 符合 schema 设计）
    const resId = resourceId || null;
    const result = db.prepare(`
      INSERT INTO notifications (recipient_id, actor_id, resource_id, type, message)
      VALUES (?, ?, ?, ?, ?)
    `).run(recipientId, actorId, resId, type, message);
    return { id: result.lastInsertRowid };
  }

  /**
   * 分页查询某用户的通知
   * @param {number} userId - 用户 ID
   * @param {object} opts
   * @param {number} opts.page     - 页码，默认 1
   * @param {number} opts.pageSize - 每页条数，默认 20
   * @param {string} opts.type     - 可选：按类型过滤
   * @returns {{ data, total, page, pageSize }}
   */
  findByUser(userId, { page = 1, pageSize = 20, type } = {}) {
    const db = getDb();
    const conditions = ['n.recipient_id = ?'];
    const params = [userId];

    // 按类型过滤
    if (type) {
      conditions.push('n.type = ?');
      params.push(type);
    }

    const whereClause = conditions.join(' AND ');

    // 查询总数
    const countRow = db.prepare(`
      SELECT COUNT(*) AS total FROM notifications n WHERE ${whereClause}
    `).get(...params);

    const total = countRow.total;

    // 查询分页数据（LEFT JOIN users 获取发送者信息，LEFT JOIN resources 获取资源信息）
    const offset = (page - 1) * pageSize;
    const rows = db.prepare(`
      SELECT
        n.id, n.type, n.message, n.is_read AS read, n.created_at,
        u.id       AS actor_id,
        u.username AS actor_username,
        u.display_name   AS actor_display_name,
        u.avatar_url     AS actor_avatar_url,
        r.id       AS resource_id,
        r.name     AS resource_name,
        r.display_name   AS resource_display_name
      FROM notifications n
      LEFT JOIN users u     ON u.id = n.actor_id
      LEFT JOIN resources r ON r.id = n.resource_id
      WHERE ${whereClause}
      ORDER BY n.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, pageSize, offset);

    return { data: rows, total, page, pageSize };
  }

  /**
   * 获取用户的未读通知数量
   * @param {number} userId - 用户 ID
   * @returns {number} 未读数量
   */
  getUnreadCount(userId) {
    const db = getDb();
    const row = db.prepare(`
      SELECT COUNT(*) AS count FROM notifications
      WHERE recipient_id = ? AND is_read = 0
    `).get(userId);
    return row.count;
  }

  /**
   * 标记单条通知为已读
   * @param {number} id     - 通知 ID
   * @param {number} userId - 用户 ID（安全校验：只能标记自己的通知）
   * @returns {boolean} 是否成功
   */
  markAsRead(id, userId) {
    const db = getDb();
    const result = db.prepare(`
      UPDATE notifications SET is_read = 1
      WHERE id = ? AND recipient_id = ?
    `).run(id, userId);
    return result.changes > 0;
  }

  /**
   * 将某用户所有未读通知标记为已读
   * @param {number} userId - 用户 ID
   * @returns {number} 更新的条数
   */
  markAllAsRead(userId) {
    const db = getDb();
    const result = db.prepare(`
      UPDATE notifications SET is_read = 1
      WHERE recipient_id = ? AND is_read = 0
    `).run(userId);
    return result.changes;
  }

  /**
   * 检查指定时间内是否已有同类型通知（用于去重）
   * @param {number} userId     - 接收者用户 ID（即 resource author_id）
   * @param {number} resourceId - 资源 ID
   * @param {string} type       - 通知类型
   * @param {number} hours      - 时间窗口（小时）
   * @returns {boolean} 是否存在
   */
  checkRecent(userId, resourceId, type, hours) {
    const db = getDb();
    const row = db.prepare(`
      SELECT id FROM notifications
      WHERE recipient_id = ? AND resource_id = ? AND type = ?
        AND created_at > datetime('now', '-' || ? || ' hours')
      LIMIT 1
    `).get(userId, resourceId, type, hours);
    return !!row;
  }
}

module.exports = new NotificationModel();