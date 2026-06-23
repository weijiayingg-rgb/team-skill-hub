/**
 * shared/expert-rules 单元测试
 *
 * 跑：cd /Users/zcy/AgentHub && node --test shared/__tests__/expert-rules.test.js
 *
 * 覆盖规则单一来源的关键路径：
 *   - frontmatter 解析（含 CRLF / 引号 / 列表两种格式）
 *   - skill 引用提取（frontmatter + 正文 + 并集）
 *   - 黑名单（路径前缀 + 路由词）
 *   - looksLikeExpert 4 条规则 + 否定用例
 */

const test = require('node:test');
const assert = require('node:assert');
const {
  parseFrontmatter,
  parseSkillRefs,
  looksLikeExpert,
  isExcludedSkillName,
  extractSkillsFromBody,
} = require('../expert-rules');

// ──────────────────────────────────────────────
// parseFrontmatter
// ──────────────────────────────────────────────

test('parseFrontmatter: 提取 name 和 description', () => {
  const md = `---\nname: my-expert\ndescription: 测试专家\n---\n\n正文`;
  const fm = parseFrontmatter(md);
  assert.strictEqual(fm.name, 'my-expert');
  assert.strictEqual(fm.description, '测试专家');
});

test('parseFrontmatter: 兼容 CRLF（Windows 编辑器保存）', () => {
  const md = `---\r\nname: x\r\ndescription: y\r\nskills: [a, b]\r\n---\r\n\r\n# x`;
  const fm = parseFrontmatter(md);
  assert.strictEqual(fm.name, 'x');
  assert.strictEqual(fm.hasSkillsField, true);
});

test('parseFrontmatter: 检测 inline skills 字段', () => {
  const md = `---\nskills: [a, b]\n---\n`;
  assert.strictEqual(parseFrontmatter(md).hasSkillsField, true);
});

test('parseFrontmatter: 检测列表形式 skills 字段', () => {
  const md = `---\nskills:\n  - a\n  - b\n---\n`;
  assert.strictEqual(parseFrontmatter(md).hasSkillsField, true);
});

test('parseFrontmatter: ≥2 agent 标记字段命中', () => {
  const md = `---\nname: x\nmodel: sonnet\ncolor: teal\nemoji: 🧪\n---\n`;
  assert.strictEqual(parseFrontmatter(md).hasAgentMarker, true);
});

test('parseFrontmatter: 单个 agent 字段不算', () => {
  const md = `---\nname: x\nmodel: sonnet\n---\n`;
  assert.strictEqual(parseFrontmatter(md).hasAgentMarker, false);
});

test('parseFrontmatter: 无 frontmatter 返回空', () => {
  assert.deepStrictEqual(parseFrontmatter('# 直接是标题'), {});
});

test('parseFrontmatter: 非字符串输入安全', () => {
  assert.deepStrictEqual(parseFrontmatter(null), {});
  assert.deepStrictEqual(parseFrontmatter(undefined), {});
});

// ──────────────────────────────────────────────
// 黑名单
// ──────────────────────────────────────────────

test('isExcludedSkillName: 完全等于（usr / api / docs）', () => {
  assert.strictEqual(isExcludedSkillName('usr'), true);
  assert.strictEqual(isExcludedSkillName('api'), true);
  assert.strictEqual(isExcludedSkillName('docs'), true);
});

test('isExcludedSkillName: 路径前缀（usr/local）', () => {
  assert.strictEqual(isExcludedSkillName('usr/local'), true);
  assert.strictEqual(isExcludedSkillName('var/log'), true);
});

test('isExcludedSkillName: 正常 skill 不命中', () => {
  assert.strictEqual(isExcludedSkillName('dt-spec'), false);
  assert.strictEqual(isExcludedSkillName('apifox'), false); // 不是完全等于 api
});

// ──────────────────────────────────────────────
// extractSkillsFromBody
// ──────────────────────────────────────────────

test('extractSkillsFromBody: 路由表抓取', () => {
  const md = '| 意图 | 调用 |\n| 规范 | `/dt-spec` |\n| 质量 | `/dt-quality` |';
  assert.deepStrictEqual(extractSkillsFromBody(md).sort(), ['dt-quality', 'dt-spec']);
});

test('extractSkillsFromBody: 排除路径前缀和路由词', () => {
  const md = '路径 `/usr/local`、`/api`、`/docs`、`/web` 都不算 skill';
  assert.deepStrictEqual(extractSkillsFromBody(md), []);
});

test('extractSkillsFromBody: 去重', () => {
  const md = '`/foo` 和 `/foo` 又一次 `/foo`';
  assert.deepStrictEqual(extractSkillsFromBody(md), ['foo']);
});

// ──────────────────────────────────────────────
// parseSkillRefs（frontmatter + body 并集）
// ──────────────────────────────────────────────

test('parseSkillRefs: 仅 frontmatter inline', () => {
  const md = `---\nskills: [a, b]\n---\n`;
  const r = parseSkillRefs(md);
  assert.deepStrictEqual(r.refs, ['a', 'b']);
  assert.strictEqual(r.source, 'frontmatter');
});

test('parseSkillRefs: 仅 frontmatter 列表', () => {
  const md = `---\nskills:\n  - 'a'\n  - "b"\n---\n`;
  const r = parseSkillRefs(md);
  assert.deepStrictEqual(r.refs, ['a', 'b']);
  assert.strictEqual(r.source, 'frontmatter');
});

test('parseSkillRefs: 仅正文路由表', () => {
  const md = '`/dt-spec` `/dt-quality`';
  const r = parseSkillRefs(md);
  assert.deepStrictEqual(r.refs.sort(), ['dt-quality', 'dt-spec']);
  assert.strictEqual(r.source, 'regex');
});

test('parseSkillRefs: frontmatter + 正文取并集', () => {
  const md = `---\nskills: [a, b]\n---\n# 路由表 \`/c\` \`/a\``; // a 在两处都有
  const r = parseSkillRefs(md);
  assert.deepStrictEqual(r.refs, ['a', 'b', 'c']); // 保持 fm 顺序，去重
  assert.strictEqual(r.source, 'merged');
});

test('parseSkillRefs: 都没有', () => {
  assert.deepStrictEqual(parseSkillRefs('普通文档').refs, []);
  assert.strictEqual(parseSkillRefs('普通文档').source, 'none');
});

test('parseSkillRefs: CRLF frontmatter', () => {
  const md = `---\r\nskills: [a, b]\r\n---\r\n`;
  assert.deepStrictEqual(parseSkillRefs(md).refs, ['a', 'b']);
});

// ──────────────────────────────────────────────
// looksLikeExpert
// ──────────────────────────────────────────────

test('looksLikeExpert: 文件名 prompt.md 命中', () => {
  assert.strictEqual(looksLikeExpert('prompt.md', '空内容'), true);
  assert.strictEqual(looksLikeExpert('PROMPT.MD', '空内容'), true);
});

test('looksLikeExpert: frontmatter 含 skills 命中', () => {
  const md = `---\nskills: [a, b]\n---\n`;
  assert.strictEqual(looksLikeExpert('whatever.md', md), true);
});

test('looksLikeExpert: ≥2 个 agent 字段命中', () => {
  const md = `---\nname: data-tester\nmodel: sonnet\ncolor: teal\nemoji: 🧪\n---\n`;
  assert.strictEqual(looksLikeExpert('data-tester.md', md), true);
});

test('looksLikeExpert: 路由表 ≥2 处命中', () => {
  const md = '| 规范 | `/dt-spec` |\n| 质量 | `/dt-quality` |';
  assert.strictEqual(looksLikeExpert('expert.md', md), true);
});

test('looksLikeExpert: 单处路由引用不算', () => {
  assert.strictEqual(looksLikeExpert('x.md', '看 `/foo` 即可'), false);
});

test('looksLikeExpert: 路径片段 /usr /api /web 不算 skill', () => {
  const md = '路径 `/usr/local`、`/api/v1`、`/web/foo` 都不算 skill 引用';
  assert.strictEqual(looksLikeExpert('docs.md', md), false);
});

test('looksLikeExpert: 普通 skill 文件返回 false', () => {
  const md = `---\nname: my-skill\ndescription: 一个 skill\n---\n# 普通 skill 内容`;
  assert.strictEqual(looksLikeExpert('my-skill.md', md), false);
});

// ──────────────────────────────────────────────
// CJS ↔ ESM 一致性测试
// ──────────────────────────────────────────────

test('CJS 与 ESM 版本导出一致性', async (t) => {
  // CJS 版本直接 require
  const cjs = require('../expert-rules');

  // ESM 版本用动态 import()（兼容 Node 18-21）
  const esm = await import('../expert-rules.mjs');

  // ── 常量一致性 ──

  t.assert.deepEqual(
    cjs.EXCLUDED_PATH_PREFIXES,
    esm.EXCLUDED_PATH_PREFIXES,
    'EXCLUDED_PATH_PREFIXES 应一致',
  );
  t.assert.deepEqual(
    cjs.AGENT_MARKER_FIELDS,
    esm.AGENT_MARKER_FIELDS,
    'AGENT_MARKER_FIELDS 应一致',
  );
  t.assert.strictEqual(
    cjs.ROUTING_TABLE_MIN_REFS,
    esm.ROUTING_TABLE_MIN_REFS,
    'ROUTING_TABLE_MIN_REFS 应一致',
  );

  // ── 函数一致性：相同输入 → 相同输出 ──

  // parseFrontmatter
  const fmInputs = [
    `---\nname: my-expert\ndescription: 测试专家\n---\n\n正文`,
    `---\r\nname: x\r\ndescription: y\r\nskills: [a, b]\r\n---\r\n\r\n# x`,
    `---\nskills: [a, b]\n---\n`,
    `---\nskills:\n  - a\n  - b\n---\n`,
    `---\nname: x\nmodel: sonnet\ncolor: teal\nemoji: 🧪\n---\n`,
    '# 直接是标题',
    null,
    undefined,
  ];
  for (const input of fmInputs) {
    t.assert.deepEqual(
      cjs.parseFrontmatter(input),
      esm.parseFrontmatter(input),
      `parseFrontmatter(${JSON.stringify(input)}) 应一致`,
    );
  }

  // isExcludedSkillName
  const excludedInputs = ['usr', 'api', 'docs', 'usr/local', 'var/log', 'dt-spec', 'apifox', '', null];
  for (const input of excludedInputs) {
    t.assert.strictEqual(
      cjs.isExcludedSkillName(input),
      esm.isExcludedSkillName(input),
      `isExcludedSkillName(${JSON.stringify(input)}) 应一致`,
    );
  }

  // extractSkillsFromBody
  const bodyInputs = [
    '| 意图 | 调用 |\n| 规范 | `/dt-spec` |\n| 质量 | `/dt-quality` |',
    '路径 `/usr/local`、`/api`、`/docs`、`/web` 都不算 skill',
    '`/foo` 和 `/foo` 又一次 `/foo`',
    '`/dt-spec` `/dt-quality`',
  ];
  for (const input of bodyInputs) {
    t.assert.deepEqual(
      cjs.extractSkillsFromBody(input),
      esm.extractSkillsFromBody(input),
      `extractSkillsFromBody(${JSON.stringify(input)}) 应一致`,
    );
  }

  // extractSkillsFromFrontmatter
  const fmRefInputs = [
    'skills: [a, b]',
    "skills:\n  - 'a'\n  - \"b\"",
    'name: x',
  ];
  for (const input of fmRefInputs) {
    t.assert.deepEqual(
      cjs.extractSkillsFromFrontmatter(input),
      esm.extractSkillsFromFrontmatter(input),
      `extractSkillsFromFrontmatter(${JSON.stringify(input)}) 应一致`,
    );
  }

  // parseSkillRefs
  const skillRefInputs = [
    `---\nskills: [a, b]\n---\n`,
    `---\nskills:\n  - 'a'\n  - "b"\n---\n`,
    '`/dt-spec` `/dt-quality`',
    "---\nskills: [a, b]\n---\n# 路由表 `/c` `/a`",
    '普通文档',
    `---\r\nskills: [a, b]\r\n---\r\n`,
  ];
  for (const input of skillRefInputs) {
    const cjsResult = cjs.parseSkillRefs(input);
    const esmResult = esm.parseSkillRefs(input);
    t.assert.deepEqual(
      cjsResult.refs,
      esmResult.refs,
      `parseSkillRefs(${JSON.stringify(input)}) refs 应一致`,
    );
    t.assert.strictEqual(
      cjsResult.source,
      esmResult.source,
      `parseSkillRefs(${JSON.stringify(input)}) source 应一致`,
    );
  }

  // looksLikeExpert
  const expertInputs = [
    ['prompt.md', '空内容'],
    ['PROMPT.MD', '空内容'],
    ['whatever.md', `---\nskills: [a, b]\n---\n`],
    ['data-tester.md', `---\nname: data-tester\nmodel: sonnet\ncolor: teal\nemoji: 🧪\n---\n`],
    ['expert.md', '| 规范 | `/dt-spec` |\n| 质量 | `/dt-quality` |'],
    ['x.md', '看 `/foo` 即可'],
    ['docs.md', '路径 `/usr/local`、`/api/v1`、`/web/foo` 都不算 skill 引用'],
    ['my-skill.md', `---\nname: my-skill\ndescription: 一个 skill\n---\n# 普通 skill 内容`],
  ];
  for (const [fileName, content] of expertInputs) {
    t.assert.strictEqual(
      cjs.looksLikeExpert(fileName, content),
      esm.looksLikeExpert(fileName, content),
      `looksLikeExpert(${JSON.stringify(fileName)}, ${JSON.stringify(content)}) 应一致`,
    );
  }
});
