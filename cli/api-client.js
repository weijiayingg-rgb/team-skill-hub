const axios = require('axios');
const Conf = require('conf').default || require('conf');
const os = require('os');
const path = require('path');
const fs = require('fs');

const configDir = path.join(os.homedir(), '.skhub');
if (!fs.existsSync(configDir)) {
  fs.mkdirSync(configDir, { recursive: true });
}

const conf = new Conf({
  projectName: 'skhub',
  configName: 'config',
});

const DEFAULT_HUB_URL = process.env.SKHUB_URL || 'http://localhost:3001';

function getConfig() {
  return {
    hubUrl: conf.get('hub_url') || DEFAULT_HUB_URL,
    token: conf.get('token') || 'dev-token-1',
  };
}

const apiClient = axios.create({
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// 请求拦截器
apiClient.interceptors.request.use((config) => {
  const cfg = getConfig();
  config.baseURL = cfg.hubUrl;
  if (cfg.token) {
    config.headers.Authorization = `Bearer ${cfg.token}`;
  }
  return config;
});

// 响应拦截器
apiClient.interceptors.response.use(
  (res) => res.data,
  (err) => {
    const message = err.response?.data?.error?.message || err.message || '请求失败';
    return Promise.reject(new Error(message));
  }
);

// API 方法
const api = {
  searchResources(q, params = {}) {
    return apiClient.get('/api/resources', { params: { q, ...params } });
  },

  getResource(id) {
    return apiClient.get(`/api/resources/${id}`);
  },

  getResourceByName(name) {
    return apiClient.get('/api/resources', { params: { q: name } });
  },

  publishResource(formData) {
    return apiClient.post('/api/resources', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  /**
   * 为已有资源添加新版本
   *
   * 向 POST /api/resources/:id/versions 发送 FormData，
   * 包含 version、changelog 和更新的文件列表。
   *
   * @param {number|string} resourceId - 远程资源 ID
   * @param {FormData} formData - 包含 version、changelog、files 的表单数据
   * @returns {Promise<object>} API 响应数据
   */
  addVersion(resourceId, formData) {
    return apiClient.post(`/api/resources/${resourceId}/versions`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  listResources(params = {}) {
    return apiClient.get('/api/resources', { params });
  },

  downloadResource(id, version) {
    return apiClient.get(`/api/resources/${id}/download`, { params: { version } });
  },

  getTrending(params = {}) {
    return apiClient.get('/api/trending', { params });
  },

  getBundles() {
    return apiClient.get('/api/bundles');
  },

  getBundle(id) {
    return apiClient.get(`/api/bundles/${id}`);
  },

  recordDownload(resourceId) {
    return apiClient.post(`/api/resources/${resourceId}/like`).catch(() => {});
  },

  /**
   * 获取注册中心资源指纹映射
   * 用于比对本地资源与注册中心的差异，实现增量更新检测
   * @returns {Promise<object>} { name: { hash, id, version } } 映射对象
   */
  getFingerprintMap() {
    return apiClient.get('/api/fingerprint-map');
  },

  // ──────────────────── Sync Session API ────────────────────

  /**
   * 创建 Sync Session
   * 用于 CLI 与 Web 页面协作完成扫描+推送的会话
   * @returns {Promise<object>} { id, status, scan_result, push_plan, push_result, ... }
   */
  createSyncSession() {
    return apiClient.post('/api/sync-sessions');
  },

  /**
   * 获取 Sync Session 详情
   * @param {string} id - Session ID
   * @returns {Promise<object>} Session 数据，包含 push_plan 等字段
   */
  getSyncSession(id) {
    return apiClient.get(`/api/sync-sessions/${id}`);
  },

  /**
   * 提交扫描结果到 Sync Session
   * CLI Phase 1 完成后调用，将扫描结果发送到 server
   * @param {string} id - Session ID
   * @param {object} data - 隐私过滤后的扫描结果
   * @returns {Promise<object>} 更新后的 Session 数据
   */
  postScanResult(id, data) {
    return apiClient.post(`/api/sync-sessions/${id}/scan`, data);
  },

  /**
   * 提交推送结果到 Sync Session
   * CLI Phase 3 完成后调用，将推送结果发送到 server
   * @param {string} id - Session ID
   * @param {object} data - 推送结果汇总
   * @returns {Promise<object>} 更新后的 Session 数据
   */
  postPushResult(id, data) {
    return apiClient.post(`/api/sync-sessions/${id}/result`, data);
  },

  /**
   * 删除 Sync Session
   * @param {string} id - Session ID
   * @returns {Promise<object>} 删除确认
   */
  deleteSyncSession(id) {
    return apiClient.delete(`/api/sync-sessions/${id}`);
  },

  getConfig,
  setConfig(key, value) {
    conf.set(key, value);
  },
};

module.exports = api;
