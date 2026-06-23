/**
 * expert-detect — Web 端 Expert 文件识别工具
 *
 * 实现已上移到 `shared/expert-rules.mjs`（ESM wrapper），
 * 底层逻辑在 `shared/expert-rules.js`（CommonJS，CLI/Server 直接 require）。
 * Web 端必须用 .mjs 版本，因为 Rollup 生产构建不支持从 CJS 做命名导入。
 *
 * @see /Users/zcy/AgentHub/shared/expert-rules.mjs
 * @see /Users/zcy/AgentHub/shared/expert-rules.js
 */

import { parseFrontmatter, parseSkillRefs, looksLikeExpert } from '@shared/expert-rules.mjs';

export { parseFrontmatter, parseSkillRefs, looksLikeExpert };
