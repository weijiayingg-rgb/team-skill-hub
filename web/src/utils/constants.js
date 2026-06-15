// 资源类型元数据（仅保留 Skill 和 Expert，核心双类型）
export const RESOURCE_TYPES = [
  {
    key: 'skill', label: '技能', icon: 'AutoFixHigh',
    desc: '可安装的 AI 能力单元',
    accent: '#1C86E2',
    badge: { bg: 'rgba(28, 134, 226, 0.08)', text: '#1675CC', border: 'rgba(28, 134, 226, 0.2)' },
  },
  {
    key: 'expert', label: '专家', icon: 'Psychology',
    desc: '完整的 AI 专家包',
    accent: '#FF6600',
    badge: { bg: 'rgba(255, 102, 0, 0.08)', text: '#E65C00', border: 'rgba(255, 102, 0, 0.2)' },
  },
  {
    key: 'scene', label: '场景', icon: 'Dashboard',
    desc: '企业工作流场景方案',
    accent: '#7C3AED',
    badge: { bg: 'rgba(124, 58, 237, 0.08)', text: '#6D28D9', border: 'rgba(124, 58, 237, 0.2)' },
  },
];

// 标签分类
export const TAG_CATEGORIES = [
  { key: 'general', label: '通用', color: '#6B7280' },
  { key: 'team', label: '团队', color: '#2563EB' },
  { key: 'tool', label: '工具', color: '#059669' },
  { key: 'workflow', label: '流程', color: '#D97706' },
];

// 获取标签分类颜色
export function getTagCategoryColor(category) {
  const cat = TAG_CATEGORIES.find(c => c.key === category);
  return cat ? cat.color : TAG_CATEGORIES[0].color;
}

// 查找类型元数据的快捷方法
export function getTypeMeta(typeKey) {
  return RESOURCE_TYPES.find(t => t.key === typeKey) || null;
}

export const SORT_OPTIONS = [
  { key: 'hot', label: '热门' },
  { key: 'newest', label: '最新' },
  { key: 'downloads', label: '最多下载' },
];

export const PLATFORM_CONFIG = {
  workbuddy: { name: 'WorkBuddy' },
  cursor: { name: 'Cursor' },
  claude: { name: 'Claude Code' },
  codex: { name: 'Codex' },
};