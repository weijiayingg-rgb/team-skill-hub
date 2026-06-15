# SkillHub

跨平台 AI 资源管理与分发中心

SkillHub 是一个中心化的 AI 资源管理平台，支持在 WorkBuddy、Cursor、Claude Code 等多个 AI 开发平台之间统一管理和分发 Skill、Rules、Expert、Hook 等资源。

## 架构概览

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   CLI Tool   │     │  Web Admin  │     │  Git Store  │
│  (skhub)      │────▶│  (React)    │────▶│  (Registry) │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       └─────────┬─────────┘                   │
                 ▼                             │
         ┌──────────────┐                      │
         │  Hub Server   │─────────────────────▶│
         │  (Express)    │                      │
         └──────┬───────┘                      │
                │                               │
                ▼                               │
         ┌──────────────┐                      │
         │   SQLite DB   │                      │
         └──────────────┘                      │
                │                               │
                ▼                               │
         ┌──────────────┐                      │
         │   Adapters   │──────────────────────▶│
         │  (Platforms) │                      │
         └──────────────┘                      │
```

- **后端**：Express + better-sqlite3 + simple-git
- **前端**：React 18 + MUI 6 + Tailwind CSS + react-router-dom
- **CLI**：Commander.js + chalk + ora
- **存储**：Git 仓库（主存储）+ SQLite（元数据缓存）
- **平台适配器**：WorkBuddy、Cursor、Claude Code

## 快速开始

### 环境要求

- Node.js >= 18
- npm >= 9
- Git

### 安装依赖

```bash
cd AgentHub
npm install
```

### 初始化数据库和 Git 仓库

```bash
# 初始化 Git 注册中心
bash scripts/init-registry.sh

# 生成种子数据
npm run seed
```

### 启动开发环境

```bash
# 同时启动前端和后端
npm run dev

# 或分别启动
npm run dev:server   # Express 服务 → http://localhost:3001
npm run dev:web      # Vite 开发服务器 → http://localhost:5173
```

### CLI 使用

```bash
# 搜索资源
node cli/bin/skhub.js search sql

# 安装资源
node cli/bin/skhub.js install sql-review-expert --platform workbuddy

# 发布资源
node cli/bin/skhub.js publish ./my-skill

# 查看配置
node cli/bin/skhub.js config

# 查看热门
node cli/bin/skhub.js list --sort hot
```

### 智能同步（CLI ↔ Web 协作）

SkillHub 支持自动扫描本地 AI 配置并智能同步到注册中心，三种使用方式：

#### 1. CLI 纯命令模式

```bash
# 一键扫描 + 自动同步（推荐）
skhub sync --auto

# 分步操作：先扫描查看报告
skhub scan

# 推送所有新增和更新
skhub push --all
```

#### 2. Web 协作模式（交互式勾选）

在浏览器"上传"页面点击"智能同步"创建会话，CLI 端执行：

```bash
skhub sync --web <sessionId>
```

Web 页面将实时展示扫描结果，你可以交互勾选要推送的资源，确认后 CLI 自动执行推送。

访问 `/sync/<sessionId>` 路径可直接跳转到同步面板。

#### 3. 比对结果说明

| 状态 | 说明 | 推送行为 |
|------|------|----------|
| 🆕 新增 | 远端不存在同名资源 | 创建新资源 |
| 🔄 有更新 | 本地内容与远端指纹不一致 | 添加新版本 |
| ✅ 已同步 | 指纹完全一致 | 无需操作 |

#### 支持扫描的平台

| 平台 | 扫描路径 |
|------|----------|
| 🟠 Claude Code | `~/.claude/commands/` + `~/.claude/agents/` |
| 🟡 Cursor | `~/.cursor/rules/` |
| 🔵 WorkBuddy | `~/.workbuddy/skills/` + `~/.workbuddy/experts/` |

## 项目结构

```
skillhub/
├── server/          # Express 后端服务
│   ├── routes/      # API 路由（resources/users/interactions/bundles/trending/stats）
│   ├── models/      # 数据访问层（SQLite CRUD，8 张表）
│   ├── services/    # 业务逻辑层（资源管理/热度计算/Git存储/适配器注册）
│   ├── middleware/   # 中间件（认证/错误处理/文件上传）
│   └── __tests__/   # 后端测试
├── adapters/        # 平台适配器（WorkBuddy/Cursor/Claude Code）
├── cli/             # skhub CLI 工具
│   ├── bin/         # CLI 入口
│   ├── cmds/        # 命令实现（install/search/publish/list/info/config/bundle/scan/push/sync）
│   └── utils/       # 工具函数（日志/指纹/扫描/本地状态/Web同步）
├── web/             # React 前端
│   └── src/
│       ├── pages/       # 页面组件
│       ├── components/  # 公共组件
│       ├── api/         # API 客户端
│       ├── hooks/       # 自定义 Hooks
│       └── utils/       # 工具函数
└── scripts/         # 工具脚本（种子数据/初始化）
```

## API 文档

所有 API 返回统一格式：`{ success: true, data, meta }` 或 `{ success: false, error: { code, message } }`

### 资源 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/resources` | 资源列表（支持分页、搜索、筛选） |
| GET | `/api/resources/:id` | 资源详情 |
| POST | `/api/resources` | 上传创建资源 |
| PUT | `/api/resources/:id` | 更新资源 |
| DELETE | `/api/resources/:id` | 删除资源 |
| GET | `/api/resources/:id/download` | 下载资源文件 |

### 社交互动 API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/resources/:id/like` | 点赞 |
| DELETE | `/api/resources/:id/like` | 取消点赞 |
| POST | `/api/resources/:id/favorite` | 收藏 |
| DELETE | `/api/resources/:id/favorite` | 取消收藏 |
| POST | `/api/resources/:id/comment` | 评论 |
| GET | `/api/resources/:id/comments` | 评论列表 |

### 排行与统计 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/trending` | 热门排行 |
| GET | `/api/trending/weekly` | 周榜 |
| GET | `/api/stats` | 平台统计 |

### 智能同步 API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/sync-sessions` | 创建同步会话（返回 sessionId） |
| GET | `/api/sync-sessions/:id` | 查询会话状态 |
| POST | `/api/sync-sessions/:id/scan` | CLI 提交扫描结果 |
| POST | `/api/sync-sessions/:id/plan` | Web 提交推送计划 |
| POST | `/api/sync-sessions/:id/result` | CLI 提交推送结果（增量） |
| DELETE | `/api/sync-sessions/:id` | 清理会话 |

### 指纹比对 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/fingerprint-map` | 获取所有已发布资源的指纹映射 { name: { hash, id, version, type } } |

## 技术栈

| 层级 | 技术选型 |
|------|----------|
| 后端框架 | Express 4.x |
| 数据库 | better-sqlite3（同步 API） |
| Git 操作 | simple-git |
| 文件上传 | multer |
| YAML 处理 | js-yaml |
| 前端框架 | React 18 + Vite 5 |
| UI 组件库 | MUI 6 |
| 样式方案 | Tailwind CSS 3 |
| 路由 | react-router-dom v6 |
| Markdown | react-markdown + rehype-highlight |
| CLI 框架 | Commander.js |
| 终端美化 | chalk + ora + inquirer |
| 测试 | Node.js Test Runner + Vitest |

## 配置

通过 `.env` 文件或环境变量配置：

```env
PORT=3001                    # 服务器端口
DB_PATH=./data/skillhub.db   # 数据库路径
REGISTRY_PATH=./data/skillhub-registry  # Git 仓库路径
ALLOWED_TOKENS=dev-token-1,dev-token-2  # 允许的认证令牌
```

## 开发指南

### 热度算法

Hacker News 风格热度计算公式：

```
hot_score = (收藏×5 + 评论×4 + 点赞×3 + 下载×2) / (时间差×24 + 2)^1.5
```

每次互动后实时更新单条资源热度分，不依赖定时任务。

### 适配器开发

新增平台适配器只需实现 4 个方法：

```javascript
class MyAdapter extends PlatformAdapter {
  get platform() { return 'my-platform'; }
  supportedTypes() { return ['skill', 'rules']; }
  async install(resource, basePath) { /* ... */ }
  async isInstalled(resource, basePath) { /* ... */ }
  async uninstall(resource, basePath) { /* ... */ }
}
```

然后在 `adapters/index.js` 注册即可。

## License

MIT
