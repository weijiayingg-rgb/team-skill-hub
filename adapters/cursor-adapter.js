const path = require('path');
const fs = require('fs').promises;
const PlatformAdapter = require('./base-adapter');

/**
 * Cursor 平台适配器
 *
 * Cursor 是基于 VS Code 的 AI 编程助手，资源安装到项目级或全局配置目录。
 * 目录结构（全局）：
 *   ~/.cursor/
 *   ├── rules/              # Rules 类型 → .mdc 规则文件
 *   │   └── {name}.mdc
 *   ├── prompts/            # Skill/Expert → Prompt 文件
 *   │   └── {name}/
 *   │       └── prompt.md
 *   └── hooks/              # Hook → 钩子脚本
 *       └── {name}/
 *           └── hook.js
 *
 * 项目级（当前项目 .cursor/ 目录，优先级高于全局）
 */
class CursorAdapter extends PlatformAdapter {
  get platform() {
    return 'cursor';
  }

  get displayName() {
    return 'Cursor';
  }

  supportedTypes() {
    return ['skill', 'expert', 'rules', 'hook'];
  }

  _getTypeDir(type) {
    const typeMap = {
      skill: 'prompts',
      expert: 'prompts',
      rules: 'rules',
      hook: 'hooks',
    };
    return typeMap[type] || 'prompts';
  }

  _getConfigDir(basePath) {
    return path.join(basePath, '.cursor');
  }

  /** 清单文件存放在 .cursor 目录下 */
  _getPlatformManifestPath(basePath) {
    return path.join(this._getConfigDir(basePath), '.skillhub.json');
  }

  async install(resource, basePath) {
    const configDir = this._getConfigDir(basePath);
    const typeDir = this._getTypeDir(resource.type);

    // Rules 类型直接写成 .mdc 文件
    if (resource.type === 'rules') {
      const rulesDir = path.join(configDir, typeDir);
      await fs.mkdir(rulesDir, { recursive: true });

      const convertedFiles = [];
      for (const file of resource.files) {
        // 将 .md 转为 .mdc（Cursor 规则格式）
        const mdcFilename = file.filename.replace(/\.md$/, '.mdc');
        const filePath = path.join(rulesDir, mdcFilename);

        // 添加 Cursor MDC 前置元数据
        let content = file.content;
        if (file.filename.endsWith('.md') && !content.startsWith('---')) {
          const frontmatter = [
            '---',
            `description: ${resource.display_name || resource.name}`,
            'globs:',
            'alwaysApply: true',
            '---',
            '',
          ].join('\n');
          content = frontmatter + content;
        }

        await fs.writeFile(filePath, content, 'utf-8');
        convertedFiles.push(filePath);
      }

      return { installedPath: rulesDir, convertedFiles };
    }

    // Skill/Expert 类型安装到 prompts 子目录
    const resourceDir = path.join(configDir, typeDir, resource.name);
    await fs.mkdir(resourceDir, { recursive: true });

    const convertedFiles = [];
    for (const file of resource.files) {
      const filePath = path.join(resourceDir, file.filename);
      await fs.writeFile(filePath, file.content, 'utf-8');
      convertedFiles.push(filePath);
    }

    // 写入元数据
    const config = {
      name: resource.name,
      displayName: resource.display_name,
      type: resource.type,
      description: resource.description || '',
      installedAt: new Date().toISOString(),
      source: 'skillhub',
    };
    const configPath = path.join(resourceDir, '.skillhub.json');
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
    convertedFiles.push(configPath);

    // 写入全局清单（追踪归属）
    await this._addToManifest(basePath, resource.name, {
      type: resource.type,
      version: resource.version || resource.current_version || '1.0.0',
      skillRefs: (resource.skill_refs || []).map(r => typeof r === 'string' ? r : (r.skill_name || r)),
    });

    // usageGuide: 根据资源类型生成对应平台的使用指引
    const usageGuide = resource.type === 'expert'
      ? `✅ 已安装。在 Cursor 的 Prompt 面板中选择 ${resource.name} 使用。`
      : `✅ 已安装。在 Cursor 中使用 /${resource.name} 调用。`;

    return { installedPath: resourceDir, convertedFiles, usageGuide };
  }

  async isInstalled(resourceName, basePath) {
    const configDir = this._getConfigDir(basePath);

    // 检查 rules 目录（.mdc 文件）
    const rulesPath = path.join(configDir, 'rules', `${resourceName}.mdc`);
    try {
      await fs.access(rulesPath);
      return true;
    } catch {
      // 不存在，继续检查
    }

    // 检查 prompts 目录
    const promptsPath = path.join(configDir, 'prompts', resourceName);
    try {
      await fs.access(promptsPath);
      return true;
    } catch {
      // 不存在，继续检查
    }

    // 检查 hooks 目录
    const hooksPath = path.join(configDir, 'hooks', resourceName);
    try {
      await fs.access(hooksPath);
      return true;
    } catch {
      // 不存在
    }

    return false;
  }

  async uninstall(resourceName, basePath) {
    const configDir = this._getConfigDir(basePath);

    // 尝试删除 rules 文件
    const rulesPath = path.join(configDir, 'rules', `${resourceName}.mdc`);
    try {
      await fs.access(rulesPath);
      await fs.unlink(rulesPath);
      await this._removeFromManifest(basePath, resourceName);
      return { removed: true, removedPath: rulesPath };
    } catch {
      // 不存在，继续检查
    }

    // 尝试删除 prompts/hooks 目录
    for (const typeDir of ['prompts', 'hooks']) {
      const resourceDir = path.join(configDir, typeDir, resourceName);
      try {
        await fs.access(resourceDir);
        await fs.rm(resourceDir, { recursive: true, force: true });
        await this._removeFromManifest(basePath, resourceName);
        return { removed: true, removedPath: resourceDir };
      } catch {
        // 不存在，继续检查
      }
    }

    return { removed: false, removedPath: '' };
  }

  getInstallGuide() {
    return {
      steps: [
        '打开 Cursor 编辑器',
        '按 Ctrl+Shift+P (Mac: Cmd+Shift+P) 打开命令面板',
        '输入 "Cursor: Open Rules" 打开规则目录',
        '将下载的文件复制到规则目录中',
        '重启 Cursor 或重新加载窗口使规则生效',
      ],
      helpUrl: 'https://docs.cursor.com/context/rules',
      configDir: '~/.cursor/',
      note: 'Cursor Rules 文件 (.mdc) 会自动全局生效，无需额外配置。',
    };
  }
}

module.exports = CursorAdapter;
