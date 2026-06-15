/**
 * 适配器注册服务（Server 端）
 *
 * 提供适配器信息的 API 访问接口，供路由层调用。
 * 转发到 adapters/index.js 的统一注册表。
 */

let adapterModule = null;

function getAdapterModule() {
  if (!adapterModule) {
    // 延迟加载，避免循环依赖
    adapterModule = require('../../adapters/index');
  }
  return adapterModule;
}

module.exports = {
  /**
   * 获取所有平台列表及安装指南
   */
  getPlatforms() {
    const { listPlatforms, getAllInstallGuides } = getAdapterModule();
    const platforms = listPlatforms();
    const guides = getAllInstallGuides();

    return platforms.map(p => ({
      ...p,
      installGuide: guides[p.platform] || null,
    }));
  },

  /**
   * 获取指定平台的安装指南
   */
  getInstallGuide(platform) {
    const { getAdapter } = getAdapterModule();
    const adapter = getAdapter(platform);
    if (!adapter) return null;

    return {
      platform: adapter.platform,
      displayName: adapter.displayName,
      supportedTypes: adapter.supportedTypes(),
      ...adapter.getInstallGuide(),
    };
  },

  /**
   * 检查指定平台是否支持某种资源类型
   */
  supportsType(platform, type) {
    const { getAdapter } = getAdapterModule();
    const adapter = getAdapter(platform);
    if (!adapter) return false;
    return adapter.supportsType(type);
  },
};
