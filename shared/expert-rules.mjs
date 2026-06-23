/**
 * shared/expert-rules — Expert 文件识别 + Skill 引用解析的「单一规则源」（ESM）
 *
 * 这个文件是 CLI / Web / Server 三端共享的「expert 规则单一来源」。
 * 使用纯 ESM 格式（export），以便 Vite/Rollup 能直接做命名导入。
 * CLI 和 Server 通过 expert-rules-cjs.js（CJS wrapper）引入。
 *
 * 之前 expert 判定散在 cli/utils/expert-bundler.js 和 web/src/utils/expert-detect.js，
 * 阈值与黑名单不一致，导致同一个 .md 在 CLI / Web 端识别结果不同（审查报告 🔴 #1）。
 * 现在统一到这里，三端都按这套规则走。
 */

// ─── 常量 ───

/**
 * 路径类前缀黑名单，避免把 `/usr/...`、`/api/...` 误识别为 Skill 引用。
 * 同时支持完全等于和路径前缀两种判定。
 */
export const EXCLUDED_PATH_PREFIXES = [
  'usr', 'tmp', 'home', 'etc', 'var', 'opt', 'bin', 'sbin', 'dev', 'proc', 'sys',
  'api', 'web', 'docs', 'admin', 'health', 'ping', 'status',
];

/** Claude Agent frontmatter 特征字段。≥2 个同时出现 → agent 文件。 */
export const AGENT_MARKER_FIELDS = ['model', 'color', 'emoji', 'memory', 'agentType'];

/** 路由表识别最低引用数。 */
export const ROUTING_TABLE_MIN_REFS = 2;

/** frontmatter 头正则（CRLF 兼容） */
const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---/;

// ─── frontmatter 解析 ───

export function parseFrontmatter(content) {
  const result = {};
  if (typeof content !== 'string') return result;

  const fmMatch = content.match(FRONTMATTER_RE);
  if (!fmMatch) return result;

  const yaml = fmMatch[1];
  const nameMatch = yaml.match(/^name:\s*(.+)$/m);
  const descMatch = yaml.match(/^description:\s*(.+)$/m);

  if (nameMatch) {
    result.name = nameMatch[1].trim().replace(/^>-\s*/, '').split('\n')[0].trim();
  }
  if (descMatch) {
    result.description = descMatch[1].trim().replace(/^>-\s*/, '');
    if (result.description.startsWith('>')) {
      result.description = result.description.replace(/^>-?\s*/, '').split('\n')[0].trim();
    }
  }

  result.hasSkillsField = /^skills:\s*(\[|\r?\n\s+-\s)/m.test(yaml);

  const hitCount = AGENT_MARKER_FIELDS.filter(k =>
    new RegExp(`^${k}:\\s*\\S`, 'm').test(yaml)
  ).length;
  result.hasAgentMarker = hitCount >= 2;

  return result;
}

// ─── Skill 引用解析 ───

export function isExcludedSkillName(name) {
  if (!name) return true;
  for (const prefix of EXCLUDED_PATH_PREFIXES) {
    if (name === prefix) return true;
    if (name.startsWith(prefix + '/')) return true;
  }
  return false;
}

export function extractSkillsFromFrontmatter(frontmatter) {
  const inlineMatch = frontmatter.match(/^skills:\s*\[([^\]]+)\]/m);
  if (inlineMatch) {
    return inlineMatch[1].split(',').map(s => s.trim().replace(/['"]/g, '')).filter(Boolean);
  }
  const listMatch = frontmatter.match(/^skills:\s*\r?\n((?:\s+-\s+.+\r?\n?)+)/m);
  if (listMatch) {
    return listMatch[1].split(/\r?\n/).map(line => line.replace(/^\s+-\s+/, '').trim().replace(/['"]/g, '')).filter(Boolean);
  }
  return [];
}

export function extractSkillsFromBody(content) {
  const refs = new Set();
  const pattern = /`\/([a-zA-Z][a-zA-Z0-9-]*)`/g;
  let match;
  while ((match = pattern.exec(content)) !== null) {
    const name = match[1].toLowerCase();
    if (!isExcludedSkillName(name)) refs.add(name);
  }
  return [...refs];
}

export function parseSkillRefs(content) {
  if (typeof content !== 'string') return { refs: [], source: 'none' };

  const fmMatch = content.match(FRONTMATTER_RE);
  const fmRefs = fmMatch ? extractSkillsFromFrontmatter(fmMatch[1]) : [];
  const bodyRefs = extractSkillsFromBody(content);

  if (fmRefs.length === 0 && bodyRefs.length === 0) return { refs: [], source: 'none' };
  if (fmRefs.length > 0 && bodyRefs.length === 0) return { refs: fmRefs, source: 'frontmatter' };
  if (fmRefs.length === 0 && bodyRefs.length > 0) return { refs: bodyRefs, source: 'regex' };

  const merged = [...fmRefs];
  const seen = new Set(fmRefs);
  for (const r of bodyRefs) { if (!seen.has(r)) { merged.push(r); seen.add(r); } }
  return { refs: merged, source: 'merged' };
}

// ─── Expert 类型识别 ───

export function looksLikeExpert(fileName, content) {
  if (fileName && fileName.toLowerCase() === 'prompt.md') return true;
  if (typeof content !== 'string') return false;

  const fm = parseFrontmatter(content);
  if (fm.hasSkillsField) return true;
  if (fm.hasAgentMarker) return true;

  const bodyRefs = extractSkillsFromBody(content);
  return bodyRefs.length >= ROUTING_TABLE_MIN_REFS;
}
