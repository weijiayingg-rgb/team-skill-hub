const path = require('path');
const fs = require('fs').promises;
const PlatformAdapter = require('./base-adapter');

/**
 * WorkBuddy 平台适配器
 *
 * WorkBuddy 是公司内部的 AI 助手工具，资源安装到用户目录下的 .workbuddy/ 配置目录。
 * 目录结构：
 *   ~/.workbuddy/
 *   ├── skills/         # Skill 类型资源
 *   │   └── {name}/
 *   │       └── prompt.md
 *   ├── experts/        # Expert 类型资源
 *   │   └── {name}/
 *   │       └── system-prompt.md
 *   ├── rules/          # Rules 类型资源
 *   │   └── {name}.md
 *   └── hooks/          # Hook 类型资源
 *       └── {name}/
 *           └── hook.js
 */
class WorkBuddyAdapter extends PlatformAdapter {
  get platform() {
    return 'workbuddy';
  }

  get displayName() {
    return 'WorkBuddy';
  }

  supportedTypes() {
    return ['skill', 'expert', 'rules', 'hook'];
  }

  /**
   * 根据资源类型获取安装目标子目录
   */
  _getTypeDir(type) {
    const typeMap = {
      skill: 'skills',
      expert: 'experts',
      rules: 'rules',
      hook: 'hooks',
    };
    return typeMap[type] || 'skills';
  }

  /**
   * 获取 WorkBuddy 配置根目录
   */
  _getConfigDir(basePath) {
    return path.join(basePath, '.workbuddy');
  }

  /** 清单文件存放在 .workbuddy 目录下 */
  _getPlatformManifestPath(basePath) {
    return path.join(this._getConfigDir(basePath), '.skillhub.json');
  }

  async install(resource, basePath) {
    const configDir = this._getConfigDir(basePath);
    const typeDir = this._getTypeDir(resource.type);
    const resourceDir = path.join(configDir, typeDir, resource.name);

    // 确保目录存在（异步）
    await fs.mkdir(resourceDir, { recursive: true });

    const convertedFiles = [];

    // 写入资源文件
    for (const file of resource.files) {
      const filePath = path.join(resourceDir, file.filename);
      await fs.writeFile(filePath, file.content, 'utf-8');
      convertedFiles.push(filePath);
    }

    // 生成配置文件（让 WorkBuddy 识别这个资源）
    const config = {
      name: resource.name,
      displayName: resource.display_name,
      type: resource.type,
      description: resource.description || '',
      installedAt: new Date().toISOString(),
      source: 'skillhub',
      entryFile: convertedFiles[0] || '',
    };
    const configPath = path.join(resourceDir, '.skillhub.json');
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
    convertedFiles.push(configPath);

    // 写入全局清单
    await this._addToManifest(basePath, resource.name, {
      type: resource.type,
      version: resource.version || resource.current_version || '1.0.0',
      skillRefs: (resource.skill_refs || []).map(r => typeof r === 'string' ? r : (r.skill_name || r)),
    });

    // usageGuide: 根据资源类型生成对应平台的使用指引
    const usageGuide = resource.type === 'expert'
      ? `✅ 已安装。在 WorkBuddy 的 Expert 面板中找到并使用 ${resource.name}。`
      : `✅ 已安装。在 WorkBuddy 中使用 /${resource.name} 调用。`;

    return {
      installedPath: resourceDir,
      convertedFiles,
      usageGuide,
    };
  }

  async isInstalled(resourceName, basePath) {
    const configDir = this._getConfigDir(basePath);
    // 检查所有类型子目录
    for (const typeDir of ['skills', 'experts', 'rules', 'hooks']) {
      const resourceDir = path.join(configDir, typeDir, resourceName);
      try {
        await fs.access(resourceDir);
        return true;
      } catch {
        // 目录不存在，继续检查下一个
      }
    }
    return false;
  }

  async uninstall(resourceName, basePath) {
    const configDir = this._getConfigDir(basePath);
    for (const typeDir of ['skills', 'experts', 'rules', 'hooks']) {
      const resourceDir = path.join(configDir, typeDir, resourceName);
      try {
        await fs.access(resourceDir);
        await fs.rm(resourceDir, { recursive: true, force: true });
        await this._removeFromManifest(basePath, resourceName);
        return { removed: true, removedPath: resourceDir };
      } catch {
        // 目录不存在，继续检查下一个
      }
    }
    return { removed: false, removedPath: '' };
  }

  getInstallGuide() {
    return {
      steps: [
        '打开 WorkBuddy 应用',
        '点击左侧「技能管理」菜单',
        '选择「从文件导入」，选择下载的文件',
        '导入成功后，在对话中即可使用该技能',
      ],
      helpUrl: '',
      configDir: '~/.workbuddy/',
      note: 'WorkBuddy 是公司内部 AI 助手，支持直接导入资源文件。',
    };
  }
}

module.exports = WorkBuddyAdapter;
