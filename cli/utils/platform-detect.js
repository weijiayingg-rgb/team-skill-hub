/**
 * 平台检测模块
 *
 * 检测用户电脑上已安装的 AI 开发平台（WorkBuddy / Cursor / Claude Code），
 * 并提供用户主目录路径。供 CLI install 命令使用。
 */

const os = require('os');
const path = require('path');
const fs = require('fs');

// 平台标识 → 对应的主目录下的配置文件夹名称
const PLATFORM_DIRS = {
  workbuddy: '.workbuddy',
  cursor: '.cursor',
  claude: '.claude',
};

/**
 * 检测当前系统上已安装的 AI 平台
 *
 * 通过检查用户主目录下是否存在对应的配置文件夹来判断平台是否安装。
 *
 * @returns {string[]} 已检测到的平台标识数组，如 ['cursor', 'claude']
 */
function detectPlatforms() {
  const homeDir = os.homedir();
  const detected = [];

  for (const [platform, dirName] of Object.entries(PLATFORM_DIRS)) {
    const dirPath = path.join(homeDir, dirName);
    try {
      if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
        detected.push(platform);
      }
    } catch (err) {
      // 权限不足或文件系统异常时跳过该平台，不影响其他平台的检测
    }
  }

  return detected;
}

/**
 * 获取用户主目录路径
 *
 * @returns {string} 用户主目录的绝对路径，如 '/home/username' 或 'C:\Users\username'
 */
function getBasePath() {
  return os.homedir();
}

module.exports = { detectPlatforms, getBasePath };
