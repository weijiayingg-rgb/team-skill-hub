/**
 * SyncPanel - 智能同步交互面板
 *
 * 实现 扫描 → 勾选 → 服务端一键推送 → 展示结果。
 *
 * 状态机：
 *   idle      → 初始状态，未创建 session
 *   scanning  → 一键自动扫描进行中
 *   scanned   → scan 结果已就绪，用户可勾选
 *   executing → 服务端正在执行推送
 *   done      → 推送完成，展示结果
 *   waiting   → fallback
 *   failed    → 出错
 */

import { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Divider from '@mui/material/Divider';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SyncIcon from '@mui/icons-material/Sync';
import NewReleasesIcon from '@mui/icons-material/NewReleases';
import UpdateIcon from '@mui/icons-material/Update';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import SearchIcon from '@mui/icons-material/Search';
import apiClient from '../api/client';
import { colors } from '../theme';
import TypeBadge from './TypeBadge';

// 状态常量
const SYNC_STATES = {
  idle: 'idle',
  scanning: 'scanning',
  waiting: 'waiting',
  scanned: 'scanned',
  executing: 'executing',
  done: 'done',
  failed: 'failed',
};

// 辅助：安全解析 scan_result JSON
function parseScanResult(raw) {
  if (!raw) return { items: [], summary: {} };
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : { items: [], summary: {} };
  } catch {
    return { items: [], summary: {} };
  }
}

// 辅助：从扫描结果初始化 selections（所有项默认不选）
function buildSelections(items) {
  const sels = {};
  for (const item of items || []) {
    sels[item.id] = false;
  }
  return sels;
}

// 状态图标和颜色映射
const STATUS_CONFIG = {
  new:     { icon: NewReleasesIcon, label: '新增', color: colors.success, bgColor: 'rgba(16,185,129,0.08)' },
  updated: { icon: UpdateIcon,      label: '有更新', color: colors.warning, bgColor: 'rgba(255,165,0,0.08)' },
  synced:  { icon: CheckCircleIcon,  label: '已同步', color: colors.textMuted, bgColor: 'rgba(0,0,0,0.03)' },
};

export default function SyncPanel({ initialSessionId }) {
  const [syncState, setSyncState] = useState(initialSessionId ? SYNC_STATES.waiting : SYNC_STATES.idle);
  const [sessionId, setSessionId] = useState(initialSessionId || null);
  const [scanResult, setScanResult] = useState(null);
  const [selections, setSelections] = useState({});  // { itemId: boolean }
  const [selectAll, setSelectAll] = useState(false);  // 全选开关
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [pushResult, setPushResult] = useState(null);
  const [searchText, setSearchText] = useState(''); // 搜索过滤

  // 一键扫描：创建 session → 自动调用 auto-scan API → 设置 scanning → 扫描完成后进入 scanned
  const handleCreateSession = async () => {
    try {
      setError('');
      // 创建 session
      const res = await apiClient.post('/sync-sessions');
      const session = res.data;
      setSessionId(session.id);

      // 立即触发 auto-scan
      setSyncState(SYNC_STATES.scanning);
      const scanRes = await apiClient.post(`/sync-sessions/${session.id}/auto-scan`);
      const scanData = parseScanResult(scanRes.data.scan_result);
      setScanResult(scanData);
      setSyncState(SYNC_STATES.scanned);

      setSelections(buildSelections(scanData.items));
      setSelectAll(false);
    } catch (err) {
      // 409 Conflict: 已有活跃 session → 复用
      if (err.status === 409 && err.errorData?.data?.session_id) {
        const existingId = err.errorData.data.session_id;
        setSessionId(existingId);

        // 先获取已有 session 的状态，决定下一步
        try {
          const existingRes = await apiClient.get(`/sync-sessions/${existingId}`);
          const existingSession = existingRes.data;

          if ((existingSession.status === 'scanned' || existingSession.status === 'planned') && existingSession.scan_result) {
            // 已扫描完成 → 直接使用结果
            const scanData = parseScanResult(existingSession.scan_result);
            setScanResult(scanData);
            setSyncState(SYNC_STATES.scanned);
            setSelections(buildSelections(scanData.items));
            setSelectAll(false);
          } else if (existingSession.status === 'waiting') {
            // 等待中 → 触发 auto-scan
            setSyncState(SYNC_STATES.scanning);
            try {
              const scanRes = await apiClient.post(`/sync-sessions/${existingId}/auto-scan`);
              const scanData = parseScanResult(scanRes.data.scan_result);
              setScanResult(scanData);
              setSyncState(SYNC_STATES.scanned);
              setSelections(buildSelections(scanData.items));
              setSelectAll(false);
            } catch (scanErr) {
              setError(scanErr.message || '自动扫描失败');
              setSyncState(SYNC_STATES.failed);
            }
          } else {
            // 其他状态 → 回到 idle
            setSyncState(SYNC_STATES.idle);
          }
        } catch (fetchErr) {
          setError(fetchErr.message || '获取会话状态失败');
          setSyncState(SYNC_STATES.failed);
        }
      } else {
        setError(err.message || '创建同步会话失败');
      }
    }
  };

  // 重新扫描
  const handleRescan = async () => {
    if (!sessionId) return;
    setSyncState(SYNC_STATES.scanning);
    setPushResult(null);  // 清除上次推送结果，让上传按钮重新显示
    setSelections({});    // 立即清空勾选，不等 API 返回
    setSelectAll(false);
    try {
      const scanRes = await apiClient.post(`/sync-sessions/${sessionId}/auto-scan`);
      const scanData = parseScanResult(scanRes.data.scan_result);
      setScanResult(scanData);
      setSyncState(SYNC_STATES.scanned);
      setSelections(buildSelections(scanData.items));
    } catch (err) {
      setError(err.message || '重新扫描失败');
      setSyncState(SYNC_STATES.scanned);
    }
  };

  // 全选/全不选切换
  // 全选/全不选：基于实际选中状态判断，而非简单 toggle
  const handleToggleSelectAll = () => {
    if (!scanResult) return;

    const selectableItems = (scanResult.items || []).filter(i => i.status !== 'synced');
    const allSelected = selectableItems.length > 0 && selectableItems.every(i => selections[i.id]);
    const newValue = !allSelected;

    setSelectAll(newValue);
    const newSelections = { ...selections };
    for (const item of selectableItems) {
      newSelections[item.id] = newValue;
    }
    setSelections(newSelections);
  };

  // 一键上传：直接调用服务端 execute API，服务端读取本地文件并完成推送
  const handleUpload = async () => {
    if (!sessionId || !scanResult) return;
    setUploading(true);
    setError('');
    setSyncState(SYNC_STATES.executing);
    try {
      // 构建 push_plan：将选中的 items 信息传给服务器
      const selectedItems = (scanResult.items || []).filter(
        item => selections[item.id] && item.status !== 'synced'
      );
      const pushPlan = {
        items: selectedItems.map(item => ({
          id: item.id,
          name: item.name,
          displayName: item.displayName,
          platform: item.platform,
          type: item.type,
          status: item.status,
          fileCount: item.fileCount,
          remoteId: item.remoteId,
          remoteVersion: item.remoteVersion,
          description: item.description || '',
        })),
        totalCount: selectedItems.length,
      };

      const res = await apiClient.post(`/sync-sessions/${sessionId}/execute`, { push_plan: pushPlan });
      setPushResult(res.data);
      setSyncState(SYNC_STATES.done);
    } catch (err) {
      setError(err.message || '推送失败');
      setSyncState(SYNC_STATES.scanned);
    } finally {
      setUploading(false);
    }
  };

  // 切换选中状态
  const handleToggleSelection = (itemId) => {
    setSelections(prev => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  // 重新开始
  const handleReset = () => {
    setSyncState(SYNC_STATES.idle);
    setSessionId(null);
    setScanResult(null);
    setSelections({});
    setSelectAll(false);
    setError('');
    setUploading(false);
    setPushResult(null);
  };

  // ──── 渲染各状态 UI ────

  // idle: 初始状态，创建 session 按钮
  if (syncState === SYNC_STATES.idle) {
    return (
      <Paper
        elevation={0}
        sx={{ p: 4, textAlign: 'center', bgcolor: colors.bgWhite, border: `1px solid ${colors.border}`, borderRadius: 2 }}
      >
        <SyncIcon sx={{ fontSize: 48, color: colors.primary, mb: 2 }} />
        <Typography variant="h6" sx={{ fontWeight: 700, fontFamily: '"Play", sans-serif', color: colors.textPrimary, mb: 1 }}>
          智能同步本地 Skill
        </Typography>
        <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 3, maxWidth: 480, mx: 'auto' }}>
          一键扫描本地的 Skill 和 Expert，
          自动识别新增、更新、已同步状态。
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 3, maxWidth: 360, mx: 'auto' }}>
          {['扫描本地 AI 配置', '查看扫描结果', '一键上传选中的资源'].map((step, i) => (
            <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chip label={i + 1} size="small" sx={{ bgcolor: colors.primaryMuted, color: colors.primary, fontWeight: 700, minWidth: 28 }} />
              <Typography variant="body2" sx={{ color: colors.textSecondary }}>{step}</Typography>
            </Box>
          ))}
        </Box>

        <Button
          variant="contained"
          size="large"
          startIcon={<SyncIcon />}
          onClick={handleCreateSession}
          sx={{
            bgcolor: colors.primary,
            fontWeight: 600,
            fontSize: '0.95rem',
            borderRadius: 2,
            px: 4,
            '&:hover': { bgcolor: '#1565C0' },
          }}
        >
          开始扫描
        </Button>

        {/* 扫描规则说明 */}
        <Accordion
          defaultExpanded
          sx={{ mt: 3, textAlign: 'left', border: `1px solid ${colors.border}`, '&:before': { display: 'none' } }}
          disableGutters
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 40, '& .MuiAccordionSummary-content': { my: 1 } }}>
            <Typography variant="body2" sx={{ fontWeight: 600, color: colors.textSecondary }}>
              📋 扫描规则说明
            </Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0 }}>
            <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 2, fontWeight: 500 }}>
              自动扫描以下目录中的 Skill 和 Expert：
            </Typography>

            {/* 扫描路径表 */}
            <Box sx={{ mb: 2 }}>
              {[
                { platform: 'Claude Code', skill: '~/.claude/commands/*.md', expert: '~/.claude/agents/*.md' },
                { platform: 'Claude Code (cc-switch)', skill: '~/.claude/skills/*/index.md', expert: '—' },
                { platform: 'Cursor', skill: '~/.cursor/rules/*.md', expert: '~/.cursor/prompts/*.md' },
                { platform: 'WorkBuddy', skill: '~/.workbuddy/skills/', expert: '~/.workbuddy/experts/' },
                { platform: 'Codex', skill: '~/.codex/commands/*.md', expert: '~/.codex/agents/*.md' },
              ].map(row => (
                <Box key={row.platform} sx={{
                  display: 'flex', py: 0.6, borderBottom: `1px solid ${colors.border}`,
                  '&:last-child': { borderBottom: 'none' },
                }}>
                  <Typography variant="caption" sx={{ width: 160, color: colors.textPrimary, fontWeight: 500 }}>
                    {row.platform}
                  </Typography>
                  <Typography variant="caption" sx={{
                    flex: 1, fontFamily: '"JetBrains Mono", monospace', fontSize: '0.68rem', color: colors.textMuted,
                  }}>
                    {row.skill}
                  </Typography>
                  <Typography variant="caption" sx={{
                    flex: 1, fontFamily: '"JetBrains Mono", monospace', fontSize: '0.68rem', color: colors.textMuted,
                  }}>
                    {row.expert}
                  </Typography>
                </Box>
              ))}
              <Box sx={{ display: 'flex', pt: 0.5 }}>
                <Typography variant="caption" sx={{ width: 160 }} />
                <Typography variant="caption" sx={{ flex: 1, color: colors.textMuted, fontSize: '0.65rem' }}>Skill 路径</Typography>
                <Typography variant="caption" sx={{ flex: 1, color: colors.textMuted, fontSize: '0.65rem' }}>Expert 路径</Typography>
              </Box>
            </Box>

            {/* Expert 打包规则 */}
            <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 1, fontWeight: 500 }}>
              Expert 智能打包规则：
            </Typography>
            <Typography variant="caption" sx={{ display: 'block', color: colors.textMuted, mb: 0.5, lineHeight: 1.6 }}>
              ① 从 frontmatter <code style={{ fontFamily: 'monospace', bgcolor: 'rgba(0,0,0,0.04)', px: 0.5 }}>skills: [name1, name2]</code> 读取显式声明（优先）
            </Typography>
            <Typography variant="caption" sx={{ display: 'block', color: colors.textMuted, mb: 0.5, lineHeight: 1.6 }}>
              ② 兜底：正则匹配正文中的 <code style={{ fontFamily: 'monospace', bgcolor: 'rgba(0,0,0,0.04)', px: 0.5 }}>`/skill-name`</code> 引用
            </Typography>
            <Typography variant="caption" sx={{ display: 'block', color: colors.textMuted, mb: 1.5, lineHeight: 1.6 }}>
              ③ 在上述目录中搜索对应 Skill 文件，打包为 ZIP（prompt.md + skills/*.md + expert.yaml）
            </Typography>

            {/* 手动备选 */}
            <Box sx={{
              p: 1.5, bgcolor: 'rgba(255,102,0,0.04)', border: '1px solid rgba(255,102,0,0.15)', borderRadius: 1,
            }}>
              <Typography variant="caption" sx={{ color: colors.warning, fontWeight: 600, display: 'block', mb: 0.5 }}>
                ⚠ 扫描不到你的资源？
              </Typography>
              <Typography variant="caption" sx={{ color: colors.textSecondary, lineHeight: 1.6 }}>
                切换到「手动上传」模式，支持上传单个 .md 文件或 Expert ZIP 包。
                也可以在 Expert 的 frontmatter 中添加 <code style={{ fontFamily: 'monospace', bgcolor: 'rgba(0,0,0,0.04)', px: 0.5 }}>skills: [skill-name]</code> 字段显式声明引用。
              </Typography>
            </Box>
          </AccordionDetails>
        </Accordion>

        {error && <Alert sx={{ mt: 2 }}>{error}</Alert>}
      </Paper>
    );
  }

  // scanning: 一键扫描进行中
  if (syncState === SYNC_STATES.scanning) {
    return (
      <Paper
        elevation={0}
        sx={{ p: 4, textAlign: 'center', bgcolor: colors.bgWhite, border: `1px solid ${colors.border}`, borderRadius: 2 }}
      >
        <CircularProgress size={48} sx={{ color: colors.primary, mb: 2 }} />
        <Typography variant="h6" sx={{ fontWeight: 700, fontFamily: '"Play", sans-serif', color: colors.textPrimary, mb: 1 }}>
          正在扫描本地 AI 配置...
        </Typography>
        <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 2 }}>
          自动扫描 Claude Code / Cursor / Codex / WorkBuddy 的本地 Skill 和 Expert
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mt: 2 }}>
          {['扫描 ~/.claude/', '扫描 ~/.cursor/', '扫描 ~/.codex/', '扫描 ~/.workbuddy/', '比对远端指纹'].map((step, i) => (
            <Typography key={i} variant="body2" sx={{ color: colors.textMuted, fontSize: '0.85rem' }}>
              {step}
            </Typography>
          ))}
        </Box>
      </Paper>
    );
  }

  // waiting: 备用等待状态（不再展示 CLI 命令）
  if (syncState === SYNC_STATES.waiting) {
    return (
      <Paper
        elevation={0}
        sx={{ p: 4, textAlign: 'center', bgcolor: colors.bgWhite, border: `1px solid ${colors.border}`, borderRadius: 2 }}
      >
        <CircularProgress size={40} sx={{ color: colors.primary, mb: 2 }} />
        <Typography variant="h6" sx={{ fontWeight: 700, fontFamily: '"Play", sans-serif', color: colors.textPrimary, mb: 1 }}>
          正在处理...
        </Typography>
        <Typography variant="body2" sx={{ color: colors.textSecondary }}>
          请稍候
        </Typography>
      </Paper>
    );
  }

  // scanned / executing / done: scan 结果展示 + 交互勾选 + 推送/结果
  if ((syncState === SYNC_STATES.scanned || syncState === SYNC_STATES.executing || syncState === SYNC_STATES.done) && scanResult) {
    const items = scanResult.items || [];
    const summary = scanResult.summary || {};

    // 搜索过滤：按名称匹配
    const filterBySearch = (itemList) => {
      if (!searchText.trim()) return itemList;
      const q = searchText.trim().toLowerCase();
      return itemList.filter(i =>
        (i.displayName || i.name || '').toLowerCase().includes(q) ||
        (i.platform || '').toLowerCase().includes(q) ||
        (i.type || '').toLowerCase().includes(q)
      );
    };

    const newItems = filterBySearch(items.filter(i => i.status === 'new'));
    const updatedItems = filterBySearch(items.filter(i => i.status === 'updated'));
    const syncedItems = filterBySearch(items.filter(i => i.status === 'synced'));

    // 类型分布统计（跟随搜索过滤）
    const filteredItems = filterBySearch(items);
    const skillCount = filteredItems.filter(i => i.type === 'skill').length;
    const expertCount = filteredItems.filter(i => i.type === 'expert').length;

    // 计算可勾选的 item 数量
    const selectableCount = newItems.length + updatedItems.length;
    // 计算已选中的 item 数量
    const selectedCount = Object.entries(selections).filter(([_, v]) => v).length;

    return (
      <Paper elevation={0} sx={{ p: 3, bgcolor: colors.bgWhite, border: `1px solid ${colors.border}`, borderRadius: 2 }}>
        {/* 扫描结果标题 */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <CheckCircleIcon sx={{ color: colors.success }} />
          <Typography variant="h6" sx={{ fontWeight: 700, fontFamily: '"Play", sans-serif' }}>
            扫描完成
          </Typography>
        </Box>

        {/* 汇总统计（显示过滤后的数量） */}
        <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
          <Chip icon={<NewReleasesIcon />} label={`${newItems.length} 新增`} size="small" sx={{ bgcolor: 'rgba(16,185,129,0.08)', color: colors.success, fontWeight: 600 }} />
          <Chip icon={<UpdateIcon />} label={`${updatedItems.length} 有更新`} size="small" sx={{ bgcolor: 'rgba(255,165,0,0.08)', color: colors.warning, fontWeight: 600 }} />
          <Chip icon={<CheckCircleIcon />} label={`${syncedItems.length} 已同步`} size="small" sx={{ bgcolor: 'rgba(0,0,0,0.03)', color: colors.textMuted }} />
          {skillCount > 0 && (
            <Chip label={`🔧 技能 ${skillCount}`} size="small" sx={{ bgcolor: 'rgba(28,134,226,0.06)', color: '#1675CC', fontWeight: 600 }} />
          )}
          {expertCount > 0 && (
            <Chip label={`🧠 专家 ${expertCount}`} size="small" sx={{ bgcolor: 'rgba(255,102,0,0.06)', color: '#E65C00', fontWeight: 600 }} />
          )}
          {searchText.trim() && (
            <Chip label={`搜索: "${searchText.trim()}"`} size="small" onDelete={() => setSearchText('')} sx={{ bgcolor: 'rgba(28,134,226,0.06)', color: colors.primary }} />
          )}
        </Box>

        {/* 搜索过滤 */}
        <TextField
          size="small"
          placeholder="搜索扫描结果（名称/平台/类型）..."
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: colors.textMuted, fontSize: 18 }} />
              </InputAdornment>
            ),
          }}
          sx={{
            mb: 2,
            '& .MuiInputBase-root': {
              fontSize: '0.85rem',
              bgcolor: colors.bgWhite,
            },
          }}
          fullWidth
        />

        {/* 全选/全不选开关 */}
        {selectableCount > 0 && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Checkbox
              checked={selectAll}
              onChange={handleToggleSelectAll}
              sx={{
                color: colors.primary,
                '&.Mui-checked': { color: colors.primary },
              }}
            />
            <Typography variant="body2" sx={{ color: colors.textSecondary }}>
              {selectAll ? '全不选' : '全选'}
            </Typography>
            <Typography variant="caption" sx={{ color: colors.textMuted, ml: 'auto' }}>
              （已同步资源无法勾选）
            </Typography>
          </Box>
        )}

        {/* 新增资源 - 默认展开 */}
        <Accordion
          defaultExpanded={newItems.length > 0}
          sx={{
            mb: 1,
            boxShadow: 'none',
            border: `1px solid ${colors.border}`,
            borderRadius: 1,
            '&:before': { display: 'none' },
          }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            sx={{
              bgcolor: 'rgba(16,185,129,0.05)',
              borderRadius: 1,
              '&.Mui-expanded': { minHeight: 48 },
              '& .MuiAccordionSummary-content': { my: 1.5 },
            }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: colors.success, flex: 1 }}>
              🆕 新增（未上传）
            </Typography>
            <Chip label={newItems.length} size="small" sx={{ ml: 2, bgcolor: 'rgba(16,185,129,0.08)', color: colors.success, fontWeight: 600 }} />
          </AccordionSummary>
          <AccordionDetails sx={{ p: 1 }}>
            {newItems.map(item => {
              const cfg = STATUS_CONFIG[item.status];
              return (
                <Box
                  key={item.id}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    p: 1.5,
                    borderRadius: 1,
                    mb: 0.5,
                    bgcolor: cfg.bgColor,
                    border: `1px solid ${cfg.color}20`,
                  }}
                >
                  <Checkbox
                    checked={selections[item.id] ?? false}
                    onChange={() => handleToggleSelection(item.id)}
                    sx={{ color: cfg.color, '&.Mui-checked': { color: cfg.color } }}
                  />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: colors.textPrimary }} noWrap>
                      {item.displayName || item.name}
                    </Typography>
                    <Box sx={{ color: colors.textMuted, fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                      [{item.platform}] · <TypeBadge type={item.type} size="small" /> · {item.fileCount || 0} 个文件
                      {item.bundledIn && (
                        <span style={{ color: colors.warning, marginLeft: 4 }}>
                          · 属于「{item.bundledIn.displayName}」
                        </span>
                      )}
                    </Box>
                    {item.description && (
                      <Typography variant="caption" sx={{ color: colors.textSecondary, fontSize: '0.78rem', mt: 0.5, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                        {item.description.length > 80 ? item.description.slice(0, 80) + '...' : item.description}
                      </Typography>
                    )}
                  </Box>
                  <Chip label={item.status === 'new' ? '新增' : item.status === 'updated' ? '更新' : '已同步'} size="small" sx={{ bgcolor: cfg.bgColor, color: cfg.color, fontWeight: 600 }} />
                </Box>
              );
            })}
          </AccordionDetails>
        </Accordion>

        {/* 有更新的资源 - 默认展开 */}
        <Accordion
          defaultExpanded={updatedItems.length > 0}
          sx={{
            mb: 1,
            boxShadow: 'none',
            border: `1px solid ${colors.border}`,
            borderRadius: 1,
            '&:before': { display: 'none' },
          }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            sx={{
              bgcolor: 'rgba(255,165,0,0.05)',
              borderRadius: 1,
              '&.Mui-expanded': { minHeight: 48 },
              '& .MuiAccordionSummary-content': { my: 1.5 },
            }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: colors.warning, flex: 1 }}>
              🔄 有更新（本地已修改）
            </Typography>
            <Chip label={updatedItems.length} size="small" sx={{ ml: 2, bgcolor: 'rgba(255,165,0,0.08)', color: colors.warning, fontWeight: 600 }} />
          </AccordionSummary>
          <AccordionDetails sx={{ p: 1 }}>
            {updatedItems.map(item => {
              const cfg = STATUS_CONFIG[item.status];
              return (
                <Box
                  key={item.id}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    p: 1.5,
                    borderRadius: 1,
                    mb: 0.5,
                    bgcolor: cfg.bgColor,
                    border: `1px solid ${cfg.color}20`,
                  }}
                >
                  <Checkbox
                    checked={selections[item.id] ?? false}
                    onChange={() => handleToggleSelection(item.id)}
                    sx={{ color: cfg.color, '&.Mui-checked': { color: cfg.color } }}
                  />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: colors.textPrimary }} noWrap>
                      {item.displayName || item.name}
                    </Typography>
                    <Box sx={{ color: colors.textMuted, fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                      [{item.platform}] · <TypeBadge type={item.type} size="small" /> · 远端版本 v{item.remoteVersion || '?'}
                      {item.bundledIn && (
                        <span style={{ color: colors.warning, marginLeft: 4 }}>
                          · 属于「{item.bundledIn.displayName}」
                        </span>
                      )}
                    </Box>
                    {item.description && (
                      <Typography variant="caption" sx={{ color: colors.textSecondary, fontSize: '0.78rem', mt: 0.5, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                        {item.description.length > 80 ? item.description.slice(0, 80) + '...' : item.description}
                      </Typography>
                    )}
                  </Box>
                  <Chip label={item.status === 'new' ? '新增' : item.status === 'updated' ? '更新' : '已同步'} size="small" sx={{ bgcolor: cfg.bgColor, color: cfg.color, fontWeight: 600 }} />
                </Box>
              );
            })}
          </AccordionDetails>
        </Accordion>

        {/* 已同步的资源 - 默认折叠 */}
        <Accordion
          defaultExpanded={false}
          sx={{
            boxShadow: 'none',
            border: `1px solid ${colors.border}`,
            borderRadius: 1,
            '&:before': { display: 'none' },
          }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            sx={{
              bgcolor: 'rgba(0,0,0,0.02)',
              borderRadius: 1,
              '&.Mui-expanded': { minHeight: 48 },
              '& .MuiAccordionSummary-content': { my: 1.5 },
            }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: colors.textMuted, flex: 1 }}>
              ✅ 已同步（无需操作）
            </Typography>
            <Chip label={syncedItems.length} size="small" sx={{ ml: 2, bgcolor: 'rgba(0,0,0,0.03)', color: colors.textMuted }} />
          </AccordionSummary>
          <AccordionDetails sx={{ p: 1 }}>
            {syncedItems.map(item => (
              <Box
                key={item.id}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  p: 1.5,
                  borderRadius: 1,
                  mb: 0.5,
                  bgcolor: 'rgba(0,0,0,0.02)',
                  opacity: 0.7,
                }}
              >
                <CheckCircleIcon sx={{ fontSize: 18, color: colors.textMuted }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" sx={{ color: colors.textSecondary }} noWrap>
                    {item.displayName || item.name}
                  </Typography>
                  <Box sx={{ color: colors.textMuted, fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                    [{item.platform}] · <TypeBadge type={item.type} size="small" /> · v{item.remoteVersion || '?'}
                    {item.bundledIn && (
                      <span style={{ color: colors.warning, marginLeft: 4 }}>
                        · 属于「{item.bundledIn.displayName}」
                      </span>
                    )}
                  </Box>
                  {item.description && (
                    <Typography variant="caption" sx={{ color: colors.textSecondary, fontSize: '0.78rem', mt: 0.5, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                      {item.description.length > 80 ? item.description.slice(0, 80) + '...' : item.description}
                    </Typography>
                  )}
                </Box>
                <Chip label={item.status === 'new' ? '新增' : item.status === 'updated' ? '更新' : '已同步'} size="small" sx={{ bgcolor: 'rgba(0,0,0,0.03)', color: colors.textMuted }} />
              </Box>
            ))}
          </AccordionDetails>
        </Accordion>

        <Divider sx={{ my: 2, borderColor: colors.border }} />

        {/* 一键上传按钮（推送未开始时显示） */}
        {!pushResult && syncState !== SYNC_STATES.executing && (
          <Box sx={{ textAlign: 'center', mb: 2 }}>
            {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 1 }}>{error}</Alert>}
            {selectedCount === 0 ? (
              <Typography variant="body2" sx={{ color: colors.textMuted, mb: 2 }}>
                请先勾选要上传的资源
              </Typography>
            ) : (
              <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 2 }}>
                已选择 <strong style={{ color: colors.primary }}>{selectedCount}</strong> 个资源准备上传
              </Typography>
            )}
            <Button
              variant="contained"
              size="large"
              startIcon={uploading ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : <CloudUploadIcon />}
              onClick={handleUpload}
              disabled={selectedCount === 0 || uploading}
              sx={{
                bgcolor: colors.primary,
                fontWeight: 700,
                fontSize: '1rem',
                borderRadius: 2,
                px: 5,
                py: 1.5,
                boxShadow: '0 4px 14px rgba(25,118,210,0.3)',
                '&:hover': { bgcolor: '#1565C0', boxShadow: '0 6px 20px rgba(25,118,210,0.4)' },
                '&.Mui-disabled': { bgcolor: 'rgba(0,0,0,0.08)', color: colors.textMuted },
              }}
            >
              {uploading ? '推送中...' : '一键上传'}
            </Button>
          </Box>
        )}

        {/* 推送执行中 */}
        {syncState === SYNC_STATES.executing && (
          <Box sx={{ textAlign: 'center', py: 3, mb: 2 }}>
            <CircularProgress size={40} sx={{ color: colors.primary, mb: 2 }} />
            <Typography variant="h6" sx={{ fontWeight: 700, fontFamily: '"Play", sans-serif', color: colors.textPrimary, mb: 1 }}>
              正在推送资源...
            </Typography>
            <Typography variant="body2" sx={{ color: colors.textSecondary }}>
              服务端正在读取本地文件并上传，请稍候
            </Typography>
          </Box>
        )}

        {/* 推送完成结果 */}
        {syncState === SYNC_STATES.done && pushResult && (
          <Box sx={{ mb: 2 }}>
            <Alert
              severity={pushResult.summary?.fail === 0 ? 'success' : 'warning'}
              icon={<CheckCircleIcon />}
              sx={{ mb: 2, borderRadius: 1, fontWeight: 600 }}
            >
              推送完成：成功 {pushResult.summary?.success || 0} 个
              {pushResult.summary?.fail > 0 && `，失败 ${pushResult.summary.fail} 个`}
            </Alert>

            {/* 逐项结果 */}
            {pushResult.items && pushResult.items.length > 0 && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {pushResult.items.map((item, idx) => (
                  <Box
                    key={idx}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      p: 1.5,
                      borderRadius: 1,
                      bgcolor: item.success ? 'rgba(16,185,129,0.05)' : 'rgba(255,0,0,0.04)',
                      border: `1px solid ${item.success ? 'rgba(16,185,129,0.2)' : 'rgba(255,0,0,0.15)'}`,
                    }}
                  >
                    {item.success
                      ? <CheckCircleIcon sx={{ fontSize: 20, color: colors.success }} />
                      : <NewReleasesIcon sx={{ fontSize: 20, color: colors.danger }} />
                    }
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: colors.textPrimary }} noWrap>
                        {item.displayName || item.name}
                      </Typography>
                      {item.success ? (
                        <Box>
                          <Typography variant="caption" sx={{ color: colors.textMuted }}>
                            {item.action}{item.version ? ` → v${item.version}` : ''}
                          </Typography>
                          {/* Expert Skill 打包反馈 */}
                          {item.bundledSkills?.length > 0 && (
                            <Typography variant="caption" sx={{ display: 'block', color: colors.success, fontSize: '0.7rem' }}>
                              ✅ 已打包 {item.bundledSkills.length} 个 Skill: {item.bundledSkills.join(', ')}
                            </Typography>
                          )}
                          {item.unbundledSkills?.length > 0 && (
                            <Typography variant="caption" sx={{ display: 'block', color: colors.warning, fontSize: '0.7rem' }}>
                              ⚠ 未找到 {item.unbundledSkills.length} 个 Skill: {item.unbundledSkills.join(', ')}
                            </Typography>
                          )}
                        </Box>
                      ) : (
                        <Typography variant="caption" sx={{ color: colors.danger }}>
                          {item.error}
                        </Typography>
                      )}
                    </Box>
                    <Chip
                      label={item.success ? '成功' : '失败'}
                      size="small"
                      sx={{
                        bgcolor: item.success ? 'rgba(16,185,129,0.08)' : 'rgba(255,0,0,0.06)',
                        color: item.success ? colors.success : colors.danger,
                        fontWeight: 600,
                      }}
                    />
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        )}

        {/* 操作按钮 */}
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
          <Button
            variant="outlined"
            startIcon={<SyncIcon />}
            onClick={handleRescan}
            sx={{
              color: colors.primary,
              borderColor: colors.primary,
              fontWeight: 600,
              px: 3,
            }}
          >
            重新扫描
          </Button>
          <Button
            variant="outlined"
            onClick={handleReset}
            sx={{
              color: colors.textSecondary,
              borderColor: colors.border,
              fontWeight: 600,
              px: 3,
            }}
          >
            重置
          </Button>
        </Box>
      </Paper>
    );
  }

  // failed: 出错
  if (syncState === SYNC_STATES.failed) {
    return (
      <Paper elevation={0} sx={{ p: 4, bgcolor: colors.bgWhite, border: `1px solid ${colors.border}`, borderRadius: 2, textAlign: 'center' }}>
        <Typography variant="h6" sx={{ fontWeight: 700, color: colors.danger, mb: 1 }}>
          同步失败
        </Typography>
        <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 3 }}>
          {error || '未知错误'}
        </Typography>
        <Button variant="outlined" startIcon={<SyncIcon />} onClick={handleReset} sx={{ color: colors.primary, borderColor: colors.primary }}>
          重新开始
        </Button>
      </Paper>
    );
  }

  // fallback
  return null;
}