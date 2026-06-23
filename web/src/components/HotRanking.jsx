/**
 * HotRanking - 热门 Skill 排行榜（JokerPS 亮色清新风格）
 *
 * 扁平化 3 维度排序切换：
 * - 维度 Chip：综合热度 / 下载量 / 收藏量
 * - 时间范围 Chip（仅综合热度时显示）：全部 / 本周 / 本月
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import Paper from '@mui/material/Paper';
import Chip from '@mui/material/Chip';
import DownloadIcon from '@mui/icons-material/Download';
import StarIcon from '@mui/icons-material/Star';
import WhatshotIcon from '@mui/icons-material/Whatshot';
import TypeBadge from './TypeBadge';
import { formatNumber } from '../utils/format';
import { useTrending } from '../hooks/useTrending';
import { colors } from '../theme';

// 排行维度定义
const DIMENSIONS = [
  { key: 'hot', label: '综合热度', sortBy: 'hot', valueKey: 'hot_score', valueLabel: '热度', ValueIcon: WhatshotIcon, isScore: true },
  { key: 'downloads', label: '下载量', sortBy: 'downloads', valueKey: 'download_count', valueLabel: '下载', ValueIcon: DownloadIcon, isScore: false },
  { key: 'favorites', label: '收藏量', sortBy: 'favorites', valueKey: 'favorite_count', valueLabel: '收藏', ValueIcon: StarIcon, isScore: false },
];

// 时间范围选项（仅综合热度维度可用）
const PERIODS = [
  { key: 'all', label: '全部' },
  { key: 'weekly', label: '本周' },
  { key: 'monthly', label: '本月' },
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
  // 维度：'hot' | 'downloads' | 'favorites'
  const [dimension, setDimension] = useState('hot');
  // 时间范围：'all' | 'weekly' | 'monthly'（仅综合热度时生效）
  const [period, setPeriod] = useState('all');

  // 只有 hot 维度支持 period，其他固定 period='all'
  const activePeriod = dimension === 'hot' ? period : 'all';
  const currentDim = DIMENSIONS.find(d => d.key === dimension);
  const { resources, loading } = useTrending(activePeriod, currentDim.sortBy, type);
  const top10 = (resources || []).slice(0, 10);

  // 根据 type 生成标题和配色
  const isExpert = type === 'expert';
  const title = isExpert ? '热门 Expert 排行' : '热门 Skill 排行';
  const titleColor = isExpert ? '#FF6600' : colors.primary; // Expert 用橙色，Skill 用品牌蓝

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

      {/* 维度切换 */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
        {DIMENSIONS.map((dim) => {
          const isActive = dim.key === dimension;
          return (
            <Chip
              key={dim.key}
              icon={<dim.ValueIcon sx={{ fontSize: 16 }} />}
              label={dim.label}
              size="small"
              clickable
              onClick={() => setDimension(dim.key)}
              sx={{
                height: 30, px: 0.5, fontSize: '0.82rem',
                fontWeight: isActive ? 700 : 500,
                bgcolor: isActive ? colors.primaryMuted : 'rgba(0,0,0,0.03)',
                color: isActive ? colors.primary : colors.textSecondary,
                border: isActive ? `1.5px solid ${colors.primary}` : '1.5px solid transparent',
                transition: 'all 0.2s ease',
                '&:hover': {
                  bgcolor: isActive ? colors.primaryMuted : 'rgba(0,0,0,0.06)',
                  color: colors.primary,
                },
                '& .MuiChip-icon': {
                  color: isActive ? colors.primary : colors.textMuted,
                },
              }}
            />
          );
        })}
      </Box>

      {/* 时间范围（仅综合热度时显示） */}
      {dimension === 'hot' && (
        <Box sx={{ display: 'flex', gap: 0.5, mb: 2 }}>
          {PERIODS.map((p) => {
            const isActive = p.key === period;
            return (
              <Chip
                key={p.key}
                label={p.label}
                size="small"
                clickable
                onClick={() => setPeriod(p.key)}
                sx={{
                  height: 26, fontSize: '0.75rem',
                  fontWeight: isActive ? 600 : 400,
                  bgcolor: isActive ? 'rgba(0,0,0,0.06)' : 'transparent',
                  color: isActive ? colors.textPrimary : colors.textMuted,
                  border: isActive ? `1px solid ${colors.border}` : '1px solid transparent',
                }}
              />
            );
          })}
        </Box>
      )}

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