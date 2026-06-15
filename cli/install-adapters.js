/**
 * CLI 适配器加载模块
 *
 * 为 CLI install 命令提供平台适配器的延迟加载能力。
 * 通过 getAdapterModule() 获取 adapters 注册表中的 getAdapter 函数，
 * 再根据平台标识获取对应的适配器实例来执行安装操作。
 */

/**
 * 获取适配器注册模块的引用
 *
 * 延迟加载 adapters/index 模块，避免在 CLI 启动时就引入所有适配器依赖。
 * 返回的对象包含 getAdapter 函数，用于按平台名称获取适配器实例。
 *
 * @returns {{ getAdapter: (platform: string) => import('../adapters/base-adapter') | null }}
 *   - getAdapter(platform): 传入平台标识（如 'cursor'、'claude'），返回对应适配器实例或 null
 *
 * @example
 *   const { getAdapter } = getAdapterModule();
 *   const adapter = getAdapter('cursor');
 *   if (adapter) {
 *     await adapter.install(resourceData, basePath);
 *   }
 */
function getAdapterModule() {
  // 使用相对路径加载 adapters 注册表
  // cli/install-adapters.js → adapters/index.js 需要向上两级
  const adapterRegistry = require('../adapters/index');

  return {
    getAdapter: adapterRegistry.getAdapter,
  };
}

module.exports = { getAdapterModule };
