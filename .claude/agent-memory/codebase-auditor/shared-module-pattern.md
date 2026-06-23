---
name: shared-module-pattern
description: shared/ 目录不在 npm workspaces 中，CLI 和 Server 直接 require 相对路径引入，Web 用 @shared alias 通过 Vite bundle 引入
metadata:
  type: reference
---

shared/ 目录的模块被三端共用：
- CLI: `const { parseSkillRefs } = require('../../shared/expert-rules')` (cli/utils/expert-bundler.js:24)
- Server: `const { parseSkillRefs } = require('../../shared/expert-rules')` (server/services/resource-manager.js:267, 483)
- Web: `import { parseFrontmatter, from '@shared/expert-rules'` (web/src/utils/expert-detect.js:10-14)

三端路径分别是：
- CLI: ../../shared/expert-rules（从 cli/utils/ 上溯两级到根目录）
- Server: ../../shared/expert-rules（从 server/services/ 上溯两级到根目录）
- Web: @shared/expert-rules（Vite alias @shared → 根目录/shared）

**Why:** 仓库根目录的 shared/ 不在 npm workspaces 体系内（package.json 的 workspaces 只列了 server/cli/web），所以 CLI 和 Server 需要用相对路径引入。Vite 的 resolve.alias 配置了 @shared 到根目录/shared，Web 端使用 ESM import。

**How to apply:** 审查涉及 shared 模块的引入路径时，确认相对路径层级正确（CLI 和 Server 从各自目录上溯两级到根目录）；检查 Vite alias 配置（@shared → ../shared）；检查 vitest.config.js 中 alias 与 vite.config.js 保持一致。
