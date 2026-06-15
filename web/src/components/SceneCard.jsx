/**
 * SceneCard - 场景卡片组件
 *
 * 展示一个企业工作流场景，包含 Rules + Skills + Hook 的组合信息。
 * 紫色主题（accent: #7C3AED），与 Skill（蓝色）和 Expert（橙色）区分。
 */
import { useNavigate } from 'react-router-dom';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardActionArea from '@mui/material/CardActionArea';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import Chip from '@mui/material/Chip';
import DashboardIcon from '@mui/icons-material/Dashboard';
import ExtensionIcon from '@mui/icons-material/Extension';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import BoltIcon from '@mui/icons-material/Bolt';
import { formatNumber } from '../utils/format';
import { colors } from '../theme';

const SCENE_ACCENT = '#7C3AED';

export default function SceneCard({ scene }) {
  const navigate = useNavigate();

  const tags = Array.isArray(scene.tags) ? scene.tags : [];
  const skillCount = (scene.skills_detail || scene.skills || []).length;
  const hasRules = !!scene.rules;
  const hasHook = !!scene.hook;

  return (
    <Card
      className="animate-fade-in-up"
      sx={{
        height: '100%',
        borderRadius: 2,
        border: `1px solid ${colors.border}`,
        borderLeft: `3px solid ${SCENE_ACCENT}`,
        bgcolor: colors.bgWhite,
        position: 'relative',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
        transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
        '&:hover': {
          borderColor: SCENE_ACCENT,
          borderLeftColor: SCENE_ACCENT,
          boxShadow: '0 2px 8px rgba(124, 58, 237, 0.12)',
        },
      }}
    >
      <CardActionArea onClick={() => navigate(`/scenes/${scene.id}`)} sx={{ height: '100%' }}>
        <CardContent sx={{ p: 2.5, display: 'flex', flexDirection: 'column', height: '100%', gap: 1 }}>
          {/* 标题行 */}
          <Typography
            variant="h6"
            sx={{
              fontSize: '1.1rem',
              fontWeight: 700,
              color: colors.textPrimary,
              fontFamily: '"Play", sans-serif',
              lineHeight: 1.3,
            }}
          >
            {scene.display_name}
          </Typography>

          {/* 描述 */}
          {scene.description && (
            <Typography
              variant="body2"
              sx={{
                fontSize: '0.85rem',
                lineHeight: 1.5,
                color: colors.textSecondary,
              }}
            >
              {scene.description.length > 100
                ? scene.description.slice(0, 99).trim() + '…'
                : scene.description}
            </Typography>
          )}

          {/* 组成结构：图标 + 数量 */}
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mt: 0.5 }}>
            {hasRules && (
              <Tooltip title={`规范: ${scene.rules.display_name}`}>
                <Chip
                  icon={<AutoFixHighIcon />}
                  label="规范"
                  size="small"
                  variant="outlined"
                  sx={{
                    fontSize: '0.75rem',
                    borderColor: '#E5E7EB',
                    color: colors.textSecondary,
                  }}
                />
              </Tooltip>
            )}
            <Tooltip title={`${skillCount} 个技能`}>
              <Chip
                icon={<ExtensionIcon />}
                label={`${skillCount} 个技能`}
                size="small"
                variant="outlined"
                sx={{
                  fontSize: '0.75rem',
                  borderColor: '#E5E7EB',
                  color: colors.textSecondary,
                }}
              />
            </Tooltip>
            {hasHook && (
              <Tooltip title={`自动化: ${scene.hook.display_name}`}>
                <Chip
                  icon={<BoltIcon />}
                  label="自动化"
                  size="small"
                  variant="outlined"
                  sx={{
                    fontSize: '0.75rem',
                    borderColor: '#E5E7EB',
                    color: colors.textSecondary,
                  }}
                />
              </Tooltip>
            )}
          </Box>

          {/* 标签 */}
          {tags.length > 0 && (
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              {tags.slice(0, 4).map(tag => (
                <Chip
                  key={tag}
                  label={tag}
                  size="small"
                  sx={{
                    fontSize: '0.7rem',
                    height: 20,
                    bgcolor: 'rgba(124, 58, 237, 0.06)',
                    color: SCENE_ACCENT,
                  }}
                />
              ))}
            </Box>
          )}

          <Box sx={{ flex: 1 }} />

          {/* 底部：作者 + 热度 */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              pt: 1,
              mt: 'auto',
              borderTop: `1px solid ${colors.border}`,
            }}
          >
            <Typography variant="caption" sx={{ color: colors.textMuted, fontSize: '0.75rem' }}>
              {scene.author_display_name || scene.author_name || '未知'}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Tooltip title="安装">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3, color: colors.textMuted, fontSize: '0.75rem' }}>
                  <DashboardIcon sx={{ fontSize: 13 }} />
                  <span style={{ fontFamily: '"JetBrains Mono", monospace', fontWeight: 600 }}>
                    {formatNumber(scene.download_count)}
                  </span>
                </Box>
              </Tooltip>
            </Box>
          </Box>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}