/**
 * InstallGuide - 安装引导组件（极简风格）
 *
 * 主要方式：自然语言指令（复制给 AI 代理即可安装）
 * 备选方式：终端 CLI 命令 / ZIP 下载
 * 不依赖平台适配器 API，代理自动检测当前平台。
 */

import { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import ContentCopy from '@mui/icons-material/ContentCopy';
import Download from '@mui/icons-material/Download';
import { colors } from '../theme';

export default function InstallGuide({ resource }) {
  const [snackbarOpen, setSnackbarOpen] = useState(false);

  if (!resource) return null;

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => setSnackbarOpen(true));
  };

  // 根据资源类型生成自然语言指令
  const isExpert = resource.type === 'expert';
  const naturalLang = isExpert
    ? `帮我安装 ${resource.name} 子代理`
    : `帮我用 skhub 安装 ${resource.name}`;

  const cliCommand = `skhub install ${resource.name}`;

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = `/api/resources/${resource.id}/download-zip`;
    link.download = `${resource.name}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Box>
      {/* ── 自然语言指令（主要方式）── */}
      <Box sx={{ mb: 2 }}>
        <Typography
          variant="subtitle2"
          sx={{ mb: 1, color: colors.textMuted, fontWeight: 500 }}
        >
          复制以下指令发给你的 AI 代理
        </Typography>
        <Paper
          variant="outlined"
          sx={{
            p: 2.5,
            bgcolor: '#1E293B',
            color: colors.codeText,
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: '0.95rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderRadius: 2,
            borderColor: 'rgba(205, 214, 244, 0.12)',
          }}
        >
          <code>{naturalLang}</code>
          <IconButton
            size="small"
            onClick={() => copyToClipboard(naturalLang)}
            sx={{ color: colors.codeText, '&:hover': { color: colors.primary } }}
          >
            <ContentCopy sx={{ fontSize: 18 }} />
          </IconButton>
        </Paper>
      </Box>

      {/* ── 分隔线 ── */}
      <Typography
        sx={{
          textAlign: 'center',
          color: colors.textMuted,
          fontSize: '0.8rem',
          my: 2,
          letterSpacing: '0.05em',
        }}
      >
        ─── 或者 ───
      </Typography>

      {/* ── 终端命令（备选方式）── */}
      <Box sx={{ mb: 2 }}>
        <Typography
          variant="subtitle2"
          sx={{ mb: 1, color: colors.textMuted, fontWeight: 500 }}
        >
          在终端中运行
        </Typography>
        <Paper
          variant="outlined"
          sx={{
            p: 2,
            bgcolor: '#1E293B',
            color: colors.codeText,
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderRadius: 2,
            borderColor: 'rgba(205, 214, 244, 0.12)',
          }}
        >
          <code>{cliCommand}</code>
          <IconButton
            size="small"
            onClick={() => copyToClipboard(cliCommand)}
            sx={{ color: colors.codeText, '&:hover': { color: colors.primary } }}
          >
            <ContentCopy sx={{ fontSize: 18 }} />
          </IconButton>
        </Paper>
      </Box>

      {/* ── ZIP 下载 ── */}
      <Box sx={{ mb: 2 }}>
        <Button
          variant="outlined"
          startIcon={<Download />}
          onClick={handleDownload}
          fullWidth
          sx={{ borderRadius: 2, py: 1.2 }}
        >
          下载 {resource.name}.zip
        </Button>
      </Box>

      {/* ── 提示文字 ── */}
      <Typography
        variant="caption"
        sx={{ color: colors.textMuted, lineHeight: 1.6 }}
      >
        AI 代理会自动检测你当前使用的平台（WorkBuddy / Cursor / Claude Code），
        将资源安装到对应位置，无需手动选择平台。
      </Typography>

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={2000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" variant="filled" sx={{ bgcolor: colors.success }}>
          已复制到剪贴板
        </Alert>
      </Snackbar>
    </Box>
  );
}