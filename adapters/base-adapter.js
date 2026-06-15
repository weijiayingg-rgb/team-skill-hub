/**
 * PlatformAdapter - 平台适配器基类
 *
 * 所有平台适配器必须继承此类并实现以下方法：
 * - platform: getter，返回平台标识符
 * - supportedTypes(): 返回支持的资源类型数组
 * - install(resource, basePath): 将资源安装到目标平台
 * - isInstalled(resourceName, basePath): 检查资源是否已安装
 * - uninstall(resourceName, basePath): 从目标平台卸载资源
 */
class PlatformAdapter {
  /**
   * 平台标识符（子类必须实现）
   * @returns {string} 平台名称，如 'workbuddy', 'cursor', 'claude'
   */
  get platform() {
    throw new Error('子类必须实现 platform getter');
  }

  /**
   * 平台显示名称
   * @returns {string} 用户友好的平台名称
   */
  get displayName() {
    throw new Error('子类必须实现 displayName getter');
  }

  /**
   * 支持安装的资源类型
   * @returns {string[]} 如 ['skill', 'rules', 'expert', 'hook']
   */
  supportedTypes() {
    throw new Error('子类必须实现 supportedTypes() 方法');
  }

  /**
   * 检查是否支持指定资源类型
   * @param {string} type - 资源类型
   * @returns {boolean}
   */
  supportsType(type) {
    return this.supportedTypes().includes(type);
  }

  /**
   * 安装资源到目标平台
   * @param {Object} resource - 资源信息 { type, name, display_name, description, files, metadata }
   * @param {string} basePath - 用户主目录或基础路径
   * @returns {Promise<{installedPath: string, convertedFiles: string[]}>}
   */
  async install(resource, basePath) {
    throw new Error('子类必须实现 install() 方法');
  }

  /**
   * 检查资源是否已安装
   * @param {string} resourceName - 资源名称
   * @param {string} basePath - 用户主目录或基础路径
   * @returns {Promise<boolean>}
   */
  async isInstalled(resourceName, basePath) {
    throw new Error('子类必须实现 isInstalled() 方法');
  }

  /**
   * 从目标平台卸载资源
   * @param {string} resourceName - 资源名称
   * @param {string} basePath - 用户主目录或基础路径
   * @returns {Promise<{removed: boolean, removedPath: string}>}
   */
  async uninstall(resourceName, basePath) {
    throw new Error('子类必须实现 uninstall() 方法');
  }

  /**
   * 获取平台安装说明（面向非技术用户）
   * @returns {Object} { steps: string[], helpUrl: string, configDir: string }
   */
  getInstallGuide() {
    throw new Error('子类必须实现 getInstallGuide() 方法');
  }
}

module.exports = PlatformAdapter;
