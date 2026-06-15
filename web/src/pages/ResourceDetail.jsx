/**
 * ResourceDetail - 资源详情页（JokerPS 亮色清新风格）
 *
 * 保持所有功能逻辑不变，仅重构视觉层。
 * 文件树、Markdown 预览、评论区全部适配亮色主题。
 */

import { useParams } from 'react-router-dom';
import { useState, useEffect, useMemo } from 'react';
import Box from '@mui/material/Box';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Collapse from '@mui/material/Collapse';
import ThumbUp from '@mui/icons-material/ThumbUp';
import ThumbUpOutlined from '@mui/icons-material/ThumbUpOutlined';
import Favorite from '@mui/icons-material/Favorite';
import FavoriteBorder from '@mui/icons-material/FavoriteBorder';
import Download from '@mui/icons-material/Download';
import FolderIcon from '@mui/icons-material/Folder';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import BuildIcon from '@mui/icons-material/Build';
import PsychologyIcon from '@mui/icons-material/Psychology';
import ExtensionIcon from '@mui/icons-material/Extension';
import apiClient from '../api/client';
import TypeBadge from '../components/TypeBadge';
import MarkdownViewer from '../components/MarkdownViewer';
import InstallGuide from '../components/InstallGuide';
import CommentSection from '../components/CommentSection';
import { useInteractions } from '../hooks/useInteractions';
import { formatNumber, formatDate } from '../utils/format';
import { colors } from '../theme';
import ThankYouDialog from '../components/ThankYouDialog';

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
  const icon = (node.name || '').endsWith('.md')
    ? <InsertDriveFileIcon fontSize="small" sx={{ color: colors.primary }} />
    : (node.name || '').endsWith('.json')
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
  const [selectedFile, setSelectedFile] = useState(null);
  const { liked, favorited, toggleLike, toggleFavorite } = useInteractions(id);
  const [thanksOpen, setThanksOpen] = useState(false);
  const [tabValue, setTabValue] = useState(0);

  const isExpert = resource?.type === 'expert';

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

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    apiClient.get(`/resources/${id}`)
      .then(res => {
        if (!cancelled) {
          setResource(res.data);
          if (res.data?.type === 'expert' && res.data?.files?.length > 0) {
            setExpertFiles(res.data.files);
            const promptFile = res.data.files.find(f => f.path === 'prompt.md');
            if (promptFile) {
              setSelectedFile(promptFile);
              setDescriptionContent(promptFile.content);
            } else {
              setDescriptionContent(res.data.description || '');
            }
          } else if (res.data?.versions?.length > 0) {
            const version = res.data.current_version || res.data.versions[0].version;
            apiClient.get(`/resources/${id}/download?version=${version}`)
              .then(dlRes => {
                if (!cancelled) {
                  const files = dlRes.data?.files || [];
                  const mdFile = files.find(f => f.filename.endsWith('.md') || f.filename.endsWith('.mdx'));
                  if (mdFile) setDescriptionContent(mdFile.content);
                  else if (files.length > 0) setDescriptionContent(files[0].content);
                  else if (res.data.description) setDescriptionContent(res.data.description);
                }
              });
          } else if (res.data.description) {
            setDescriptionContent(res.data.description);
          }
        }
      })
      .catch(err => console.error('Failed to fetch resource:', err))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

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

            {/* 技能清单 */}
            {expertStats.skillNames.length > 0 && (
              <Box sx={{ mb: expertStats.toolNames.length > 0 ? 2 : 0 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, color: colors.primary, mb: 0.5 }}>包含技能</Typography>
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                  {expertStats.skillNames.slice(0, 8).map((name, i) => (
                    <Chip key={i} label={name} size="small" sx={{ bgcolor: colors.primaryMuted, color: colors.primary, fontSize: '0.75rem' }} />
                  ))}
                  {expertStats.skillNames.length > 8 && (
                    <Chip label={`+${expertStats.skillNames.length - 8}`} size="small" variant="outlined" sx={{ fontSize: '0.75rem' }} />
                  )}
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
            variant="contained"
            startIcon={<Download />}
            onClick={async () => {
              try {
                await apiClient.get(`/resources/${id}/download`);
                const key = `thanks_dialog_dismissed_${id}`;
                const dismissed = localStorage.getItem(key);
                if (!dismissed || Date.now() - parseInt(dismissed) > 7 * 24 * 60 * 60 * 1000) {
                  setThanksOpen(true);
                }
              } catch (e) {}
            }}
          >
            下载 ({formatNumber(resource.download_count)})
          </Button>
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
        </Box>
      </Paper>

      {isExpert && fileTree ? (
        /* ===== Expert 包结构视图 ===== */
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Box sx={{ position: 'sticky', top: 88, maxHeight: 'calc(100vh - 104px)', overflowY: 'auto' }}>
            <Paper sx={{ mb: 3, overflow: 'hidden', bgcolor: colors.bgWhite }}>
              <Box sx={{ px: 2, py: 1.5, bgcolor: 'rgba(0,0,0,0.02)', borderBottom: `1px solid ${colors.border}` }}>
                <Typography
                  variant="subtitle2"
                  fontWeight={600}
                  sx={{ fontFamily: '"Play", sans-serif', color: colors.textPrimary }}
                >
                  包结构
                </Typography>
              </Box>
              <List dense disablePadding>
                {Object.values(fileTree.children).map(child => (
                  <FileTreeNode
                    key={child.path || child.name}
                    node={child}
                    selectedPath={selectedFile?.path}
                    onSelect={(node) => setSelectedFile(node)}
                  />
                ))}
              </List>
            </Paper>
            <Paper sx={{ p: 3, mb: 3, bgcolor: colors.bgWhite }}>
              <InstallGuide resource={resource} />
            </Paper>
          </Box>
          </Grid>

          <Grid item xs={12} md={8}>
            <Paper sx={{ p: 3, mb: 3, minHeight: 400, bgcolor: colors.bgWhite }}>
              {selectedFile ? (
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
                  <Typography>选择左侧文件以预览内容</Typography>
                </Box>
              )}
            </Paper>
            <Paper sx={{ p: 3, bgcolor: colors.bgWhite }}>
              <CommentSection resourceId={id} />
            </Paper>
          </Grid>

          <Grid item xs={12} md={4}>
            <Box sx={{ position: 'sticky', top: 88, maxHeight: 'calc(100vh - 104px)', overflowY: 'auto' }}>
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
            {resource.scenes && resource.scenes.length > 0 && (
              <Paper sx={{ p: 3, mb: 3, bgcolor: colors.bgWhite }}>
                <Typography variant="h6" sx={{ mb: 1, fontFamily: '"Play", sans-serif' }}>所属场景</Typography>
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                  {resource.scenes.map(scene => (
                    <Chip key={scene.id} label={scene.display_name} size="small"
                      component="a" href={`/scenes/${scene.id}`} clickable
                      sx={{ bgcolor: 'rgba(124, 58, 237, 0.08)', color: '#7C3AED', fontWeight: 600, textDecoration: 'none' }}
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
            {resource.scenes && resource.scenes.length > 0 && (
              <Paper sx={{ p: 3, mb: 3, bgcolor: colors.bgWhite }}>
                <Typography variant="h6" sx={{ mb: 1, fontFamily: '"Play", sans-serif' }}>所属场景</Typography>
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                  {resource.scenes.map(scene => (
                    <Chip key={scene.id} label={scene.display_name} size="small"
                      component="a" href={`/scenes/${scene.id}`} clickable
                      sx={{ bgcolor: 'rgba(124, 58, 237, 0.08)', color: '#7C3AED', fontWeight: 600, textDecoration: 'none' }}
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

      {/* 感谢弹窗 */}
      <ThankYouDialog
        open={thanksOpen}
        onClose={() => setThanksOpen(false)}
        resourceName={resource.display_name || resource.name}
        authorName={resource.author_display_name || resource.author_name}
        resourceId={id}
      />
    </Box>
  );
}