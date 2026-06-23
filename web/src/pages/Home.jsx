/**
 * Home - 首页（双栏布局：左侧主内容 + 右侧贡献榜）
 *
 * 设计要点：
 * - Hero 区域：白色面板 + 搜索栏（全宽）
 * - TypeNavigation（全宽）
 * - 左侧主内容（lg=8）：Skill 排行 + 最近更新 + Expert 推荐
 * - 右侧分栏（lg=4）：贡献榜 TOP 8 + 快捷入口
 */

import { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import Snackbar from '@mui/material/Snackbar';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import TerminalIcon from '@mui/icons-material/Terminal';
import SearchBar from '../components/SearchBar';
import TypeNavigation from '../components/TypeNavigation';
import HotRanking from '../components/HotRanking';
import ResourceGrid from '../components/ResourceGrid';
import LeaderboardWidget from '../components/LeaderboardWidget';
import { useResources } from '../hooks/useResources';
import { colors } from '../theme';

export default function Home() {
  const [copied, setCopied] = useState(false);

  // Skill + Expert 混合获取最新资源
  const { resources: latestResources, loading: resourcesLoading } = useResources({ sort: 'newest', pageSize: 8, types: 'skill,expert' });
  // Expert 单独获取用于专家包推荐
  const { resources: latestExperts, loading: expertsLoading } = useResources({ sort: 'newest', pageSize: 5, type: 'expert' });

  const handleCopy = () => {
    navigator.clipboard.writeText('npm install -g skhub');
    setCopied(true);
  };

  return (
    <Box>
      {/* ========== Hero 区域 - 紧凑单行搜索栏 ========== */}
      <Box sx={{ mb: 2, textAlign: 'center' }}>
        <Typography
          variant="h5"
          sx={{
            fontWeight: 700,
            color: colors.textPrimary,
            fontFamily: '"Play", sans-serif',
            mb: 0.5,
            fontSize: { xs: '1.1rem', md: '1.3rem' },
          }}
        >
          发现你的 <span style={{ color: colors.primary }}>AI 技能</span>
        </Typography>
        <Typography
          variant="caption"
          sx={{
            color: colors.textSecondary,
            mb: 1.5,
            display: 'block',
          }}
        >
          AI 技能分发中心 — Skill · 场景 · Expert 一站式获取
        </Typography>
        <Box sx={{ maxWidth: 640, mx: 'auto' }}>
          <SearchBar variant="hero" />
        </Box>
        {/* CLI 安装提示 */}
        <Box
          sx={{
            mt: 1.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1,
          }}
        >
          <TerminalIcon sx={{ fontSize: 16, color: colors.textMuted }} />
          <Typography variant="body2" sx={{ color: colors.textSecondary }}>
            还没安装 skhub CLI？
          </Typography>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              bgcolor: 'rgba(0,0,0,0.05)',
              px: 1.5,
              py: 0.5,
              borderRadius: 1,
              cursor: 'pointer',
              border: `1px solid ${colors.border}`,
              transition: 'all 0.15s',
              '&:hover': { bgcolor: 'rgba(0,0,0,0.08)', borderColor: colors.primary },
            }}
            onClick={handleCopy}
          >
            <Typography
              sx={{
                fontFamily: '"JetBrains Mono", monospace',
                color: colors.textPrimary,
                fontSize: '0.85rem',
                fontWeight: 500,
              }}
            >
              npm install -g skhub
            </Typography>
            {copied ? (
              <CheckCircleIcon sx={{ fontSize: 16, ml: 0.5, color: colors.success }} />
            ) : (
              <ContentCopyIcon sx={{ fontSize: 16, ml: 0.5, color: colors.textMuted }} />
            )}
          </Box>
        </Box>
      </Box>

      {/* ========== Skill 大卡片（TypeNavigation 组件） ========== */}
      <TypeNavigation />

      {/* ========== 双栏布局：左侧主内容 + 右侧贡献榜 ========== */}
      <Grid container spacing={3}>
        {/* 左侧主内容 */}
        <Grid item xs={12} lg={8}>
          {/* Skill 排行（主角） */}
          <HotRanking type="skill" />

          {/* 最近更新（Skill + Expert 混合） */}
          <Box sx={{ mb: 2 }}>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 700,
                color: colors.textPrimary,
                fontFamily: '"Play", sans-serif',
                mb: 2,
              }}
            >
              最近更新
            </Typography>
          </Box>
          <ResourceGrid resources={latestResources} loading={resourcesLoading} emptyText="暂无资源更新" />

          {/* 分隔线 */}
          <Divider sx={{ my: 4, borderColor: colors.border }} />

          {/* Expert 热门 TOP 5（简化版，视觉权重低） */}
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 700,
                  color: colors.warning,
                  fontFamily: '"Play", sans-serif',
                }}
              >
                专家包推荐
              </Typography>
              <Typography
                variant="caption"
                sx={{ color: colors.textMuted }}
              >
                完整的 AI 专家套餐
              </Typography>
            </Box>
            <ResourceGrid resources={latestExperts} loading={expertsLoading} emptyText="暂无 Expert" />
          </Box>
        </Grid>

        {/* 右侧分栏 */}
        <Grid item xs={12} lg={4}>
          <LeaderboardWidget />
        </Grid>
      </Grid>

      {/* 复制成功提示 */}
      <Snackbar
        open={copied}
        autoHideDuration={2000}
        onClose={() => setCopied(false)}
        message="✅ 已复制安装命令"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  );
}