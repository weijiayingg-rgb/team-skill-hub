/**
 * install-prompt.js — 安装提示词生成器
 *
 * 根据资源信息和 SkillHub 服务地址，生成自包含的 Markdown 安装指引。
 * 复制给任意 AI 助手即可执行安装，无需额外上下文。
 *
 * 提示词结构：
 *   1. 资源元信息（名称、类型、版本、作者、描述）
 *   2. 前置条件（CLI 安装检测）
 *   3. 方式一：CLI 安装（推荐）
 *   4. 方式二：手动下载安装
 *   5. 验证方法
 *   6. 幂等处理说明
 */

const config = require('../config');

/**
 * 平台安装路径映射
 * key: 平台标识（与 adapters/ 中 platform getter 一致）
 * value: { skill, expert, rules, hook } 各类型对应的安装目录模板
 */
const PLATFORM_PATHS = {
  'claude-code': {
    label: 'Claude Code',
    skill: '~/.claude/commands/{name}.md',
    expert: '~/.claude/agents/{name}/',
    rules: '~/.claude/CLAUDE.md（追加）',
    hook: '~/.claude/hooks/{name}/',
  },
  'cursor': {
    label: 'Cursor',
    skill: '~/.cursor/prompts/{name}/',
    expert: '~/.cursor/prompts/{name}/',
    rules: '~/.cursor/rules/{name}.mdc',
  },
  'workbuddy': {
    label: 'WorkBuddy',
    skill: '~/.workbuddy/skill/{name}/',
    expert: '~/.workbuddy/expert/{name}/',
    rules: '~/.workbuddy/rules/{name}/',
    hook: '~/.workbuddy/hook/{name}/',
  },
  'codex': {
    label: 'Codex',
    skill: '~/.codex/commands/{name}.md',
    expert: '~/.codex/agents/{name}/',
    rules: '~/.codex/RULES.md（追加）',
  },
};

/**
 * 类型中文标签
 */
const TYPE_LABELS = {
  skill: '技能 (Skill)',
  expert: '专家 (Expert)',
  rules: '规则 (Rules)',
  hook: '钩子 (Hook)',
};

/**
 * 生成安装提示词
 *
 * @param {object} resource - 资源对象（从 DB 查询，包含 name, type, version 等字段）
 * @param {string} [hubUrl] - SkillHub 服务地址，默认取 config.hubUrl
 * @returns {{ prompt: string, hubUrl: string, packageUrl: string, markdownUrl: string }}
 */
function generateInstallPrompt(resource, hubUrl) {
  const base = hubUrl || config.hubUrl;
  const name = resource.name;
  const displayName = resource.display_name || name;
  const type = resource.type || 'skill';
  const version = resource.current_version || '1.0.0';
  const author = resource.author_display_name || resource.author_name || '未知';
  const description = resource.description || '';
  const typeLabel = TYPE_LABELS[type] || type;

  const packageUrl = `${base}/api/resources/${resource.id}/download-zip`;
  const markdownUrl = `${base}/resources/${resource.id}`;

  // 构建平台路径说明
  const platformPathLines = Object.entries(PLATFORM_PATHS).map(([key, info]) => {
    const skillPath = info[type] || info.skill || '—';
    return `   - **${info.label}**: \`${skillPath}\``;
  }).join('\n');

  // Expert 特殊说明
  const expertNote = type === 'expert'
    ? `\n> **Expert 包说明**：Expert 包含 prompt.md（主提示词）、可能的 skills/（内嵌技能）、tools/（工具定义）等文件。安装时 CLI 会自动处理所有子文件。\n`
    : '';

  // Skill 引用说明
  const skillRefsNote = (resource.skill_refs && resource.skill_refs.length > 0)
    ? `\n> **引用 Skill**：此 Expert 引用了 ${resource.skill_refs.map(r => r.skill_name).join('、')} 等技能。安装时 CLI 会检测冲突并提示处理方式。\n`
    : '';

  const prompt = `# 安装 ${displayName}

## 资源信息
- **名称**: ${name}
- **类型**: ${typeLabel}
- **版本**: ${version}
- **作者**: ${author}
- **描述**: ${description || '无'}
- **PackageURL**: ${packageUrl}
- **MarkdownURL**: ${markdownUrl}
${expertNote}${skillRefsNote}
## 执行要求
1. 先确保当前环境已经安装 SkillHub CLI
2. 优先使用 PackageURL 下载安装包
3. 根据安装包中的文件结构安装对应技能
4. 如果某些技能已经安装，按幂等方式处理，不要报错中断

## 前置条件
先检查当前环境是否已安装 SkillHub CLI：
\`\`\`bash
skhub --version
\`\`\`
- 若已安装，直接跳到方式一
- 若未安装，在项目根目录运行 \`cd cli && npm link\` 注册全局命令

确认 SkillHub 服务正在运行（默认 ${base}）

## 方式一：CLI 安装（推荐）
\`\`\`bash
skhub install ${name}
\`\`\`
CLI 会自动检测当前平台（Claude Code / Cursor / WorkBuddy / Codex），
将资源安装到对应目录，无需手动选择平台。

可用选项：
- \`-p <platform>\` 指定平台（如 \`claude-code\`、\`cursor\`、\`workbuddy\`）
- \`-y\` 跳过确认提示

## 方式二：手动安装
1. 从 PackageURL 下载 ZIP 包：${packageUrl}
2. 解压到临时目录
3. 根据目标平台将文件放置到对应目录：
${platformPathLines}

## 验证
\`\`\`bash
skhub info ${name}    # 查看资源详情
skhub list            # 列出已安装资源
\`\`\`

## 幂等处理
- 如果技能已安装，重复安装不会报错，会更新到最新版本
${type === 'expert' ? '- Expert 包中引用的 Skill 如果已存在，CLI 会提示选择：跳过/覆盖/取消\n' : ''}
---
*复制此提示词发送给任意 AI 助手即可安装。支持 Claude Code、Cursor、WorkBuddy、Codex 等平台。*`;

  return {
    prompt,
    hubUrl: base,
    packageUrl,
    markdownUrl,
    // 返回结构化平台路径数据，供前端 Tab 2 渲染
    platformPaths: Object.entries(PLATFORM_PATHS).map(([key, info]) => ({
      platform: info.label,
      path: (info[type] || info.skill || '—').replace('{name}', name),
    })),
  };
}

module.exports = { generateInstallPrompt, PLATFORM_PATHS, TYPE_LABELS };
