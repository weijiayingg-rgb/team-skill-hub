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
];

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