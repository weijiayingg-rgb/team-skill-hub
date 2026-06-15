# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

SkillHub 是跨平台 AI 资源管理与分发中心。核心功能：管理 Skill、Rules、Expert、Hook 等 AI 资源，支持在 WorkBuddy、Cursor、Claude Code 三平台之间统一分发。

## 架构

npm workspaces 项目，三个子包 + 适配器层：

- **server** — Express 4 后端，better-sqlite3 同步 API 存储，simple-git 管理资源版本仓库
- **web** — React 18 前端（MUI 6 + Tailwind CSS），Vite 5 构建，Vite proxy 将 `/api` 和 `/uploads` 转发到后端
- **cli** — `skhub` 命令行工具（Commander.js），7 个子命令：install/search/publish/list/info/config/bundle
- **adapters** — 平台适配器层，继承 `PlatformAdapter` 基类（4 个方法：`platform` getter、`supportedTypes`、`install`、`isInstalled`、`uninstall`），在 `adapters/index.js` 注册

### 数据流

资源文件存储在 Git 仓库（`data/skillhub-registry/`），SQLite 存元数据缓存和互动数据。创建资源时：ResourceManager → GitStore 写文件 + metadata.yaml → SQLite 写记录 → manifest-generator 重新生成 `manifests/index.yaml`。前端通过 Vite proxy 访问后端 API，CLI 通过 axios 直连。

### 服务层关键模块

- `server/services/resource-manager.js` — 资源 CRUD 核心编排，协调 GitStore + DB + manifest
- `server/services/git-store.js` — 资源文件的 Git 仓库读写，metadata.yaml 解析用 js-yaml
- `server/services/heat-calculator.js` — Hacker News 风格热度：`(下载×2 + 点赞×3 + 收藏×5 + 评论×4) / (时间差h+2)^1.5`
- `server/services/adapter-registry.js` — 转发到 `adapters/index.js` 的 Map 注册表
- `server/services/manifest-generator.js` — 扫描 Git 仓库全量资源生成 index.yaml

### 数据库

SQLite WAL 模式，FTS5 全文搜索（`resources_fts` 虚拟表，触发器自动同步）。8 张表：users、resources、resource_versions、tags、resource_tags、interactions、comments、bundles、settings。Schema 在 `server/models/db.js` 的 `runMigrations()` 中自建。

### 认证

简化 Token 白名单（`config.allowedTokens`），无 token 时 fallback 到 anonymous 用户。`server/middleware/auth.js`。

## 常用命令

```bash
# 安装所有依赖（根目录运行，workspaces 自动链接子包）
npm install

# 初始化 Git 注册中心（首次必须运行）
bash scripts/init-registry.sh

# 生成种子数据
npm run seed

# 开发模式（同时启动前后端）
npm run dev

# 只启动后端（http://localhost:3001）
npm run dev:server

# 只启动前端（http://localhost:5173）
npm run dev:web

# 运行全部测试
npm run test

# 后端测试（Node.js Test Runner，在 server 目录下）
cd server && node --test --test-reporter spec
# 运行单个后端测试文件
cd server && node --test __tests__/routes/resources.test.js

# 前端测试（Vitest，在 web 目录下）
cd web && npx vitest run
# 运行单个前端测试
cd web && npx vitest run __tests__/components/ResourceCard.test.jsx

# CLI 使用
node cli/bin/skhub.js <command>
```

## 新增平台适配器

1. 在 `adapters/` 创建新文件，继承 `PlatformAdapter`（`adapters/base-adapter.js`）
2. 实现 `platform` getter、`supportedTypes()`、`install()`、`isInstalled()`、`uninstall()`
3. 在 `adapters/index.js` 的 `ADAPTER_REGISTRY` Map 中注册

## API 响应格式

统一：`{ success: true, data, meta }` 或 `{ success: false, error: { code, message } }`

## MCP 截图规则（防止对话崩溃）

使用 `mcp__chrome-devtools__take_screenshot` 时，**必须始终传入 `filePath` 参数**，将截图保存到磁盘（如 `/tmp/screenshot-xxx.png`）。
**禁止**不带 `filePath` 的截图调用——内联 base64 图片数据会污染对话上下文导致后续对话全部报错。
需要查看截图时，用 `Read` 工具读取保存的文件路径。

## 环境配置

`.env` 文件（参考 `.env.example`）：PORT、DB_PATH、REGISTRY_PATH、UPLOAD_DIR、ALLOWED_TOKENS、REGISTRY_GIT_URL/BRANCH（可选远程 push）。