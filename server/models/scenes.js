/**
 * Scene（场景）模型 — 企业工作流场景 = Rules + Skills + Hook 的组合
 *
 * 场景不是独立上传的资源，而是通过勾选已有资源组装而成。
 * 一个场景包含：1 个 Rules（行为规范） + N 个 Skills（能力） + 可选 1 个 Hook（自动化）
 */
const { getDb } = require('./db');

class SceneModel {
  findAll(filters = {}) {
    const db = getDb();
    const { status = 'published', sort = 'hot', page = 1, pageSize = 20, tag, category } = filters;
    const limit = Math.min(pageSize, 100);
    const offset = (page - 1) * limit;

    let where = ['s.status = ?'];
    let params = [status];

    // 按标签筛选：通过 tags JSON 字段 LIKE 匹配
    if (tag) {
      where.push(`s.tags LIKE ?`);
      params.push(`%${tag}%`);
    }

    const orderMap = {
      hot: 's.hot_score DESC',
      newest: 's.created_at DESC',
      downloads: 's.download_count DESC',
    };
    const orderClause = orderMap[sort] || 's.hot_score DESC';

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const countStmt = db.prepare(`SELECT COUNT(*) as total FROM scenes s ${whereClause}`);
    const { total } = countStmt.get(...params);

    const stmt = db.prepare(`
      SELECT s.*, u.username as author_name, u.display_name as author_display_name
      FROM scenes s
      LEFT JOIN users u ON s.author_id = u.id
      ${whereClause}
      ORDER BY ${orderClause}
      LIMIT ? OFFSET ?
    `);
    const rows = stmt.all(...params, limit, offset);

    return {
      data: rows.map(deserialize),
      meta: { total, page, pageSize: limit },
    };
  }

  findById(id) {
    const db = getDb();
    const row = db.prepare(`
      SELECT s.*, u.username as author_name, u.display_name as author_display_name
      FROM scenes s
      LEFT JOIN users u ON s.author_id = u.id
      WHERE s.id = ?
    `).get(id);
    return row ? deserialize(row) : null;
  }

  findByName(name) {
    const db = getDb();
    const row = db.prepare(`
      SELECT s.*, u.username as author_name, u.display_name as author_display_name
      FROM scenes s
      LEFT JOIN users u ON s.author_id = u.id
      WHERE s.name = ?
    `).get(name);
    return row ? deserialize(row) : null;
  }

  create(data) {
    const db = getDb();
    const {
      name, display_name, description = '',
      author_id, rules_id = null, skills = [],
      hooks_id = null, tags = [],
    } = data;

    const result = db.prepare(`
      INSERT INTO scenes (name, display_name, description, author_id, rules_id, skills, hooks_id, tags)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name, display_name, description, author_id,
      rules_id, JSON.stringify(skills), hooks_id,
      JSON.stringify(tags)
    );

    return this.findById(result.lastInsertRowid);
  }

  update(id, data) {
    const db = getDb();
    const fields = [];
    const params = [];

    const stringFields = ['name', 'display_name', 'description', 'status'];
    for (const field of stringFields) {
      if (data[field] !== undefined) {
        fields.push(`${field} = ?`);
        params.push(data[field]);
      }
    }

    const numberFields = ['rules_id', 'hooks_id'];
    for (const field of numberFields) {
      if (data[field] !== undefined) {
        fields.push(`${field} = ?`);
        params.push(data[field]);
      }
    }

    if (data.skills !== undefined) {
      fields.push('skills = ?');
      params.push(JSON.stringify(data.skills));
    }

    if (data.tags !== undefined) {
      fields.push('tags = ?');
      params.push(JSON.stringify(data.tags));
    }

    if (data.download_count !== undefined) { fields.push('download_count = ?'); params.push(data.download_count); }
    if (data.like_count !== undefined) { fields.push('like_count = ?'); params.push(data.like_count); }
    if (data.hot_score !== undefined) { fields.push('hot_score = ?'); params.push(data.hot_score); }

    if (fields.length === 0) return this.findById(id);

    fields.push(`updated_at = datetime('now')`);
    params.push(id);

    db.prepare(`UPDATE scenes SET ${fields.join(', ')} WHERE id = ?`).run(...params);
    return this.findById(id);
  }

  delete(id) {
    const db = getDb();
    db.prepare('DELETE FROM scenes WHERE id = ?').run(id);
  }

  /**
   * 查找包含某个资源的所有场景
   * @param {number} resourceId
   * @returns {Array} 场景列表
   */
  findByResourceId(resourceId) {
    const db = getDb();
    // 资源可能作为 rules_id、hooks_id 或 skills 数组中的一项
    const rows = db.prepare(`
      SELECT * FROM scenes
      WHERE rules_id = ?
         OR hooks_id = ?
         OR skills LIKE ?
      ORDER BY created_at DESC
    `).all(resourceId, resourceId, `%${resourceId}%`);
    return rows.map(deserialize);
  }
}

function deserialize(row) {
  return {
    ...row,
    skills: safeParse(row.skills, []),
    tags: safeParse(row.tags, []),
  };
}

function safeParse(str, defaultVal) {
  try { return JSON.parse(str); } catch { return defaultVal; }
}

module.exports = new SceneModel();