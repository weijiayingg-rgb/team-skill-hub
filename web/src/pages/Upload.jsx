/**
 * Upload - 资源发布页（智能同步为主 + 手动上传为备选）
 *
 * 默认展示智能同步（核心场景：扫描本地 Skill 一键推送）
 * 手动上传作为备选：从零创建资源，文件上传后自动识别 skill 信息
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Chip from '@mui/material/Chip';
import UploadIcon from '@mui/icons-material/Upload';
import SyncIcon from '@mui/icons-material/Sync';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import apiClient from '../api/client';
import FileUploader from '../components/FileUploader';
import SyncPanel from '../components/SyncPanel';
import { RESOURCE_TYPES, PLATFORM_CONFIG } from '../utils/constants';
import { colors } from '../theme';

const EXPERT_PACKAGE_STRUCTURE = `expert-name/
├── metadata.yaml    # 元数据（可选，系统自动生成）
├── prompt.md        # 系统提示词（必须）
├── skills/          # 技能包目录
│   ├── review.md    # 技能定义文件
│   └── analyze.md
├── tools/           # 工具配置目录
│   └── mcp-config.json
└── README.md        # 使用说明`;

/**
 * 从文件内容中提取 YAML frontmatter 字段
 * 简单正则解析，不依赖 yaml 库
 *
 * @param {string} content - 文件文本内容
 * @returns {{ name?: string, description?: string }}
 */
function parseFrontmatter(content) {
  const result = {};
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return result;

  const yaml = fmMatch[1];
  const nameMatch = yaml.match(/^name:\s*(.+)$/m);
  const descMatch = yaml.match(/^description:\s*(.+)$/m);

  if (nameMatch) {
    result.name = nameMatch[1].trim().replace(/^>-\s*/, '').split('\n')[0].trim();
  }
  if (descMatch) {
    result.description = descMatch[1].trim().replace(/^>-\s*/, '');
    // YAML 多行 >- 格式：只取第一行
    if (result.description.startsWith('>')) {
      result.description = result.description.replace(/^>-?\s*/, '').split('\n')[0].trim();
    }
  }

  return result;
}

export default function Upload() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('sync'); // 默认智能同步

  // 手动上传表单状态
  const [files, setFiles] = useState([]);
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [type, setType] = useState('skill');
  const [description, setDescription] = useState('');
  const [platforms, setPlatforms] = useState([]);
  const [tags, setTags] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const isExpert = type === 'expert';

  // ── 自动识别：上传 .md 文件后，从文件内容提取 skill 信息 ──
  useEffect(() => {
    if (mode !== 'manual' || files.length === 0) return;

    // 找到第一个 .md 文件来解析
    const mdFile = files.find(f => f.name.toLowerCase().endsWith('.md'));
    if (!mdFile) return;

    // 只在表单为空时自动填充（不覆盖用户手动输入的内容）
    const shouldAutoFill = !name && !displayName;
    if (!shouldAutoFill) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      const fm = parseFrontmatter(content);

      // 文件名 → name（去掉 .md 扩展名，转为 kebab-case）
      const fileName = mdFile.name.replace(/\.md$/i, '').toLowerCase();

      // frontmatter 优先，文件名 fallback
      if (!name) {
        setName(fileName);
      }
      if (!displayName) {
        setDisplayName(fm.name || fileName);
      }
      if (!description && fm.description) {
        setDescription(fm.description);
      }

      // 包含 prompt.md 的文件组合 → 推断为 expert 类型
      const hasPromptMd = files.some(f => f.name.toLowerCase() === 'prompt.md');
      if (hasPromptMd && type === 'skill') {
        setType('expert');
      }
    };
    reader.readAsText(mdFile);
  }, [files, mode, name, displayName, description, type]);

  const handleSubmit = async () => {
    if (!name || !displayName || files.length === 0) {
      setError('请填写必填字段并至少上传一个文件');
      return;
    }
    if (isExpert && files.length === 1 && !files[0].name.toLowerCase().endsWith('.zip')) {
      setError('专家类型请上传 ZIP 格式的专家包');
      return;
    }

    setSubmitting(true);
    setError('');

    const formData = new FormData();
    formData.append('name', name);
    formData.append('display_name', displayName);
    formData.append('type', type);
    formData.append('description', description);
    formData.append('platforms', JSON.stringify(platforms));
    formData.append('tags', JSON.stringify(tags.split(',').map(t => t.trim()).filter(Boolean)));
    for (const file of files) {
      formData.append('files', file);
    }

    try {
      const res = await apiClient.post('/resources', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data?.id) {
        navigate(`/resources/${res.data.id}`);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto' }}>
      {/* 页面标题 */}
      <Typography
        variant="h4"
        sx={{
          mb: 1,
          fontFamily: '"Play", sans-serif',
          color: colors.textPrimary,
        }}
      >
        同步资源
      </Typography>
      <Typography variant="body2" sx={{ color: colors.textMuted, mb: 3 }}>
        扫描推送本地 AI Skill，或手动上传新资源到 SkillHub
      </Typography>

      {/* 模式切换：智能同步为主，手动上传为备选 */}
      <ToggleButtonGroup
        value={mode}
        exclusive
        onChange={(e, val) => val && setMode(val)}
        sx={{ mb: 3, width: '100%' }}
      >
        <ToggleButton
          value="sync"
          sx={{
            flex: 1,
            fontWeight: mode === 'sync' ? 600 : 500,
            color: mode === 'sync' ? colors.primary : colors.textSecondary,
            borderColor: mode === 'sync' ? colors.primary : colors.border,
            bgcolor: mode === 'sync' ? colors.primaryMuted : 'transparent',
            '&.Mui-selected': {
              bgcolor: colors.primaryMuted,
              color: colors.primary,
              borderColor: colors.primary,
            },
          }}
        >
          <SyncIcon sx={{ mr: 1, fontSize: 18 }} />
          智能同步
        </ToggleButton>
        <ToggleButton
          value="manual"
          sx={{
            flex: 1,
            fontWeight: mode === 'manual' ? 600 : 500,
            color: mode === 'manual' ? colors.primary : colors.textSecondary,
            borderColor: mode === 'manual' ? colors.primary : colors.border,
            bgcolor: mode === 'manual' ? colors.primaryMuted : 'transparent',
            '&.Mui-selected': {
              bgcolor: colors.primaryMuted,
              color: colors.primary,
              borderColor: colors.primary,
            },
          }}
        >
          <UploadIcon sx={{ mr: 1, fontSize: 18 }} />
          手动上传
        </ToggleButton>
      </ToggleButtonGroup>

      {/* 按模式渲染 */}
      {mode === 'sync' ? (
        <SyncPanel />
      ) : (
        <>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {/* 自动识别提示 */}
          {name && displayName && (
            <Paper sx={{ p: 2, mb: 2, bgcolor: colors.primaryMuted, border: `1px solid ${colors.primary}20`, borderRadius: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <AutoFixHighIcon sx={{ fontSize: 18, color: colors.primary }} />
                <Typography variant="body2" sx={{ color: colors.primary, fontWeight: 500 }}>
                  已自动识别 skill 信息，请检查并补充
                </Typography>
              </Box>
            </Paper>
          )}

          {/* Expert 包结构说明 */}
          {isExpert && (
            <Paper sx={{ p: 3, mb: 3, bgcolor: colors.bgWhite, borderLeft: `3px solid ${colors.warning}` }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <Chip label="专家包" size="small" sx={{ bgcolor: 'rgba(255,102,0,0.08)', color: colors.warning }} />
                <Typography variant="subtitle1" fontWeight={600} sx={{ fontFamily: '"Play", sans-serif' }}>
                  ZIP 包结构要求
                </Typography>
              </Box>
              <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 1 }}>
                专家类型支持上传 ZIP 格式的专家包，包含系统提示词、技能包和工具配置。
              </Typography>
              <Box component="pre" sx={{
                bgcolor: '#1E293B',
                color: '#CDD6F4',
                p: 2,
                borderRadius: 1,
                border: `1px solid ${colors.border}`,
                fontSize: '0.8rem',
                lineHeight: 1.6,
                overflow: 'auto',
                fontFamily: '"JetBrains Mono", monospace',
              }}>
                {EXPERT_PACKAGE_STRUCTURE}
              </Box>
              <Typography variant="caption" sx={{ mt: 1, display: 'block', color: colors.textMuted }}>
                prompt.md 为必需文件，skills/ 和 tools/ 目录可选
              </Typography>
            </Paper>
          )}

          {/* 文件上传区 */}
          <Paper sx={{ p: 3, mb: 3, bgcolor: colors.bgWhite }}>
            <Typography variant="h6" sx={{ mb: 2, fontFamily: '"Play", sans-serif' }}>
              文件上传
              {isExpert && (
                <Typography component="span" variant="body2" sx={{ ml: 1, color: colors.warning }}>
                  （请上传 ZIP 格式专家包）
                </Typography>
              )}
            </Typography>
            <FileUploader
              files={files}
              setFiles={setFiles}
              maxFiles={isExpert ? 1 : 20}
              maxSize={isExpert ? 50 * 1024 * 1024 : 10 * 1024 * 1024}
              acceptZip={isExpert}
            />
          </Paper>

          {/* 基本信息表单 */}
          <Paper sx={{ p: 3, mb: 3, bgcolor: colors.bgWhite }}>
            <Typography variant="h6" sx={{ mb: 2, fontFamily: '"Play", sans-serif' }}>基本信息</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField id="upload-name" name="name" label="资源名称 (kebab-case)" value={name} onChange={e => setName(e.target.value)} required helperText="例: sql-review-expert（上传 .md 文件后自动识别）" />
              <TextField id="upload-display-name" name="display_name" label="显示名称" value={displayName} onChange={e => setDisplayName(e.target.value)} required />
              <FormControl>
                <InputLabel htmlFor="upload-type">资源类型</InputLabel>
                <Select id="upload-type" name="type" value={type} onChange={e => { setType(e.target.value); setFiles([]); }} label="资源类型">
                  {RESOURCE_TYPES.map(t => (
                    <MenuItem key={t.key} value={t.key}>{t.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField id="upload-description" name="description" label="描述" value={description} onChange={e => setDescription(e.target.value)} multiline rows={3} helperText="上传含 YAML frontmatter 的文件后自动填充" />
              <FormControl>
                <InputLabel htmlFor="upload-platforms">支持的平台</InputLabel>
                <Select id="upload-platforms" name="platforms" multiple value={platforms} onChange={e => setPlatforms(e.target.value)} label="支持的平台">
                  {Object.entries(PLATFORM_CONFIG).map(([key, cfg]) => (
                    <MenuItem key={key} value={key}>{cfg.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField id="upload-tags" name="tags" label="标签 (逗号分隔)" value={tags} onChange={e => setTags(e.target.value)} helperText="例: sql, review, database" />
            </Box>
          </Paper>

          <Button
            variant="contained"
            size="large"
            onClick={handleSubmit}
            disabled={submitting}
            sx={{ width: '100%' }}
          >
            {submitting ? <CircularProgress size={24} sx={{ color: '#FFFFFF' }} /> : '发布资源'}
          </Button>
        </>
      )}
    </Box>
  );
}
