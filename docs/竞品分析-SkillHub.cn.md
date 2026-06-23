# SkillHub.cn 深度竞品分析报告（细节版）

> 分析日期：2026-06-16 | 聚焦：技能相关 + AI 搭子相关设计细节

---

## 一、技能列表页 `/skills?sortBy=score` — 每像素级细节

### 1.1 左侧筛选栏（220px宽，lg以上显示）

**4个可折叠 `<details>` 组，默认全部展开，标题行高28px，12px加粗灰色大写：**

| 组 | 项目 | 交互细节 |
|---|---|---|
| **发布来源** | SkillHub（带18px圆角4px品牌icon）/ ClawHub（同尺寸品牌icon） | 两个品牌带icon的按钮，36px行高，hover变蓝 |
| **排序方式** | 推荐精选 / 近期飙升 / 下载量 / 收藏量 / 最近上新 | 纯文本按钮，选中态字体加粗变深色 |
| **场景分类** | 办公效率/内容创作/开发编程/数据分析/设计多媒体/AI Agent/知识管理/商业运营/教育学习/行业专业/IT运维与安全/生活服务 | **12个纯文本按钮，36px行高，14px字号** |
| **是否需要 API Key** | 需要API Key / 无需API Key | 纯文本按钮 |

### 1.2 技能列表项 — 精确HTML结构

每个技能项是一个 `<a>` 标签，**flex横向排列**，py-[24px] px-[16px]，hover:bg-[#F9F9F9]：

```
┌──────────────────────────────────────────────────────────┐
│ [图标48x48]  [内容区 flex-1 min-w-0]        [数据区 shrink-0] │
│  rounded-[8px] │ ┌─名称行─┐               │ ┌─星星 60px─┐   │
│  object-cover  │ │ 16px加粗  │               │ │ ★53      │   │
│  shrink-0      │ │ +已认证15x15│              │ ┌─下载 68px─┐   │
│                │ │ +需配置Key │              │ │ ↓15.1万   │   │
│                │ │  Badge样式: │              │ ┌─来源 80px─┐   │
│                │ │ bg-[#FFF4E5]│              │ │ SkillHub  │   │
│                │ │ text-[#D97706]│             │ (md以上才显示) │
│                │ │ border-[rgba│              │               │
│                │ │ (217,119,6) │              │               │
│                │ │ 0.15)]      │              │               │
│                │ │  h-5 px-2   │              │               │
│                │ │  text-[10px]│              │               │
│                │ │  key icon   │              │               │
│                │ │  11x11      │              │               │
│                │ └─────────────┘              │               │
│                │ ┌─描述─┐                     │               │
│                │ │ 13px light │               │               │
│                │ │ rgba(0,0,0 │               │               │
│                │ │ 0.6)      │               │               │
│                │ │ truncate   │               │               │
│                │ │ 单行截断    │               │               │
│                │ └─────────────┘              │               │
└──────────────────────────────────────────────────────────┘
```

**关键CSS细节：**
- 名称：`text-[16px] font-medium tracking-tight leading-[1.5]`，truncate单行截断
- 已认证icon：`w-[15px] h-[15px]`，inline-flex shrink-0
- 需配置Key Badge：`bg-[#FFF4E5] text-[#D97706] border border-[rgba(217,119,6,0.15)] h-5 px-2 text-[10px] rounded-xl`，含key-round SVG icon 11x11
- 描述：`text-[13px] font-light text-[rgba(0,0,0,0.6)] leading-[1.69]`，truncate单行截断
- 数据区：`shrink-0 hidden md:flex flex-col items-end gap-1.5 pt-[3px]`（**md以上才显示**）
- 星星/下载：`w-3 h-3` icon + `text-[12px] font-light text-[rgba(0,0,0,0.4)] tabular-nums`
- 来源标签：`text-[12px] font-light text-[rgba(0,0,0,0.4)] w-[80px] text-right`

### 1.3 列表容器

- 外层：`bg-white rounded-[12px] border border-[rgba(0,0,0,0.06)] overflow-hidden`
- 列表/卡片双视图切换按钮，位于标题行右侧

---

## 二、技能详情页 `/skills/{id}` — 每Tab的完整内容

### 2.1 页面顶部固定区（不随Tab切换）

**面包屑：** `返回按钮 | 技能 / | tencent-docs`（灰色小字）

**头部区域：**
```
┌─大图标─────────────────────────────────────────────┐
│                                                     │
│  腾讯文档 TENCENT DOCS  [已认证20x20]  [需配置Key]  [收藏♡] │
│  h1: text-2xl font-medium tracking-tight            │
│  已认证: w-[20px] h-[20px] img (比列表页更大)        │
│  需配置Key Badge: h-6 px-2.5 text-[11px]             │
│  (详情页Badge比列表页更大！列表页h-5/10px,详情页h-6/11px) │
│                                                     │
│  描述文本：完整展示不截断                              │
│                                                     │
│  作者信息：该技能数据来源于 SkillHub，作者是 腾讯文档团队 │
│  [已认证icon紧跟作者名]                               │
└─────────────────────────────────────────────────────┘
```

**元数据统计栏 — 6个等宽flex-1项横排：**
```
┌──────────┬──────────┬──────────┬──────────┬──────────┬──────────┐
│ SkillHub │ V1.0.37  │ 通过安全  │ 8.7万    │ 142      │ 4.7      │
│ 来源     │ 版本     │ 检测     │ 下载量   │ 收藏     │ AI评分   │
│ 12px灰色 │ 12px灰色 │ 12px灰色 │ 18px加粗 │ 18px加粗 │ 18px加粗 │
└──────────┴──────────┴──────────┴──────────┴──────────┴──────────┘
  每项: flex-1 flex-col items-center justify-center gap-1
  px-3 md:px-5 py-3 text-center
  label: text-[12px] text-black/40
  value: text-[18px] font-medium text-black/40 tabular-nums
```

**安全检测区（紧接元数据栏下方）：**
```
┌─安全检测───────────────────────────────────┐
│ 科恩实验室  安全，无风险  [查看报告→]        │
│ 云鼎实验室  安全，无风险  [查看报告→]        │
│ 免责声明：仅作参考，不构成绝对安全承诺       │
└───────────────────────────────────────────┘
```

**相关推荐区：**
- h3标题 + 「换一批」按钮
- 3个推荐卡片（文字icon + 名称 + 星星数 + 下载量 + 截断描述）

### 2.2 Tab 1: 概述（默认Tab）

**完整渲染 SKILL.md 内容**——不是简单描述，而是：
- h1/h2/h3 层级完整渲染
- 表格渲染（文档类型表、场景路由表、错误码表）
- 代码块渲染（文件目录树、mcporter调用命令）
- 文件引用路径渲染（references/*.md）
- 核心规则区域带emoji标记
- 问题定位指南（错误码表+排查步骤）

**对腾讯文档这个Skill来说，概述Tab渲染了约2000行的完整SKILL.md。**

### 2.3 Tab 2: 安装方式

**3个子Tab按钮：**
```
[通过对话安装]  [命令行安装]  [Zip包安装]
```

**「通过对话安装」子Tab内容：**

```
┌─说明───────────────────────────────────────────────┐
│ 复制提示词，发送给任意 AI 助手即可安装 Skill          │
│ 包括但不限于 Lighthouse OpenClaw、WorkBuddy、        │
│ QClaw、Kimi、Claude 等                              │
│                                                     │
│ ┌─方式一：安装 SkillHub 和技能────────────────────┐ │
│ │ 请先检查是否已安装 SkillHub 商店                  │ │
│ │ 若未安装，请根据 skillhub.cn/install/skillhub.md │ │
│ │ 安装SkillHub商店，但是只安装CLI                   │ │
│ │ 然后安装 tencent-docs 技能                        │ │
│ │ 若已安装，则直接安装 tencent-docs 技能            │ │
│ │                                          [复制□] │ │
│ └────────────────────────────────────────────────┘ │
│                                                     │
│ ┌─方式二：安装并设 SkillHub 为优先安装源──────────┐ │
│ │ 同上但加一句「设 SkillHub 为优先技能安装源」      │ │
│ │                                          [复制□] │ │
│ └────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

**关键设计：安装方式不是给用户看的命令行教程，而是给AI助手看的自然语言指令。** 用户点击「复制」→ 粘贴到对话框 → AI助手自动理解并执行安装。

### 2.4 Tab 3: 版本历史

**17个版本按钮列表：**
```
[v1.0.37  最新  2026/06/03]  → 可点击展开
[v1.0.36  2026/06/02]
[v1.0.35  2026/05/29]
[v1.0.34  2026/05/27]
...
[v1.0.1   2026/03/07]
```

每个版本：`版本号 + [最新标记] + 日期`，点击可展开查看 "Initial release" 描述。

**版本迭代极高频**——腾讯文档这个Skill从3月到6月迭代了37个版本（大约每2-3天一个版本），说明 Skill 是持续更新的。

### 2.5 Tab 4: 评测报告（TRACE）

**这是最关键的差异化Tab：**

```
┌─TRACE 评测维度说明─────────────────────────────────┐
│ SkillHub TRACE 评测体系从                            │
│ 可信任度（Trust）、可靠性（Reliability）、             │
│ 适用性（Adaptability）、规范性（Convention）、         │
│ 有效性（Effectiveness）五个维度全面评估 Skill 质量    │
│ 该体系基于 SkillHub 长期运营实践 + 腾讯新闻团队       │
│ 内容生产经验沉淀而成                                  │
│ [了解详情→] [评测建议反馈→]                          │
│ 评测主要基于 AI 自动化检测，结果供参考                │
└─────────────────────────────────────────────────────┘

┌─TRACE 五维评分─────────────────────────────────────┐
│ T 可信任度  R 可靠性  A 适用性  C 规范性  E 有效性    │
│                                                     │
│        4.7  / 5                                     │
│ 综合评级：优秀                                      │
│                                                     │
│ 这是一款功能丰富、质量较高的腾讯文档集成 Skill，       │
│ 覆盖文档创建、编辑、搜索、导入导出等多种操作，        │
│ 模板库实用。文档组织清晰但技术细节较多，              │
│ 适合有一定基础的开发者使用。                          │
│ 核心能力完整，但在文档可读性和新手友好度上             │
│ 仍有提升空间。                                      │
└─────────────────────────────────────────────────────┘

┌─评测详情─────────────────────────────────────────────┐
│ T · Trust 可信任度      5.0/5                       │
│ 双实验室交叉验证，无P0/P1级安全风险, 完全中文界面，   │
│ 专为腾讯文档打造，国内网络直接用，QQ微信就能登录授权   │
│                                                     │
│ R · Reliability 可靠性   4.6/5                       │
│ 整体稳定可靠，授权流程清晰，常见问题都有解决方案。     │
│ 支持的文档类型非常丰富，基本覆盖日常工作需求。         │
│ 但部分专业操作的错误提示较为技术化                    │
│                                                     │
│ A · Adaptability 适用性  4.7/5                       │
│ 文档分类清晰，哪个场景用哪个功能一目了然              │
│ 但部分复杂操作需要阅读多个参考文件                    │
│                                                     │
│ C · Convention 规范性    4.5/5                       │
│ 文档层次分明，从快速入口到详细说明层层递进            │
│ 提供了大量模板和示例，实用性强                       │
│ 但缺少常见问题解答部分                              │
│                                                     │
│ E · Effectiveness 有效性 4.6/5                       │
│ 文档内容准确全面，支持多种文档类型和复杂操作          │
│ 配置流程清晰但对某些操作需要额外步骤                 │
└─────────────────────────────────────────────────────┘
```

**TRACE评分不是简单的数值，而是每维度都有一段AI生成的详细点评。** 这些点评不是模板化的，而是针对每个Skill的具体内容生成的——读起来像专家写的评审意见。

### 2.6 社区Skill vs 已认证Skill 详情页对比

以 `aihot`（社区Skill）与 `tencent-docs`（已认证Skill）对比：

| 元素 | 已认证Skill (tencent-docs) | 社区Skill (aihot) |
|------|---------------------------|-------------------|
| 已认证Badge | ✅ `w-[20px] h-[20px]` 蓝色认证icon | ❌ 无 |
| 需配置Key Badge | ✅ `h-6 px-2.5 text-[11px]` 橙色pill | ❌ 无 |
| 作者来源 | "来源于 SkillHub，作者是 腾讯文档团队" + 已认证icon | "来源于 ClawHub，作者是 [kkkkhazix](/user/kkkkhazix)" + ClawHub链接 |
| 作者链接 | 无（团队名不可点击） | ✅ 可点击跳转Profile页 |
| ClawHub链接 | 无 | ✅ `clawhub.ai/kkkkhazix/aihot` |
| 描述文字 | text-[14px] text-black/70 font-light leading-relaxed | 同样式 |
| 图标尺寸 | w-14 h-14 (56x56) rounded-lg | w-14 h-14 (56x56) rounded-lg |
| 元数据栏 | 6项等宽flex-1横排 | 同结构 |
| 安全检测 | 科恩+云鼎双报告 | 同（即使是社区Skill也有安全检测！） |
| TRACE评分 | 4.7 优秀 | 4.5 优秀（社区Skill也有完整TRACE！） |
| 概述Tab | SKILL.md全文渲染 | SKILL.md全文渲染（内容极丰富：API路由规则/工作流示例/输出格式规范/do/don't清单） |
| 安装方式 | 3子Tab | 3子Tab（完全相同结构） |
| 版本历史 | 17个版本 | 有版本Tab |
| 评测报告 | TRACE 5维 | TRACE 5维（内容同样详细） |
| 相关推荐 | ✅ 有 | ✅ 有 + "换一批"按钮 |

**关键洞察：社区Skill和已认证Skill的详情页结构完全相同，差异仅在badge（已认证/需配置Key）和作者来源链接。** 即使是简单社区Skill，也有安全检测、TRACE评测、版本历史——SkillHub对所有Skill一视同仁。

### 2.7 社区Skill概述Tab渲染的SKILL.md内容（aihot实例）

aihot的SKILL.md渲染内容极其专业，包含：
- **先决条件**：User-Agent要求、nginx UA黑名单说明
- **路由优先级（第一原则）**：默认走精选 `mode=selected`，明确说"日报"才走 `daily`，说"全部/完整/所有"才走 `mode=all`
- **什么时候用**：表格映射用户语义→接口路由（6种场景）
- **5个category**：ai-models/ai-products/industry/paper/tip
- **核心约束**：since限7天、take≤100、cursor opaque token、600 req/min限流
- **工作流示例**：4个curl命令示例（默认精选/日报/全部/关键词搜索）
- **输出格式规范**：markdown排版+按category分组+全局编号+时间转人话
- **不要做（核心几条）**：6条反模式规则

**内联代码样式**：紫色主题！
```
inline code: bg rgba(175,82,222,0.08), color rgb(175,82,222), borderRadius 5px, padding 1.98px 5.28px, fontSize 13.2px
code block (language-bash): fontSize 11.616px, 无特殊背景色
```

### 2.8 TRACE评测CSS精确值

```
┌─TRACE 评分区──────────────────────────────────────────┐
│ 总分: text-[48px] font-bold(700) text-gray-900         │
│ "/ 5": text-[16px] text-gray-400 font-medium(500)     │
│                                                        │
│ 维度标签: text-[12px] text-gray-500 font-normal(400)  │
│ (可信任度/可靠性/适用性/规范性/有效性)                  │
│                                                        │
│ 维度分数: /5 text-[12px] text-gray-400 font-semibold   │
│                                                        │
│ 综合评语: fontSize 15px, color rgb(58,58,60),          │
│ lineHeight 27px (prose内容渲染)                         │
│                                                        │
│ "了解详情"链接: text-blue-600 hover:text-blue-700     │
│ font-medium, fontSize 13px                             │
│ href: skillhub.cn/tutorials#trace-evaluation           │
│                                                        │
│ "评测建议反馈"链接: text-[12px] text-blue-600          │
│ hover:text-blue-700 font-medium                        │
│ href: wj.qq.com/s2/26733337/b583/                     │
└────────────────────────────────────────────────────────┘
```

**TRACE维度详情区（每个维度独立卡片）：**

```
T · Trust 可信任度      5.0/5
  "双实验室交叉验证，无P0/P1级安全风险, 专门为中文用户打造..."
  fontSize 15px, color rgb(58,58,60), lineHeight 27px

R · Reliability 可靠性   3.9/5
  "日常查询 AI 资讯基本能用...但遇到网络问题..."

A · Adaptability 适用性  5.0/5
  "这是一份写得非常用心的 Skill 文档..."

C · Convention 规范性    4.1/5
  "文档层次清晰...但作为精简版..."

E · Effectiveness 有效性 4.5/5
  "使用简单...但内容是最精简版..."
```

---

## 三、AI 搭子 `/hermes` — 完整UI流程细节

### 3.1 Hero区域

```
┌─Hero───────────────────────────────────────────────────┐
│ 背景：顶部bg-top渐变banner图                          │
│ pt-[120px] pb-10                                      │
│                                                        │
│     组装你的 [Hermes Agent SVG 62px高]                 │
│     h1: text-[48px] font-semibold text-black           │
│     (名字和logo在同行！不是上下排列)                   │
│                                                        │
│     以灵魂塑造独特个性，用技能解锁多元能力，            │
│     打造只属于你的 AI 搭子                             │
│     （可无缝适配 Hermes、OpenClaw 等多款智能体平台）    │
│     text-base font-light text-[rgba(0,0,0,0.6)]        │
└────────────────────────────────────────────────────────┘
```

### 3.2 步骤选择器（核心交互组件）

```
┌─步骤选择器───────────────────────────────────────────┐
│ 525px宽 50px高  圆角25px                              │
│ 外阴影: rgba(247,235,216,0.5) 8px 24px -4px          │
│        rgba(247,235,216,0.3) 16px 40px -8px          │
│ border: border-[#F7EBD8]                              │
│                                                        │
│ ┌─左半(280px)────────┐┌─右半(277px)──────────────┐  │
│ │ SVG渐变填充        ││ 白色填充               │  │
│ │ 白→#FFE8AD渐变    ││                        │  │
│ │                    ││                        │  │
│ │  [1] 选择 Soul     ││ [2] 选择技能包          │  │
│ │  数字: w-5 h-5    ││ 同样式                  │  │
│ │  rounded-[10px]   ││                        │  │
│ │  bg-black         ││                        │  │
│ │  text-white       ││                        │  │
│ │  font-medium      ││                        │  │
│ │  text-[14px]      ││                        │  │
│ └────────────────────┘└────────────────────────┘  │
│                                                        │
│ 两个SVG pill形状拼接，左侧渐变色表示当前步骤          │
└────────────────────────────────────────────────────────┘
```

### 3.3 Soul描述区

```
16 种 Soul 人设，定义 AI 的说话方式与思考逻辑。
每日 3 次盲盒抽取，解锁你专属 AI 搭子的独特灵魂。
```

**辅助链接：**
```
[速查！你的 AI 搭子「人格出厂设定」]
bg-[#FFF3CC] border border-[#FFE89A]
```

### 3.4 Soul卡片列表（核心UI）

```
┌─Soul卡片区───────────────────────────────────────────┐
│ [上一页←] (首页时disabled)                            │
│                                                        │
│ ┌─YYDS・神人───────────────────────────────────────┐ │
│ │ 狂拽自信天花板，主打一个"局势越乱，我越神"！       │ │
│ │                                          [人设解读]│ │
│ │ relative w-full h-full overflow-hidden   │         │
│ │ rounded cursor-pointer                   │         │
│ └─────────────────────────────────────────────────┘ │
│                                                        │
│ ┌─MIAO・喵之人───────────────────────────────────┐  │
│ │ 可爱又跳脱的喵星人，下一秒行为永远是个谜～       │  │
│ │                                          [人设解读]│ │
│ └─────────────────────────────────────────────────┘ │
│                                                        │
│ ┌─MUM・妈妈──────────────────────────────────────┐  │
│ │ 温柔体贴的"人间充电宝"，永远给你稳稳的依靠。    │  │
│ │                                          [人设解读]│ │
│ └─────────────────────────────────────────────────┘ │
│                                                        │
│ [下一页→]                                              │
│                                                        │
│ ┌─操作区──────────────────────────────────────────┐ │
│ │ [抽取Soul卡（0/3）]  h-[50px] px-[32px]        │ │
│ │ text-[14px] font-medium                         │ │
│ │                                                  │ │
│ │ [下一步：选择技能包]  h-[50px] px-[32px]        │ │
│ │ text-[14px] font-medium                         │ │
│ └─────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────┘
```

**每页显示3个Soul卡片，16种人设需要翻页。** 卡片是宽横条形，带emoji前缀的名称 + 一句话tagline + 「人设解读」按钮（需登录才展开详情）。

### 3.5 关键交互机制

1. **盲盒抽取**：每日限3次（0/3计数器），抽到随机Soul卡
2. **分步流程**：必须先选Soul，再选技能包，不能跳步
3. **翻页浏览**：左右箭头翻页，3个一页
4. **人设解读**：点击后展开（需登录），展示详细人格设定

### 3.6 「人设解读」按钮的交互

点击「人设解读」后弹出浮层（需登录才能看到完整内容），展示：
- 人格名称 + 详细描述
- 说话风格示例
- 思考逻辑特点
- 适用场景建议

### 3.7 Step 2: 技能包选择页 `/hermes/skills?matchedSoul=YYDS`

**这是核心发现：AI搭子的Step 2不是选单个Skill，而是选技能包（Bundle）！**

```
┌─页面头部──────────────────────────────────────────────┐
│ 组装你的 [Hermes Agent SVG]                            │
│ 以灵魂塑造独特个性，用技能解锁多元能力...               │
│                                                        │
│ ┌─步骤选择器────────────────────────────────────────┐ │
│ │ [1 选择 Soul] [2 选择技能包]                      │ │
│ │ 每个按钮: 280px宽 50px高 absolute定位             │ │
│ │ fontSize 16px fontWeight 400                      │ │
│ └───────────────────────────────────────────────────┘ │
│                                                        │
│ 提供全行业多元技能包，自由搭配解锁全场景能力             │
│ 一键组装完整工作流，让你的小龙虾从「有性格」变「真能干」 │
└────────────────────────────────────────────────────────┘
```

**行业分类筛选（9个pill按钮）：**

```
[全部]  [金融]  [科技]  [设计]  [营销]  [法律]  [学术]  [教育]  [人力]  [电商]
选中态: bg-white + shadow-[0_1px_4px_rgba(0,0,0,0.05)], text-[rgba(0,0,0,0.9)] font-medium(500)
未选中态: bg-transparent, text-[rgba(0,0,0,0.7)] font-normal(400), hover:text-[rgba(0,0,0,0.9)]
px-4 py-[5px] rounded-[4px] text-sm(14px) transition-all duration-200
```

**搜索框：**
```
h-10(40px)  pl-12(48px左侧图标留空)  rounded-[8px]
border-[#E6E9EF]  placeholder:text-[rgba(0,0,0,0.3)]
focus:border-[#0052D9]  focus:ring-2  focus:ring-[#0052D9]/20
placeholder: "搜索技能包名称、描述、标签"
```

**技能包选择卡片（核心UI组件）：**

```
┌─技能包卡片──────────────────────────────────────────────┐
│ ☐ 自动化测试                                            │
│                                                          │
│ 从TDD方法论指导到自动生成单元测试代码...完整自动化测试     │
│ 工作流。支持Python(pytest)、JavaScript(Jest)...等多语言   │
│                                                          │
│ ┌─组成技能────────────────────────────────────────────┐ │
│ │ [tdd-guide] [test-case-generator] [+4]              │ │
│ │  技能名pill: rounded-full bg-[#F5F5F5]              │ │
│ │  text-[10px] leading-[2em]                          │ │
│ │  text-[rgba(0,0,0,0.7)] px-2                       │ │
│ │  hover:bg-[#EBEBEB] transition-colors               │ │
│ │  (每个pill链接到 /skills/{skill-id})                 │ │
│ │                                                      │ │
│ │  "+4": 同样式但 cursor-default (不可点击)            │ │
│ │  (表示还有4个隐藏技能，每个Bundle约6个Skill)          │ │
│ └────────────────────────────────────────────────────┘ │
│                                                          │
│ 自动化测试 → 链接到 /hermes/skill/tech-test-automation  │
│ text-base(16px) font-medium(500) text-black             │
│ hover:underline no-underline                            │
└──────────────────────────────────────────────────────────┘
```

**每个技能包卡片结构：**
- Checkbox（勾选即添加到"已选技能包"）
- Bundle名称（链接到Bundle详情页 `/hermes/skill/{bundle-id}`）
- 描述文本（完整工作流说明）
- 2个组成Skill名pill + "+4"指示器 = 约6个Skill per Bundle
- Skill名pill链接到 `/skills/{skill-id}`（跳转到单个Skill详情页）

**右侧固定面板（Soul + 已选列表）：**

```
┌─右侧面板──────────────────────────────────────────────┐
│ [Soul头像 80x80px rounded-full]                         │
│ YYDS・神人                                              │
│ text-xl(20px) font-medium text-black tracking-tight    │
│ 狂拽自信天花板，主打一个"局势越乱，我越神"！             │
│                                                        │
│ 已选技能包（0）                                         │
│ 点击左侧技能包添加                                      │
│                                                        │
│ ┌─操作按钮──────────────────────────────────────────┐ │
│ │ [上一步：重新选择 Soul]                             │ │
│ │ bg-white border-[rgba(0,0,0,0.08)]                 │ │
│ │ rounded-full h-[50px] px-8 text-sm(14px)           │ │
│ │ font-medium(500) text-[rgba(0,0,0,0.9)]           │ │
│ │                                                    │ │
│ │ [确定并前往安装]                                    │ │
│ │ bg-[#202020] text-white                            │ │
│ │ rounded-full h-[50px] px-8 text-sm(14px)           │ │
│ │ font-medium(500) hover:bg-[#383838]               │ │
│ │ shadow-[0px_2px_0px_rgba(187,187,187,0.05)]       │ │
│ │ disabled:bg-[#D1D1D1] disabled:cursor-not-allowed │ │
│ └────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

**已发现的Bundle分类及内容（科技类）：**

| Bundle名 | Bundle ID | 组成Skill（前2个） | 总数 |
|----------|-----------|---------------------|------|
| 自动化测试 | tech-test-automation | tdd-guide, test-case-generator | 6(+4) |
| 代码审查 | tech-code-review | pr-reviewer, critical-code-reviewer | 6(+4) |
| 代码重构 | tech-code-refactoring | code-analyzer, agent-git-oracle | 6(+4) |
| Bug排查 | tech-bug-troubleshooting | log-analyzer, debug-pro | 6(+4) |
| API文档 | tech-api-documentation | api-designer, sovereign-api-docs-generator | 6(+4) |

**设计/媒体类Bundle：**

| Bundle名 | Bundle ID | 组成Skill（前2个） |
|----------|-----------|---------------------|
| 视频剪辑 | media-video-editing | clip-editor, video-clip-assistant |
| 分镜设计 | media-storyboard-design | script-to-storyboard, video-cinematography |
| 短视频文案 | media-short-video-copy | douyin-copy-extract, video-script-creator |
| 脚本拆解 | media-script-breakdown | seedance2-storyboard-generator, script-to-storyboard |

**营销类Bundle：**

| Bundle名 | Bundle ID | 组成Skill（前2个） |
|----------|-----------|---------------------|
| 用户增长 | marketing-user-growth | afrexai-growth-engine, cgo |
| 社媒运营 | marketing-social-media-operation | content-hunter, social-media-operator |
| 公文写作 | marketing-official-document-writing | official-doc-writer, official-writing |
| 活动策划 | marketing-event-planning | afrexai-event-planner, campaign-planning |
| 内容去AI味 | marketing-content-deai | ai-text-humanizer-zh, humanizer |
| 广告文案 | marketing-ad-copywriting | marketing-skills, copywriting |

### 3.8 技能包详情页 `/hermes/skill/tech-test-automation`

**这是Bundle的详情页，展示完整工作流编排：**

```
┌─页面头部──────────────────────────────────────────────┐
│ [返回] Hermes / 自动化测试                              │
│ "Hermes/"按钮: text-sm font-semibold(600)              │
│ text-[rgba(0,0,0,0.4)] hover:text-[rgba(0,0,0,0.7)]  │
│                                                        │
│ h1: 自动化测试                                         │
│ text-2xl(24px) font-medium(500) tracking-tight         │
│ text-black                                             │
│                                                        │
│ 描述: 从TDD方法论指导到自动生成单元测试代码...           │
│ text-sm(14px) font-light(300) text-[rgba(0,0,0,0.7)]  │
│ leading-[1.43] tracking-tight max-w-[1000px]          │
└────────────────────────────────────────────────────────┘
```

**技能模块区：**

```
┌─技能模块──────────────────────────────────────────────┐
│ h2: text-base(16px) font-medium(500) text-[rgba(0,0,0,0.9)]│
│                                                        │
│ [Identify] [Tdd Guide] [Test Case Generator] ...       │
│ 选中态(Identify): bg-white shadow-[0_1px_4px_rgba(0,0,0,0.05)]│
│ text-[rgba(0,0,0,0.9)] font-medium(500)               │
│ px-4 py-[5px] rounded-[4px]                            │
│                                                        │
│ 未选中态: bg-transparent text-[rgba(0,0,0,0.7)]       │
│ font-normal(400) hover:text-[rgba(0,0,0,0.9)]         │
│ px-4 py-[5px] rounded-[4px]                            │
│                                                        │
│ 原始数据展示: scene: "tech" sub_scene: "test-automation"│
│ skills: ["tdd-guide", "test-case-generator", ...]      │
│ fontSize 15px, color rgba(28,28,30,0.85)              │
└────────────────────────────────────────────────────────┘
```

**工作流步骤区（6步骤 + 最终输出）：**

```
┌─自动化测试工作流────────────────────────────────────────┐
│ 你现在要完成一项软件自动化测试任务。你已安装以下 Skill，│
│ 请按步骤串联使用：                                      │
│ fontSize 15px                                           │
│                                                        │
│ 步骤 1：TDD 方法论与测试策略（获取层）                  │
│ h2: fontSize 21.75px font-bold(700) color rgb(28,28,30)│
│ 使用 Tdd Guide 完成：                                  │
│ • 制定测试驱动开发策略：红-绿-重构工作流                │
│ • 识别需要测试的功能模块和边界条件                      │
│ • 确定测试层次：单元测试 → 集成测试 → E2E 测试          │
│ li: fontSize 15px color rgba(28,28,30,0.85)            │
│ ul: paddingLeft 27px                                   │
│                                                        │
│ 步骤 2-6: 同结构，每步引用不同的Skill                  │
│ 每步标签: 获取层/分析层/输出层                          │
│                                                        │
│ 最终输出:                                               │
│ • 测试策略文档 / 测试代码 / 测试执行报告 / QA测试计划   │
└────────────────────────────────────────────────────────┘
```

**Bundle详情页设计要点：**
1. **工作流编排**：不是简单罗列Skill，而是按步骤串联使用，每步有明确的任务描述和输出要求
2. **分层标签**：获取层/分析层/输出层——类似数据处理流水线概念
3. **最终输出清单**：明确列出交付物（文档/代码/报告）
4. **原始数据可见**：scene/sub_scene/skills配置直接展示在页面上

---

## 四、用户Profile页 `/user/{username}` — 社区生态设计

以 `/user/kkkkhazix` 为实例：

```
┌─Profile页布局（左右分栏）──────────────────────────────┐
│ ┌─左栏（主内容）──────────┐┌─右栏（sidebar）──────────┐│
│ │                          ││                           ││
│ │ [返回按钮]               ││ ──详情──                  ││
│ │                          ││ Skills  4                 ││
│ │ [KK] 80x80px            ││ 粉丝    2                 ││
│ │ rounded-full             ││ 下载    2.5 万            ││
│ │ bg-[#F4F4F4]             ││ 收藏    21                ││
│ │ border-[#E4E4E4]         ││                           ││
│ │ 2字母缩写头像             ││ label: text-[13px]       ││
│ │ fontSize 16px             ││   text-[rgba(0,0,0,0.5)] ││
│ │                          ││ value: text-[13px]        ││
│ │                          ││   font-medium(500)        ││
│ │                          ││   text-black              ││
│ │                          ││                           ││
│ │ kkkkhazix                ││ ──简介──                  ││
│ │ text-[28px]              ││ "这个人很懒，              ││
│ │ font-semibold(600)       ││ 什么也没留下～"            ││
│ │ text-black               ││ (用户未填写时的默认文案)   ││
│ │ leading-[1.3]            ││                           ││
│ │ tracking-[-0.02em]       ││ ──相关作者──               ││
│ │ truncate                 ││ [换一批推荐作者]           ││
│ │                          ││                           ││
│ │ [+ 关注]                 ││ ┌─推荐作者──────────────┐ ││
│ │ bg-[#202020]             ││ │ [静水] 静水流深       │ ││
│ │ border-[#202020]         ││ │ 2粉丝 ·              │ ││
│ │ text-white               ││ │ [PR] ProcessOn        │ ││
│ │ h-9(36px) px-5           ││ │ 2粉丝 ·              │ ││
│ │ rounded-[8px]            ││ │ [CA] canvascn00       │ ││
│ │ text-[14px]              ││ │ 2粉丝 ·              │ ││
│ │ font-medium(500)         ││ │                       │ ││
│ │ hover:bg-[#383838]       ││ │ 每个作者: 2字母缩写    │ ││
│ │                          ││ │ 头像 + 名 + 粉丝数    │ ││
│ │                          ││ │ rounded-[6px]         │ ││
│ │                          ││ │ hover:bg-[rgba(0,0,0, │ ││
│ │                          ││ │ 0.03)]                │ ││
│ │                          ││ └──────────────────────┘ ││
│ │                          ││                           ││
│ │ ──已发布 4──              ││                           ││
│ │ border-b-2 border-black  ││                           ││
│ │ text-[14px] font-medium  ││                           ││
│ │                          ││                           ││
│ │ ┌─技能卡片列表──────────┐││                           ││
│ │ │ [A] Aihot Skill Lite │││                           ││
│ │ │ 2.2万下载 12收藏     │││                           ││
│ │ │ ──分割线──            │││                           ││
│ │ │ [N] Neat Freak       │││                           ││
│ │ │ 1.1千下载 4收藏      │││                           ││
│ │ │ ──分割线──            │││                           ││
│ │ │ [H] HV Analysis      │││                           ││
│ │ │ 1.0千下载 3收藏      │││                           ││
│ │ │ ──分割线──            │││                           ││
│ │ │ [K] Khazix Writer    │││                           ││
│ │ │ 1.2千下载 2收藏      │││                           ││
│ │ └──────────────────────┘││                           ││
│ │                          ││                           ││
│ │ 技能卡片: flex items-center gap-4                    ││
│ │ py-4 no-underline        ││                           ││
│ │ hover:bg-[rgba(0,0,0,0.02)]││                         ││
│ │ border-b border-[rgba(0,0,0,0.06)]                   ││
│ └──────────────────────────┘└───────────────────────────┘│
└──────────────────────────────────────────────────────────┘
```

**Profile页设计要点：**
1. **2字母缩写头像**：w-20 h-20 rounded-full bg-[#F4F4F4]，默认取用户名首字母
2. **关注按钮**：深色主题 bg-[#202020]，与"确定并前往安装"按钮视觉统一
3. **简介默认文案**："这个人很懒，什么也没留下～"——轻松幽默的语气
4. **推荐作者**：3个相关作者 + "换一批"功能，促进社区连接
5. **技能列表**：紧凑横排样式，2字母缩写icon + 名称 + 下载量 + 收藏数
6. **统计标签用英文**："Skills" 而非"技能数"，说明平台定位偏国际化

---

## 五、MCP详情页 `/mcp/{id}` — 结构对比

### 5.1 与Skill详情页的差异

| 元素 | Skill详情页 | MCP详情页 |
|------|------------|----------|
| 面包屑 | 技能 / | MCP 广场 / |
| 作者信息 | 作者名 + 已认证icon | 作者名 + 源码链接 + 来源链接 |
| 语言切换 | 无 | 中文 | English |
| 元数据面板 | 6项横排（来源/版本/安全/下载/收藏/评分） | **无元数据面板** |
| 安全检测 | 科恩+云鼎双报告 | **无安全检测** |
| 评分 | TRACE 5维 | **无评分** |
| 内容渲染 | SKILL.md全文 | README.md全文 + 功能截图 |
| 安装方式 | 3子Tab（对话/命令行/Zip） | 直接在README中给出npx/npm/源码安装 |
| 版本历史 | 独立Tab | **无** |
| 评测报告 | TRACE独立Tab | **无** |
| MCP配置 | 无 | mcp.json配置示例（stdio/sse两种模式） |

**关键洞察：MCP详情页比Skill详情页简单很多——没有评分、没有安全检测、没有版本历史。** MCP走的是纯开发者路线，Skill走的是用户+开发者双路线。

---

## 六、对我们 AgentHub 的具体迭代建议（细化版）

### P0 — 必须做的

**1. 详情页元数据面板（6项横排）**
- 来源（平台名）
- 版本号（从metadata.yaml读取）
- 状态标记（如「已验证」「需配置Key」）
- 下载量
- 收藏数
- AI评分（或简单评分）

**2. Badge体系**
- 已认证：15x15（列表页）/ 20x20（详情页）蓝色认证icon
- 需配置Key：橙色pill `bg-[#FFF4E5] text-[#D97706] border-[rgba(217,119,6,0.15)] rounded-xl`，含key icon
- 来源：列表页右下角80px宽灰色文字

**3. 场景分类**
- 12个分类按钮：办公效率/内容创作/开发编程/数据分析/设计多媒体/AI Agent/知识管理/商业运营/教育学习/行业专业/IT运维与安全/生活服务
- 作为sidebar筛选项和详情页标签

**4. 完整文档渲染**
- 详情页增加Tab：概述 / 安装方式
- 概述Tab渲染完整 SKILL.md / Rules.md 内容
- 安装方式Tab提供一键复制给AI助手的自然语言安装指令

**5. 专区/场景聚合**
- 3张横排专区卡片（Banner图 + 标题 + 描述 + 查看专区按钮）
- 时间驱动：节日/活动专区
- 场景驱动：刚需场景专区
- 平台驱动：「Claude Code专区」「Cursor专区」

### P1 — 应该做的

**6. TRACE式评分（简化版）**
- 3维评分就够了：实用性 / 规范性 / 有效性
- 每维度给1-5分 + 一句话点评
- 综合评级：优秀/良好/一般/较差
- 总分显示：48px粗体（参考SkillHub的做法）
- 维度标签：12px灰色（text-[12px] text-gray-500）
- 评分详情区：15px正文色（rgb(58,58,30)），lineHeight 27px

**7. 版本历史**
- 列出所有版本：版本号 + 日期 + 变更描述
- 最新版标记「最新」

**8. 相关推荐**
- 3个推荐资源 + 「换一批」按钮
- 推荐卡片：rounded-[12px] border-[rgba(0,0,0,0.08)] hover:border-[rgba(0,0,0,0.16)] hover:shadow

**9. 技能包(Bundle)概念**
- 参考SkillHub的Bundle设计：一个Bundle = 约6个相关Skill + 工作流编排
- Bundle详情页展示：步骤串联（获取层→分析层→输出层）+ 最终交付物清单
- Bundle选择页：行业分类筛选 + 搜索 + checkbox勾选
- 组成Skill名pill：rounded-full bg-[#F5F5F5] text-[10px] + "+N"折叠指示
- 这是一个**重大差异化机会**——目前我们没有"资源组合"的概念

**10. 用户Profile页**
- 头像：80x80px 2字母缩写 + bg-[#F4F4F4] rounded-full
- 关注按钮：bg-[#202020] text-white h-9 rounded-[8px]
- 统计栏：Skills/粉丝/下载/收藏（13px标签/值）
- 简介默认文案：轻松幽默风格
- 推荐作者：3人 + 换一批，促进社区连接
- 已发布资源列表：紧凑横排，border-b分割

### P2 — 可以做的

**11. AI 搭子人格化Expert**
- ExpertCard增加人格维度（5-8种风格）
- 不做盲盒抽取（太重），做直接选择
- 风格标签：严谨型/活泼型/简洁型/详尽型/创意型...
- Step选择器：pill SVG渐变填充，280px宽50px高
- 人格卡：宽横条形 + emoji前缀名 + tagline + "人设解读"按钮

**12. 一键复制安装命令**
- 详情页和首页提供可直接复制给AI助手的自然语言安装指令
- 列出支持的AI助手名（Claude Code/Cursor/WorkBuddy）
- 3子Tab：对话安装/命令行安装/Zip包安装
- "方式一"和"方式二"标签：text-[14px] font-medium text-[rgba(0,0,0,0.9)]
- 复制按钮：紧贴在每个安装方式右侧

**13. 多维推荐**
- 4个Tab：为你推荐/近期飙升/下载热榜/最近上新
- 首页推荐区

**14. MCP独立展示**
- MCP类型资源有独立的列表和详情页
- 详情页直接展示mcp.json配置示例

**15. 搜索框增强**
- 搜索技能包名称、描述、标签
- focus:border-[#0052D9] focus:ring-2 focus:ring-[#0052D9]/20
- h-10(40px) pl-12(48px图标区) rounded-[8px]

**16. SKILL.md渲染增强**
- 内联代码：紫色主题 rgba(175,82,222,0.08)背景 + rgb(175,82,222)文字 + borderRadius 5px
- 代码块：language-bash fontSize 11.616px
- H2标题：fontSize 21.75px font-bold(700) color rgb(28,28,30)
- 列表项：fontSize 15px color rgba(28,28,30,0.85)
