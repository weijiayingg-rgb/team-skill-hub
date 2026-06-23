/**
 * PlatformAdapter - 平台适配器基类
 *
 * 所有平台适配器必须继承此类并实现以下方法：
 * - platform: getter，返回平台标识符
 * - supportedTypes(): 返回支持的资源类型数组
 * - install(resource, basePath): 将资源安装到目标平台
 * - isInstalled(resourceName, basePath): 检查资源是否已安装
 * - uninstall(resourceName, basePath): 从目标平台卸载资源
 *
 * 基类提供 .skillhub.json 清单管理方法，用于追踪安装归属和冲突检测。
 * 清单格式：
 *   {
 *     "version": 1,
 *     "installed": {
 *       "resource-name": {
 *         "type": "expert|skill|rules|hook",
 *         "version": "1.0.0",
 *         "installedAt": "ISO timestamp",
 *         "installedBy": "expert-name" | null,
 *         "skillRefs": ["ref-skill-1", ...]
 *       }
 *     }
 *   }
 */
const path = require('path');
const fs = require('fs').promises;

class PlatformAdapter {
  get platform() {
    throw new Error('子类必须实现 platform getter');
  }

  get displayName() {
    throw new Error('子类必须实现 displayName getter');
  }

  supportedTypes() {
    throw new Error('子类必须实现 supportedTypes() 方法');
  }

  supportsType(type) {
    return this.supportedTypes().includes(type);
  }

  async install(resource, basePath) {
    throw new Error('子类必须实现 install() 方法');
  }

  async isInstalled(resourceName, basePath) {
    throw new Error('子类必须实现 isInstalled() 方法');
  }

  async uninstall(resourceName, basePath) {
    throw new Error('子类必须实现 uninstall() 方法');
  }

  getInstallGuide() {
    throw new Error('子类必须实现 getInstallGuide() 方法');
  }

  // ═══════════════════════════════════════════════════════════
  // .skillhub.json 清单管理（基类实现，子类可直接使用）
  // ═══════════════════════════════════════════════════════════

  /**
   * 获取 .skillhub.json 文件路径
   * 存放在平台配置根目录下
   */
  _getManifestPath(basePath) {
    return path.join(basePath, '.skillhub.json');
  }

  /**
   * 按平台获取清单路径（子类可覆盖）
   */
  _getPlatformManifestPath(basePath) {
    return this._getManifestPath(basePath);
  }

  /**
   * 读取清单文件
   * @returns {Promise<Object>} { version, installed: {} }
   */
  async _readManifest(basePath) {
    const manifestPath = this._getPlatformManifestPath(basePath);
    try {
      const raw = await fs.readFile(manifestPath, 'utf-8');
      return JSON.parse(raw);
    } catch {
      return { version: 1, installed: {} };
    }
  }

  /**
   * 写入清单文件
   */
  async _writeManifest(basePath, manifest) {
    const manifestPath = this._getPlatformManifestPath(basePath);
    await fs.mkdir(path.dirname(manifestPath), { recursive: true });
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
  }

  /**
   * 记录安装到清单
   * 注意：如果资源已存在且有归属者，不覆盖 installedBy（保留原始归属）
   * @param {string} basePath
   * @param {string} resourceName - 资源名称
   * @param {Object} info - { type, version, installedBy, skillRefs }
   */
  async _addToManifest(basePath, resourceName, info) {
    const manifest = await this._readManifest(basePath);
    const existing = manifest.installed[resourceName];

    manifest.installed[resourceName] = {
      type: info.type || (existing ? existing.type : 'skill'),
      version: info.version || (existing ? existing.version : '1.0.0'),
      installedAt: existing ? existing.installedAt : new Date().toISOString(),
      // 保留原始归属者，不覆盖（避免卸载时归属链断裂）
      installedBy: (existing && existing.installedBy) ? existing.installedBy : (info.installedBy || null),
      skillRefs: info.skillRefs || (existing ? existing.skillRefs : []),
    };
    await this._writeManifest(basePath, manifest);
  }

  /**
   * 从清单中移除
   */
  async _removeFromManifest(basePath, resourceName) {
    const manifest = await this._readManifest(basePath);
    delete manifest.installed[resourceName];
    await this._writeManifest(basePath, manifest);
  }

  /**
   * 检查资源是否在清单中
   */
  async _isInManifest(basePath, resourceName) {
    const manifest = await this._readManifest(basePath);
    return !!manifest.installed[resourceName];
  }

  /**
   * 获取已安装 Skill 列表（从清单中）
   * @returns {Promise<string[]>} 已安装的 Skill 名称数组
   */
  async _getInstalledSkills(basePath) {
    const manifest = await this._readManifest(basePath);
    return Object.entries(manifest.installed)
      .filter(([, info]) => info.type === 'skill')
      .map(([name]) => name);
  }

  /**
   * 检测 Expert 引用的 Skill 与本地已安装 Skill 的冲突
   * @param {string} basePath
   * @param {string[]} skillRefs - Expert 引用的 Skill 名称列表
   * @returns {Promise<Object>} { hasConflicts: boolean, conflicts: [{ name, installedBy }], safe: string[] }
   */
  async checkSkillConflicts(basePath, skillRefs) {
    const manifest = await this._readManifest(basePath);
    const conflicts = [];
    const safe = [];

    for (const refName of skillRefs) {
      const existing = manifest.installed[refName];
      if (existing) {
        conflicts.push({
          name: refName,
          installedBy: existing.installedBy || '手动安装',
          type: existing.type,
          version: existing.version,
        });
      } else {
        safe.push(refName);
      }
    }

    return { hasConflicts: conflicts.length > 0, conflicts, safe };
  }

  /**
   * 获取引用某 Skill 的其他 Expert 列表（用于卸载时判断）
   * @returns {Promise<string[]>} 引用该 Skill 的 Expert 名称列表
   */
  async _getSkillReferrers(basePath, skillName) {
    const manifest = await this._readManifest(basePath);
    return Object.entries(manifest.installed)
      .filter(([, info]) => info.skillRefs && info.skillRefs.includes(skillName))
      .map(([name]) => name);
  }
}

module.exports = PlatformAdapter;
