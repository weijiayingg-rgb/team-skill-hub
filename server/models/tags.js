const { getDb } = require('./db');

class TagModel {
  findAll() {
    const db = getDb();
    return db.prepare(`
      SELECT t.*, COUNT(rt.resource_id) as resource_count
      FROM tags t
      LEFT JOIN resource_tags rt ON t.id = rt.tag_id
      GROUP BY t.id
      ORDER BY resource_count DESC
    `).all();
  }

  findById(id) {
    const db = getDb();
    return db.prepare('SELECT * FROM tags WHERE id = ?').get(id);
  }

  findByName(name) {
    const db = getDb();
    return db.prepare('SELECT * FROM tags WHERE name = ?').get(name);
  }

  getOrCreate(name) {
    const db = getDb();
    let tag = this.findByName(name);
    if (!tag) {
      const result = db.prepare('INSERT INTO tags (name) VALUES (?)').run(name);
      tag = this.findById(result.lastInsertRowid);
    }
    return tag;
  }

  addToResource(resourceId, tagName) {
    const tag = this.getOrCreate(tagName);
    const db = getDb();
    try {
      db.prepare('INSERT OR IGNORE INTO resource_tags (resource_id, tag_id) VALUES (?, ?)').run(resourceId, tag.id);
    } catch (e) {
      // ignore duplicate
    }
  }

  removeFromResource(resourceId, tagName) {
    const tag = this.findByName(tagName);
    if (!tag) return;
    const db = getDb();
    db.prepare('DELETE FROM resource_tags WHERE resource_id = ? AND tag_id = ?').run(resourceId, tag.id);
  }

  getResourceTags(resourceId) {
    const db = getDb();
    return db.prepare(`
      SELECT t.* FROM tags t
      JOIN resource_tags rt ON t.id = rt.tag_id
      WHERE rt.resource_id = ?
    `).all(resourceId);
  }

  setResourceTags(resourceId, tagNames) {
    const db = getDb();
    db.prepare('DELETE FROM resource_tags WHERE resource_id = ?').run(resourceId);
    for (const name of tagNames) {
      this.addToResource(resourceId, name);
    }
  }
}

module.exports = new TagModel();
