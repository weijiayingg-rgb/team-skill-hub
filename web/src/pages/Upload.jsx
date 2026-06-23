/**
 * Upload - 资源发布页（智能同步为主 + 手动上传为备选）
 *
 * 默认展示智能同步（核心场景：扫描本地 Skill 一键推送）
 * 手动上传作为备选：从零创建资源，文件上传后自动识别 skill 信息
 *
 * Expert 自动识别逻辑抽到 utils/expert-detect.js，与 cli/utils/expert-bundler.js 判定对齐
 *
 * 当上传 Expert 时，自动解析 Skill 引用并提示用户勾选一并发布：
 * - 已上架的 Skill 显示绿色 Chip + 跳转链接
 * - 未上架的 Skill 显示橙色虚线 Chip + 勾选框
 * - 提交时，勾选的未上架 Skill 会先创建 skill 资源，再创建 expert 资源
 */

import { useState, useEffect, useRef } from 'react';
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
import Checkbox from '@mui/material/Checkbox';
import Divider from '@mui/material/Divider';
import Link from '@mui/material/Link';
import Tooltip from '@mui/material/Tooltip';
import UploadIcon from '@mui/icons-material/Upload';
import SyncIcon from '@mui/icons-material/Sync';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import apiClient from '../api/client';
import FileUploader from '../components/FileUploader';
import SyncPanel from '../components/SyncPanel';
import { RESOURCE_TYPES, PLATFORM_CONFIG } from '../utils/constants';
import { parseFrontmatter, looksLikeExpert, parseSkillRefs } from '../utils/expert-detect';
import { colors } from '../theme';

const EXPERT_PACKAGE_STRUCTURE = `expert-name/
├── prompt.md        # 系统提示词（必须）
├── expert.yaml      # Skill 引用声明（可选，自动生成）
├── skills/          # 嵌入的技能文件（可选）
│   ├── dt-spec.md
│   └── dt-quality.md
├── tools/           # 工具配置（可选）
│   └── mcp-config.json
└── README.md`;

const EXPERT_FRONTMATTER_EXAMPLE = `---
name: my-expert
description: "专家描述"
skills: [dt-spec, dt-quality]   # 显式声明引用的 Skill
---

# 专家身份定义
...`;

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

  // ── Skill 引用检测状态 ──
  const [skillRefs, setSkillRefs] = useState([]);
  const [skillStatus, setSkillStatus] = useState({});
  const [selectedSkills, setSelectedSkills] = useState(new Set());
  const [checkingSkills, setCheckingSkills] = useState(false);
  const [skillCreateErrors, setSkillCreateErrors] = useState([]);
  const [autoEmbeddedSkills, setAutoEmbeddedSkills] = useState([]); // 服务端自动嵌入的 Skill

  // ref 跟踪"是否已自动填充"，避免依赖被本 effect 修改的 state 导致重触发
  const autoFilledRef = useRef(false);
  // ref 跟踪"是否已自动勾选 Skill"，防止 batch-check 完成后覆盖用户手动取消
  const autoSelectedRef = useRef(false);

  const isExpert = type === 'expert';

  // ── 自动识别 + Skill 引用解析：上传 .md 文件后，从文件内容提取 skill 信息 ──
  // 扫描所有 .md 文件（不仅第一个），取 Skill 引用并集
  // 依赖数组只包含 [files, mode]（外部触发因素），不再依赖被本 effect 修改的 state
  useEffect(() => {
    if (mode !== 'manual' || files.length === 0) return;

    // 文件变更时重置自动勾选标记，允许对新文件重新自动勾选
    autoSelectedRef.current = false;

    const mdFiles = files.filter(f => f.name.toLowerCase().endsWith('.md'));
    if (mdFiles.length === 0) return;

    // 辅助：读取文件为文本
    const readFile = (file) => new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve({ file, content: e.target.result });
      reader.onerror = () => resolve({ file, content: '' });
      reader.readAsText(file);
    });

    // 读取所有 .md 文件
    Promise.all(mdFiles.map(readFile)).then((results) => {
      // 优先级：prompt.md > 与资源同名 .md > 第一个 .md
      const promptResult = results.find(r => r.file.name.toLowerCase() === 'prompt.md');
      const mainResult = promptResult || results[0];

      const fm = parseFrontmatter(mainResult.content);
      const fileName = mainResult.file.name.replace(/\.md$/i, '').toLowerCase();

      // 只在首次自动填充时设置（ref 不触发重渲染）
      if (!autoFilledRef.current) {
        setName(fileName);
        setDisplayName(fm.name || fileName);
        if (fm.description) setDescription(fm.description);
        autoFilledRef.current = true;
      }

      // 自动识别 expert 类型（任一 .md 文件看起来像 expert 则判定）
      const hasPromptMd = results.some(r => r.file.name.toLowerCase() === 'prompt.md');
      const anyLooksLikeExpert = results.some(r => looksLikeExpert(r.file.name, r.content));
      if (hasPromptMd || anyLooksLikeExpert) {
        setType('expert');
      }

      // 合并所有 .md 文件的 Skill 引用（取并集）
      const allRefs = new Set();
      for (const { content } of results) {
        const parsed = parseSkillRefs(content);
        for (const ref of (parsed.refs || [])) {
          allRefs.add(ref);
        }
      }
      setSkillRefs([...allRefs]);
    });
  }, [files, mode]);

  // ── 查询 Skill 引用在平台上的状态（批量一次请求）──
  useEffect(() => {
    if (skillRefs.length === 0) return;

    let cancelled = false;
    setCheckingSkills(true);

    const uniqueRefs = [...new Set(skillRefs)];

    const checkAll = async () => {
      try {
        const res = await apiClient.get(
          `/resources/batch-check?names=${encodeURIComponent(uniqueRefs.join(','))}&type=skill`
        );
        if (!cancelled) {
          const status = {};
          for (const item of res.data?.data || []) {
            status[item.name] = {
              found: item.found,
              id: item.id,
              displayName: item.display_name,
            };
          }
          setSkillStatus(status);
          setCheckingSkills(false);
        }
      } catch (err) {
        // 批量查询失败，全部标记为未上架
        if (!cancelled) {
          const status = {};
          for (const name of uniqueRefs) {
            status[name] = { found: false, id: null, displayName: null, error: err.message };
          }
          setSkillStatus(status);
          setCheckingSkills(false);
        }
      }
    };

    checkAll();
    return () => { cancelled = true; };
  }, [skillRefs]);

  // ── 自动勾选所有有嵌入文件的 Skill 引用（仅首次检测后执行一次）──
  // 用户上传 Expert 时，所有检测到的 Skill 引用默认勾选"一并发布"
  // 使用 autoSelectedRef 防止 batch-check 完成后覆盖用户手动取消的操作
  useEffect(() => {
    if (skillRefs.length === 0 || checkingSkills || autoSelectedRef.current) return;

    autoSelectedRef.current = true;
    setSelectedSkills(prev => {
      const next = new Set(prev);
      let changed = false;
      for (const skillName of skillRefs) {
        const hasFile = files.some(f => {
          const fName = f.name.toLowerCase();
          const sName = skillName.toLowerCase();
          return fName.endsWith('.md') && (
            fName === `${sName}.md` ||
            fName === `skills/${sName}.md` ||
            fName.endsWith(`/${sName}.md`)
          );
        });
        if (hasFile && !next.has(skillName)) {
          next.add(skillName);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [skillRefs, files, checkingSkills]);

  // ── 提交表单：如果用户勾选了未上架 Skill，先批量创建 skill 资源 ──
  const handleSubmit = async () => {
    if (!name || !displayName || files.length === 0) {
      setError('请填写必填字段并至少上传一个文件');
      return;
    }

    setSubmitting(true);
    setError('');
    setSkillCreateErrors([]);
    setAutoEmbeddedSkills([]);
    try {
      // ── Step 1: 先创建用户勾选的未上架 Skill ──
      const pendingSkills = [...selectedSkills].filter(
        skillName => skillStatus[skillName] && !skillStatus[skillName].found
      );

      if (pendingSkills.length > 0) {
        // 检查是否有嵌入的 skill 文件
        for (const skillName of pendingSkills) {
          // 查找同批文件中是否有对应的 skill .md 文件（如 skills/dt-spec.md / dt-spec.md）
          const matchingFile = files.find(f => {
            const fName = f.name.toLowerCase();
            const skillNameLower = skillName.toLowerCase();
            return fName.endsWith('.md') && (
              fName === `${skillNameLower}.md` ||
              fName === `skills/${skillNameLower}.md` ||
              fName.endsWith(`/${skillNameLower}.md`)
            );
          });

          if (!matchingFile) {
            // 没有嵌入的 skill 文件，跳过——前端会提示用户
            continue;
          }

          // 为此 skill 创建表单数据
          const skillFormData = new FormData();
          skillFormData.append('name', skillName);
          skillFormData.append('display_name', skillName);
          skillFormData.append('type', 'skill');
          skillFormData.append('description', `由 Expert "${displayName}" 自动关联创建的 Skill`);
          skillFormData.append('platforms', JSON.stringify(platforms));
          skillFormData.append('tags', JSON.stringify(['auto-generated']));
          skillFormData.append('files', matchingFile);

          try {
            await apiClient.post('/resources', skillFormData, {
              headers: { 'Content-Type': 'multipart/form-data' },
            });
          } catch (skillErr) {
            // 单个 skill 创建失败不阻断整体流程，记录错误但继续
            console.error(`创建 Skill "${skillName}" 失败:`, skillErr.message);
            setSkillCreateErrors(prev => [...prev, { name: skillName, message: skillErr.message }]);
          }
        }
      }

      // ── Step 2: 创建 Expert 资源 ──
      const formData = new FormData();
      formData.append('name', name);
      formData.append('display_name', displayName);
      formData.append('type', type);
      formData.append('description', description);
      formData.append('platforms', JSON.stringify(platforms));
      formData.append('tags', JSON.stringify(tags.split(',').map(t => t.trim()).filter(Boolean)));

      // ── 检测 ZIP 文件：如果用户上传了 ZIP，优先走 ZIP 解析路径 ──
      // 服务端 ZIP 分支要求 files.length === 1，所以只发 ZIP、忽略散文件
      const zipFile = files.find(f => f.name.toLowerCase().endsWith('.zip'));
      const autoPlacedFiles = new Set(); // 前端归位的文件集合（用于反馈）

      if (zipFile) {
        // ZIP 模式：只发送 ZIP 文件（服务端 parseExpertZip + autoEmbedSkills 处理）
        formData.append('files', zipFile);
      } else {
        // ── 散文件模式：自动归位匹配的 Skill 文件到 skills/ 目录 ──
        // 用户上传了 dt-spec.md 且 prompt.md 引用了 dt-spec → 自动归位为 skills/dt-spec.md
        // 不需要用户勾选"一并发布"，这纯粹是 Expert 包内的文件组织
        if (isExpert && skillRefs.length > 0) {
          for (const skillName of skillRefs) {
            const matchingFile = files.find(f => {
              const fName = f.name.toLowerCase();
              const sName = skillName.toLowerCase();
              return fName.endsWith('.md') && (
                fName === `${sName}.md` ||
                fName === `skills/${sName}.md` ||
                fName.endsWith(`/${sName}.md`)
              );
            });
            if (matchingFile) {
              autoPlacedFiles.add(matchingFile);
              formData.append('files', matchingFile, `skills/${skillName}.md`);
            }
          }
        }

        // 用户上传的原始文件（已归位到 skills/ 的跳过，避免冗余副本）
        for (const file of files) {
          if (!autoPlacedFiles.has(file)) {
            formData.append('files', file);
          }
        }
      }

      const res = await apiClient.post('/resources', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data?.id) {
        // 合并前端自动归位 + 服务端自动嵌入的结果
        const autoPlacedNames = zipFile ? [] : [...autoPlacedFiles].map(f => {
          const name = f.name.replace(/\.md$/i, '');
          return name;
        });
        const serverEmbedded = res.data.autoEmbeddedSkills || [];
        const allEmbedded = [...new Set([...autoPlacedNames, ...serverEmbedded])];
        const skipped = res.data.skippedSkills || [];
        if (allEmbedded.length > 0 || skipped.length > 0) {
          sessionStorage.setItem('autoEmbedResult', JSON.stringify({ embedded: allEmbedded, skipped }));
        }
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
                  上传方式
                </Typography>
              </Box>
              <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 2 }}>
                支持上传 ZIP 格式专家包，或直接上传多个文件（prompt.md + skills/*.md）。
                系统会自动解析包结构和 Skill 引用。
              </Typography>
              <Box component="pre" sx={{
                bgcolor: '#1E293B', color: '#CDD6F4', p: 2, borderRadius: 1,
                border: `1px solid ${colors.border}`, fontSize: '0.78rem', lineHeight: 1.6,
                overflow: 'auto', fontFamily: '"JetBrains Mono", monospace', mb: 2,
              }}>
                {EXPERT_PACKAGE_STRUCTURE}
              </Box>

              {/* Skill 引用声明说明 */}
              <Typography variant="subtitle2" sx={{ fontWeight: 600, color: colors.textPrimary, mb: 1 }}>
                Skill 引用声明（可选）
              </Typography>
              <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 1, fontSize: '0.8rem' }}>
                在 prompt.md 的 frontmatter 中添加 <code style={{ fontFamily: 'monospace', bgcolor: 'rgba(0,0,0,0.04)', px: 0.5, borderRadius: 2 }}>skills</code> 字段，
                显式声明引用的 Skill 名称。CLI 发布时会自动收集这些 Skill 并打包。
              </Typography>
              <Box component="pre" sx={{
                bgcolor: '#1E293B', color: '#CDD6F4', p: 2, borderRadius: 1,
                border: `1px solid ${colors.border}`, fontSize: '0.78rem', lineHeight: 1.6,
                overflow: 'auto', fontFamily: '"JetBrains Mono", monospace',
              }}>
                {EXPERT_FRONTMATTER_EXAMPLE}
              </Box>
              <Typography variant="caption" sx={{ mt: 1, display: 'block', color: colors.textMuted }}>
                💡 CLI 使用 <code style={{ fontFamily: 'monospace' }}>skhub publish</code> 发布 Expert 时，会自动解析引用、搜索本地 Skill 文件并打包为 ZIP。
                如果自动扫描找不到，也可以手动构建 ZIP 上传。
              </Typography>
            </Paper>
          )}

          {/* ── 关联 Skill 检查区域（仅 expert 类型 + 有 Skill 引用时显示）── */}
          {isExpert && skillRefs.length > 0 && (
            <Paper sx={{ p: 3, mb: 3, bgcolor: colors.bgWhite }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <InfoOutlinedIcon sx={{ fontSize: 20, color: colors.primary }} />
                <Typography variant="h6" sx={{ fontFamily: '"Play", sans-serif' }}>
                  关联 Skill 检查
                </Typography>
                {checkingSkills && (
                  <CircularProgress size={16} sx={{ color: colors.primary }} />
                )}
              </Box>
              <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 2 }}>
                当前 Expert 引用了以下 {skillRefs.length} 个 Skill。
                <strong>已上架的 Skill 会自动嵌入到 Expert 包中</strong>，
                未上架的 Skill 已自动勾选，提交时将一并创建。
              </Typography>

              <Divider sx={{ mb: 2 }} />

              {/* Skill 引用列表 */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {[...new Set(skillRefs)].map((skillName) => {
                  const status = skillStatus[skillName];
                  const isLoading = checkingSkills && !status;
                  const isFound = status?.found;
                  const isSelected = selectedSkills.has(skillName);

                  // 检查同批文件中是否有此 skill 的 .md 文件
                  const hasEmbeddedFile = files.some(f => {
                    const fName = f.name.toLowerCase();
                    const sName = skillName.toLowerCase();
                    return fName.endsWith('.md') && (
                      fName === `${sName}.md` ||
                      fName === `skills/${sName}.md` ||
                      fName.endsWith(`/${sName}.md`)
                    );
                  });

                  return (
                    <Box
                      key={skillName}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        p: 1.5,
                        borderRadius: 1,
                        bgcolor: isFound ? 'rgba(82, 196, 26, 0.04)' : 'rgba(255, 102, 0, 0.03)',
                        border: `1px solid ${isFound ? 'rgba(82, 196, 26, 0.15)' : 'rgba(255, 102, 0, 0.12)'}`,
                        transition: 'all 0.2s',
                      }}
                    >
                      {/* 状态图标 */}
                      {isLoading ? (
                        <CircularProgress size={16} sx={{ color: colors.textMuted }} />
                      ) : isFound ? (
                        <CheckCircleIcon sx={{ fontSize: 18, color: colors.success }} />
                      ) : (
                        <WarningAmberIcon sx={{ fontSize: 18, color: colors.warning }} />
                      )}

                      {/* Skill 名称 */}
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 600,
                          fontFamily: 'monospace',
                          color: colors.textPrimary,
                          minWidth: 120,
                        }}
                      >
                        {skillName}
                      </Typography>

                      {/* 状态标签 */}
                      {isLoading ? (
                        <Typography variant="caption" sx={{ color: colors.textMuted }}>
                          查询中...
                        </Typography>
                      ) : isFound ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Chip
                            label="已上架"
                            size="small"
                            sx={{
                              bgcolor: 'rgba(82, 196, 26, 0.08)',
                              color: colors.success,
                              fontSize: '0.7rem',
                              height: 22,
                            }}
                          />
                          <Link
                            href={`/resources/${status.id}`}
                            underline="hover"
                            sx={{ fontSize: '0.75rem', color: colors.primary, cursor: 'pointer' }}
                          >
                            查看
                          </Link>
                        </Box>
                      ) : (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                          <Chip
                            label="未上架"
                            size="small"
                            variant="outlined"
                            sx={{
                              borderColor: 'rgba(255, 102, 0, 0.4)',
                              color: colors.warning,
                              fontSize: '0.7rem',
                              height: 22,
                              borderStyle: 'dashed',
                            }}
                          />

                          {/* 勾选框：一并发布 */}
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 0.5,
                              ml: 'auto',
                            }}
                          >
                            {hasEmbeddedFile ? (
                              <Tooltip title="检测到嵌入文件，将自动提取内容创建 Skill" arrow>
                                <Typography variant="caption" sx={{ color: colors.textMuted, fontSize: '0.7rem' }}>
                                  检测到嵌入文件
                                </Typography>
                              </Tooltip>
                            ) : (
                              <Tooltip title={`同批文件中未找到 ${skillName}.md，需要手动上传 skill 文件后勾选`} arrow>
                                <Typography variant="caption" sx={{ color: colors.textMuted, fontSize: '0.7rem' }}>
                                  需要上传 .md 文件
                                </Typography>
                              </Tooltip>
                            )}
                            <Checkbox
                              size="small"
                              checked={isSelected}
                              disabled={!hasEmbeddedFile}
                              onChange={(e) => {
                                setSelectedSkills(prev => {
                                  const next = new Set(prev);
                                  if (e.target.checked) {
                                    next.add(skillName);
                                  } else {
                                    next.delete(skillName);
                                  }
                                  return next;
                                });
                              }}
                              sx={{
                                color: colors.warning,
                                '&.Mui-checked': { color: colors.warning },
                                p: 0.5,
                              }}
                            />
                            <Typography
                              variant="caption"
                              sx={{
                                color: hasEmbeddedFile ? colors.warning : colors.textMuted,
                                fontSize: '0.75rem',
                                cursor: hasEmbeddedFile ? 'pointer' : 'default',
                                userSelect: 'none',
                              }}
                              onClick={() => {
                                if (!hasEmbeddedFile) return;
                                setSelectedSkills(prev => {
                                  const next = new Set(prev);
                                  if (next.has(skillName)) {
                                    next.delete(skillName);
                                  } else {
                                    next.add(skillName);
                                  }
                                  return next;
                                });
                              }}
                            >
                              一并发布
                            </Typography>
                          </Box>
                        </Box>
                      )}
                    </Box>
                  );
                })}
              </Box>

              {/* 汇总提示 */}
              {selectedSkills.size > 0 && (
                <Alert severity="info" sx={{ mt: 2, fontSize: '0.8rem' }}>
                  提交时将对以下 {selectedSkills.size} 个未上架 Skill 一并创建：
                  {[...selectedSkills].join(', ')}
                </Alert>
              )}
            </Paper>
          )}

          {/* 文件上传区 */}
          <Paper sx={{ p: 3, mb: 3, bgcolor: colors.bgWhite }}>
            <Typography variant="h6" sx={{ mb: 2, fontFamily: '"Play", sans-serif' }}>
              文件上传
              {isExpert && (
                <Typography component="span" variant="body2" sx={{ ml: 1, color: colors.textMuted }}>
                  （上传 prompt.md 等文件，或整个 ZIP 包）
                </Typography>
              )}
            </Typography>
            <FileUploader
              files={files}
              setFiles={setFiles}
              maxFiles={20}
              maxSize={50 * 1024 * 1024}
              acceptExpert={isExpert}
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
                <Select id="upload-type" name="type" value={type} onChange={e => { setType(e.target.value); setFiles([]); setSkillRefs([]); setSkillStatus({}); setSelectedSkills(new Set()); autoFilledRef.current = false; }} label="资源类型">
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

          {/* Skill 创建失败提示 */}
          {skillCreateErrors.length > 0 && (
            <Alert
              severity="warning"
              onClose={() => setSkillCreateErrors([])}
              sx={{ mb: 2 }}
            >
              以下 Skill 创建失败（Expert 资源已正常创建）：
              <Box component="ul" sx={{ mt: 1, pl: 2, listStyleType: 'disc' }}>
                {skillCreateErrors.map(err => (
                  <li key={err.name}>
                    <strong>{err.name}</strong>：{err.message}
                  </li>
                ))}
              </Box>
            </Alert>
          )}

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
