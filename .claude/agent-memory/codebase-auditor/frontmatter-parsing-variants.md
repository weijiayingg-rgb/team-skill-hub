---
name: frontmatter-parsing-variants
description: 项目中存在多处 YAML frontmatter 解析逻辑，用途不同但正则不一致
metadata:
  type: reference
---

项目中 YAML frontmatter 解析有多个版本，用于不同场景：

1. **shared/expert-rules.js** — `FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---/` — CRLF 兼容，用于 Expert 识别和 Skill 引用提取（三端共用）
2. **cli/utils/fingerprint.js** — 简易版（indexOf 找 `---` 开始和结束标记），不支持 CRLF，只做 key: value 单行解析
3. **cli/utils/scanner.js:530** — `/^---\n([\s\S]*?)\n---/`（不支持 CRLF），只提取 name 和 description
4. **server/routes/sync-sessions.js:282** — `(/^---\n([\s\S]*?)\n---/`（不支持 CRLF），只提取 description

**Why:** 不同位置的 frontmatter 解析用途不同： shared 版做 Expert 识别（需要 skills/agent 特征字段），fingerprint/scanner/sync-sessions 版只做简单 metadata 提取。不统一的原因是功能目标不同——强行统一会引入不必要的复杂度。

**How to apply:** 审查 frontmatter 解析相关改动时，确认每个位置的解析目标（Expert 识别 vs 简单 metadata 提取），避免误统一。未来如果需要 CRLF 兼容，可考虑让 scanner/sync-sessions 也切换到 shared 版。
