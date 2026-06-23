/**
 * InstallGuide - 安装引导组件（JokerPS 亮色清新风格）
 *
 * 三种安装方式 Tab 切换：
 *   1. 🤖 AI 代理安装 — 复制完整提示词给 AI 助手执行
 *   2. 💻 终端命令 — skhub install 一键安装
 *   3. 📦 下载 — 下载 ZIP 手动安装
 *
 * AI 代理提示词包含完整的资源信息、前置条件、安装步骤、验证方法，
 * 任意 AI 助手复制粘贴即可执行安装。
 */

import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Skeleton from '@mui/material/Skeleton';
import SmartToy from '@mui/icons-material/SmartToy';
import Terminal from '@mui/icons-material/Terminal';
import Download from '@mui/icons-material/Download';
import ContentCopy from '@mui/icons-material/ContentCopy';
import ExpandMore from '@mui/icons-material/ExpandMore';
import ExpandLess from '@mui/icons-material/ExpandLess';
import apiClient from '../api/client';
import { colors } from '../theme';

// ─── Tab 面板 ─────────────────────────────────────────
function TabPanel({ children, value, index }) {
  if (value !== index) return null;
  return <Box sx={{ pt: 2 }}>{children}</Box>;
}

// ─── 代码块样式 ────────────────────────────────────────
const codeBlockSx = {
  p: 2,
  bgcolor: colors.codeBg,
  color: colors.codeText,
  fontFamily: '"JetBrains Mono", monospace',
  fontSize: '0.82rem',
  lineHeight: 1.7,
  borderRadius: 2,
  border: `1px solid ${colors.codeBorder}`,
  overflow: 'auto',
  maxHeight: 400,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
};

// ─── 复制按钮 ──────────────────────────────────────────
function CopyButton({ text, onCopy, sx }) {
  return (
    <IconButton
      size="small"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          // fallback: textarea 复制（非 HTTPS 环境）
          const ta = document.createElement('textarea');
          ta.value = text;
          ta.style.cssText = 'position:fixed;left:-9999px';
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
        }
        onCopy?.();
      }}
      sx={{
        color: colors.codeText,
        '&:hover': { color: colors.primary, bgcolor: 'rgba(255,255,255,0.08)' },
        ...sx,
      }}
    >
      <ContentCopy sx={{ fontSize: 18 }} />
    </IconButton>
  );
}

export default function InstallGuide({ resource }) {
  const [tabValue, setTabValue] = useState(0);
  const [promptData, setPromptData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMsg, setSnackbarMsg] = useState('已复制到剪贴板');

  // 请求安装提示词
  useEffect(() => {
    if (!resource?.id) return;
    let cancelled = false;
    setLoading(true);
    apiClient.get(`/resources/${resource.id}/install-prompt`)
      .then(res => {
        if (!cancelled) setPromptData(res.data);
      })
      .catch(() => {
        // API 失败时本地生成简化版提示词
        if (!cancelled) {
          setPromptData({
            prompt: buildFallbackPrompt(resource),
            packageUrl: `/api/resources/${resource.id}/download-zip`,
          });
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [resource?.id]);

  if (!resource) return null;

  // 仅负责显示 Snackbar 通知，clipboard 操作由 CopyButton 处理
  const showNotify = (msg) => {
    setSnackbarMsg(msg || '已复制到剪贴板');
    setSnackbarOpen(true);
  };

  const cliCommand = `skhub install ${resource.name}`;
  const isExpert = resource.type === 'expert';

  return (
    <Box>
      {/* ── Tab 头部 ── */}
      <Tabs
        value={tabValue}
        onChange={(_, v) => setTabValue(v)}
        variant="fullWidth"
        sx={{
          minHeight: 40,
          '& .MuiTab-root': {
            minHeight: 40,
            textTransform: 'none',
            fontSize: '0.8rem',
            fontWeight: 500,
            color: colors.textMuted,
            '&.Mui-selected': { color: colors.primary, fontWeight: 600 },
          },
          '& .MuiTabs-indicator': { bgcolor: colors.primary, height: 2 },
        }}
      >
        <Tab icon={<SmartToy sx={{ fontSize: 16 }} />} iconPosition="start" label="Agent 安装" />
        <Tab icon={<Terminal sx={{ fontSize: 16 }} />} iconPosition="start" label="终端安装" />
        <Tab icon={<Download sx={{ fontSize: 16 }} />} iconPosition="start" label="手动安装" />
      </Tabs>

      {/* ── Tab 0: AI 代理安装 ── */}
      <TabPanel value={tabValue} index={0}>
        {loading ? (
          <Box>
            <Skeleton variant="rectangular" height={80} sx={{ borderRadius: 2, mb: 1 }} />
            <Skeleton variant="rectangular" height={40} sx={{ borderRadius: 2 }} />
          </Box>
        ) : (
          <Box>
            {/* 根据展开状态切换显示内容：折叠=缩略版，展开=完整版 */}
            {(() => {
              const compactPrompt = `帮我安装 ${resource.display_name || resource.name}（${resource.type} v${resource.current_version}）\n\nPackageURL: ${promptData?.packageUrl || `/api/resources/${resource.id}/download-zip`}\n\n执行：skhub install ${resource.name}`;

              return (
                <Paper
                  variant="outlined"
                  sx={{
                    borderRadius: 2,
                    borderColor: colors.codeBorder,
                    overflow: 'hidden',
                  }}
                >
                  {/* 顶部栏：标题 + 复制按钮 */}
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      px: 2,
                      py: 1,
                      bgcolor: colors.codeHeaderBg,
                      borderBottom: `1px solid ${colors.codeBorder}`,
                    }}
                  >
                    <Typography variant="caption" sx={{ color: colors.codeSubtle, fontWeight: 500, fontSize: '0.7rem' }}>
                      {expanded ? '完整安装指引（Markdown）' : '📋 复制给 AI 代理即可安装'}
                    </Typography>
                    <CopyButton
                      text={expanded ? promptData?.prompt : compactPrompt}
                      onCopy={() => showNotify(expanded ? '已复制完整安装指引' : '已复制安装指引')}
                    />
                  </Box>

                  {/* 内容区：折叠显示缩略版，展开显示完整版 */}
                  <Box component="pre" sx={{ ...codeBlockSx, borderRadius: 0, border: 'none', m: 0 }}>
                    {expanded && promptData?.prompt ? promptData.prompt : compactPrompt}
                  </Box>

                  {/* 展开/折叠按钮 */}
                  <Box sx={{ display: 'flex', justifyContent: 'center', pb: 1 }}>
                    <Button
                      size="small"
                      onClick={() => setExpanded(!expanded)}
                      endIcon={expanded ? <ExpandLess sx={{ fontSize: 16 }} /> : <ExpandMore sx={{ fontSize: 16 }} />}
                      sx={{
                        color: colors.codeAccent,
                        fontSize: '0.75rem',
                        textTransform: 'none',
                        '&:hover': { bgcolor: colors.primaryMuted },
                      }}
                    >
                      {expanded ? '收起完整指引' : '展开完整指引'}
                    </Button>
                  </Box>
                </Paper>
              );
            })()}

            {/* 底部提示 */}
            <Typography
              variant="caption"
              sx={{ color: colors.textMuted, mt: 1.5, display: 'block', lineHeight: 1.5, fontSize: '0.7rem' }}
            >
              AI 代理会自动检测你当前使用的平台（Claude Code / Cursor / WorkBuddy / Codex），
              将资源安装到对应位置，无需手动选择平台。
            </Typography>
          </Box>
        )}
      </TabPanel>

      {/* ── Tab 1: 终端命令 ── */}
      <TabPanel value={tabValue} index={1}>
        <Typography variant="subtitle2" sx={{ mb: 1, color: colors.textMuted, fontWeight: 500, fontSize: '0.8rem' }}>
          在终端中运行
        </Typography>
        <Paper
          variant="outlined"
          sx={{
            p: 2,
            bgcolor: colors.codeBg,
            color: colors.codeText,
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: '0.88rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderRadius: 2,
            borderColor: colors.codeBorder,
          }}
        >
          <code>{cliCommand}</code>
          <CopyButton text={cliCommand} onCopy={() => showNotify('已复制命令')} sx={{ color: colors.codeText }} />
        </Paper>

        {/* CLI 选项说明 */}
        <Box sx={{ mt: 1.5 }}>
          <Typography variant="caption" sx={{ color: colors.textMuted, lineHeight: 1.8, display: 'block' }}>
            可用选项：
          </Typography>
          <Typography
            component="code"
            variant="caption"
            sx={{
              color: colors.textSecondary,
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: '0.72rem',
              display: 'block',
              mt: 0.3,
            }}
          >
            -p &lt;platform&gt; 指定平台（claude-code / cursor / workbuddy）
          </Typography>
          <Typography
            component="code"
            variant="caption"
            sx={{
              color: colors.textSecondary,
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: '0.72rem',
              display: 'block',
              mt: 0.2,
            }}
          >
            -y 跳过确认提示
          </Typography>
        </Box>

        {/* 未安装 CLI 提示 */}
        <Paper
          variant="outlined"
          sx={{
            mt: 2,
            p: 1.5,
            bgcolor: colors.codeWarningBg,
            borderColor: colors.codeWarningBorder,
            borderRadius: 2,
          }}
        >
          <Typography variant="caption" sx={{ color: colors.codeWarning, fontWeight: 500, fontSize: '0.72rem' }}>
            ⚠ 未安装 CLI？
          </Typography>
          <Typography
            component="code"
            variant="caption"
            sx={{
              display: 'block',
              mt: 0.5,
              color: colors.textSecondary,
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: '0.72rem',
            }}
          >
            cd cli && npm link
          </Typography>
        </Paper>
      </TabPanel>

      {/* ── Tab 2: 下载 ── */}
      <TabPanel value={tabValue} index={2}>
        <Button
          variant="contained"
          startIcon={<Download />}
          onClick={() => {
            const link = document.createElement('a');
            link.href = `/api/resources/${resource.id}/download-zip`;
            link.download = `${resource.name}-v${resource.current_version}.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          }}
          fullWidth
          sx={{
            borderRadius: 2,
            py: 1.5,
            textTransform: 'none',
            fontSize: '0.9rem',
          }}
        >
          下载 {resource.name}-v{resource.current_version}.zip
        </Button>

        {/* 手动安装路径说明（优先用 API 返回数据，fallback 到本地映射） */}
        <Typography variant="caption" sx={{ color: colors.textMuted, mt: 2, display: 'block', fontWeight: 500, fontSize: '0.72rem' }}>
          手动安装路径：
        </Typography>
        <Box sx={{ mt: 0.5 }}>
          {(promptData?.platformPaths || [
            { platform: 'Claude Code', path: isExpert ? '~/.claude/agents/' + resource.name + '/' : '~/.claude/commands/' + resource.name + '.md' },
            { platform: 'Cursor', path: isExpert ? '~/.cursor/prompts/' + resource.name + '/' : '~/.cursor/rules/' + resource.name + '.mdc' },
            { platform: 'WorkBuddy', path: `~/.workbuddy/${resource.type}/${resource.name}/` },
            { platform: 'Codex', path: isExpert ? '~/.codex/agents/' + resource.name + '/' : '~/.codex/commands/' + resource.name + '.md' },
          ]).map(item => (
            <Typography
              key={item.platform}
              variant="caption"
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                py: 0.4,
                color: colors.textSecondary,
                borderBottom: `1px solid ${colors.border}`,
                fontSize: '0.7rem',
                '&:last-child': { borderBottom: 'none' },
              }}
            >
              <span>{item.platform}</span>
              <code style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.68rem', color: colors.textMuted }}>
                {item.path}
              </code>
            </Typography>
          ))}
        </Box>
      </TabPanel>

      {/* ── Snackbar ── */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={2000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" variant="filled" sx={{ bgcolor: colors.success }}>
          {snackbarMsg}
        </Alert>
      </Snackbar>
    </Box>
  );
}

// ─── 本地 fallback 提示词生成（API 不可用时） ──────────
function buildFallbackPrompt(resource) {
  const name = resource.name;
  const displayName = resource.display_name || name;
  const type = resource.type || 'skill';
  const version = resource.current_version || '1.0.0';
  const author = resource.author_display_name || resource.author_name || '未知';
  const description = resource.description || '无';
  const typeLabel = type === 'expert' ? '专家 (Expert)' : '技能 (Skill)';

  return `# 安装 ${displayName}

## 资源信息
- **名称**: ${name}
- **类型**: ${typeLabel}
- **版本**: ${version}
- **作者**: ${author}
- **描述**: ${description}

## 前置条件
\`\`\`bash
skhub --version
\`\`\`
若未安装：cd cli && npm link

## 安装
\`\`\`bash
skhub install ${name}
\`\`\`

## 验证
\`\`\`bash
skhub list
\`\`\``;
}
