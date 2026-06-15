const path = require('path');
const fs = require('fs');

const SERVER_DIR = __dirname;
const DATA_DIR = path.join(SERVER_DIR, 'data');

/**
 * 向后兼容路径解析：
 * - 新默认路径为 skillhub.db / skillhub-registry
 * - 如果新路径不存在但旧路径（agenthub）存在，自动使用旧路径
 * - 这样现有部署不会中断
 */
function resolvePath(envVar, newDefault, oldDefault) {
  // 环境变量优先级最高，直接使用
  if (process.env[envVar]) {
    return process.env[envVar];
  }

  const newPath = path.join(DATA_DIR, newDefault);
  const oldPath = path.join(DATA_DIR, oldDefault);

  // 新路径已存在，使用新路径
  if (fs.existsSync(newPath)) {
    return newPath;
  }

  // 旧路径存在但新路径不存在，向后兼容使用旧路径
  if (fs.existsSync(oldPath)) {
    return oldPath;
  }

  // 都不存在，使用新默认路径（后续初始化会创建）
  return newPath;
}

module.exports = {
  port: process.env.PORT || 3001,
  dbPath: resolvePath('DB_PATH', 'skillhub.db', 'agenthub.db'),
  registryPath: resolvePath('REGISTRY_PATH', 'skillhub-registry', 'agenthub-registry'),
  uploadDir: process.env.UPLOAD_DIR || path.join(SERVER_DIR, 'data', 'uploads'),
  allowedTokens: (process.env.ALLOWED_TOKENS || 'dev-token-1,dev-token-2').split(','),
  registryGitUrl: process.env.REGISTRY_GIT_URL || '',
  registryGitBranch: process.env.REGISTRY_GIT_BRANCH || 'main',
  pageSize: 20,
  maxPageSize: 100,
};