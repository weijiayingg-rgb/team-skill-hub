---
name: expert-skillrefs-assignment-bug
description: addVersion 中 newSkillRefs 刵值逻辑有隐性 bug——null 与 [] 的语义差异导致 expert.yaml skills 丢失
metadata:
  type: feedback
---

addVersion 函数（resource-manager.js:403） 中 `newSkillRefs` 初始值设为 `null`（语义为"未确定是否有引用"），而 create 方法中 `expertSkillRefs` 初始值设为 `[]`（语义为"确定没有引用"）。两者语义不一致。

关键问题在兜底逻辑（第485-488 行）：当 expert.yaml 不存在或 skills 不是 Array 时， newSkillRefs 保持 null。兜底逻辑 `const seen = new Set(newSkillRefs || [])` 实际是 `new Set([])`，`(newSkillRefs || (newSkillRefs = [])).push(r)` 会把 null 变成空数组再push。结果： expert.yaml 的 skills 被完全忽略，只保留 prompt.md 的兜底引用。

而 create 方法中同样的逻辑用的是 `expertSkillRefs`（初始值是空数组 `[]`），兜底时 `const seen = new Set(expertSkillRefs)` 不会丢失 expert.yaml 的内容。

**Why:** null vs [] 的语义差异在兜底逻辑中导致行为不一致——addVersion 会丢失 expert.yaml 的声明
**How to apply:** 将 addVersion 中 newSkillRefs 初始值改为 []，与 create 保持一致