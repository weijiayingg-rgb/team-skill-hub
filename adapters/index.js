const PlatformAdapter = require('./base-adapter');
const ClaudeAdapter = require('./claude-adapter');
const CursorAdapter = require('./cursor-adapter');
const WorkBuddyAdapter = require('./workbuddy-adapter');
const CodexAdapter = require('./codex-adapter');

/**
 * 平台适配器注册表
 *
 * 管理所有已注册的平台适配器，提供统一的查询和获取接口。
 * 包含操作日志记录功能。
 *
 * 新增平台适配器步骤：
 * 1. 创建新文件 xxx-adapter.js，继承 PlatformAdapter
 * 2. 实现 platform getter、supportedTypes()、install()、isInstalled()、uninstall()
 * 3. 在下方 ADAPTER_REGISTRY Map 中注册
 */

// 适配器注册表：platform 标识 → 适配器实例
const ADAPTER_REGISTRY = new Map([
  ['claude', new ClaudeAdapter()],
  ['cursor', new CursorAdapter()],
  ['workbuddy', new WorkBuddyAdapter()],
  ['codex', new CodexAdapter()],
]);

/**
 * 日志记录函数
 * @param {string} operation - 操作类型 (install/uninstall/isInstalled)
 * @param {string} platform - 平台标识
 * @param {string} resourceName - 资源名称
 * @param {object} result - 操作结果
 * @param {Error} [error] - 错误对象（如果有）
 */
function logAdapterOperation(operation, platform, resourceName, result, error) {
  const timestamp = new Date().toISOString();
  if (error) {
    console.error(`[Adapter:${timestamp}] ${operation} FAILED | platform=${platform} resource=${resourceName} error=${error.message}`);
  } else {
    console.log(`[Adapter:${timestamp}] ${operation} OK | platform=${platform} resource=${resourceName} result=${JSON.stringify(result)}`);
  }
}

/**
 * 创建带日志的适配器代理
 * @param {PlatformAdapter} adapter - 原始适配器实例
 * @returns {PlatformAdapter} 带日志的代理
 */
function createLoggingProxy(adapter) {
  return new Proxy(adapter, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);

      // 只包装异步方法
      if (prop === 'install' || prop === 'uninstall' || prop === 'isInstalled') {
        return async function (...args) {
          const resourceName = args[0]?.name || args[0]; // install 传 resource 对象，其他传 resourceName
          try {
            const result = await value.apply(target, args);
            logAdapterOperation(prop, target.platform, resourceName, result);
            return result;
          } catch (error) {
            logAdapterOperation(prop, target.platform, resourceName, null, error);
            throw error;
          }
        };
      }

      return value;
    },
  });
}

/**
 * 获取指定平台的适配器实例（带日志）
 * @param {string} platform - 平台标识符
 * @returns {PlatformAdapter|null}
 */
function getAdapter(platform) {
  const adapter = ADAPTER_REGISTRY.get(platform);
  if (!adapter) return null;
  return createLoggingProxy(adapter);
}

/**
 * 获取所有已注册的平台列表
 * @returns {Array<{platform: string, displayName: string, supportedTypes: string[]}>}
 */
function listPlatforms() {
  const platforms = [];
  for (const [key, adapter] of ADAPTER_REGISTRY) {
    platforms.push({
      platform: adapter.platform,
      displayName: adapter.displayName,
      supportedTypes: adapter.supportedTypes(),
    });
  }
  return platforms;
}

/**
 * 获取所有平台的安装指南
 * @returns {Object} { platform: installGuide }
 */
function getAllInstallGuides() {
  const guides = {};
  for (const [key, adapter] of ADAPTER_REGISTRY) {
    guides[key] = {
      platform: adapter.platform,
      displayName: adapter.displayName,
      ...adapter.getInstallGuide(),
    };
  }
  return guides;
}

module.exports = {
  getAdapter,
  listPlatforms,
  getAllInstallGuides,
  ADAPTER_REGISTRY,
};
