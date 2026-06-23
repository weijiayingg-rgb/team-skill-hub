/**
 * shared/expert-rules-cjs — CommonJS wrapper（给 CLI / Server 用）
 *
 * expert-rules.mjs 是纯 ESM 格式，Vite/Rollup 能直接做命名导入。
 * CLI 和 Server 是 CommonJS 环境，不能直接 import .mjs 文件。
 * 这个 wrapper 用动态 import() 加载 ESM 模块，然后以 CommonJS 方式导出。
 *
 * 由于 import() 是异步的，这里用同步的 hack：
 *   - 在 CLI 启动时一次性 require 此文件
 *   - 内部用 Module._load + 禁用 ESM 检测的方式同步加载 .mjs
 *
 * 更简单的方案：直接把逻辑写在这个 .js 文件里（CJS 格式），
 * 但这样会违反"单一源文件"原则。所以这里只做转发。
 */

// 最简单的方案：直接用 CJS 格式在这里转发
// Node.js 22+ 支持 require(esm)（--experimental-require-module）
// 但为了兼容旧版本，直接把 .mjs 的逻辑复制一份在这里（保持同步）
//
// 注意：这不再是"转发"，而是"副本"。两份文件必须保持一致。
// 任何改动都要同时修改 expert-rules.mjs 和 expert-rules.js（CJS 副本）。
//
// 更好的方案：只保留一份 .mjs 源文件，CLI/Server 通过 Node 22+ 的
// require(esm) 引入。当前项目要求 Node >= 18，部分用户可能在 18-21，
// 所以暂时保留两份。

// ─── 以下内容与 expert-rules.mjs 完全一致，只是导出格式改为 CJS ───

const EXCLUDED_PATH_PREFIXES = [
  'usr', 'tmp', 'home', 'etc', 'var', 'opt', 'bin', 'sbin', 'dev', 'proc', 'sys',
  'api', 'web', 'docs', 'admin', 'health', 'ping', 'status',
];

const AGENT_MARKER_FIELDS = ['model', 'color', 'emoji', 'memory', 'agentType'];
const ROUTING_TABLE_MIN_REFS = 2;
const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---/;

function parseFrontmatter(content) {
  const result = {};
  if (typeof content !== 'string') return result;
  const fmMatch = content.match(FRONTMATTER_RE);
  if (!fmMatch) return result;
  const yaml = fmMatch[1];
  const nameMatch = yaml.match(/^name:\s*(.+)$/m);
  const descMatch = yaml.match(/^description:\s*(.+)$/m);
  if (nameMatch) result.name = nameMatch[1].trim().replace(/^>-\s*/, '').split('\n')[0].trim();
  if (descMatch) {
    result.description = descMatch[1].trim().replace(/^>-\s*/, '');
    if (result.description.startsWith('>')) result.description = result.description.replace(/^>-?\s*/, '').split('\n')[0].trim();
  }
  result.hasSkillsField = /^skills:\s*(\[|\r?\n\s+-\s)/m.test(yaml);
  const hitCount = AGENT_MARKER_FIELDS.filter(k => new RegExp(`^${k}:\\s*\\S`, 'm').test(yaml)).length;
  result.hasAgentMarker = hitCount >= 2;
  return result;
}

function isExcludedSkillName(name) {
  if (!name) return true;
  for (const prefix of EXCLUDED_PATH_PREFIXES) {
    if (name === prefix) return true;
    if (name.startsWith(prefix + '/')) return true;
  }
  return false;
}

function extractSkillsFromFrontmatter(frontmatter) {
  const inlineMatch = frontmatter.match(/^skills:\s*\[([^\]]+)\]/m);
  if (inlineMatch) return inlineMatch[1].split(',').map(s => s.trim().replace(/['"]/g, '')).filter(Boolean);
  const listMatch = frontmatter.match(/^skills:\s*\r?\n((?:\s+-\s+.+\r?\n?)+)/m);
  if (listMatch) return listMatch[1].split(/\r?\n/).map(line => line.replace(/^\s+-\s+/, '').trim().replace(/['"]/g, '')).filter(Boolean);
  return [];
}

function extractSkillsFromBody(content) {
  const refs = new Set();
  const pattern = /`\/([a-zA-Z][a-zA-Z0-9-]*)`/g;
  let match;
  while ((match = pattern.exec(content)) !== null) { const name = match[1].toLowerCase(); if (!isExcludedSkillName(name)) refs.add(name); }
  return [...refs];
}

function parseSkillRefs(content) {
  if (typeof content !== 'string') return { refs: [], source: 'none' };
  const fmMatch = content.match(FRONTMATTER_RE);
  const fmRefs = fmMatch ? extractSkillsFromFrontmatter(fmMatch[1]) : [];
  const bodyRefs = extractSkillsFromBody(content);
  if (fmRefs.length === 0 && bodyRefs.length === 0) return { refs: [], source: 'none' };
  if (fmRefs.length > 0 && bodyRefs.length === 0) return { refs: fmRefs, source: 'frontmatter' };
  if (fmRefs.length === 0 && bodyRefs.length > 0) return { refs: bodyRefs, source: 'regex' };
  const merged = [...fmRefs]; const seen = new Set(fmRefs);
  for (const r of bodyRefs) { if (!seen.has(r)) { merged.push(r); seen.add(r); } }
  return { refs: merged, source: 'merged' };
}

function looksLikeExpert(fileName, content) {
  if (fileName && fileName.toLowerCase() === 'prompt.md') return true;
  if (typeof content !== 'string') return false;
  const fm = parseFrontmatter(content);
  if (fm.hasSkillsField) return true;
  if (fm.hasAgentMarker) return true;
  const bodyRefs = extractSkillsFromBody(content);
  return bodyRefs.length >= ROUTING_TABLE_MIN_REFS;
}

module.exports = {
  parseFrontmatter, parseSkillRefs, looksLikeExpert,
  extractSkillsFromFrontmatter, extractSkillsFromBody, isExcludedSkillName,
  EXCLUDED_PATH_PREFIXES, AGENT_MARKER_FIELDS, ROUTING_TABLE_MIN_REFS,
};
