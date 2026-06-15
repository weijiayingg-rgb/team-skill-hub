const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const path = require('path');

const testDbPath = path.join(__dirname, '..', '..', 'data', 'test.db');
process.env.DB_PATH = testDbPath;

const { getDb } = require('../../models/db');

describe('Database', () => {
  let db;

  before(() => {
    db = getDb();
  });

  it('should create all tables', () => {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
    const tableNames = tables.map(t => t.name);
    assert.ok(tableNames.includes('users'));
    assert.ok(tableNames.includes('resources'));
    assert.ok(tableNames.includes('resource_versions'));
    assert.ok(tableNames.includes('tags'));
    assert.ok(tableNames.includes('resource_tags'));
    assert.ok(tableNames.includes('interactions'));
    assert.ok(tableNames.includes('comments'));
    assert.ok(tableNames.includes('bundles'));
    assert.ok(tableNames.includes('settings'));
  });

  it('should have FTS5 table', () => {
    const fts = db.prepare("SELECT name FROM sqlite_master WHERE type='virtual' AND name='resources_fts'").get();
    assert.ok(fts);
  });

  it('should create indexes', () => {
    const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type='index'").all();
    const indexNames = indexes.map(i => i.name);
    assert.ok(indexNames.includes('idx_resources_type'));
    assert.ok(indexNames.includes('idx_resources_hot_score'));
    assert.ok(indexNames.includes('idx_interactions_resource'));
  });

  it('should create triggers', () => {
    const triggers = db.prepare("SELECT name FROM sqlite_master WHERE type='trigger'").all();
    const triggerNames = triggers.map(t => t.name);
    assert.ok(triggerNames.includes('resources_ai'));
    assert.ok(triggerNames.includes('resources_ad'));
    assert.ok(triggerNames.includes('resources_au'));
  });

  after(() => {
    const fs = require('fs');
    try { fs.unlinkSync(testDbPath); fs.unlinkSync(testDbPath + '-wal'); fs.unlinkSync(testDbPath + '-shm'); } catch (e) {}
  });
});
