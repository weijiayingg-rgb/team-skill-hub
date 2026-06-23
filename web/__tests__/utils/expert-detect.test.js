/**
 * expert-detect 单元测试
 *
 * 覆盖 4 个 expert 识别策略 + 否定用例。
 * 直接通过 vitest 的 resolve alias（@shared）测试 shared 源。
 */

import { describe, it, expect } from 'vitest';
import { parseFrontmatter, looksLikeExpert } from '@shared/expert-rules';

describe('parseFrontmatter', () => {
  it('提取 name 和 description', () => {
    const md = `---\nname: my-expert\ndescription: 一个测试专家\n---\n\n正文`;
    const fm = parseFrontmatter(md);
    expect(fm.name).toBe('my-expert');
    expect(fm.description).toBe('一个测试专家');
  });

  it('兼容 CRLF（Windows 编辑器保存）', () => {
    const md = `---\r\nname: x\r\ndescription: y\r\nskills: [a, b]\r\n---\r\n\r\n# x`;
    const fm = parseFrontmatter(md);
    expect(fm.name).toBe('x');
    expect(fm.hasSkillsField).toBe(true);
  });

  it('无 frontmatter 时返回空对象', () => {
    expect(parseFrontmatter('# 直接是标题')).toEqual({});
  });

  it('检测 inline 数组形式的 skills 字段', () => {
    const md = `---\nname: x\nskills: [a, b]\n---\n`;
    expect(parseFrontmatter(md).hasSkillsField).toBe(true);
  });

  it('检测列表形式的 skills 字段', () => {
    const md = `---\nname: x\nskills:\n  - a\n  - b\n---\n`;
    expect(parseFrontmatter(md).hasSkillsField).toBe(true);
  });

  it('检测 ≥2 个 agent 标记字段', () => {
    const md = `---\nname: data-tester\nmodel: sonnet\ncolor: teal\nemoji: 🧪\n---\n`;
    expect(parseFrontmatter(md).hasAgentMarker).toBe(true);
  });

  it('单个 agent 字段不算 agent', () => {
    const md = `---\nname: x\nmodel: sonnet\n---\n`;
    expect(parseFrontmatter(md).hasAgentMarker).toBe(false);
  });
});

describe('looksLikeExpert', () => {
  it('文件名 prompt.md 直接命中', () => {
    expect(looksLikeExpert('prompt.md', '空内容')).toBe(true);
    expect(looksLikeExpert('PROMPT.MD', '空内容')).toBe(true);
  });

  it('frontmatter 含 skills 字段命中', () => {
    const md = `---\nname: x\nskills: [a, b]\n---\n# x`;
    expect(looksLikeExpert('whatever.md', md)).toBe(true);
  });

  it('frontmatter 含多个 agent 标记字段命中（claude agent 场景）', () => {
    const md = `---\nname: data-tester\nmodel: sonnet\ncolor: teal\nemoji: 🧪\nmemory: project\n---\n\n# 内容`;
    expect(looksLikeExpert('data-tester.md', md)).toBe(true);
  });

  it('正文 ≥2 处 /skill-name 路由表引用命中', () => {
    const md = `# 路由表\n| 意图 | 调用 |\n| 规范 | \`/dt-spec\` |\n| 质量 | \`/dt-quality\` |\n`;
    expect(looksLikeExpert('expert.md', md)).toBe(true);
  });

  it('单处 /skill 引用不算（避免单例误判）', () => {
    const md = `# 普通文档\n看 \`/foo\` 即可\n`;
    expect(looksLikeExpert('普通.md', md)).toBe(false);
  });

  it('正文中的路径片段不被识别为 Skill 引用', () => {
    const md = `# 文档\n路径 \`/usr/local\`、\`/api\`、\`/web\` 都不算 skill\n`;
    expect(looksLikeExpert('docs.md', md)).toBe(false);
  });

  it('普通 skill 文件返回 false', () => {
    const md = `---\nname: my-skill\ndescription: just a skill\n---\n# 普通 skill 内容\n`;
    expect(looksLikeExpert('my-skill.md', md)).toBe(false);
  });
});
