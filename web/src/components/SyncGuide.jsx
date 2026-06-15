/**
 * SyncGuide - CLI 同步引导卡片
 *
 * 前端无法直接扫描本地文件，通过引导卡片让用户：
 * 1. 知道有 skhub sync 命令可以自动扫描本地 Skill/Expert
 * 2. 一键复制 CLI 命令
 * 3. 了解扫描流程和平台覆盖范围
 */

import { useState } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import Snackbar from '@mui/material/Snackbar';
import TerminalIcon from '@mui/icons-material/Terminal';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WhatshotIcon from '@mui/icons-material/Whatshot';
import { colors } from '../theme';

const CLI_COMMANDS = [
  { cmd: 'skhub sync --auto', desc: '一键扫描 + 自动同步所有新增和更新', primary: true },
  { cmd: 'skhub scan', desc: '先扫描查看状态报告', primary: false },
  { cmd: 'skhub push --all', desc: '推送所有新增和更新到注册中心', primary: false },
];

const PLATFORMS = [
  { name: 'Claude Code', paths: '~/.claude/commands/ + ~/.claude/agents/', icon: '🟠' },
  { name: 'Cursor', paths: '~/.cursor/skills/ + ~/.cursor/prompts/ + ~/.cursor/agents/', icon: '🟡' },
  { name: 'Codex', paths: '~/.codex/commands/ + ~/.codex/agents/', icon: '🟣' },
  { name: 'WorkBuddy', paths: '~/.workbuddy/skills/ + ~/.workbuddy/experts/', icon: '🔵' },
];

export default function SyncGuide({ variant = 'card' }) {
  const [copiedCmd, setCopiedCmd] = useState(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);

  const handleCopy = (cmd) => {
    navigator.clipboard.writeText(cmd).then(() => {
      setCopiedCmd(cmd);
      setSnackbarOpen(true);
      setTimeout(() => setCopiedCmd(null), 2000);
    }).catch(() => {
      // clipboard API 不可用时 fallback
      const textarea = document.createElement('textarea');
      textarea.value = cmd;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedCmd(cmd);
      setSnackbarOpen(true);
      setTimeout(() => setCopiedCmd(null), 2000);
    });
  };

  if (variant === 'compact') {
    // 紧凑版本：用于首页 Hero 区域
    return (
      <Box sx={{ textAlign: 'center' }}>
        <Typography
          variant="body2"
          sx={{ color: colors.textSecondary, mb: 1 }}
        >
          本地有 Skill 或 Expert？一键扫描上传：
        </Typography>
        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
          <Paper
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 1,
              px: 2,
              py: 0.75,
              bgcolor: '#1E1E2E',
              borderRadius: 1,
              border: '1px solid rgba(255,255,255,0.1)',
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: '0.85rem',
              color: '#E0E0E0',
              cursor: 'pointer',
              transition: 'border-color 0.2s',
              '&:hover': { borderColor: colors.primary },
            }}
            onClick={() => handleCopy('skhub sync --auto')}
          >
            <TerminalIcon sx={{ fontSize: 16, color: colors.primary }} />
            skhub sync --auto
            <ContentCopyIcon sx={{ fontSize: 14, color: colors.textMuted }} />
          </Paper>
        </Box>
        <Typography
          variant="caption"
          sx={{ color: colors.textMuted, mt: 0.5, display: 'block' }}
        >
          自动扫描 Claude Code / Cursor / WorkBuddy 的本地 Skill 和 Expert
        </Typography>

        <Snackbar
          open={snackbarOpen}
          autoHideDuration={1500}
          onClose={() => setSnackbarOpen(false)}
          message="命令已复制到剪贴板"
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        />
      </Box>
    );
  }

  // 完整卡片版本：用于个人中心页
  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        borderRadius: 2,
        border: `1px solid ${colors.border}`,
        bgcolor: colors.bgWhite,
        mb: 3,
      }}
    >
      {/* 标题 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <TerminalIcon sx={{ color: colors.primary, fontSize: 22 }} />
        <Typography
          variant="h6"
          sx={{
            fontWeight: 700,
            color: colors.textPrimary,
            fontFamily: '"Play", sans-serif',
          }}
        >
          同步你的本地 Skill
        </Typography>
      </Box>

      <Typography
        variant="body2"
        sx={{ color: colors.textSecondary, mb: 2 }}
      >
        使用 CLI 命令自动扫描本地 AI 配置，智能识别新增/已同步/有更新的 Skill 和 Expert，一键推送到注册中心。
      </Typography>

      {/* CLI 命令列表 */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 2 }}>
        {CLI_COMMANDS.map((item) => (
          <Box
            key={item.cmd}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              p: 1.5,
              borderRadius: 1,
              bgcolor: item.primary ? colors.primaryMuted : 'rgba(0,0,0,0.02)',
              border: item.primary ? `1px solid ${colors.primary}30` : `1px solid ${colors.border}`,
              cursor: 'pointer',
              transition: 'border-color 0.2s',
              '&:hover': {
                borderColor: colors.primary,
              },
            }}
            onClick={() => handleCopy(item.cmd)}
          >
            <TerminalIcon sx={{ fontSize: 18, color: item.primary ? colors.primary : colors.textMuted }} />
            <Typography
              sx={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: '0.85rem',
                fontWeight: item.primary ? 700 : 500,
                color: item.primary ? colors.primary : colors.textSecondary,
                flex: 1,
              }}
            >
              {item.cmd}
            </Typography>
            <Typography
              variant="caption"
              sx={{ color: colors.textMuted, mr: 1 }}
            >
              {item.desc}
            </Typography>
            <Tooltip title="复制命令">
              {copiedCmd === item.cmd ? (
                <CheckCircleIcon sx={{ fontSize: 16, color: colors.success }} />
              ) : (
                <ContentCopyIcon sx={{ fontSize: 16, color: colors.textMuted }} />
              )}
            </Tooltip>
          </Box>
        ))}
      </Box>

      {/* 扫描流程说明 */}
      <Box sx={{ mb: 2 }}>
        <Typography
          variant="subtitle2"
          sx={{ fontWeight: 600, color: colors.textPrimary, mb: 1 }}
        >
          扫描流程
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {['扫描本地 → 计算指纹 → 比对远端 → 推送同步'].map((step, i) => (
            <Chip
              key={i}
              label={step}
              size="small"
              sx={{
                bgcolor: 'rgba(0,0,0,0.03)',
                color: colors.textSecondary,
                fontWeight: 500,
                fontSize: '0.75rem',
              }}
            />
          ))}
        </Box>
      </Box>

      {/* 支持的平台 */}
      <Box>
        <Typography
          variant="subtitle2"
          sx={{ fontWeight: 600, color: colors.textPrimary, mb: 1 }}
        >
          支持扫描的平台
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {PLATFORMS.map((p) => (
            <Box
              key={p.name}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                fontSize: '0.8rem',
              }}
            >
              <span>{p.icon}</span>
              <Typography sx={{ fontWeight: 600, color: colors.textPrimary, fontSize: '0.8rem' }}>
                {p.name}
              </Typography>
              <Typography sx={{ color: colors.textMuted, fontSize: '0.75rem', fontFamily: '"JetBrains Mono", monospace' }}>
                {p.paths}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>

      {/* 状态图标说明 */}
      <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <Chip
          icon={<WhatshotIcon sx={{ fontSize: 14 }} />}
          label="🆕 新增"
          size="small"
          sx={{ bgcolor: colors.primaryMuted, color: colors.primary, fontWeight: 500 }}
        />
        <Chip
          icon={<CheckCircleIcon sx={{ fontSize: 14 }} />}
          label="✅ 已同步"
          size="small"
          sx={{ bgcolor: colors.successMuted || 'rgba(16,185,129,0.08)', color: colors.success, fontWeight: 500 }}
        />
        <Chip
          label="🔄 有更新"
          size="small"
          sx={{ bgcolor: 'rgba(255,165,0,0.08)', color: colors.warning, fontWeight: 500 }}
        />
      </Box>

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={1500}
        onClose={() => setSnackbarOpen(false)}
        message="命令已复制到剪贴板"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Paper>
  );
}