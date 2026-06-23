---
name: project-zip-path-handling
description: 项目中 ZIP 解析和文件写入没有路径遍历防护，需要重点修复
metadata:
  type: feedback
---

parseExpertZip（resource-manager.js:92-114）和 writeResourceFile（git-store.js:55-64）都不检查 `..` 路径遍历。恶意 ZIP 包可以包含 `../../../etc/passwd` 这样的 entryName，通过 path.join 写到 versionDir 之外。Node.js path.join 不会拒绝 `../`，结果文件会写到目标目录外。

sync-sessions.js:272 的路径校验只检查 HOME 目录前缀 + `..`，但 parseExpertZip 没有同等防护。

**Why:** zip-slip 是经典攻击模式，本项目缺乏防护
**How to apply:** 所有 ZIP 解析和文件写入代码都应加入路径遍历检查（拒绝包含 `..` 的路径），确保最终路径仍在预期目录内。[[zip-slip-vulnerability]] [[expert-skillrefs-assignment-bug]]
