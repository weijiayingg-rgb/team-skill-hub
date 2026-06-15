const path = require('path');
const fs = require('fs').promises;
const PlatformAdapter = require('./base-adapter');

/**
 * Claude Code 平台适配器
 *
 * Claude Code 是 Anthropic 的 CLI AI 编程助手，资源安装到 CLAUDE.md 和 .claude/ 配置目录。
 * 目录结构：
 *   ~/.claude/                  # 全局配置
 *   ├── CLAUDE.md               # 全局 Rules（追加到文件末尾）
 *   ├── commands/               # Skill → 自定义斜杠命令
 *   │   └── {name}.md
 *   ├── agents/                 # Expert → AI Agent 定义文件
 *   │   └── {name}.md
 *   ├── hooks/                  # Hook → 钩子脚本
 *   │   └── {name}/
 *   └── settings.json           # 配置文件
 *
 *   项目级 .claude/              # 项目配置（优先级高于全局）
 *   ├── commands/
 *   │   └── {name}.md
 *   └── agents/
 *       └── {name}.md
 */
class ClaudeAdapter extends PlatformAdapter {
  get platform() {
    return 'claude';
  }

  get displayName() {
    return 'Claude Code';
  }

  supportedTypes() {
    return ['skill', 'expert', 'rules', 'hook'];
  }

  _getConfigDir(basePath) {
    return path.join(basePath, '.claude');
  }

  async install(resource, basePath) {
    const configDir = this._getConfigDir(basePath);
    const convertedFiles = [];

    await fs.mkdir(configDir, { recursive: true });

    // Rules 类型 → 追加到全局 CLAUDE.md
    if (resource.type === 'rules') {
      const claudeMdPath = path.join(configDir, 'CLAUDE.md');
      let existingContent = '';
      try {
        existingContent = await fs.readFile(claudeMdPath, 'utf-8');
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
        convertedFiles.push(claudeMdPath);
      }

      await fs.writeFile(claudeMdPath, existingContent.trim() + '\n', 'utf-8');
      return { installedPath: claudeMdPath, convertedFiles };
    }

    // Skill 类型 → 安装为自定义斜杠命令
    if (resource.type === 'skill') {
      const commandsDir = path.join(configDir, 'commands');
      await fs.mkdir(commandsDir, { recursive: true });

      for (const file of resource.files) {
        // Claude Code 命令文件是 .md 格式
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

      return { installedPath: commandsDir, convertedFiles };
    }

    // Expert 类型 → 整个包解压到 agents/expert-name/ 目录
    if (resource.type === 'expert') {
      const agentDir = path.join(configDir, 'agents', resource.name);
      const commandsDir = path.join(configDir, 'commands');
      const toolsDir = path.join(agentDir, 'tools');

      await fs.mkdir(agentDir, { recursive: true });
      await fs.mkdir(commandsDir, { recursive: true });

      for (const file of resource.files) {
        const filePath = file.path || file.filename;

        if (filePath === 'prompt.md') {
          // prompt.md → agents/expert-name/prompt.md（agent 定义文件）
          const destPath = path.join(agentDir, 'prompt.md');
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
          await fs.writeFile(destPath, content, 'utf-8');
          convertedFiles.push(destPath);
        } else if (filePath.startsWith('skills/') && filePath.endsWith('.md')) {
          // skills/*.md → commands/（作为自定义斜杠命令）
          const skillName = path.basename(filePath);
          const destPath = path.join(commandsDir, skillName);
          let content = file.content;
          if (!content.startsWith('---')) {
            const header = [
              '---',
              `description: ${resource.display_name} - ${path.basename(filePath, '.md')}`,
              '---',
              '',
            ].join('\n');
            content = header + content;
          }
          await fs.writeFile(destPath, content, 'utf-8');
          convertedFiles.push(destPath);
        } else if (filePath.startsWith('tools/')) {
          // tools/* → agents/expert-name/tools/
          await fs.mkdir(toolsDir, { recursive: true });
          const toolName = path.basename(filePath);
          const destPath = path.join(toolsDir, toolName);
          await fs.writeFile(destPath, file.content, 'utf-8');
          convertedFiles.push(destPath);
        } else if (filePath === 'README.md' || filePath === 'metadata.yaml') {
          // README.md / metadata.yaml → agents/expert-name/
          const destPath = path.join(agentDir, path.basename(filePath));
          await fs.writeFile(destPath, file.content, 'utf-8');
          convertedFiles.push(destPath);
        }
      }

      return { installedPath: agentDir, convertedFiles };
    }

    // Hook 类型 → 安装到 hooks 目录
    if (resource.type === 'hook') {
      const hooksDir = path.join(configDir, 'hooks', resource.name);
      await fs.mkdir(hooksDir, { recursive: true });

      for (const file of resource.files) {
        const filePath = path.join(hooksDir, file.filename);
        await fs.writeFile(filePath, file.content, 'utf-8');
        convertedFiles.push(filePath);
      }

      return { installedPath: hooksDir, convertedFiles };
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

    // 检查 CLAUDE.md 中是否有该规则的标记
    const claudeMdPath = path.join(configDir, 'CLAUDE.md');
    try {
      const content = await fs.readFile(claudeMdPath, 'utf-8');
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

    // 检查 agents 目录（expert 包）
    const agentDir = path.join(configDir, 'agents', resourceName);
    try {
      await fs.access(agentDir);
      return true;
    } catch {
      // 检查旧的单文件格式
      const agentsDir = path.join(configDir, 'agents');
      try {
        const files = await fs.readdir(agentsDir);
        if (files.some(f => f.startsWith(resourceName))) {
          return true;
        }
      } catch {
        // 目录不存在
      }
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

    // 尝试从 CLAUDE.md 中移除
    const claudeMdPath = path.join(configDir, 'CLAUDE.md');
    try {
      let content = await fs.readFile(claudeMdPath, 'utf-8');
      const marker = `<!-- SkillHub: ${resourceName} START -->`;
      const markerEnd = `<!-- SkillHub: ${resourceName} END -->`;

      if (content.includes(marker)) {
        const regex = new RegExp(
          `\\s*${escapeRegExp(marker)}[\\s\\S]*?${escapeRegExp(markerEnd)}`,
          'g'
        );
        content = content.replace(regex, '').trim();
        await fs.writeFile(claudeMdPath, content + '\n', 'utf-8');
        return { removed: true, removedPath: claudeMdPath };
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
          return { removed: true, removedPath: filePath };
        }
      }
    } catch {
      // 目录不存在
    }

    // 尝试删除 agents 目录（expert 包）
    const agentDir = path.join(configDir, 'agents', resourceName);
    try {
      await fs.access(agentDir);
      await fs.rm(agentDir, { recursive: true, force: true });
      return { removed: true, removedPath: agentDir };
    } catch {
      // 尝试旧的单文件格式
      const agentsDir = path.join(configDir, 'agents');
      try {
        const files = await fs.readdir(agentsDir);
        for (const file of files) {
          if (file.startsWith(resourceName)) {
            const filePath = path.join(agentsDir, file);
            await fs.unlink(filePath);
            return { removed: true, removedPath: filePath };
          }
        }
      } catch {
        // 目录不存在
      }
    }

    // 尝试删除 hooks 目录（使用 recursive: true 确保完整删除）
    const hooksPath = path.join(configDir, 'hooks', resourceName);
    try {
      await fs.access(hooksPath);
      await fs.rm(hooksPath, { recursive: true, force: true });
      return { removed: true, removedPath: hooksPath };
    } catch {
      // 目录不存在
    }

    return { removed: false, removedPath: '' };
  }

  getInstallGuide() {
    return {
      steps: [
        '确保已安装 Claude Code（终端输入 claude --version 验证）',
        'Skill（斜杠命令）：文件自动安装到 ~/.claude/commands/，在 Claude Code 中输入 /命令名 即可调用',
        'Expert（AI Agent）：文件自动安装到 ~/.claude/agents/，Claude Code 会自动识别并加载 Agent 定义',
        'Rules（规则）：内容自动追加到 ~/.claude/CLAUDE.md，作为全局指令生效，无需额外操作',
        'Hook（钩子）：脚本安装到 ~/.claude/hooks/{名称}/，需在 settings.json 中配置触发条件',
        '安装完成后重启 Claude Code 或重新打开终端窗口使更改生效',
      ],
      helpUrl: 'https://docs.anthropic.com/en/docs/claude-code',
      configDir: '~/.claude/',
      paths: {
        skill: '~/.claude/commands/{name}.md — 自定义斜杠命令，输入 / 查看列表',
        expert: '~/.claude/agents/{name}/ — 专家包目录（prompt.md 为 agent 定义，skills/ 复制到 commands/，tools/ 保留在包内）',
        rules: '~/.claude/CLAUDE.md — 全局规则文件，追加到文件末尾',
        hook: '~/.claude/hooks/{name}/ — 钩子脚本目录',
      },
      note: '所有资源通过 SkillHub 自动安装到正确路径，你也可以手动将文件放到对应目录。输入 /help 查看 Claude Code 帮助信息。',
    };
  }
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = ClaudeAdapter;
