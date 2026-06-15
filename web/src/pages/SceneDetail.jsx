/**
 * SceneDetail - 场景详情页
 *
 * Tab 布局：概述 | 安装方式 | 版本历史
 * 展示场景的组成结构（Rules + Skills + Hook）
 */
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Grid from '@mui/material/Grid';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import CircularProgress from '@mui/material/CircularProgress';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import ExtensionIcon from '@mui/icons-material/Extension';
import BoltIcon from '@mui/icons-material/Bolt';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import InstallGuide from '../components/InstallGuide';
import { colors } from '../theme';
import apiClient from '../api/client';
import { formatDate } from '../utils/format';

const SCENE_ACCENT = '#7C3AED';

export default function SceneDetail() {
  const { id } = useParams();
  const [scene, setScene] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState(0);

  useEffect(() => {
    setLoading(true);
    apiClient.get(`/scenes/${id}`)
      .then(res => setScene(res.data))
      .catch(err => setError(err.message || '加载失败'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress size={48} sx={{ color: SCENE_ACCENT }} />
      </Box>
    );
  }

  if (error || !scene) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Typography variant="h6" sx={{ color: colors.textSecondary }}>
          {error || '场景不存在'}
        </Typography>
      </Box>
    );
  }

  const { rules, skills_detail, hook, tags } = scene;

  return (
    <Box>
      {/* 标题区 */}
      <Paper sx={{ p: 3, mb: 3, bgcolor: colors.bgWhite, borderRadius: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Chip label="场景" size="small" sx={{ bgcolor: 'rgba(124, 58, 237, 0.1)', color: SCENE_ACCENT, fontWeight: 600, fontSize: '0.75rem' }} />
              <Typography variant="caption" sx={{ color: colors.textMuted }}>
                {scene.author_display_name || scene.author_name} · {formatDate(scene.created_at)}
              </Typography>
            </Box>
            <Typography variant="h4" sx={{ fontFamily: '"Play", sans-serif', color: colors.textPrimary, mb: 1 }}>
              {scene.display_name}
            </Typography>
            {scene.description && (
              <Typography variant="body1" sx={{ color: colors.textSecondary }}>
                {scene.description}
              </Typography>
            )}
          </Box>
        </Box>

        {/* 组成结构概览 */}
        <Box sx={{ display: 'flex', gap: 2, mt: 2, flexWrap: 'wrap' }}>
          {rules && (
            <Chip
              icon={<AutoFixHighIcon />}
              label={`规范: ${rules.display_name}`}
              variant="outlined"
              onClick={() => window.open(`/resources/${rules.id}`, '_blank')}
              onDelete={() => window.open(`/resources/${rules.id}`, '_blank')}
              deleteIcon={<OpenInNewIcon />}
              sx={{ borderColor: '#E5E7EB' }}
            />
          )}
          <Chip
            icon={<ExtensionIcon />}
            label={`${(skills_detail || []).length} 个技能`}
            variant="outlined"
            sx={{ borderColor: '#E5E7EB' }}
          />
          {hook && (
            <Chip
              icon={<BoltIcon />}
              label={`自动化: ${hook.display_name}`}
              variant="outlined"
              onClick={() => window.open(`/resources/${hook.id}`, '_blank')}
              onDelete={() => window.open(`/resources/${hook.id}`, '_blank')}
              deleteIcon={<OpenInNewIcon />}
              sx={{ borderColor: '#E5E7EB' }}
            />
          )}
        </Box>
      </Paper>

      {/* Tab 布局 */}
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{
          mb: 3,
          '& .MuiTab-root': {
            textTransform: 'none',
            fontWeight: 600,
            fontSize: '0.9rem',
            color: colors.textSecondary,
          },
          '& .Mui-selected': { color: `${SCENE_ACCENT} !important` },
          '& .MuiTabs-indicator': { bgcolor: SCENE_ACCENT },
        }}
      >
        <Tab label="概述" />
        <Tab label="安装方式" />
        <Tab label="版本历史" />
      </Tabs>

      {/* Tab 内容 */}
      {tab === 0 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            {/* 技能列表 */}
            <Paper sx={{ p: 3, mb: 3, bgcolor: colors.bgWhite, borderRadius: 2 }}>
              <Typography variant="h6" sx={{ fontFamily: '"Play", sans-serif', mb: 2, color: colors.textPrimary }}>
                包含的技能
              </Typography>
              {skills_detail && skills_detail.length > 0 ? (
                <List disablePadding>
                  {skills_detail.map((skill, idx) => (
                    <ListItem
                      key={skill.id}
                      sx={{
                        px: 2,
                        py: 1.5,
                        borderRadius: 1,
                        mb: 0.5,
                        bgcolor: idx % 2 === 0 ? 'rgba(0,0,0,0.01)' : 'transparent',
                        cursor: 'pointer',
                        '&:hover': { bgcolor: 'rgba(124, 58, 237, 0.04)' },
                      }}
                      onClick={() => window.open(`/resources/${skill.id}`, '_blank')}
                    >
                      <ListItemIcon sx={{ minWidth: 36 }}>
                        <ExtensionIcon sx={{ fontSize: 20, color: colors.textMuted }} />
                      </ListItemIcon>
                      <ListItemText
                        primary={skill.display_name}
                        secondary={skill.description?.slice(0, 100) || ''}
                        primaryTypographyProps={{ fontWeight: 600, fontSize: '0.9rem', color: colors.textPrimary }}
                        secondaryTypographyProps={{ fontSize: '0.8rem', color: colors.textMuted }}
                      />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Typography variant="body2" sx={{ color: colors.textMuted }}>暂无技能</Typography>
              )}
            </Paper>

            {/* 规范详情 */}
            {rules && (
              <Paper sx={{ p: 3, mb: 3, bgcolor: colors.bgWhite, borderRadius: 2 }}>
                <Typography variant="h6" sx={{ fontFamily: '"Play", sans-serif', mb: 1, color: colors.textPrimary }}>
                  行为规范
                </Typography>
                <ListItem
                  sx={{ px: 2, py: 1.5, borderRadius: 1, cursor: 'pointer', '&:hover': { bgcolor: 'rgba(124, 58, 237, 0.04)' } }}
                  onClick={() => window.open(`/resources/${rules.id}`, '_blank')}
                >
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <AutoFixHighIcon sx={{ fontSize: 20, color: colors.textMuted }} />
                  </ListItemIcon>
                  <ListItemText
                    primary={rules.display_name}
                    secondary={rules.description?.slice(0, 100) || ''}
                    primaryTypographyProps={{ fontWeight: 600, fontSize: '0.9rem' }}
                    secondaryTypographyProps={{ fontSize: '0.8rem', color: colors.textMuted }}
                  />
                </ListItem>
              </Paper>
            )}

            {/* 自动化钩子 */}
            {hook && (
              <Paper sx={{ p: 3, mb: 3, bgcolor: colors.bgWhite, borderRadius: 2 }}>
                <Typography variant="h6" sx={{ fontFamily: '"Play", sans-serif', mb: 1, color: colors.textPrimary }}>
                  自动化钩子
                </Typography>
                <ListItem
                  sx={{ px: 2, py: 1.5, borderRadius: 1, cursor: 'pointer', '&:hover': { bgcolor: 'rgba(124, 58, 237, 0.04)' } }}
                  onClick={() => window.open(`/resources/${hook.id}`, '_blank')}
                >
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <BoltIcon sx={{ fontSize: 20, color: colors.textMuted }} />
                  </ListItemIcon>
                  <ListItemText
                    primary={hook.display_name}
                    secondary={hook.description?.slice(0, 100) || ''}
                    primaryTypographyProps={{ fontWeight: 600, fontSize: '0.9rem' }}
                    secondaryTypographyProps={{ fontSize: '0.8rem', color: colors.textMuted }}
                  />
                </ListItem>
              </Paper>
            )}
          </Grid>

          {/* 右侧栏：标签 + 统计 */}
          <Grid item xs={12} md={4}>
            <Box sx={{ position: 'sticky', top: 88 }}>
              {tags && tags.length > 0 && (
                <Paper sx={{ p: 3, mb: 3, bgcolor: colors.bgWhite, borderRadius: 2 }}>
                  <Typography variant="h6" sx={{ fontFamily: '"Play", sans-serif', mb: 1.5 }}>标签</Typography>
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    {tags.map(tag => (
                      <Chip key={tag} label={tag} size="small" variant="outlined" sx={{ borderColor: '#E5E7EB' }} />
                    ))}
                  </Box>
                </Paper>
              )}

              <Paper sx={{ p: 3, bgcolor: colors.bgWhite, borderRadius: 2 }}>
                <Typography variant="h6" sx={{ fontFamily: '"Play", sans-serif', mb: 1.5 }}>统计</Typography>
                <Box sx={{ display: 'flex', gap: 3 }}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h5" sx={{ fontWeight: 700, color: SCENE_ACCENT, fontFamily: '"JetBrains Mono", monospace' }}>
                      {scene.download_count || 0}
                    </Typography>
                    <Typography variant="caption" sx={{ color: colors.textMuted }}>安装</Typography>
                  </Box>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h5" sx={{ fontWeight: 700, color: colors.textPrimary, fontFamily: '"JetBrains Mono", monospace' }}>
                      {scene.like_count || 0}
                    </Typography>
                    <Typography variant="caption" sx={{ color: colors.textMuted }}>点赞</Typography>
                  </Box>
                </Box>
              </Paper>
            </Box>
          </Grid>
        </Grid>
      )}

      {tab === 1 && (
        <Box sx={{ maxWidth: 720 }}>
          <InstallGuide resource={scene} />
          {skills_detail && skills_detail.length > 0 && (
            <Paper sx={{ p: 3, mt: 3, bgcolor: colors.bgWhite, borderRadius: 2 }}>
              <Typography variant="h6" sx={{ fontFamily: '"Play", sans-serif', mb: 2 }}>
                批量安装所有技能
              </Typography>
              <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 2 }}>
                你也可以逐个安装场景中包含的技能：
              </Typography>
              <List disablePadding>
                {skills_detail.map(skill => (
                  <ListItem key={skill.id} sx={{ px: 0, py: 0.5 }}>
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      <ExtensionIcon sx={{ fontSize: 18, color: colors.textMuted }} />
                    </ListItemIcon>
                    <ListItemText
                      primary={skill.display_name}
                      secondary={`skhub install ${skill.name}`}
                      primaryTypographyProps={{ fontSize: '0.85rem', fontWeight: 600 }}
                      secondaryTypographyProps={{ fontSize: '0.75rem', fontFamily: '"JetBrains Mono", monospace', color: colors.textMuted }}
                    />
                  </ListItem>
                ))}
              </List>
            </Paper>
          )}
        </Box>
      )}

      {tab === 2 && (
        <Paper sx={{ p: 4, bgcolor: colors.bgWhite, borderRadius: 2, textAlign: 'center' }}>
          <Typography variant="h6" sx={{ color: colors.textSecondary, mb: 2 }}>
            版本历史
          </Typography>
          <Box sx={{ py: 4 }}>
            <Typography variant="body1" sx={{ color: colors.textMuted, mb: 1 }}>
              v{scene.version || '1.0.0'}
            </Typography>
            <Typography variant="body2" sx={{ color: colors.textMuted }}>
              创建于 {formatDate(scene.created_at)}
            </Typography>
          </Box>
        </Paper>
      )}
    </Box>
  );
}