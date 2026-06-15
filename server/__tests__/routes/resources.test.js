const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const path = require('path');

const testDbPath = path.join(__dirname, '..', '..', 'data', 'test-routes.db');
process.env.DB_PATH = testDbPath;

describe('Resources API', () => {
  let app;

  before(async () => {
    app = require('../../index');
  });

  it('should return health check', async () => {
    const res = await fetch('http://localhost:3001/api/health');
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.data.status, 'ok');
  });

  it('should list resources', async () => {
    const res = await fetch('http://localhost:3001/api/resources');
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(Array.isArray(data.data));
  });

  it('should return 404 for non-existent resource', async () => {
    const res = await fetch('http://localhost:3001/api/resources/99999');
    const data = await res.json();
    assert.equal(data.success, false);
    assert.equal(data.error.code, 'NOT_FOUND');
  });

  it('should search with FTS', async () => {
    const res = await fetch('http://localhost:3001/api/resources?q=sql');
    const data = await res.json();
    assert.equal(data.success, true);
  });

  after(() => {
    const fs = require('fs');
    try { fs.unlinkSync(testDbPath); fs.unlinkSync(testDbPath + '-wal'); fs.unlinkSync(testDbPath + '-shm'); } catch (e) {}
  });

  it('should get trending', async () => {
    const res = await fetch('http://localhost:3001/api/trending');
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(Array.isArray(data.data));
  });

  it('should get stats', async () => {
    const res = await fetch('http://localhost:3001/api/stats');
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(data.data.totalResources !== undefined);
  });
});
