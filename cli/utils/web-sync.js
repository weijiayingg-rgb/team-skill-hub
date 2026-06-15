/**
 * web-sync.js — CLI 与 Web 页面协作模块
 *
 * 负责：
 *   1. 隐私过滤：去除本地文件路径和文件级哈希，只保留安全信息
 *   2. 提交扫描结果：将 Phase 1 的 scan 结果 POST 到 server
 *   3. 等待推送计划：轮询 session，等待 Web 端选定 push_plan
 *   4. 提交推送结果：将 Phase 3 的 push 结果 POST 到 server
 *   5. 增量进度更新：每推送完一个资源就 POST 增量结果
 */

const api = require('../api-client');
const logger = require('./logger');

// ──────────────────── 隐私过滤 ────────────────────

/**
 * 过滤扫描结果中的隐私信息
 *
 * 去除：
 *   - file_paths：包含本地文件绝对路径，不应发送到 server
 *   - content_hash 中的文件级细节（保留 collectionHash 层级的摘要）
 *
 * 保留：
 *   - name, type, platform, display_name, status, content_hash（摘要级）
 *   - remote_id, remote_version（用于 Web 端理解资源关系）
 *
 * @param {object[]} skills - local-state 中的完整资源记录
 * @returns {object[]} 过滤后的安全资源列表，可安全发送到 server
 */
function filterScanResult(skills) {
  return skills.map(skill => ({
    name: skill.name,
    type: skill.type,
    platform: skill.platform,
    display_name: skill.display_name || skill.name,
    status: skill.status,
    // 保留摘要级指纹（8 字符短哈希），不暴露完整 hash
    content_hash_short: skill.content_hash ? skill.content_hash.slice(0, 8) : null,
    // 远端信息：Web 端需要知道哪些资源已在远端存在
    remote_id: skill.remote_id || null,
    remote_version: skill.remote_version || null,
    // 文件数量（不含路径）
    file_count: (skill.file_paths || []).length,
  }));
}

// ──────────────────── 提交扫描结果 ────────────────────

/**
 * 将 Phase 1 的扫描结果 POST 到 Sync Session
 *
 * @param {string} sessionId - Sync Session ID
 * @param {object[]} skills - local-state 中的完整资源记录（会被自动过滤）
 * @returns {Promise<object>} server 返回的更新后 session 数据
 */
async function postScanResult(sessionId, skills) {
  const filtered = filterScanResult(skills);

  const data = {
    scan_result: filtered,
    scan_summary: {
      total: filtered.length,
      new_count: filtered.filter(s => s.status === 'new').length,
      updated_count: filtered.filter(s => s.status === 'updated').length,
      synced_count: filtered.filter(s => s.status === 'synced').length,
    },
  };

  const result = await api.postScanResult(sessionId, data);
  return result;
}

// ──────────────────── 等待推送计划 ────────────────────

/**
 * 轮询 Sync Session，等待 Web 端选定 push_plan
 *
 * 每 2 秒轮询一次 GET /api/sync-sessions/:id
 * 检查 push_plan 字段是否非空（Web 端选择完成后会写入）
 * 同时每 10 秒输出一次等待提示
 *
 * @param {string} sessionId - Sync Session ID
 * @param {object} [options] - 轮询选项
 * @param {number} [options.pollInterval=2000] - 轮询间隔（毫秒）
 * @param {number} [options.hintInterval=10000] - 提示输出间隔（毫秒）
 * @param {number} [options.maxWait=600000] - 最大等待时间（毫秒，默认 10 分钟）
 * @returns {Promise<object[]>} push_plan 中的资源列表
 */
async function waitForPushPlan(sessionId, options = {}) {
  const pollInterval = options.pollInterval || 2000;
  const hintInterval = options.hintInterval || 10000;
  const maxWait = options.maxWait || 600000;

  const startTime = Date.now();
  let lastHintTime = startTime;

  while (Date.now() - startTime < maxWait) {
    // 获取最新 session 数据
    let session;
    try {
      session = await api.getSyncSession(sessionId);
    } catch (err) {
      logger.warn(`获取 session 状态失败: ${err.message}，继续等待...`);
      await sleep(pollInterval);
      continue;
    }

    // 检查 push_plan 是否已填写
    if (session.push_plan && session.push_plan.length > 0) {
      logger.success('收到推送计划，开始执行...');
      return session.push_plan;
    }

    // 检查 session 是否被取消（Web 端可能取消操作）
    if (session.status === 'cancelled') {
      logger.warn('Web 端已取消操作');
      return [];
    }

    // 每 10 秒输出等待提示
    const now = Date.now();
    if (now - lastHintTime >= hintInterval) {
      logger.info('等待 Web 端选择...');
      lastHintTime = now;
    }

    await sleep(pollInterval);
  }

  // 超时
  logger.error('等待 Web 端选择超时（10 分钟），请重试或在 Web 端完成选择');
  return [];
}

// ──────────────────── 提交推送结果 ────────────────────

/**
 * 提交完整的推送结果到 Sync Session
 *
 * Phase 3 全部完成后调用，发送汇总结果
 *
 * @param {string} sessionId - Sync Session ID
 * @param {object[]} results - 推送结果数组
 * @param {object[]} pushPlan - 推送计划（Web 端选定的列表）
 * @returns {Promise<object>} server 返回的更新后 session 数据
 */
async function postPushResult(sessionId, results, pushPlan) {
  const data = {
    push_result: results,
    push_summary: {
      total: pushPlan.length,
      success_count: results.filter(r => r.success).length,
      fail_count: results.filter(r => !r.success).length,
    },
  };

  const result = await api.postPushResult(sessionId, data);
  return result;
}

// ──────────────────── 增量进度更新 ────────────────────

/**
 * 每推送完一个资源就 POST 增量结果到 server
 *
 * Web 端可以实时看到每个资源的推送进度和结果
 * allResults 包含已推送完毕的所有结果
 * totalCount 是推送计划的总量，用于计算进度百分比
 *
 * @param {string} sessionId - Sync Session ID
 * @param {object} singleResult - 当前刚完成的单个推送结果
 * @param {object[]} allResults - 截至当前的所有推送结果（含 singleResult）
 * @param {number} totalCount - 推送计划总量
 * @returns {Promise<object>} server 返回的更新后 session 数据
 */
async function postIncrementalResult(sessionId, singleResult, allResults, totalCount) {
  const total = totalCount || allResults.length;

  const data = {
    push_result: allResults,
    // 标记为增量更新
    incremental: true,
    last_completed: singleResult,
    progress: {
      completed: allResults.length,
      total,
      percentage: Math.round((allResults.length / total) * 100),
    },
  };

  const result = await api.postPushResult(sessionId, data);
  return result;
}

// ──────────────────── 工具函数 ────────────────────

/**
 * 简单 sleep 函数
 * @param {number} ms - 等待毫秒数
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  filterScanResult,
  postScanResult,
  waitForPushPlan,
  postPushResult,
  postIncrementalResult,
};