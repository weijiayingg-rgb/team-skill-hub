---
name: agent-memory-index
description: Codebase Auditor agent memory index
---

- [zip-slip 漯防漏洞](zip-slip-vulnerability.md) — parseExpertZip 和 writeResourceFile 缺少路径遍历校验
- [shared 模块引入模式](shared-module-pattern.md) — shared/ 不在 npm workspaces 中，CLI 和 Server 直接 require 相对路径引入，Web 用 Vite alias
- [frontmatter 解析差异](frontmatter-parsing-variants.md) — 项目中多处 YAML frontmatter 解析逻辑不一致，scanner/fingerprint/sync-sessions 用简化正则，shared 用 CRLF 兼容版
- [expert skill_refs 赬值 bug](expert-skillrefs-assignment-bug.md) — addVersion 中 newSkillRefs 初始值 null 导致兜底逻辑丢失 expert.yaml skills
- [项目 ZIP 路径处理](project-zip-path-handling.md) — ZIP 解析和文件写入缺乏路径遍历防护