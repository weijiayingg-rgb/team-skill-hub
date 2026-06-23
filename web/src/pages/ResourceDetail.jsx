/**
 * ResourceDetail - 资源详情页（JokerPS 亮色清新风格）
 *
 * 保持所有功能逻辑不变，仅重构视觉层。
 * 文件树、Markdown 预览、评论区全部适配亮色主题。
 */

import { useParams } from 'react-router-dom';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Collapse from '@mui/material/Collapse';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import ThumbUp from '@mui/icons-material/ThumbUp';
import ThumbUpOutlined from '@mui/icons-material/ThumbUpOutlined';
import Favorite from '@mui/icons-material/Favorite';
import FavoriteBorder from '@mui/icons-material/FavoriteBorder';
import FolderIcon from '@mui/icons-material/Folder';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import BuildIcon from '@mui/icons-material/Build';
import PsychologyIcon from '@mui/icons-material/Psychology';
import ExtensionIcon from '@mui/icons-material/Extension';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CodeIcon from '@mui/icons-material/Code';
import PublishIcon from '@mui/icons-material/Publish';
import HistoryToggleOffIcon from '@mui/icons-material/HistoryToggleOff';
import DescriptionIcon from '@mui/icons-material/Description';
import IconButton from '@mui/material/IconButton';
import apiClient from '../api/client';
import TypeBadge from '../components/TypeBadge';
import MarkdownViewer from '../components/MarkdownViewer';
import InstallGuide from '../components/InstallGuide';
import CommentSection from '../components/CommentSection';
import VersionUploadDialog from '../components/VersionUploadDialog';
import { useInteractions } from '../hooks/useInteractions';
import { formatNumber, formatDate } from '../utils/format';
import { colors } from '../theme';

// ─── 文件树构建（逻辑不变） ──────────────────────────────
function buildFileTree(files) {
  const root = { name: '', type: 'dir', children: {} };
  for (const file of files) {
    const parts = file.path.split('/');
    let current = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (i === parts.length - 1) {
        current.children[part] = { name: part, path: file.path, type: 'file', content: file.content };
      } else {
        if (!current.children[part]) {
          current.children[part] = { name: part, path: parts.slice(0, i + 1).join('/'), type: 'dir', children: {} };
        }
        current = current.children[part];
      }
    }
  }
  return root;
}

// ─── 文件树节点渲染（亮色适配） ─────────────────────────
function FileTreeNode({ node, depth = 0, selectedPath, onSelect }) {
  const [open, setOpen] = useState(true);

  if (node.type === 'dir') {
    const childEntries = Object.values(node.children || {}).sort((a, b) => {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return (
      <>
        <ListItemButton
          onClick={() => setOpen(!open)}
          sx={{ pl: 2 + depth * 2, py: 0.5, '&:hover': { bgcolor: colors.primaryMuted } }}
        >
          <ListItemIcon sx={{ minWidth: 32 }}>
            {open
              ? <FolderOpenIcon fontSize="small" sx={{ color: colors.primary }} />
              : <FolderIcon fontSize="small" sx={{ color: colors.primary }} />
            }
          </ListItemIcon>
          <ListItemText
            primary={node.name}
            primaryTypographyProps={{ variant: 'body2', fontWeight: 500, color: colors.textPrimary }}
          />
          {open ? <ExpandLess fontSize="small" sx={{ color: colors.textMuted }} /> : <ExpandMore fontSize="small" sx={{ color: colors.textMuted }} />}
        </ListItemButton>
        <Collapse in={open} timeout="auto" unmountOnExit>
          {childEntries.map(child => (
            <FileTreeNode key={child.path || child.name} node={child} depth={depth + 1} selectedPath={selectedPath} onSelect={onSelect} />
          ))}
        </Collapse>
      </>
    );
  }

  const isSelected = selectedPath === node.path;
  // 文件图标区分：README.md（📖 给人看的文档）、prompt.md（🧠 给 AI 的提示词）、其他文件按扩展名
  const fileName = node.name || '';
  const icon = fileName === 'README.md'
    ? <DescriptionIcon fontSize="small" sx={{ color: '#FF6600' }} />
    : fileName === 'prompt.md'
      ? <PsychologyIcon fontSize="small" sx={{ color: colors.primary }} />
      : fileName.endsWith('.md')
        ? <InsertDriveFileIcon fontSize="small" sx={{ color: colors.primary }} />
        : fileName.endsWith('.json')
          ? <ExtensionIcon fontSize="small" sx={{ color: colors.success }} />
          : <BuildIcon fontSize="small" sx={{ color: colors.textMuted }} />;

  return (
    <ListItemButton
      selected={isSelected}
      onClick={() => onSelect(node)}
      sx={{
        pl: 2 + depth * 2,
        py: 0.5,
        bgcolor: isSelected ? colors.primaryMuted : 'transparent',
        borderLeft: isSelected ? `2px solid ${colors.primary}` : '2px solid transparent',
        '&:hover': { bgcolor: isSelected ? colors.primaryMuted : 'rgba(0,0,0,0.02)' },
        '&.Mui-selected': { bgcolor: colors.primaryMuted },
      }}
    >
      <ListItemIcon sx={{ minWidth: 32 }}>{icon}</ListItemIcon>
      <ListItemText
        primary={node.name}
        primaryTypographyProps={{
          variant: 'body2',
          color: isSelected ? colors.primary : colors.textSecondary,
          fontWeight: isSelected ? 600 : 400,
        }}
      />
    </ListItemButton>
  );
}

// ─── 主组件 ──────────────────────────────────────────────
export default function ResourceDetail() {
  const { id } = useParams();
  const [resource, setResource] = useState(null);
  const [loading, setLoading] = useState(true);
  const [descriptionContent, setDescriptionContent] = useState('');
  const [expertFiles, setExpertFiles] = useState([]);
  const [skillRefs, setSkillRefs] = useState([]); // 引用模型：Expert 引用的平台 Skill
  const [selectedFile, setSelectedFile] = useState(null);
  const { liked, favorited, toggleLike, toggleFavorite } = useInteractions(id);
  const [tabValue, setTabValue] = useState(0);
  const [mainTabValue, setMainTabValue] = useState(0); // Expert 右侧主区域 Tabs: 0=内容, 1=更新日志
  const [versionDialogOpen, setVersionDialogOpen] = useState(false);

  // Skill 内容预览（点击引用 Skill 后在右侧主内容区展示）
  const [viewingSkill, setViewingSkill] = useState(null); // { name, content, loading } 或 null
  const viewingSkillRef = useRef(null); // 同步镜像，供 handleViewSkill 读取避免依赖 state
  const [skillContents, setSkillContents] = useState(new Map());   // 缓存已加载的 skill 内容
  const inflightSkillsRef = useRef(new Set()); // 防止重复请求

  // 自动嵌入反馈（从 Upload 页传入 sessionStorage）
  const [autoEmbedResult, setAutoEmbedResult] = useState({ embedded: [], skipped: [] });

  const isExpert = resource?.type === 'expert';

  // 可复用的资源加载函数（初始加载 + 版本上传后刷新）
  const fetchResource = useCallback(() => {
    if (!id) return;
    setLoading(true);
    apiClient.get(`/resources/${id}`)
      .then(res => {
        setResource(res.data);
        setSkillRefs([]);
        if (res.data?.type === 'expert' && res.data?.files?.length > 0) {
          setExpertFiles(res.data.files);
          setSkillRefs(res.data.skill_refs || []);
          // Expert 详情页优先展示 README.md（给人看的文档），其次才是 prompt.md（给 AI 的提示词）
          const readmeFile = res.data.files.find(f => f.path === 'README.md');
          const promptFile = res.data.files.find(f => f.path === 'prompt.md');
          const defaultFile = readmeFile || promptFile;
          if (defaultFile) {
            setSelectedFile(defaultFile);
            setDescriptionContent(defaultFile.content);
          } else {
            setDescriptionContent(res.data.description || '');
          }
        } else if (res.data?.versions?.length > 0) {
          const version = res.data.current_version || res.data.versions[0].version;
          apiClient.get(`/resources/${id}/download?version=${version}`)
            .then(dlRes => {
              const files = dlRes.data?.files || [];
              const mdFile = files.find(f => f.filename.endsWith('.md') || f.filename.endsWith('.mdx'));
              if (mdFile) setDescriptionContent(mdFile.content);
              else if (files.length > 0) setDescriptionContent(files[0].content);
              else if (res.data.description) setDescriptionContent(res.data.description);
            });
        } else if (res.data.description) {
          setDescriptionContent(res.data.description);
        }
      })
      .catch(err => console.error('Failed to fetch resource:', err))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    fetchResource();
  }, [fetchResource]);

  // 读取 Upload 页传入的自动嵌入反馈
  useEffect(() => {
    try {
      // 新格式（含 embedded + skipped）
      const stored = sessionStorage.getItem('autoEmbedResult');
      if (stored) {
        setAutoEmbedResult(JSON.parse(stored));
        sessionStorage.removeItem('autoEmbedResult');
        return;
      }
      // 兼容旧格式
      const oldStored = sessionStorage.getItem('autoEmbeddedSkills');
      if (oldStored) {
        setAutoEmbedResult({ embedded: JSON.parse(oldStored), skipped: [] });
        sessionStorage.removeItem('autoEmbeddedSkills');
      }
    } catch { /* ignore */ }
  }, []);

  // 同步 viewingSkill → ref，供 handleViewSkill 读取（避免 useCallback 依赖 state）
  const updateViewingSkill = useCallback((val) => {
    viewingSkillRef.current = val;
    setViewingSkill(val);
  }, []);

  /**
   * 点击引用 Skill → 在右侧主内容区展示 Skill 内容
   * 优先从 expertFiles 嵌入文件获取，其次通过 API 获取
   */
  const handleViewSkill = useCallback(async (skillName, skillId) => {
    // 切换：再次点击同一个 skill 则关闭
    if (viewingSkillRef.current?.name === skillName) {
      updateViewingSkill(null);
      return;
    }

    updateViewingSkill({ name: skillName, content: null, loading: true });

    // 已有缓存 → 直接使用
    if (skillContents.has(skillName)) {
      updateViewingSkill({ name: skillName, content: skillContents.get(skillName), loading: false });
      return;
    }

    // 防止重复请求
    if (inflightSkillsRef.current.has(skillName)) return;
    inflightSkillsRef.current.add(skillName);

    try {
      let content = null;

      // 1. 优先从 expertFiles 中查找嵌入的 skills/{name}.md
      const embeddedFile = expertFiles.find(
        f => f.path === `skills/${skillName}.md` || f.path === `skills/${skillName}.mdx`
      );
      if (embeddedFile && embeddedFile.content) {
        content = embeddedFile.content;
      }
      // 2. 通过 API 获取引用 Skill 的内容
      else if (skillId) {
        const res = await apiClient.get(`/resources/${skillId}`);
        const skillData = res.data;
        if (skillData?.files?.length > 0) {
          const promptFile = skillData.files.find(f => f.filename === 'prompt.md' || f.path === 'prompt.md');
          const mainMd = skillData.files.find(f => f.filename?.endsWith('.md'));
          content = (promptFile || mainMd)?.content;
        }
        if (!content && skillData?.description) content = skillData.description;
      }

      setSkillContents(prev => new Map(prev).set(skillName, content || null));
      updateViewingSkill({ name: skillName, content: content || null, loading: false });
    } catch (err) {
      console.error(`Failed to load skill content for ${skillName}:`, err);
      setSkillContents(prev => new Map(prev).set(skillName, null));
      updateViewingSkill({ name: skillName, content: null, loading: false });
    } finally {
      inflightSkillsRef.current.delete(skillName);
    }
  }, [skillContents, expertFiles, updateViewingSkill]);

  const expertStats = useMemo(() => {
    if (!isExpert || expertFiles.length === 0) return null;
    const skills = expertFiles.filter(f => f.path.startsWith('skills/') && f.filename.endsWith('.md'));
    const tools = expertFiles.filter(f => f.path.startsWith('tools/'));

    // 提取技能名称列表（从文件名去掉.md后缀）
    const YAML_INDICATORS = ['|', '>', '|-', '>-'];  // YAML 多行指示符，不是实际值
    const skillNames = skills.map(f => {
      const name = f.filename.replace('.md', '').replace('.mdx', '');
      // 尝试从 frontmatter 提取 display_name
      if (f.content) {
        const fmMatch = f.content.match(/^---\n([\s\S]*?)\n---/);
        if (fmMatch) {
          const nameMatch = fmMatch[1].match(/^display_name:\s*(.+)$/m) || fmMatch[1].match(/^name:\s*(.+)$/m);
          if (nameMatch) {
            const val = nameMatch[1].trim();
            // 过滤 YAML 多行指示符
            if (!YAML_INDICATORS.includes(val)) return val;
          }
        }
      }
      return name;
    });

    // 提取工具名称列表
    const toolNames = tools.map(f => f.filename.replace(/\.(json|yaml|yml|js|py|sh)$/, ''));

    // 提取角色定位（从 prompt.md 的 frontmatter 或首段文字）
    let roleDescription = '';
    let roleGoals = '';
    const promptFile = expertFiles.find(f => f.path === 'prompt.md');
    if (promptFile && promptFile.content) {
      const fmMatch = promptFile.content.match(/^---\n([\s\S]*?)\n---/);
      if (fmMatch) {
        const roleMatch = fmMatch[1].match(/^role:\s*(.+)$/m);
        const descMatch = fmMatch[1].match(/^description:\s*(.+)$/m);
        const goalsMatch = fmMatch[1].match(/^goals:\s*(.+)$/m);
        // 过滤 YAML 多行指示符
        if (roleMatch) {
          const val = roleMatch[1].trim();
          if (!YAML_INDICATORS.includes(val)) roleDescription = val;
        }
        if (descMatch && !roleDescription) {
          const val = descMatch[1].trim();
          if (!YAML_INDICATORS.includes(val)) roleDescription = val;
        }
        if (goalsMatch) {
          const val = goalsMatch[1].trim();
          if (!YAML_INDICATORS.includes(val)) roleGoals = val;
        }
      }
      // 无 frontmatter 时取首段文字
      if (!roleDescription) {
        const cleanContent = promptFile.content.replace(/^---[\s\S]*?---/, '');
        const lines = cleanContent.split('\n');
        const firstPara = lines.find(l => l.trim() && !l.startsWith('#') && !l.startsWith('!'));
        if (firstPara) roleDescription = firstPara.trim().slice(0, 200);
      }
    }

    return {
      skillCount: skills.length,
      toolCount: tools.length,
      skillNames,
      toolNames,
      roleDescription,
      roleGoals,
    };
  }, [isExpert, expertFiles]);

  const fileTree = useMemo(() => {
    if (!isExpert || expertFiles.length === 0) return null;
    return buildFileTree(expertFiles);
  }, [isExpert, expertFiles]);

  if (loading) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <CircularProgress sx={{ color: colors.primary }} />
      </Box>
    );
  }

  if (!resource) {
    return <Box sx={{ textAlign: 'center', py: 8 }}><Typography sx={{ color: colors.textMuted }}>资源不存在</Typography></Box>;
  }

  return (
    <Box>
      {/* ── 自动嵌入反馈通知 ── */}
      {autoEmbedResult.embedded.length > 0 && (
        <Alert
          severity="success"
          onClose={() => setAutoEmbedResult(prev => ({ ...prev, embedded: [] }))}
          icon={<AutoAwesomeIcon />}
          sx={{ mb: 2 }}
        >
          🎉 已自动从平台拉取并嵌入 {autoEmbedResult.embedded.length} 个 Skill：
          <strong>{autoEmbedResult.embedded.join(', ')}</strong>
          。Expert 包现在包含完整的 Skill 文件。
        </Alert>
      )}
      {autoEmbedResult.skipped.length > 0 && (
        <Alert
          severity="warning"
          onClose={() => setAutoEmbedResult(prev => ({ ...prev, skipped: [] }))}
          sx={{ mb: 2 }}
        >
          ⚠️ 以下 {autoEmbedResult.skipped.length} 个 Skill 未能自动嵌入：
          <Box component="ul" sx={{ mt: 0.5, mb: 0, pl: 2 }}>
            {autoEmbedResult.skipped.map((s, i) => (
              <li key={i}>
                <strong>{s.name}</strong>：{s.reason}
              </li>
            ))}
          </Box>
        </Alert>
      )}

      {/* ── 资源头部 ── */}
      <Paper sx={{ p: 3, mb: 3, bgcolor: colors.bgWhite }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1 }}>
          <Box>
            <Typography
              variant="h4"
              sx={{
                mb: 0.5,
                fontFamily: '"Play", sans-serif',
                color: colors.textPrimary,
              }}
            >
              {resource.display_name}
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: colors.textMuted,
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: '0.8rem',
              }}
            >
              {resource.name} · v{resource.current_version} · {formatDate(resource.created_at)}
            </Typography>
          </Box>
          <TypeBadge type={resource.type} size="medium" />
        </Box>

        {/* Expert 统计 */}
        {isExpert && expertStats && (
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <Chip label={`${expertFiles.length} 个文件`} size="small" variant="outlined" />
            {expertStats.skillCount > 0 && (
              <Chip label={`${expertStats.skillCount} 个技能`} size="small" sx={{ borderColor: colors.primary, color: colors.primary }} variant="outlined" />
            )}
            {expertStats.toolCount > 0 && (
              <Chip label={`${expertStats.toolCount} 个工具`} size="small" sx={{ borderColor: colors.success, color: colors.success }} variant="outlined" />
            )}
          </Box>
        )}

        {/* ── Expert 能力概览 ── */}
        {isExpert && expertStats && (expertStats.roleDescription || expertStats.skillNames.length > 0) && (
          <Paper sx={{ p: 2.5, mb: 2, bgcolor: 'rgba(255,102,0,0.03)', border: '1px solid rgba(255,102,0,0.12)', borderRadius: 2 }}>
            {/* 角色定位 */}
            {expertStats.roleDescription && (
              <Box sx={{ mb: expertStats.skillNames.length > 0 || expertStats.toolNames.length > 0 ? 2 : 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                  <PsychologyIcon sx={{ fontSize: 16, color: '#FF6600' }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#FF6600' }}>角色定位</Typography>
                </Box>
                <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                  {expertStats.roleDescription}
                </Typography>
                {expertStats.roleGoals && (
                  <Typography variant="body2" sx={{ color: colors.textMuted, mt: 0.5, fontSize: '0.8rem' }}>
                    目标：{expertStats.roleGoals}
                  </Typography>
                )}
              </Box>
            )}

            {/* 引用的平台 Skill — 点击后在右侧主内容区展示 */}
            {skillRefs.length > 0 && (
              <Box sx={{ mb: expertStats.toolNames.length > 0 ? 2 : 0 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#FF6600', mb: 0.5 }}>
                  🔗 引用 Skill ({skillRefs.length})
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                  {skillRefs.map((ref, i) => {
                    const skillName = ref.skill_name;
                    const displayName = ref.skill_display_name || skillName;
                    const isPublished = !!ref.skill_id;
                    const isActive = viewingSkill?.name === skillName;

                    return (
                      <Chip
                        key={i}
                        label={displayName}
                        size="small"
                        onClick={() => handleViewSkill(skillName, ref.skill_id)}
                        sx={{
                          cursor: 'pointer',
                          fontWeight: isActive ? 700 : 500,
                          bgcolor: isActive ? 'rgba(255,102,0,0.15)' : isPublished ? 'rgba(16,185,129,0.06)' : 'rgba(245,158,11,0.06)',
                          color: isActive ? '#CC5200' : isPublished ? '#059669' : '#D97706',
                          border: isActive ? '1.5px solid #FF6600' : '1px solid transparent',
                          '&:hover': { bgcolor: 'rgba(255,102,0,0.12)' },
                        }}
                      />
                    );
                  })}
                </Box>
              </Box>
            )}

            {/* 工具清单 */}
            {expertStats.toolNames.length > 0 && (
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, color: colors.success, mb: 0.5 }}>包含工具</Typography>
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                  {expertStats.toolNames.slice(0, 6).map((name, i) => (
                    <Chip key={i} label={name} size="small" sx={{ bgcolor: 'rgba(16,185,129,0.08)', color: colors.success, fontSize: '0.75rem' }} />
                  ))}
                  {expertStats.toolNames.length > 6 && (
                    <Chip label={`+${expertStats.toolNames.length - 6}`} size="small" variant="outlined" sx={{ fontSize: '0.75rem' }} />
                  )}
                </Box>
              </Box>
            )}
          </Paper>
        )}

        {/* 操作按钮组 */}
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            startIcon={liked ? <ThumbUp /> : <ThumbUpOutlined />}
            onClick={toggleLike}
            sx={{
              borderColor: liked ? colors.primary : colors.border,
              color: liked ? colors.primary : colors.textSecondary,
            }}
          >
            {formatNumber(resource.like_count)}
          </Button>
          <Button
            variant="outlined"
            startIcon={favorited ? <Favorite /> : <FavoriteBorder />}
            onClick={toggleFavorite}
            sx={{
              borderColor: favorited ? colors.danger : colors.border,
              color: favorited ? colors.danger : colors.textSecondary,
            }}
          >
            {formatNumber(resource.favorite_count)}
          </Button>

          {/* 上传新版本按钮 */}
          <Button
            variant="outlined"
            startIcon={<PublishIcon />}
            onClick={() => setVersionDialogOpen(true)}
            sx={{
              ml: 'auto',
              borderColor: colors.warning,
              color: colors.warning,
              '&:hover': {
                borderColor: colors.warning,
                bgcolor: 'rgba(255,102,0,0.04)',
              },
            }}
          >
            上传新版本
          </Button>
        </Box>
      </Paper>

      {isExpert && fileTree ? (
        /* ===== Expert 包结构视图 — 两列布局 ===== */
        <Grid container spacing={3}>
          {/* 左侧边栏：包结构 + 标签 + 作者 + 安装指引 */}
          <Grid item xs={12} md={4}>
            <Box sx={{ position: 'sticky', top: 88, maxHeight: 'calc(100vh - 104px)', overflowY: 'auto' }}>
            <Paper sx={{ mb: 3, overflow: 'hidden', bgcolor: colors.bgWhite }}>
              {/* 包结构标题 — 醒目的强调色条 */}
              <Box sx={{
                px: 2,
                py: 1.5,
                bgcolor: colors.primaryMuted,
                borderBottom: `2px solid ${colors.primary}`,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}>
                <AccountTreeIcon sx={{ fontSize: 18, color: colors.primary }} />
                <Typography
                  variant="subtitle1"
                  fontWeight={700}
                  sx={{ color: colors.primary, fontFamily: '"Play", sans-serif', fontSize: '0.95rem' }}
                >
                  包结构
                </Typography>
                <Chip
                  label={`${expertFiles.length} 文件`}
                  size="small"
                  sx={{ ml: 'auto', bgcolor: 'rgba(28,134,226,0.12)', color: colors.primary, fontSize: '0.7rem', fontWeight: 500 }}
                />
              </Box>

              {/* Expert 内容摘要 — 技能 + 工具一览（有数据时才显示） */}
              {expertStats && (expertStats.skillNames.length > 0 || expertStats.toolNames.length > 0 || skillRefs.length > 0) && (
                <Box sx={{ px: 2, py: 1.5, borderBottom: `1px solid ${colors.border}`, bgcolor: 'rgba(0,0,0,0.01)' }}>
                  {/* 技能列表 */}
                  {expertStats.skillNames.length > 0 && (
                    <Box sx={{ mb: expertStats.toolNames.length > 0 || skillRefs.length > 0 ? 1.5 : 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                        <AutoAwesomeIcon sx={{ fontSize: 14, color: colors.primary }} />
                        <Typography variant="caption" sx={{ fontWeight: 600, color: colors.primary, fontSize: '0.72rem' }}>
                          技能 ({expertStats.skillNames.length})
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {expertStats.skillNames.map((name, i) => {
                          // 查找对应的 skill_id（如果有平台引用）
                          const ref = skillRefs.find(r => r.skill_name === name);
                          const isActive = viewingSkill?.name === name;
                          return (
                            <Chip
                              key={i}
                              label={name}
                              size="small"
                              onClick={() => handleViewSkill(name, ref?.skill_id)}
                              sx={{
                                cursor: 'pointer',
                                bgcolor: isActive ? 'rgba(255,102,0,0.15)' : colors.primaryMuted,
                                color: isActive ? '#CC5200' : colors.primary,
                                border: isActive ? '1.5px solid #FF6600' : '1px solid transparent',
                                fontSize: '0.7rem',
                                fontWeight: isActive ? 700 : 500,
                                height: 22,
                                '&:hover': { bgcolor: 'rgba(255,102,0,0.12)' },
                              }}
                            />
                          );
                        })}
                      </Box>
                    </Box>
                  )}

                  {/* 工具列表 */}
                  {expertStats.toolNames.length > 0 && (
                    <Box sx={{ mb: skillRefs.length > 0 ? 1.5 : 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                        <CodeIcon sx={{ fontSize: 14, color: colors.success }} />
                        <Typography variant="caption" sx={{ fontWeight: 600, color: colors.success, fontSize: '0.72rem' }}>
                          工具 ({expertStats.toolNames.length})
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {expertStats.toolNames.map((name, i) => (
                          <Chip
                            key={i}
                            label={name}
                            size="small"
                            sx={{
                              bgcolor: 'rgba(16,185,129,0.08)',
                              color: colors.success,
                              fontSize: '0.7rem',
                              fontWeight: 500,
                              height: 22,
                            }}
                          />
                        ))}
                      </Box>
                    </Box>
                  )}

                </Box>
              )}

              {/* 文件树 */}
              <List dense disablePadding>
                {Object.values(fileTree.children).map(child => (
                  <FileTreeNode
                    key={child.path || child.name}
                    node={child}
                    selectedPath={selectedFile?.path}
                    onSelect={(node) => { setSelectedFile(node); updateViewingSkill(null); }}
                  />
                ))}
              </List>
            </Paper>

            {/* 标签 */}
            {resource.tags_detail?.length > 0 && (
              <Paper sx={{ p: 2.5, mb: 3, bgcolor: colors.bgWhite }}>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600, color: colors.textPrimary }}>标签</Typography>
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                  {resource.tags_detail.map(tag => (
                    <Chip key={tag.id} label={tag.name} size="small" variant="outlined"
                      sx={{ borderColor: tag.category === 'team' ? '#2563EB' : tag.category === 'tool' ? '#059669' : tag.category === 'workflow' ? '#D97706' : '#E5E7EB' }}
                    />
                  ))}
                </Box>
              </Paper>
            )}

            {/* 作者 */}
            <Paper sx={{ p: 2.5, mb: 3, bgcolor: colors.bgWhite }}>
              <Typography variant="subtitle2" sx={{ mb: 0.5, fontWeight: 600, color: colors.textPrimary }}>作者</Typography>
              <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                {resource.author_display_name || resource.author_name}
              </Typography>
            </Paper>

            <Paper sx={{ p: 3, mb: 3, bgcolor: colors.bgWhite }}>
              <InstallGuide resource={resource} />
            </Paper>
          </Box>
          </Grid>

          {/* 右侧主区域：Tabs（内容 | 更新日志）+ 评论 */}
          <Grid item xs={12} md={8}>
            <Paper sx={{ mb: 3, minHeight: 400, bgcolor: colors.bgWhite }}>
              {/* ── Expert Tabs 切换栏 ── */}
              <Box sx={{ borderBottom: `1px solid ${colors.border}` }}>
                <Tabs
                  value={mainTabValue}
                  onChange={(_, v) => setMainTabValue(v)}
                  sx={{ px: 2 }}
                >
                  <Tab
                    icon={<DescriptionIcon sx={{ fontSize: 18 }} />}
                    iconPosition="start"
                    label="内容"
                    sx={{ minHeight: 48, py: 1.5 }}
                  />
                  <Tab
                    icon={<HistoryToggleOffIcon sx={{ fontSize: 18 }} />}
                    iconPosition="start"
                    label="更新日志"
                    sx={{ minHeight: 48, py: 1.5 }}
                  />
                </Tabs>
              </Box>

              {/* ── Tab 0: 文件/Skill 内容预览 ── */}
              {mainTabValue === 0 && (
                <Box sx={{ p: 3 }}>
                  {/* ── 正在查看 Skill ── */}
                  {viewingSkill ? (
                    <>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                        <ExtensionIcon sx={{ fontSize: 20, color: '#FF6600' }} />
                        <Typography variant="h6" sx={{ fontFamily: '"Play", sans-serif' }}>
                          {viewingSkill.name}
                        </Typography>
                        <Chip
                          label="引用 Skill"
                          size="small"
                          sx={{ bgcolor: 'rgba(255,102,0,0.08)', color: '#CC5200', fontSize: '0.7rem' }}
                        />
                        <Button
                          size="small"
                          onClick={() => updateViewingSkill(null)}
                          sx={{ ml: 'auto', color: colors.textMuted, fontSize: '0.75rem' }}
                        >
                          ← 返回文件
                        </Button>
                      </Box>
                      <Divider sx={{ mb: 2, borderColor: colors.border }} />
                      {viewingSkill.loading ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 4, justifyContent: 'center' }}>
                          <CircularProgress size={20} sx={{ color: colors.primary }} />
                          <Typography variant="body2" sx={{ color: colors.textMuted }}>加载 Skill 内容...</Typography>
                        </Box>
                      ) : viewingSkill.content ? (
                        <MarkdownViewer content={viewingSkill.content} />
                      ) : (
                        <Box sx={{ textAlign: 'center', py: 6, color: colors.textMuted }}>
                          <ExtensionIcon sx={{ fontSize: 36, mb: 1, opacity: 0.3 }} />
                          <Typography>此 Skill 暂无可预览内容</Typography>
                        </Box>
                      )}
                    </>
                  ) : selectedFile ? (
                    /* ── 正在查看文件 ── */
                    <>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                        <Typography variant="h6" sx={{ fontFamily: '"Play", sans-serif' }}>
                          {selectedFile.name}
                        </Typography>
                        <Chip
                          label={selectedFile.path}
                          size="small"
                          sx={{
                            fontFamily: '"JetBrains Mono", monospace',
                            fontSize: '0.7rem',
                            variant: 'outlined',
                          }}
                        />
                      </Box>
                      <Divider sx={{ mb: 2, borderColor: colors.border }} />
                      {selectedFile && (selectedFile.name || '').endsWith('.md') ? (
                        <MarkdownViewer content={selectedFile.content} />
                      ) : (
                        <Box component="pre" sx={{
                          bgcolor: '#1E293B',
                          color: '#CDD6F4',
                          p: 2,
                          borderRadius: 1,
                          border: `1px solid ${colors.border}`,
                          overflow: 'auto',
                          fontSize: '0.85rem',
                          lineHeight: 1.6,
                          fontFamily: '"JetBrains Mono", monospace',
                        }}>
                          {selectedFile.content}
                        </Box>
                      )}
                    </>
                  ) : (
                    <Box sx={{ textAlign: 'center', py: 8, color: colors.textMuted }}>
                      <InsertDriveFileIcon sx={{ fontSize: 48, mb: 1, opacity: 0.4 }} />
                      <Typography>选择左侧文件或点击上方 Skill 以预览内容</Typography>
                    </Box>
                  )}
                </Box>
              )}

              {/* ── Tab 1: 更新日志 / 版本历史 ── */}
              {mainTabValue === 1 && (
                <Box sx={{ p: 3 }}>
                  {resource.versions && resource.versions.length > 0 ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                      {[...resource.versions]
                        .sort((a, b) => {
                          // 按版本号倒序排列（最新在上）
                          const verA = a.version.split('.').map(Number);
                          const verB = b.version.split('.').map(Number);
                          for (let i = 0; i < Math.max(verA.length, verB.length); i++) {
                            const diff = (verB[i] || 0) - (verA[i] || 0);
                            if (diff !== 0) return diff;
                          }
                          // 版本号相同时按创建时间倒序
                          return new Date(b.created_at) - new Date(a.created_at);
                        })
                        .map((ver, index, arr) => {
                          const isCurrent = ver.version === resource.current_version;
                          const isLast = index === arr.length - 1;
                          return (
                            <Box
                              key={ver.id || ver.version}
                              sx={{
                                position: 'relative',
                                pl: 3,
                                pb: isLast ? 0 : 3,
                                // 左侧时间线
                                '&::before': {
                                  content: '""',
                                  position: 'absolute',
                                  left: 7,
                                  top: 8,
                                  bottom: isLast ? '50%' : 0,
                                  width: 2,
                                  bgcolor: isCurrent ? colors.primary : colors.border,
                                },
                                // 时间线节点圆点
                                '&::after': {
                                  content: '""',
                                  position: 'absolute',
                                  left: 2,
                                  top: 6,
                                  width: 12,
                                  height: 12,
                                  borderRadius: '50%',
                                  bgcolor: isCurrent ? colors.primary : colors.bgWhite,
                                  border: `2px solid ${isCurrent ? colors.primary : colors.border}`,
                                },
                              }}
                            >
                              {/* 版本号 + 日期行 */}
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                <Typography
                                  variant="subtitle2"
                                  sx={{
                                    fontWeight: 700,
                                    fontFamily: '"JetBrains Mono", monospace',
                                    color: isCurrent ? colors.primary : colors.textPrimary,
                                    fontSize: '0.9rem',
                                  }}
                                >
                                  v{ver.version}
                                </Typography>
                                {isCurrent && (
                                  <Chip
                                    label="当前版本"
                                    size="small"
                                    sx={{
                                      height: 20,
                                      fontSize: '0.65rem',
                                      fontWeight: 600,
                                      bgcolor: colors.primaryMuted,
                                      color: colors.primary,
                                    }}
                                  />
                                )}
                                <Typography
                                  variant="caption"
                                  sx={{ color: colors.textMuted, ml: 'auto' }}
                                >
                                  {formatDate(ver.created_at)}
                                </Typography>
                              </Box>

                              {/* Changelog 内容 */}
                              {ver.changelog ? (
                                <Typography
                                  variant="body2"
                                  sx={{
                                    color: colors.textSecondary,
                                    lineHeight: 1.7,
                                    whiteSpace: 'pre-wrap',
                                  }}
                                >
                                  {ver.changelog}
                                </Typography>
                              ) : (
                                <Typography
                                  variant="body2"
                                  sx={{ color: colors.textMuted, fontStyle: 'italic' }}
                                >
                                  无更新说明
                                </Typography>
                              )}
                            </Box>
                          );
                        })}
                    </Box>
                  ) : (
                    /* 无版本记录时的空状态 */
                    <Box sx={{ textAlign: 'center', py: 8, color: colors.textMuted }}>
                      <HistoryToggleOffIcon sx={{ fontSize: 48, mb: 1, opacity: 0.4 }} />
                      <Typography>暂无更新日志</Typography>
                    </Box>
                  )}
                </Box>
              )}
            </Paper>
            <Paper sx={{ p: 3, bgcolor: colors.bgWhite }}>
              <CommentSection resourceId={id} />
            </Paper>
          </Grid>
        </Grid>
      ) : (
        /* ===== 普通资源视图 ===== */
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Paper sx={{ p: 3, mb: 3, bgcolor: colors.bgWhite }}>
              <Typography variant="h6" sx={{ mb: 2, fontFamily: '"Play", sans-serif' }}>内容</Typography>
              <MarkdownViewer content={descriptionContent} />
            </Paper>
            <Paper sx={{ p: 3, bgcolor: colors.bgWhite }}>
              <CommentSection resourceId={id} />
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Box sx={{ position: 'sticky', top: 88, maxHeight: 'calc(100vh - 104px)', overflowY: 'auto' }}>
            {/* ── Skill 被 Expert 引用标记 ── */}
            {resource.type === 'skill' && resource.referenced_by_experts?.length > 0 && (
              <Paper sx={{ p: 2.5, mb: 3, bgcolor: 'rgba(255,102,0,0.04)', border: '1px solid rgba(255,102,0,0.15)' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                  <ExtensionIcon sx={{ fontSize: 16, color: '#FF6600' }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#FF6600', fontSize: '0.85rem' }}>
                    被 {resource.referenced_by_experts.length} 个专家引用
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  {resource.referenced_by_experts.map((expert, i) => (
                    <Chip
                      key={i}
                      label={expert.display_name}
                      size="small"
                      component="a"
                      href={`/resources/${expert.id}`}
                      clickable
                      sx={{
                        justifyContent: 'flex-start',
                        bgcolor: 'rgba(255,102,0,0.08)',
                        color: '#CC5200',
                        fontWeight: 500,
                        fontSize: '0.78rem',
                        textDecoration: 'none',
                        '&:hover': { bgcolor: 'rgba(255,102,0,0.15)' },
                      }}
                    />
                  ))}
                </Box>
              </Paper>
            )}
            <Paper sx={{ p: 3, mb: 3, bgcolor: colors.bgWhite }}>
              <InstallGuide resource={resource} />
            </Paper>
            {resource.tags_detail?.length > 0 && (
              <Paper sx={{ p: 3, mb: 3, bgcolor: colors.bgWhite }}>
                <Typography variant="h6" sx={{ mb: 1, fontFamily: '"Play", sans-serif' }}>标签</Typography>
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                  {resource.tags_detail.map(tag => (
                    <Chip key={tag.id} label={tag.name} size="small" variant="outlined"
                      sx={{ borderColor: tag.category === 'team' ? '#2563EB' : tag.category === 'tool' ? '#059669' : tag.category === 'workflow' ? '#D97706' : '#E5E7EB' }}
                    />
                  ))}
                </Box>
              </Paper>
            )}
            <Paper sx={{ p: 3, bgcolor: colors.bgWhite }}>
              <Typography variant="h6" sx={{ mb: 1, fontFamily: '"Play", sans-serif' }}>作者</Typography>
              <Typography sx={{ color: colors.textSecondary }}>
                {resource.author_display_name || resource.author_name}
              </Typography>
            </Paper>
          </Box>
          </Grid>
        </Grid>
      )}

      {/* 上传新版本对话框 */}
      <VersionUploadDialog
        open={versionDialogOpen}
        onClose={() => setVersionDialogOpen(false)}
        resource={resource}
        onSuccess={fetchResource}
      />
    </Box>
  );
}
