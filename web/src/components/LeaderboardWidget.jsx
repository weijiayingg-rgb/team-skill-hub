/**
 * LeaderboardWidget - 首页右侧栏贡献榜小组件
 *
 * 紧凑版贡献者排行，展示 TOP 8，点击可跳转完整榜单页面。
 * 前三名用金银铜圆形徽章，其余用序号。
 */

import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Avatar from '@mui/material/Avatar';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import Chip from '@mui/material/Chip';
import MilitaryTechIcon from '@mui/icons-material/MilitaryTech';
import DownloadIcon from '@mui/icons-material/Download';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { useLeaderboard } from '../hooks/useLeaderboard';
import { formatNumber } from '../utils/format';
import { colors } from '../theme';

// 前三名配色
const RANK_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32'];

export default function LeaderboardWidget() {
  const navigate = useNavigate();
  const { data, loading } = useLeaderboard('all', 8);

  return (
    <Paper sx={{ p: 2.5, bgcolor: colors.bgWhite, position: 'sticky', top: 80 }}>
      {/* 标题 */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <MilitaryTechIcon sx={{ color: '#FF6600', fontSize: 20 }} />
          <Typography
            variant="subtitle1"
            sx={{
              fontWeight: 700,
              color: colors.textPrimary,
              fontFamily: '"Play", sans-serif',
            }}
          >
            贡献榜
          </Typography>
        </Box>
        <Button
          size="small"
          endIcon={<ArrowForwardIcon sx={{ fontSize: 14 }} />}
          onClick={() => navigate('/leaderboard')}
          sx={{
            color: colors.textMuted,
            fontSize: '0.75rem',
            fontWeight: 500,
            minWidth: 'auto',
            px: 1,
            py: 0.25,
            '&:hover': { color: colors.primary },
          }}
        >
          完整榜单
        </Button>
      </Box>

      {/* 排行列表 */}
      {loading ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} variant="rounded" height={44} sx={{ bgcolor: colors.bgPage, borderRadius: 1 }} />
          ))}
        </Box>
      ) : data.length === 0 ? (
        <Typography sx={{ py: 3, textAlign: 'center', color: colors.textMuted, fontSize: '0.85rem' }}>
          暂无贡献数据
        </Typography>
      ) : (
        <List disablePadding sx={{ '& .MuiListItemButton-root': { px: 1.5, py: 1 } }}>
          {data.map((user, index) => {
            const isTop3 = index < 3;
            return (
              <ListItemButton
                key={user.id}
                onClick={() => navigate('/leaderboard')}
                sx={{
                  borderRadius: 1,
                  mb: 0.25,
                  transition: 'background-color 0.15s',
                  '&:hover': { bgcolor: colors.primaryMuted },
                }}
              >
                {/* 排名 */}
                {isTop3 ? (
                  <Box
                    sx={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      bgcolor: RANK_COLORS[index],
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mr: 1.5,
                      fontWeight: 700,
                      color: '#fff',
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: '0.72rem',
                      flexShrink: 0,
                    }}
                  >
                    {index + 1}
                  </Box>
                ) : (
                  <Typography
                    sx={{
                      width: 24,
                      textAlign: 'center',
                      mr: 1.5,
                      color: colors.textMuted,
                      fontWeight: 500,
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: '0.8rem',
                      flexShrink: 0,
                    }}
                  >
                    {index + 1}
                  </Typography>
                )}

                {/* 头像 */}
                <Avatar
                  sx={{
                    width: 28,
                    height: 28,
                    mr: 1.5,
                    fontSize: '0.7rem',
                    bgcolor: isTop3 ? `${RANK_COLORS[index]}30` : colors.primaryMuted,
                    color: isTop3 ? RANK_COLORS[index] : colors.primary,
                  }}
                >
                  {(user.display_name || user.username || '?')[0].toUpperCase()}
                </Avatar>

                {/* 名称 + 统计 */}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography
                    variant="body2"
                    noWrap
                    sx={{
                      fontWeight: isTop3 ? 600 : 500,
                      color: isTop3 ? colors.textPrimary : colors.textSecondary,
                      fontSize: '0.82rem',
                      lineHeight: 1.3,
                    }}
                  >
                    {user.display_name || user.username}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5, mt: 0.25, alignItems: 'center' }}>
                    <Typography variant="caption" sx={{ color: colors.textMuted, fontSize: '0.68rem' }}>
                      {user.uploaded_count} 资源
                    </Typography>
                    <Typography variant="caption" sx={{ color: colors.textMuted, fontSize: '0.68rem' }}>
                      ·
                    </Typography>
                    <Typography variant="caption" sx={{ color: colors.textMuted, fontSize: '0.68rem' }}>
                      {formatNumber(user.total_downloads)} 下载
                    </Typography>
                  </Box>
                </Box>

                {/* 贡献度 */}
                <Chip
                  label={user.contribution_score}
                  size="small"
                  sx={{
                    height: 22,
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    fontFamily: '"JetBrains Mono", monospace',
                    bgcolor: isTop3 ? `${RANK_COLORS[index]}18` : 'rgba(0,0,0,0.03)',
                    color: isTop3 ? RANK_COLORS[index] : colors.textMuted,
                    border: 'none',
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
