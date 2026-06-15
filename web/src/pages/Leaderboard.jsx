/**
 * Leaderboard - 贡献榜页面（总榜/月榜/周榜）
 */
import { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Avatar from '@mui/material/Avatar';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import WhatshotIcon from '@mui/icons-material/Whatshot';
import MilitaryTechIcon from '@mui/icons-material/MilitaryTech';
import DownloadIcon from '@mui/icons-material/Download';
import { useLeaderboard } from '../hooks/useLeaderboard';
import { formatNumber } from '../utils/format';
import { colors } from '../theme';

// 前三名配色：金、银、铜
const RANK_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32'];
const RANK_BG = [
  'rgba(255,215,0,0.08)',  // 金色背景
  'rgba(192,192,192,0.08)', // 银色背景
  'rgba(205,127,50,0.08)',  // 铜色背景
];

// Tab 配置（weekly/monthly 筛的是"最近上传的资源"，不是"活跃资源"，标签需准确）
const PERIOD_TABS = [
  { key: 'all', label: '总榜' },
  { key: 'monthly', label: '本月新贡献' },
  { key: 'weekly', label: '本周新贡献' },
];

export default function Leaderboard() {
  const [period, setPeriod] = useState('all');
  const { data, loading, error } = useLeaderboard(period, 20);

  return (
    <Box>
      {/* 页面标题 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <MilitaryTechIcon sx={{ color: '#FF6600', fontSize: 28 }} />
        <Typography variant="h5" sx={{ fontWeight: 700, fontFamily: '"Play", sans-serif', color: colors.textPrimary }}>
          贡献榜
        </Typography>
        <Typography variant="caption" sx={{ color: colors.textMuted }}>
          感谢每一位贡献者
        </Typography>
      </Box>

      {/* 三期 Tab */}
      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={period}
          onChange={(_, val) => setPeriod(val)}
          sx={{
            '& .MuiTab-root': {
              fontWeight: 600,
              fontSize: '0.9rem',
              color: colors.textSecondary,
            },
            '& .Mui-selected': { color: '#FF6600 !important' },
            '& .MuiTabs-indicator': { backgroundColor: '#FF6600', height: 2 },
          }}
        >
          {PERIOD_TABS.map(tab => (
            <Tab key={tab.key} value={tab.key} label={tab.label} />
          ))}
        </Tabs>
      </Paper>

      {/* 排行列表 */}
      <Paper sx={{ bgcolor: colors.bgWhite }}>
        {loading ? (
          <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 1 }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} variant="rounded" height={60} sx={{ bgcolor: colors.bgPage, borderRadius: 1 }} />
            ))}
          </Box>
        ) : error ? (
          <Box sx={{ p: 6, textAlign: 'center' }}>
            <Typography sx={{ color: colors.danger }}>加载失败</Typography>
          </Box>
        ) : data.length === 0 ? (
          <Box sx={{ p: 6, textAlign: 'center' }}>
            <Typography sx={{ color: colors.textMuted }}>暂无贡献数据</Typography>
            <Typography variant="body2" sx={{ color: colors.textSecondary, mt: 1 }}>
              上传你的第一个 Skill，成为贡献者！
            </Typography>
          </Box>
        ) : (
          <List disablePadding>
            {data.map((user, index) => {
              const isTop3 = index < 3;
              return (
                <ListItemButton
                  key={user.id}
                  sx={{
                    px: 3,
                    py: 2,
                    bgcolor: isTop3 ? RANK_BG[index] : 'transparent',
                    borderBottom: `1px solid ${colors.border}`,
                    '&:hover': { bgcolor: isTop3 ? RANK_BG[index] : colors.primaryMuted },
                  }}
                >
                  {/* 排名标记 */}
                  {isTop3 ? (
                    <Box sx={{
                      width: 40, height: 40, borderRadius: '50%',
                      bgcolor: RANK_COLORS[index],
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      mr: 2, fontWeight: 700, color: '#fff', fontFamily: '"JetBrains Mono", monospace',
                      fontSize: '1.1rem',
                    }}>
                      {index + 1}
                    </Box>
                  ) : (
                    <Typography sx={{
                      width: 40, textAlign: 'center',
                      color: colors.textMuted, fontWeight: 500, fontFamily: '"JetBrains Mono", monospace',
                      mr: 2,
                    }}>
                      {index + 1}
                    </Typography>
                  )}

                  {/* 用户信息 */}
                  <Avatar sx={{
                    width: 40, height: 40,
                    bgcolor: isTop3 ? RANK_COLORS[index] : colors.primaryMuted,
                    color: isTop3 ? '#fff' : colors.primary,
                    mr: 2,
                  }}>
                    {(user.display_name || user.username || '?')[0].toUpperCase()}
                  </Avatar>

                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontWeight: isTop3 ? 700 : 500, color: colors.textPrimary }}>
                      {user.display_name || user.username}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                      <Chip label={`${user.uploaded_count} 个资源`} size="small" sx={{ fontSize: '0.72rem', height: 22 }} />
                      <Chip icon={<DownloadIcon sx={{ fontSize: 12 }} />} label={`${formatNumber(user.total_downloads)} 下载`} size="small" sx={{ fontSize: '0.72rem', height: 22 }} />
                    </Box>
                  </Box>

                  {/* 贡献度分数 */}
                  <Chip
                    icon={<WhatshotIcon sx={{ fontSize: 14 }} />}
                    label={`${user.contribution_score}`}
                    sx={{
                      fontWeight: 700,
                      fontFamily: '"JetBrains Mono", monospace',
                      bgcolor: isTop3 ? `${RANK_COLORS[index]}20` : 'rgba(0,0,0,0.03)',
                      color: isTop3 ? RANK_COLORS[index] : colors.textSecondary,
                      fontSize: '0.78rem',
                      height: 28,
                    }}
                  />
                </ListItemButton>
              );
            })}
          </List>
        )}
      </Paper>
    </Box>
  );
}