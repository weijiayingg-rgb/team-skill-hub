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
import Paper from '@mui/material/Paper';
import Chip from '@mui/material/Chip';
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
        {/* CLI 安装提示 — 替换为 Quick Start 引导横幅 */}
      </Box>

      {/* ========== Quick Start 引导横幅 ========== */}
      <Paper
        sx={{
          mb: 3,
          p: { xs: 2, md: 2.5 },
          background: `linear-gradient(135deg, ${colors.primaryMuted} 0%, rgba(28,134,226,0.04) 100%)`,
          border: `1px solid rgba(28,134,226,0.15)`,
          borderRadius: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <TerminalIcon sx={{ color: colors.primary, fontSize: 20 }} />
          <Typography
            variant="subtitle1"
            sx={{ fontWeight: 700, color: colors.primary, fontFamily: '"Play", sans-serif' }}
          >
            快速开始
          </Typography>
          <Typography variant="caption" sx={{ color: colors.textMuted }}>
            安装 CLI 后即可自动同步和安装所有资源
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: { xs: 1.5, md: 2.5 }, alignItems: 'flex-start' }}>
          {/* Step 1: 安装 CLI */}
          <Box sx={{ flex: { xs: '1 1 100%', md: '1 1 auto' }, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
              <Chip
                label="1"
                size="small"
                sx={{
                  width: 22, height: 22, minWidth: 22,
                  fontWeight: 700, fontSize: '0.75rem',
                  bgcolor: colors.primary, color: '#fff',
                }}
              />
              <Typography variant="body2" sx={{ fontWeight: 600, color: colors.textPrimary }}>
                安装 CLI
              </Typography>
            </Box>
            <Box
              onClick={handleCopy}
              sx={{
                display: 'flex',
                alignItems: 'center',
                bgcolor: 'rgba(0,0,0,0.06)',
                px: 1.5,
                py: 0.75,
                borderRadius: 1,
                cursor: 'pointer',
                transition: 'background-color 0.15s',
                '&:hover': { bgcolor: 'rgba(0,0,0,0.1)' },
              }}
            >
              <Typography
                sx={{
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: '0.82rem',
                  fontWeight: 500,
                  color: colors.textPrimary,
                  flex: 1,
                }}
              >
                $ npm install -g skhub
              </Typography>
              {copied ? (
                <CheckCircleIcon sx={{ fontSize: 16, color: colors.success }} />
              ) : (
                <ContentCopyIcon sx={{ fontSize: 16, color: colors.textMuted }} />
              )}
            </Box>
          </Box>

          {/* Step 2: 上传你的 Skill */}
          <Box sx={{ flex: { xs: '1 1 45%', md: '0 0 auto' } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
              <Chip
                label="2"
                size="small"
                sx={{
                  width: 22, height: 22, minWidth: 22,
                  fontWeight: 700, fontSize: '0.75rem',
                  bgcolor: colors.success, color: '#fff',
                }}
              />
              <Typography variant="body2" sx={{ fontWeight: 600, color: colors.textPrimary }}>
                上传 Skill
              </Typography>
            </Box>
            <Typography variant="caption" sx={{ color: colors.textSecondary, lineHeight: 1.6, display: 'block' }}>
              在{' '}
              <Box
                component="a"
                href="/upload"
                sx={{ color: colors.primary, textDecoration: 'none', fontWeight: 600, '&:hover': { textDecoration: 'underline' } }}
              >
                上传页
              </Box>
              {' '}使用智能扫描，自动发现本地 Skill / Expert 并一键同步
            </Typography>
          </Box>

          {/* Step 3: 浏览安装 */}
          <Box sx={{ flex: { xs: '1 1 45%', md: '0 0 auto' } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
              <Chip
                label="3"
                size="small"
                sx={{
                  width: 22, height: 22, minWidth: 22,
                  fontWeight: 700, fontSize: '0.75rem',
                  bgcolor: colors.warning, color: '#fff',
                }}
              />
              <Typography variant="body2" sx={{ fontWeight: 600, color: colors.textPrimary }}>
                浏览安装
              </Typography>
            </Box>
            <Typography variant="caption" sx={{ color: colors.textSecondary, lineHeight: 1.6, display: 'block' }}>
              在{' '}
              <Box
                component="a"
                href="/skills"
                sx={{ color: colors.primary, textDecoration: 'none', fontWeight: 600, '&:hover': { textDecoration: 'underline' } }}
              >
                Skill 列表
              </Box>
              {' '}找到需要的技能，或{' '}
              <Box
                component="a"
                href="/experts"
                sx={{ color: colors.warning, textDecoration: 'none', fontWeight: 600, '&:hover': { textDecoration: 'underline' } }}
              >
                Expert 列表
              </Box>
              {' '}获取专家套餐
            </Typography>
          </Box>
        </Box>
      </Paper>

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