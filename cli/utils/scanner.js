/**
 * 配置扫描器
 * 扫描用户 HOME 目录下的 AI 平台配置文件，返回可导入 SkillHub 的资源列表
 *
 * 路径策略：只扫描各平台官方文档定义的路径（与适配器 install 路径对齐）。
 * 不扫描 cc-switch 等第三方工具部署的社区路径（如 ~/.claude/skills/、~/.codex/skills/）。
 *
 * 覆盖 4 个平台：
 *   - Claude Code: ~/.claude/commands/ + ~/.claude/agents/
 *   - Cursor:      ~/.cursor/skills-cursor/ + ~/.cursor/skills/ + ~/.cursor/prompts/ + ~/.cursor/agents/ + ~/.cursor/rules/
 *   - Codex:       ~/.codex/commands/ + ~/.codex/agents/
 *   - WorkBuddy:   ~/.workbuddy/skills/ + ~/.workbuddy/experts/
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

/** 获取 HOME 目录 */
function getHomeDir() {
  return os.homedir();
}

/**
 * 安全的路径拼接：如果 basePath 不存在则返回 null
 */
function resolvePath(...segments) {
  const fullPath = path.join(...segments);
  if (fs.existsSync(fullPath)) {
    return fullPath;
  }
  return null;
}

/**
 * 判断路径是否为目录（follow 符号链接后判断真实类型）
 * 安全限制：符号链接必须指向 HOME 目录内的路径，拒绝外部链接
 * @param {string} fullPath - 文件绝对路径
 * @returns {boolean}
 */
function isRealDirectory(fullPath) {
  try {
    const stat = fs.lstatSync(fullPath);
    if (stat.isSymbolicLink()) {
      // follow 链接，但只接受 HOME 内的目标路径
      const realPath = fs.realpathSync(fullPath);
      const home = getHomeDir();
      if (!realPath.startsWith(home)) {
        return false; // 拒绝 HOME 外的符号链接
      }
      return fs.statSync(fullPath).isDirectory();
    }
    return stat.isDirectory();
  } catch {
    return false;
  }
}

// ──────────────────────────── Claude Code ────────────────────────────

/**
 * 扫描 Claude Code 平台（skill 和 expert）
 *
 * 官方路径（与适配器对齐）：
 *   - skills: ~/.claude/commands/{name}.md（自定义 slash 命令）
 *   - experts: ~/.claude/agents/{name}.md 或 {name}/（Agent 定义）
 */
function scanClaudeCode() {
  const home = getHomeDir();
  const items = [];

  // 扫描 skills: ~/.claude/commands/*.md（自定义 slash 命令）
  const commandsDir = resolvePath(home, '.claude', 'commands');
  if (commandsDir) {
    try {
      const entries = fs.readdirSync(commandsDir);
      for (const name of entries) {
        if (name.startsWith('.')) continue;
        const filePath = path.join(commandsDir, name);
        if (name.endsWith('.md') && !isRealDirectory(filePath)) {
          const skillName = name.replace(/\.md$/, '');
          items.push({
            platform: 'claude-code',
            type: 'skill',
            name: skillName,
            displayName: skillName,
            files: [filePath],
          });
        }
      }
    } catch {
      // 读取目录失败，静默跳过
    }
  }

  // 扫描 experts: ~/.claude/agents/ 下的子目录和 .md 文件
  const agentsDir = resolvePath(home, '.claude', 'agents');
  if (agentsDir) {
    try {
      const entries = fs.readdirSync(agentsDir);
      for (const name of entries) {
        if (name.startsWith('.')) continue;
        const fullPath = path.join(agentsDir, name);

        if (isRealDirectory(fullPath)) {
          // 子目录：收集目录下所有文件
          const files = collectDirFiles(fullPath);
          if (files.length > 0) {
            items.push({
              platform: 'claude-code',
              type: 'expert',
              name,
              displayName: name,
              files,
            });
          }
        } else if (name.endsWith('.md')) {
          // 单个 .md 文件
          const agentName = name.replace(/\.md$/, '');
          items.push({
            platform: 'claude-code',
            type: 'expert',
            name: agentName,
            displayName: agentName,
            files: [fullPath],
          });
        }
      }
    } catch {
      // 读取目录失败，静默跳过
    }
  }

  return items;
}

// ──────────────────────────── Cursor ────────────────────────────

/**
 * 扫描 Cursor 平台（skill、expert 和 rules）
 *
 * 官方路径（与适配器对齐 + Cursor Agent Skills 官方格式）：
 *   - skills: ~/.cursor/skills-cursor/{name}/SKILL.md（Cursor 内置托管 Skills）
 *   - skills: ~/.cursor/skills/{name}/SKILL.md（用户自定义 Agent Skills）
 *   - skills: ~/.cursor/prompts/{name}/（Skill/Expert 的 Prompt 目录，适配器 install 目标）
 *   - experts: ~/.cursor/agents/{name}.md（Cursor Agent 定义）
 *   - rules:  ~/.cursor/rules/{name}.mdc（Cursor Rules）
 */
function scanCursor() {
  const home = getHomeDir();
  const items = [];

  // 扫描 skills: ~/.cursor/skills-cursor/*/SKILL.md（Cursor 内置托管 Skills）
  const skillsCursorDir = resolvePath(home, '.cursor', 'skills-cursor');
  if (skillsCursorDir) {
    try {
      const entries = fs.readdirSync(skillsCursorDir);
      for (const name of entries) {
        if (name.startsWith('.')) continue;
        const skillSubDir = path.join(skillsCursorDir, name);
        if (!isRealDirectory(skillSubDir)) continue;

        const skillMd = path.join(skillSubDir, 'SKILL.md');
        const promptMd = path.join(skillSubDir, 'prompt.md');

        if (fs.existsSync(skillMd) || fs.existsSync(promptMd)) {
          const allFiles = collectDirFiles(skillSubDir);
          if (allFiles.length > 0) {
            const displayName = extractDisplayNameFromSkillDir(skillSubDir) || name;
            items.push({
              platform: 'cursor',
              type: 'skill',
              name,
              displayName,
              files: allFiles,
            });
          }
        }
      }
    } catch {
      // 读取目录失败，静默跳过
    }
  }

  // 扫描 skills: ~/.cursor/skills/*/SKILL.md（用户自定义 Agent Skills）
  const skillsDir = resolvePath(home, '.cursor', 'skills');
  if (skillsDir) {
    try {
      const entries = fs.readdirSync(skillsDir);
      for (const name of entries) {
        if (name.startsWith('.')) continue;
        const skillSubDir = path.join(skillsDir, name);
        if (!isRealDirectory(skillSubDir)) continue;

        const skillMd = path.join(skillSubDir, 'SKILL.md');
        const promptMd = path.join(skillSubDir, 'prompt.md');

        if (fs.existsSync(skillMd) || fs.existsSync(promptMd)) {
          const allFiles = collectDirFiles(skillSubDir);
          if (allFiles.length > 0) {
            const displayName = extractDisplayNameFromSkillDir(skillSubDir) || name;
            items.push({
              platform: 'cursor',
              type: 'skill',
              name,
              displayName,
              files: allFiles,
            });
          }
        }
      }
    } catch {
      // 读取目录失败，静默跳过
    }
  }

  // 扫描 skills/experts: ~/.cursor/prompts/*/（适配器 install 目标目录）
  const promptsDir = resolvePath(home, '.cursor', 'prompts');
  if (promptsDir) {
    try {
      const entries = fs.readdirSync(promptsDir);
      for (const name of entries) {
        if (name.startsWith('.')) continue;
        const promptSubDir = path.join(promptsDir, name);
        if (!isRealDirectory(promptSubDir)) continue;

        const allFiles = collectDirFiles(promptSubDir);
        if (allFiles.length > 0) {
          // 检查 .skillhub.json 元数据判断类型
          const type = detectResourceTypeFromMeta(promptSubDir) || 'skill';
          items.push({
            platform: 'cursor',
            type,
            name,
            displayName: name,
            files: allFiles,
          });
        }
      }
    } catch {
      // 读取目录失败，静默跳过
    }
  }

  // 扫描 experts: ~/.cursor/agents/*.md
  const agentsDir = resolvePath(home, '.cursor', 'agents');
  if (agentsDir) {
    try {
      const entries = fs.readdirSync(agentsDir);
      for (const name of entries) {
        if (name.startsWith('.')) continue;
        const fullPath = path.join(agentsDir, name);

        if (name.endsWith('.md') && !isRealDirectory(fullPath)) {
          const agentName = name.replace(/\.md$/, '');
          items.push({
            platform: 'cursor',
            type: 'expert',
            name: agentName,
            displayName: agentName,
            files: [fullPath],
          });
        } else if (isRealDirectory(fullPath)) {
          const files = collectDirFiles(fullPath);
          if (files.length > 0) {
            items.push({
              platform: 'cursor',
              type: 'expert',
              name,
              displayName: name,
              files,
            });
          }
        }
      }
    } catch {
      // 读取目录失败，静默跳过
    }
  }

  // 扫描 rules: ~/.cursor/rules/*.mdc（可选，目录可能不存在）
  const rulesDir = resolvePath(home, '.cursor', 'rules');
  if (rulesDir) {
    try {
      const entries = fs.readdirSync(rulesDir);
      for (const name of entries) {
        if (name.startsWith('.')) continue;
        const fullPath = path.join(rulesDir, name);
        if (name.endsWith('.mdc') && !isRealDirectory(fullPath)) {
          const ruleName = name.replace(/\.mdc$/, '');
          items.push({
            platform: 'cursor',
            type: 'rules',
            name: ruleName,
            displayName: ruleName,
            files: [fullPath],
          });
        }
      }
    } catch {
      // 读取目录失败，静默跳过
    }
  }

  return items;
}

// ──────────────────────────── Codex ────────────────────────────

/**
 * 扫描 Codex 平台（skill 和 expert）
 *
 * 官方路径（与适配器对齐，来自 OpenAI Codex CLI GitHub 文档）：
 *   - skills: ~/.codex/commands/{name}.md（自定义 slash 命令）
 *   - experts: ~/.codex/agents/{name}.md（Agent 定义）
 */
function scanCodex() {
  const home = getHomeDir();
  const items = [];

  // 扫描 skills: ~/.codex/commands/*.md（自定义 slash 命令）
  const commandsDir = resolvePath(home, '.codex', 'commands');
  if (commandsDir) {
    try {
      const entries = fs.readdirSync(commandsDir);
      for (const name of entries) {
        if (name.startsWith('.')) continue;
        const filePath = path.join(commandsDir, name);
        if (name.endsWith('.md') && !isRealDirectory(filePath)) {
          const skillName = name.replace(/\.md$/, '');
          items.push({
            platform: 'codex',
            type: 'skill',
            name: skillName,
            displayName: skillName,
            files: [filePath],
          });
        }
      }
    } catch {
      // 读取目录失败，静默跳过
    }
  }

  // 扫描 experts: ~/.codex/agents/*.md（Agent 定义）
  const agentsDir = resolvePath(home, '.codex', 'agents');
  if (agentsDir) {
    try {
      const entries = fs.readdirSync(agentsDir);
      for (const name of entries) {
        if (name.startsWith('.')) continue;
        const fullPath = path.join(agentsDir, name);

        if (name.endsWith('.md') && !isRealDirectory(fullPath)) {
          const agentName = name.replace(/\.md$/, '');
          items.push({
            platform: 'codex',
            type: 'expert',
            name: agentName,
            displayName: agentName,
            files: [fullPath],
          });
        } else if (isRealDirectory(fullPath)) {
          const files = collectDirFiles(fullPath);
          if (files.length > 0) {
            items.push({
              platform: 'codex',
              type: 'expert',
              name,
              displayName: name,
              files,
            });
          }
        }
      }
    } catch {
      // 读取目录失败，静默跳过
    }
  }

  return items;
}

// ──────────────────────────── WorkBuddy ────────────────────────────

/**
 * 扫描 WorkBuddy 平台（skill 和 expert）
 *
 * 官方路径（与适配器对齐）：
 *   - skills: ~/.workbuddy/skills/{name}/SKILL.md 或 prompt.md
 *   - experts: ~/.workbuddy/experts/{name}/
 */
function scanWorkBuddy() {
  const home = getHomeDir();
  const items = [];

  // 扫描 skills: ~/.workbuddy/skills/*/ 查找 SKILL.md 或 prompt.md
  const skillsDir = resolvePath(home, '.workbuddy', 'skills');
  if (skillsDir) {
    try {
      const entries = fs.readdirSync(skillsDir);
      for (const name of entries) {
        if (name.startsWith('.')) continue;
        const skillSubDir = path.join(skillsDir, name);
        if (!isRealDirectory(skillSubDir)) continue;

        const skillMdPath = path.join(skillSubDir, 'SKILL.md');
        const promptPath = path.join(skillSubDir, 'prompt.md');
        if (fs.existsSync(skillMdPath) || fs.existsSync(promptPath)) {
          const allFiles = collectDirFiles(skillSubDir);
          items.push({
            platform: 'workbuddy',
            type: 'skill',
            name,
            displayName: name,
            files: allFiles,
          });
        }
      }
    } catch {
      // 读取目录失败，静默跳过
    }
  }

  // 扫描 experts: ~/.workbuddy/experts/*/ 每个子目录
  const expertsDir = resolvePath(home, '.workbuddy', 'experts');
  if (expertsDir) {
    try {
      const entries = fs.readdirSync(expertsDir);
      for (const name of entries) {
        if (name.startsWith('.')) continue;
        const expertDir = path.join(expertsDir, name);
        if (!isRealDirectory(expertDir)) continue;

        const files = collectDirFiles(expertDir);
        if (files.length > 0) {
          items.push({
            platform: 'workbuddy',
            type: 'expert',
            name,
            displayName: name,
            files,
          });
        }
      }
    } catch {
      // 读取目录失败，静默跳过
    }
  }

  return items;
}

// ──────────────────────────── 通用工具 ────────────────────────────

/**
 * 递归收集目录下的所有文件（排除隐藏文件和目录）
 * 安全限制：最大递归深度 5 层，防止符号链接环或超大目录导致无限遍历
 * @param {string} dirPath - 目录绝对路径
 * @param {number} [maxDepth=5] - 最大递归深度
 * @returns {string[]} 文件路径数组
 */
function collectDirFiles(dirPath, maxDepth = 5) {
  if (maxDepth <= 0) return [];
  const files = [];
  try {
    const entries = fs.readdirSync(dirPath);
    for (const name of entries) {
      if (name.startsWith('.')) continue; // 跳过隐藏文件
      const fullPath = path.join(dirPath, name);
      if (isRealDirectory(fullPath)) {
        files.push(...collectDirFiles(fullPath, maxDepth - 1));
      } else {
        files.push(fullPath);
      }
    }
  } catch {
    // 读取失败，静默跳过
  }
  return files;
}

/**
 * 从 skill 目录中的 SKILL.md / skill.md / prompt.md 提取显示名称
 *
 * 读取 YAML frontmatter 的 name 或 description 字段作为 displayName。
 * 如果没有 frontmatter 或无 name 字段，返回 null。
 *
 * @param {string} skillDirPath - skill 子目录绝对路径
 * @returns {string|null} 显示名称，或 null 表示无法提取
 */
function extractDisplayNameFromSkillDir(skillDirPath) {
  const candidates = ['SKILL.md', 'skill.md', 'prompt.md'];
  for (const filename of candidates) {
    const filePath = path.join(skillDirPath, filename);
    if (!fs.existsSync(filePath)) continue;

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (fmMatch) {
        const yaml = fmMatch[1];
        const nameMatch = yaml.match(/^name:\s*(.+)$/m);
        const descMatch = yaml.match(/^description:\s*(.+)$/m);

        if (nameMatch) {
          let name = nameMatch[1].trim();
          if (descMatch && name.length < 3) {
            name = descMatch[1].trim().replace(/^>-\s*/, '').split('\n')[0].trim();
          }
          return name;
        }
      }
    } catch {
      // 读取失败，跳过
    }
  }

  return null;
}

/**
 * 从 .skillhub.json 元数据文件检测资源类型
 * @param {string} resourceDir - 资源目录路径
 * @returns {string|null} 类型（skill 或 expert），或 null
 */
function detectResourceTypeFromMeta(resourceDir) {
  const metaPath = path.join(resourceDir, '.skillhub.json');
  if (!fs.existsSync(metaPath)) return null;

  try {
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    return meta.type || null;
  } catch {
    return null;
  }
}

// ──────────────────────────── 平台别名与扫描入口 ────────────────────────────

/**
 * 平台别名映射
 * 用户常用简写：claude → claude-code, cc → claude-code, wb → workbuddy, cx → codex
 */
const PLATFORM_ALIASES = {
  claude: 'claude-code',
  cc: 'claude-code',
  wb: 'workbuddy',
  cx: 'codex',
  openai: 'codex',
};

/**
 * 解析平台名称，支持别名
 * @param {string} name - 用户输入的平台名或别名
 * @returns {string} 标准平台名
 */
function resolvePlatform(name) {
  if (!name) return name;
  const lower = name.toLowerCase();
  return PLATFORM_ALIASES[lower] || lower;
}

/**
 * 扫描所有平台的可导入资源（skill 和 expert 类型）
 * @param {object} options - 过滤选项
 * @param {string} [options.platform] - 限定平台 (claude-code|cursor|codex|workbuddy)，支持别名
 * @param {string} [options.type] - 限定资源类型 (skill|expert)
 * @returns {Array<{platform: string, type: string, name: string, displayName: string, files: string[]}>}
 */
function scanAll(options = {}) {
  const platform = resolvePlatform(options.platform);
  const { type } = options;
  let items = [];

  // 按平台扫描
  if (!platform || platform === 'claude-code') {
    items = items.concat(scanClaudeCode());
  }
  if (!platform || platform === 'cursor') {
    items = items.concat(scanCursor());
  }
  if (!platform || platform === 'codex') {
    items = items.concat(scanCodex());
  }
  if (!platform || platform === 'workbuddy') {
    items = items.concat(scanWorkBuddy());
  }

  // 按类型过滤（仅 skill 和 expert）
  if (type) {
    items = items.filter(item => item.type === type);
  }

  return items;
}

module.exports = { scanAll, scanClaudeCode, scanCursor, scanCodex, scanWorkBuddy, resolvePlatform };
