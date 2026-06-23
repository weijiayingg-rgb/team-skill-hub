const path = require('path');
const fs = require('fs').promises;
const PlatformAdapter = require('./base-adapter');

/**
 * Codex 平台适配器
 *
 * Codex 是 OpenAI 的 CLI AI 编程助手，资源安装到 ~/.codex/ 配置目录。
 * 目录结构：
 *   ~/.codex/                   # 全局配置
 *   ├── RULES.md                # 全局 Rules（追加到文件末尾）
 *   ├── commands/               # Skill → 自定义命令
 *   │   └── {name}.md
 *   └── agents/                 # Expert → AI Agent 定义文件
 *       └── {name}.md
 */
class CodexAdapter extends PlatformAdapter {
  get platform() {
    return 'codex';
  }

  get displayName() {
    return 'Codex';
  }

  supportedTypes() {
    return ['skill', 'expert', 'rules'];
  }

  _getConfigDir(basePath) {
    return path.join(basePath, '.codex');
  }

  /** 清单文件存放在 .codex 目录下 */
  _getPlatformManifestPath(basePath) {
    return path.join(this._getConfigDir(basePath), '.skillhub.json');
  }

  async install(resource, basePath) {
    const configDir = this._getConfigDir(basePath);
    const convertedFiles = [];

    await fs.mkdir(configDir, { recursive: true });

    // Rules 类型 → 追加到全局 RULES.md
    if (resource.type === 'rules') {
      const rulesMdPath = path.join(configDir, 'RULES.md');
      let existingContent = '';
      try {
        existingContent = await fs.readFile(rulesMdPath, 'utf-8');
      } catch {
        // 文件不存在，使用空字符串
      }

      for (const file of resource.files) {
        // 添加分隔标记，方便后续卸载
        const marker = `<!-- SkillHub: ${resource.name} START -->`;
        const markerEnd = `<!-- SkillHub: ${resource.name} END -->`;

        // 如果已存在同名标记，先移除旧内容
        if (existingContent.includes(marker)) {
          const regex = new RegExp(
            `${escapeRegExp(marker)}[\\s\\S]*?${escapeRegExp(markerEnd)}`,
            'g'
          );
          existingContent = existingContent.replace(regex, '').trim();
        }

        const section = `\n\n${marker}\n## ${resource.display_name || resource.name}\n\n${file.content}\n${markerEnd}`;
        existingContent += section;
        convertedFiles.push(rulesMdPath);
      }

      await fs.writeFile(rulesMdPath, existingContent.trim() + '\n', 'utf-8');
      return { installedPath: rulesMdPath, convertedFiles };
    }

    // Skill 类型 → 安装到 commands 目录
    if (resource.type === 'skill') {
      const commandsDir = path.join(configDir, 'commands');
      await fs.mkdir(commandsDir, { recursive: true });

      for (const file of resource.files) {
        const cmdFilename = file.filename.endsWith('.md')
          ? file.filename
          : `${resource.name}.md`;
        const filePath = path.join(commandsDir, cmdFilename);

        // 添加命令描述头部（如果没有）
        let content = file.content;
        if (!content.startsWith('---')) {
          const header = [
            '---',
            `description: ${resource.description || resource.display_name}`,
            '---',
            '',
          ].join('\n');
          content = header + content;
        }

        await fs.writeFile(filePath, content, 'utf-8');
        convertedFiles.push(filePath);
      }

      // usageGuide: 安装后提示用户如何在 Codex 中调用该 Skill
      return {
        installedPath: commandsDir,
        convertedFiles,
        usageGuide: `✅ 已安装。在 Codex 中使用 /${resource.name} 调用。`,
      };
    }

    // Expert 类型 → 安装到 agents 目录
    if (resource.type === 'expert') {
      const agentsDir = path.join(configDir, 'agents');
      await fs.mkdir(agentsDir, { recursive: true });

      for (const file of resource.files) {
        const agentFilename = file.filename.endsWith('.md')
          ? file.filename
          : `${resource.name}.md`;
        const filePath = path.join(agentsDir, agentFilename);

        // 添加 Agent 描述头部（如果没有）
        let content = file.content;
        if (!content.startsWith('---')) {
          const header = [
            '---',
            `name: ${resource.display_name || resource.name}`,
            `description: ${resource.description || ''}`,
            '---',
            '',
          ].join('\n');
          content = header + content;
        }

        await fs.writeFile(filePath, content, 'utf-8');
        convertedFiles.push(filePath);
      }

      // 写入清单
      await this._addToManifest(basePath, resource.name, {
        type: 'expert',
        version: resource.version || resource.current_version || '1.0.0',
        skillRefs: (resource.skill_refs || []).map(r => typeof r === 'string' ? r : (r.skill_name || r)),
      });

      // usageGuide: 安装后提示用户如何在 Codex 中激活该 Expert
      return {
        installedPath: agentsDir,
        convertedFiles,
        usageGuide: `✅ 已安装。在 Codex 中使用 /${resource.name} 激活此专家。`,
      };
    }

    // 未知类型，默认安装到 commands 目录
    const fallbackDir = path.join(configDir, 'commands', resource.name);
    await fs.mkdir(fallbackDir, { recursive: true });
    for (const file of resource.files) {
      const filePath = path.join(fallbackDir, file.filename);
      await fs.writeFile(filePath, file.content, 'utf-8');
      convertedFiles.push(filePath);
    }

    return { installedPath: fallbackDir, convertedFiles };
  }

  async isInstalled(resourceName, basePath) {
    const configDir = this._getConfigDir(basePath);

    // 检查 RULES.md 中是否有该规则的标记
    const rulesMdPath = path.join(configDir, 'RULES.md');
    try {
      const content = await fs.readFile(rulesMdPath, 'utf-8');
      if (content.includes(`SkillHub: ${resourceName} START`)) {
        return true;
      }
    } catch {
      // 文件不存在
    }

    // 检查 commands 目录（skill）
    const commandsDir = path.join(configDir, 'commands');
    try {
      const files = await fs.readdir(commandsDir);
      if (files.some(f => f.startsWith(resourceName))) {
        return true;
      }
    } catch {
      // 目录不存在
    }

    // 检查 agents 目录（expert）
    const agentsDir = path.join(configDir, 'agents');
    try {
      const files = await fs.readdir(agentsDir);
      if (files.some(f => f.startsWith(resourceName))) {
        return true;
      }
    } catch {
      // 目录不存在
    }

    return false;
  }

  async uninstall(resourceName, basePath) {
    const configDir = this._getConfigDir(basePath);

    // 尝试从 RULES.md 中移除
    const rulesMdPath = path.join(configDir, 'RULES.md');
    try {
      let content = await fs.readFile(rulesMdPath, 'utf-8');
      const marker = `<!-- SkillHub: ${resourceName} START -->`;
      const markerEnd = `<!-- SkillHub: ${resourceName} END -->`;

      if (content.includes(marker)) {
        const regex = new RegExp(
          `\\s*${escapeRegExp(marker)}[\\s\\S]*?${escapeRegExp(markerEnd)}`,
          'g'
        );
        content = content.replace(regex, '').trim();
        await fs.writeFile(rulesMdPath, content + '\n', 'utf-8');
        await this._removeFromManifest(basePath, resourceName);
        return { removed: true, removedPath: rulesMdPath };
      }
    } catch {
      // 文件不存在或读取失败
    }

    // 尝试删除 commands 文件（skill）
    const commandsDir = path.join(configDir, 'commands');
    try {
      const files = await fs.readdir(commandsDir);
      for (const file of files) {
        if (file.startsWith(resourceName)) {
          const filePath = path.join(commandsDir, file);
          await fs.unlink(filePath);
          await this._removeFromManifest(basePath, resourceName);
          return { removed: true, removedPath: filePath };
        }
      }
    } catch {
      // 目录不存在
    }

    // 尝试删除 agents 文件（expert）
    const agentsDir = path.join(configDir, 'agents');
    try {
      const files = await fs.readdir(agentsDir);
      for (const file of files) {
        if (file.startsWith(resourceName)) {
          const filePath = path.join(agentsDir, file);
          await fs.unlink(filePath);
          await this._removeFromManifest(basePath, resourceName);
          return { removed: true, removedPath: filePath };
        }
      }
    } catch {
      // 目录不存在
    }

    return { removed: false, removedPath: '' };
  }

  getInstallGuide() {
    return {
      steps: [
        '确保已安装 Codex CLI（终端输入 codex --version 验证）',
        'Skill（命令）：文件自动安装到 ~/.codex/commands/，Codex 会自动识别可用命令',
        'Expert（AI Agent）：文件自动安装到 ~/.codex/agents/，Codex 会加载 Agent 定义',
        'Rules（规则）：内容自动追加到 ~/.codex/RULES.md，作为全局指令生效，无需额外操作',
        '安装完成后重启 Codex 或重新打开终端窗口使更改生效',
      ],
      helpUrl: 'https://github.com/openai/codex',
      configDir: '~/.codex/',
      paths: {
        skill: '~/.codex/commands/{name}.md — 自定义命令文件',
        expert: '~/.codex/agents/{name}.md — AI Agent 定义文件',
        rules: '~/.codex/RULES.md — 全局规则文件，追加到文件末尾',
      },
      note: '所有资源通过 SkillHub 自动安装到正确路径，你也可以手动将文件放到对应目录。',
    };
  }
}

/**
 * 转义正则表达式特殊字符
 * @param {string} string - 需要转义的字符串
 * @returns {string} 转义后的字符串
 */
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = CodexAdapter;
