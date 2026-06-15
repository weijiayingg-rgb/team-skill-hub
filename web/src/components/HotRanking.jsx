/**
 * HotRanking - 热门 Skill 排行榜（JokerPS 亮色清新风格）
 *
 * 改动说明：
 * - 将 DIMENSIONS 分为两组：热度排行（综合/本周/本月）和数量排行（下载/点赞/收藏）
 * - 第一层 Tab 区分排行性质，第二层 Tab 选择具体维度
 * - 热度值用火焰图标 + "热度"标签，数值排行用具体单位标签
 * - 视觉上明确区分两种不同性质的排行榜
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import Paper from '@mui/material/Paper';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Chip from '@mui/material/Chip';
import DownloadIcon from '@mui/icons-material/Download';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import StarIcon from '@mui/icons-material/Star';
import WhatshotIcon from '@mui/icons-material/Whatshot';
import TypeBadge from './TypeBadge';
import { formatNumber } from '../utils/format';
import { useTrending } from '../hooks/useTrending';
import { colors } from '../theme';

// 热度排行维度（基于热度算法）
const HEAT_DIMS = [
  { key: 'all', label: '综合热度', period: 'all', sortBy: 'hot', valueKey: 'hot_score', valueLabel: '热度', ValueIcon: WhatshotIcon, isScore: true },
  { key: 'weekly', label: '本周热门', period: 'weekly', sortBy: 'hot', valueKey: 'hot_score', valueLabel: '热度', ValueIcon: WhatshotIcon, isScore: true },
  { key: 'monthly', label: '本月热门', period: 'monthly', sortBy: 'hot', valueKey: 'hot_score', valueLabel: '热度', ValueIcon: WhatshotIcon, isScore: true },
];

// 数量排行维度（简单数值排序）
const SORT_DIMS = [
  { key: 'downloads', label: '最多下载', period: 'all', sortBy: 'downloads', valueKey: 'download_count', valueLabel: '下载', ValueIcon: DownloadIcon, isScore: false },
  { key: 'likes', label: '最多点赞', period: 'all', sortBy: 'likes', valueKey: 'like_count', valueLabel: '点赞', ValueIcon: ThumbUpIcon, isScore: false },
  { key: 'favorites', label: '最多收藏', period: 'all', sortBy: 'favorites', valueKey: 'favorite_count', valueLabel: '收藏', ValueIcon: StarIcon, isScore: false },
];

// 前三名颜色：亮蓝、活力橙、翠绿
const RANK_COLORS = [colors.primary, colors.warning, colors.success];

function getRankStyle(index) {
  if (index < 3) {
    return {
      color: RANK_COLORS[index],
      fontWeight: 700,
      fontSize: '1.1rem',
      fontFamily: '"JetBrains Mono", monospace',
    };
  }
  return {
    color: colors.textMuted,
    fontWeight: 500,
    fontSize: '0.9rem',
    fontFamily: '"JetBrains Mono", monospace',
  };
}

export default function HotRanking({ type = 'skill' }) {
  const navigate = useNavigate();
  // 第一层：排行类型（热度排行 / 数量排行）
  const [group, setGroup] = useState(0);
  // 第二层：具体维度
  const [heatTab, setHeatTab] = useState('all');
  const [sortTab, setSortTab] = useState('downloads');

  // 根据当前 group 和 tab 计算实际维度参数
  const currentDim = group === 0
    ? HEAT_DIMS.find(d => d.key === heatTab) || HEAT_DIMS[0]
    : SORT_DIMS.find(d => d.key === sortTab) || SORT_DIMS[0];

  const { resources, loading } = useTrending(currentDim.period, currentDim.sortBy, type);
  const top10 = (resources || []).slice(0, 10);

  // 根据 type 生成标题和配色
  const isExpert = type === 'expert';
  const title = isExpert ? '热门 Expert 排行' : '热门 Skill 排行';
  const titleColor = isExpert ? '#FF6600' : colors.primary; // Expert 用橙色，Skill 用品牌蓝
  const accentColor = isExpert ? '#FF6600' : colors.primary;

  return (
    <Paper sx={{ p: 3, mb: 3, bgcolor: colors.bgWhite }}>
      {/* 标题 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <WhatshotIcon sx={{ color: titleColor, fontSize: 22 }} />
        <Typography
          variant="h6"
          sx={{
            fontWeight: 700,
            color: titleColor,
            fontFamily: '"Play", sans-serif',
          }}
        >
          {title}
        </Typography>
      </Box>

      {/* 第一层 Tab：排行类型分组 */}
      <Tabs
        value={group}
        onChange={(_, val) => setGroup(val)}
        sx={{
          mb: 1,
          minHeight: 40,
          '& .MuiTab-root': {
            minHeight: 40,
            py: 0.5,
            px: 2,
            fontSize: '0.9rem',
            fontWeight: 600,
            color: colors.textSecondary,
          },
          '& .Mui-selected': {
            color: `${colors.primary} !important`,
          },
          '& .MuiTabs-indicator': {
            backgroundColor: colors.primary,
            height: 2,
          },
        }}
      >
        <Tab label="🔥 热度排行" />
        <Tab label="📊 数量排行" />
      </Tabs>

      {/* 第二层：Chip 切换按钮（替代 Tabs，间距更大更清晰） */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
        {(group === 0 ? HEAT_DIMS : SORT_DIMS).map((dim) => {
          const isActive = group === 0 ? dim.key === heatTab : dim.key === sortTab;
          return (
            <Chip
              key={dim.key}
              label={dim.label}
              size="small"
              clickable
              onClick={() => {
                if (group === 0) setHeatTab(dim.key);
                else setSortTab(dim.key);
              }}
              sx={{
                height: 30,
                px: 0.5,
                fontSize: '0.82rem',
                fontWeight: isActive ? 700 : 500,
                bgcolor: isActive ? colors.primaryMuted : 'rgba(0,0,0,0.03)',
                color: isActive ? colors.primary : colors.textSecondary,
                border: isActive ? `1.5px solid ${colors.primary}` : '1.5px solid transparent',
                transition: 'all 0.2s ease',
                '&:hover': {
                  bgcolor: isActive ? colors.primaryMuted : 'rgba(0,0,0,0.06)',
                  color: colors.primary,
                },
              }}
            />
          );
        })}
      </Box>

      {/* 内容区 */}
      {loading ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} variant="rounded" height={40} sx={{ bgcolor: colors.bgPage, borderRadius: 1 }} />
          ))}
        </Box>
      ) : top10.length === 0 ? (
        <Typography sx={{ py: 3, textAlign: 'center', color: colors.textMuted }}>
          暂无数据
        </Typography>
      ) : (
        <List disablePadding>
          {top10.map((resource, index) => {
            const ValueIcon = currentDim.ValueIcon;
            const rawValue = resource[currentDim.valueKey];
            const displayValue = currentDim.isScore
              ? (rawValue ?? 0).toFixed(1)
              : formatNumber(rawValue ?? 0);

            return (
              <ListItemButton
                key={resource.id}
                onClick={() => navigate(`/resources/${resource.id}`)}
                sx={{
                  px: 1.5,
                  py: 1.75,
                  borderRadius: 1,
                  transition: 'background-color 0.15s',
                  bgcolor: index < 3 ? colors.primaryMuted : 'transparent',
                  '&:hover': { bgcolor: colors.primaryMuted },
                }}
              >
                {/* 排名数字 */}
                <Typography sx={{ width: 32, textAlign: 'center', ...getRankStyle(index) }}>
                  {index + 1}
                </Typography>

                {/* 名称 + 描述 + 类型 */}
                <Box sx={{ flex: 1, ml: 1.5, minWidth: 0 }}>
                  <Typography
                    variant="body2"
                    noWrap
                    sx={{
                      fontWeight: index < 3 ? 600 : 500,
                      color: index < 3 ? colors.textPrimary : colors.textSecondary,
                    }}
                  >
                    {resource.display_name}
                  </Typography>
                  {resource.description && (
                    <Typography
                      variant="caption"
                      noWrap
                      sx={{
                        display: 'block',
                        color: colors.textMuted,
                        fontSize: '0.75rem',
                        lineHeight: 1.3,
                      }}
                    >
                      {resource.description.length > 40
                        ? resource.description.slice(0, 40) + '...'
                        : resource.description}
                    </Typography>
                  )}
                  <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, alignItems: 'center' }}>
                    <TypeBadge type={resource.type} />
                  </Box>
                </Box>

                {/* 数值 */}
                <Chip
                  icon={<ValueIcon sx={{ fontSize: 16 }} />}
                  label={displayValue}
                  size="small"
                  sx={{
                    height: 28,
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    fontFamily: '"JetBrains Mono", monospace',
                    bgcolor: index < 3 ? colors.primaryMuted : 'rgba(0,0,0,0.03)',
                    color: index < 3 ? colors.primary : colors.textSecondary,
                    border: 'none',
                    '& .MuiChip-icon': {
                      color: 'inherit',
                      ml: 0.5,
                    },
                  }}
                />
              </ListItemButton>
            );
          })}
        </List>
      )}
    </Paper>
  );
}