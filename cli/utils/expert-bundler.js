/**
 * expert-bundler — Expert 智能打包器
 *
 * 将单个 Expert .md 文件自动打包为标准 Expert ZIP 包：
 *   1. 解析 Skill 引用（frontmatter + 正文路由表 取并集）
 *   2. 在标准目录中搜索对应的 Skill 文件
 *   3. 构建 ZIP：prompt.md + skills/*.md + expert.yaml
 *
 * Skill 引用解析规则统一来自 shared/expert-rules.js（单一规则源）：
 *   - frontmatter 中的 skills 字段（显式声明）
 *   - 正文中的 `/skill-name` 模式（路由表推断）
 *   - 两者都有时取并集
 *
 * 标准 Expert 包结构：
 *   prompt.md         ← Expert 身份定义（必须）
 *   expert.yaml       ← 声明引用的 Skill 列表（自动生成）
 *   skills/*.md       ← 嵌入的技能文件（自动收集）
 *   tools/*.json      ← 工具配置（暂不涉及）
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { parseSkillRefs } = require('../../shared/expert-rules');

/**
 * 获取所有 Skill 搜索目录
 *
 * 覆盖 Claude Code 的两种 Skill 格式：
 *   - 标准格式: ~/.claude/commands/{name}.md
 *   - cc-switch 格式: ~/.claude/skills/{name}/index.md
 *
 * 以及其他平台的标准路径。
 *
 * @returns {string[]} 存在的目录绝对路径列表
 */
function getSkillSearchDirs() {
  const home = os.homedir();
  const dirs = [
    // Claude Code — 两种格式
    path.join(home, '.claude', 'commands'),
    path.join(home, '.claude', 'skills'),
    // Cursor
    path.join(home, '.cursor', 'rules'),
    // WorkBuddy
    path.join(home, '.workbuddy', 'skills'),
    // Codex
    path.join(home, '.codex', 'commands'),
  ];

  // 当前项目目录（如果是 git 仓库根目录）
  const projectCommands = path.join(process.cwd(), '.claude', 'commands');
  if (fs.existsSync(projectCommands)) {
    dirs.push(projectCommands);
  }
  const projectSkills = path.join(process.cwd(), '.claude', 'skills');
  if (fs.existsSync(projectSkills)) {
    dirs.push(projectSkills);
  }

  return dirs.filter(dir => fs.existsSync(dir) && fs.statSync(dir).isDirectory());
}

/**
 * 在搜索目录中查找指定名称的 Skill 文件
 *
 * 支持两种格式：
 *   - 标准格式: {dir}/{skillName}.md 或 .mdx
 *   - cc-switch 格式: {dir}/{skillName}/index.md
 *
 * @param {string} skillName - Skill 名称（不含扩展名）
 * @param {string[]} searchDirs - 搜索目录列表
 * @returns {{ path: string, content: string } | null}
 */
function findSkillFile(skillName, searchDirs) {
  // 收集所有候选文件，再按 mtime 选最新（cc-switch 与传统 .md 共存时不会错命中旧版）
  const candidates = [];
  for (const dir of searchDirs) {
    // cc-switch 格式: {name}/index.md（目录入口优先级更高，是新格式）
    const indexMd = path.join(dir, skillName, 'index.md');
    if (fs.existsSync(indexMd) && fs.statSync(indexMd).isFile()) {
      candidates.push({ path: indexMd, mtime: fs.statSync(indexMd).mtimeMs });
    }
    // 标准格式: {name}.md / {name}.mdx
    for (const ext of ['.md', '.mdx']) {
      const filePath = path.join(dir, skillName + ext);
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        candidates.push({ path: filePath, mtime: fs.statSync(filePath).mtimeMs });
      }
    }
  }
  if (candidates.length === 0) return null;
  // 按 mtime 降序选最新（同一 skill 在 cc-switch 目录和老 .md 同时存在时取较新者）
  candidates.sort((a, b) => b.mtime - a.mtime);
  const winner = candidates[0];
  return {
    path: winner.path,
    content: fs.readFileSync(winner.path, 'utf-8'),
  };
}

/**
 * 智能打包 Expert 为 ZIP Buffer
 *
 * 如果检测到是 Expert 类型且有引用的 Skill，自动构建标准 Expert ZIP 包。
 * 否则返回 null，表示无需特殊打包（普通上传即可）。
 *
 * @param {string} filePath - Expert .md 文件的绝对路径
 * @param {object} [options] - 配置选项
 * @param {string} [options.type] - 资源类型（如果不传，自动从 frontmatter 检测）
 * @param {boolean} [options.verbose] - 是否打印详细日志
 * @returns {{
 *   isExpert: boolean,
 *   zipBuffer: Buffer | null,
 *   skillRefs: string[],
 *   foundSkills: { name: string, path: string }[],
 *   missingSkills: string[],
 *   structure: { path: string, size: number }[]
 * }}
 */
function bundleExpert(filePath, options = {}) {
  const { verbose = false } = options;

  // 读取 Expert 文件内容
  if (!fs.existsSync(filePath)) {
    return { isExpert: false, zipBuffer: null, skillRefs: [], foundSkills: [], missingSkills: [], structure: [] };
  }

  const content = fs.readFileSync(filePath, 'utf-8');

  // 检测是否为 Expert
  // 来源（任一命中即识别）：
  //   1. 调用者显式传 options.type === 'expert'（CLI publish 路径）
  //   2. frontmatter 含 type: expert
  //   3. 文件位于 ~/.claude/agents/ 目录下（claude agent 文件）
  let isExpert = options.type === 'expert';
  if (!isExpert) {
    // 从 frontmatter 检测 type 字段
    const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (fmMatch && /^type:\s*expert\s*$/m.test(fmMatch[1])) {
      isExpert = true;
    }
    // ~/.claude/agents/ 目录约定
    if (!isExpert) {
      const agentsDir = path.join(os.homedir(), '.claude', 'agents');
      if (filePath.startsWith(agentsDir)) {
        isExpert = true;
      }
    }
  }

  if (!isExpert) {
    return { isExpert: false, zipBuffer: null, skillRefs: [], foundSkills: [], missingSkills: [], structure: [] };
  }

  // 解析 Skill 引用（统一规则：frontmatter + 正文 取并集）
  const { refs: skillRefNames, source: refSource } = parseSkillRefs(content);
  if (verbose) {
    const sourceLabel = {
      frontmatter: 'frontmatter 显式声明',
      regex: '正文路由表',
      merged: 'frontmatter + 路由表 并集',
      none: '无',
    }[refSource] || refSource;
    console.log(`  解析到 ${skillRefNames.length} 个 Skill 引用 (${sourceLabel}): ${skillRefNames.join(', ') || '无'}`);
  }

  // 搜索 Skill 文件
  const searchDirs = getSkillSearchDirs();
  const foundSkills = [];
  const missingSkills = [];

  for (const refName of skillRefNames) {
    const skill = findSkillFile(refName, searchDirs);
    if (skill) {
      foundSkills.push({ name: refName, path: skill.path, content: skill.content });
    } else {
      missingSkills.push(refName);
    }
  }

  // 构建 ZIP
  const AdmZip = require('adm-zip');
  const zip = new AdmZip();
  const structure = [];

  // 1. prompt.md — Expert 身份定义（始终放在根目录）
  zip.addFile('prompt.md', Buffer.from(content, 'utf-8'));
  structure.push({ path: 'prompt.md', size: content.length });

  // 2. skills/*.md — 嵌入找到的 Skill 文件
  for (const skill of foundSkills) {
    const skillPath = `skills/${skill.name}.md`;
    zip.addFile(skillPath, Buffer.from(skill.content, 'utf-8'));
    structure.push({ path: skillPath, size: skill.content.length });
  }

  // 3. expert.yaml — 声明所有引用的 Skill（包括找到的和未找到的）
  if (skillRefNames.length > 0) {
    const yamlContent = [
      '# Expert Skill 引用声明（由 skhub publish 自动生成）',
      `# 生成时间：${new Date().toISOString().split('T')[0]}`,
      'skills:',
      ...skillRefNames.map(name => {
        const status = foundSkills.some(s => s.name === name) ? '' : '  # ⚠ 本地未找到，需手动安装';
        return `  - ${name}${status}`;
      }),
      '',
    ].join('\n');
    zip.addFile('expert.yaml', Buffer.from(yamlContent, 'utf-8'));
    structure.push({ path: 'expert.yaml', size: yamlContent.length });
  }

  const zipBuffer = zip.toBuffer();

  if (verbose) {
    console.log(`  打包结构：`);
    structure.forEach(s => console.log(`    ${s.path} (${s.size} bytes)`));
    if (missingSkills.length > 0) {
      console.log(`  ⚠ 未找到的 Skill: ${missingSkills.join(', ')}`);
    }
  }

  return {
    isExpert: true,
    zipBuffer,
    skillRefs: skillRefNames,
    foundSkills: foundSkills.map(s => ({ name: s.name, path: s.path })),
    missingSkills,
    structure,
  };
}

module.exports = { bundleExpert, findSkillFile, getSkillSearchDirs };
