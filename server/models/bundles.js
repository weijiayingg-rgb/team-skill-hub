const { getDb } = require('./db');

class BundleModel {
  findAll() {
    const db = getDb();
    return db.prepare(`
      SELECT b.*, u.username as author_name
      FROM bundles b
      LEFT JOIN users u ON b.author_id = u.id
      ORDER BY b.created_at DESC
    `).all().map(deserialize);
  }

  findById(id) {
    const db = getDb();
    const row = db.prepare(`
      SELECT b.*, u.username as author_name
      FROM bundles b
      LEFT JOIN users u ON b.author_id = u.id
      WHERE b.id = ?
    `).get(id);
    return row ? deserialize(row) : null;
  }

  create(data) {
    const db = getDb();
    const { name, description = '', author_id, version = '1.0.0', resources = [] } = data;

    const result = db.prepare(`
      INSERT INTO bundles (name, description, author_id, version, resources)
      VALUES (?, ?, ?, ?, ?)
    `).run(name, description, author_id, version, JSON.stringify(resources));

    return this.findById(result.lastInsertRowid);
  }

  update(id, data) {
    const db = getDb();
    const fields = [];
    const params = [];
    const allowedFields = ['name', 'description', 'version'];
    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        fields.push(`${field} = ?`);
        params.push(data[field]);
      }
    }
    if (data.resources !== undefined) {
      fields.push('resources = ?');
      params.push(JSON.stringify(data.resources));
    }
    if (fields.length === 0) return this.findById(id);
    fields.push(`updated_at = datetime('now')`);
    params.push(id);
    db.prepare(`UPDATE bundles SET ${fields.join(', ')} WHERE id = ?`).run(...params);
    return this.findById(id);
  }

  delete(id) {
    const db = getDb();
    db.prepare('DELETE FROM bundles WHERE id = ?').run(id);
  }
}

function deserialize(row) {
  return {
    ...row,
    resources: safeParse(row.resources, []),
  };
}

function safeParse(str, defaultVal) {
  try { return JSON.parse(str); } catch { return defaultVal; }
}

module.exports = new BundleModel();