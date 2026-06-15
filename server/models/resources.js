const { getDb } = require('./db');

class ResourceModel {
  findAll(filters = {}) {
    const db = getDb();
    const { type, types, status = 'published', sort = 'hot', order = 'desc', page = 1, pageSize = 20, q, tag, tag_category } = filters;
    const limit = Math.min(pageSize, 100);
    const offset = (page - 1) * limit;

    let where = [`r.status = ?`];
    let params = [status];

    if (type) {
      where.push(`r.type = ?`);
      params.push(type);
    }

    // 支持多类型过滤（逗号分隔）
    if (types) {
      const typeList = types.split(',').map(t => t.trim());
      where.push(`r.type IN (${typeList.map(() => '?').join(', ')})`);
      params.push(...typeList);
    }

    // 按标签名筛选
    if (tag) {
      where.push(`r.id IN (SELECT rt.resource_id FROM resource_tags rt JOIN tags t ON rt.tag_id = t.id WHERE t.name = ?)`);
      params.push(tag);
    }

    // 按标签分类筛选
    if (tag_category) {
      where.push(`r.id IN (SELECT rt.resource_id FROM resource_tags rt JOIN tags t ON rt.tag_id = t.id WHERE t.category = ?)`);
      params.push(tag_category);
    }

    // 先尝试 FTS5 全文搜索
    if (q) {
      where.push(`r.id IN (SELECT rowid FROM resources_fts WHERE resources_fts MATCH ?)`);
      params.push(`"${q}"`);
    }

    const orderMap = {
      hot: 'r.hot_score DESC',
      newest: 'r.created_at DESC',
      downloads: 'r.download_count DESC',
      likes: 'r.like_count DESC',
      favorites: 'r.favorite_count DESC',
    };
    const orderClause = orderMap[sort] || 'r.hot_score DESC';

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const countStmt = db.prepare(`SELECT COUNT(*) as total FROM resources r ${whereClause}`);
    const { total } = countStmt.get(...params);

    const stmt = db.prepare(`
      SELECT r.*, u.username as author_name, u.display_name as author_display_name
      FROM resources r
      LEFT JOIN users u ON r.author_id = u.id
      ${whereClause}
      ORDER BY ${orderClause}
      LIMIT ? OFFSET ?
    `);
    let rows = stmt.all(...params, limit, offset);

    // FTS5 无结果时，fallback 到 LIKE 模糊搜索（解决中文分词问题）
    if (q && rows.length === 0) {
      const likeWhere = where.filter(c => !c.includes('resources_fts'));
      likeWhere.push(`(r.name LIKE ? OR r.display_name LIKE ? OR r.description LIKE ?)`);
      const likeParam = `%${q}%`;
      const likeWhereClause = likeWhere.length > 0 ? `WHERE ${likeWhere.join(' AND ')}` : '';

      const likeCountStmt = db.prepare(`SELECT COUNT(*) as total FROM resources r ${likeWhereClause}`);
      const likeTotalResult = likeCountStmt.get(...params.slice(0, -1), likeParam, likeParam, likeParam);

      const likeStmt = db.prepare(`
        SELECT r.*, u.username as author_name, u.display_name as author_display_name
        FROM resources r
        LEFT JOIN users u ON r.author_id = u.id
        ${likeWhereClause}
        ORDER BY ${orderClause}
        LIMIT ? OFFSET ?
      `);
      rows = likeStmt.all(...params.slice(0, -1), likeParam, likeParam, likeParam, limit, offset);

      return {
        data: rows.map(deserialize),
        meta: { total: likeTotalResult.total, page, pageSize: limit },
      };
    }

    return {
      data: rows.map(deserialize),
      meta: { total, page, pageSize: limit },
    };
  }

  findById(id) {
    const db = getDb();
    const row = db.prepare(`
      SELECT r.*, u.username as author_name, u.display_name as author_display_name
      FROM resources r
      LEFT JOIN users u ON r.author_id = u.id
      WHERE r.id = ?
    `).get(id);
    return row ? deserialize(row) : null;
  }

  findByName(name) {
    const db = getDb();
    const row = db.prepare(`
      SELECT r.*, u.username as author_name, u.display_name as author_display_name
      FROM resources r
      LEFT JOIN users u ON r.author_id = u.id
      WHERE r.name = ?
    `).get(name);
    return row ? deserialize(row) : null;
  }

  create(data) {
    const db = getDb();
    const { name, display_name, type, description = '', author_id, current_version = '1.0.0', tags = [], status = 'pending', git_path, files = [], platform = null } = data;

    const result = db.prepare(`
      INSERT INTO resources (name, display_name, type, description, author_id, current_version, tags, status, git_path, files, platform)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(name, display_name, type, description, author_id, current_version, JSON.stringify(tags), status, git_path, JSON.stringify(files), platform);

    return this.findById(result.lastInsertRowid);
  }

  update(id, data) {
    const db = getDb();
    const fields = [];
    const params = [];

    const allowedFields = ['display_name', 'type', 'description', 'current_version', 'tags', 'status', 'git_path', 'files', 'content_hash', 'platform'];
    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        const val = (field === 'tags' || field === 'files') ? JSON.stringify(data[field]) : data[field];
        fields.push(`${field} = ?`);
        params.push(val);
      }
    }

    if (data.download_count !== undefined) { fields.push('download_count = ?'); params.push(data.download_count); }
    if (data.like_count !== undefined) { fields.push('like_count = ?'); params.push(data.like_count); }
    if (data.favorite_count !== undefined) { fields.push('favorite_count = ?'); params.push(data.favorite_count); }
    if (data.comment_count !== undefined) { fields.push('comment_count = ?'); params.push(data.comment_count); }
    if (data.hot_score !== undefined) { fields.push('hot_score = ?'); params.push(data.hot_score); }

    if (fields.length === 0) return this.findById(id);

    fields.push(`updated_at = datetime('now')`);
    params.push(id);

    db.prepare(`UPDATE resources SET ${fields.join(', ')} WHERE id = ?`).run(...params);
    return this.findById(id);
  }

  delete(id) {
    const db = getDb();
    db.prepare('DELETE FROM resources WHERE id = ?').run(id);
  }

  updateHotScore(id) {
    const db = getDb();
    db.prepare(`
      UPDATE resources SET hot_score = (
        SELECT CAST(
          (r.download_count * 2.0 + r.like_count * 3.0 + r.favorite_count * 5.0 + r.comment_count * 4.0)
          / POWER((julianday('now') - julianday(r.created_at)) * 24.0 + 2.0, 1.5)
        AS REAL)
        FROM resources r WHERE r.id = resources.id
      ) WHERE id = ?
    `).run(id);
  }

  updateAllHotScores() {
    const db = getDb();
    db.prepare(`
      UPDATE resources SET hot_score = (
        SELECT CAST(
          (r2.download_count * 2.0 + r2.like_count * 3.0 + r2.favorite_count * 5.0 + r2.comment_count * 4.0)
          / POWER((julianday('now') - julianday(r2.created_at)) * 24.0 + 2.0, 1.5)
        AS REAL)
        FROM resources r2 WHERE r2.id = resources.id
      )
    `).run();
  }

  searchFts(query) {
    const db = getDb();
    const rows = db.prepare(`
      SELECT r.*
      FROM resources r
      JOIN resources_fts fts ON r.id = fts.rowid
      WHERE resources_fts MATCH ?
        AND r.status = 'published'
      ORDER BY rank
    `).all(query);
    return rows.map(deserialize);
  }
}

function deserialize(row) {
  return {
    ...row,
    tags: safeParse(row.tags, []),
    files: safeParse(row.files, []),
  };
}

function safeParse(str, defaultVal) {
  try { return JSON.parse(str); } catch { return defaultVal; }
}

module.exports = new ResourceModel();