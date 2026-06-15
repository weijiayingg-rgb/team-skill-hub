/**
 * ResourceCard - 资源卡片（JokerPS 亮色清新风格）
 *
 * 设计要点：
 * - 白色背景卡片 + 微妙阴影
 * - 左侧淡色竖线标识类型
 * - hover 时亮蓝边框 + 微阴影
 * - 统计数据用 monospace 数字
 */

import { useNavigate } from 'react-router-dom';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardActionArea from '@mui/material/CardActionArea';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import ThumbUp from '@mui/icons-material/ThumbUp';
import Favorite from '@mui/icons-material/Favorite';
import Download from '@mui/icons-material/Download';
import TypeBadge from './TypeBadge';
import TagChip from './TagChip';
import { formatNumber, formatDateRelative } from '../utils/format';
import { getTypeMeta } from '../utils/constants';
import { colors } from '../theme';

// 安全解析 JSON 字符串，失败时返回空数组
function safeJSONParse(val) {
  if (typeof val !== 'string') return [];
  try { return JSON.parse(val); } catch { return []; }
}

// 获取标签数组（兼容 tags/tags_detail 为 JSON 字符串的情况）
function getTagsArray(resource) {
  if (resource.tags_detail) {
    return resource.tags_detail.map(t => t.name);
  }
  const rawTags = resource.tags || [];
  if (Array.isArray(rawTags)) return rawTags;
  if (typeof rawTags === 'string') return safeJSONParse(rawTags);
  return [];
}

export default function ResourceCard({ resource }) {
  const navigate = useNavigate();
  const typeInfo = getTypeMeta(resource.type);
  const accent = typeInfo?.accent || colors.textMuted;

  return (
    <Card
      className="animate-fade-in-up"
      sx={{
        height: '100%',
        borderRadius: 2,
        border: `1px solid ${colors.border}`,
        borderLeft: `3px solid ${accent}`,
        bgcolor: colors.bgWhite,
        position: 'relative',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
        transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
        '&:hover': {
          borderColor: colors.primary,
          borderLeftColor: accent,
          boxShadow: '0 2px 8px rgba(28, 134, 226, 0.08)',
        },
      }}
    >
      <CardActionArea onClick={() => navigate(`/resources/${resource.id}`)} sx={{ height: '100%' }}>
        <CardContent sx={{ p: 2.5, display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* 标题行 */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1 }}>
            <Typography
              variant="h6"
              sx={{
                fontSize: '0.95rem',
                fontWeight: 600,
                color: colors.textPrimary,
                fontFamily: '"Play", sans-serif',
                lineHeight: 1.3,
                flex: 1,
                mr: 1,
              }}
            >
              {resource.display_name}
            </Typography>
            <TypeBadge type={resource.type} />
          </Box>

          {/* 描述 */}
          <Typography
            variant="body2"
            sx={{
              mb: 1.5,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              lineHeight: 1.6,
              color: colors.textSecondary,
              flex: 1,
            }}
          >
            {resource.description || '暂无描述'}
          </Typography>

          {/* 标签 */}
          {(() => {
            const tags = getTagsArray(resource);
            return tags.length > 0 && (
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1.5 }}>
              {tags.slice(0, 4).map(tag => (
                <TagChip key={tag} label={tag} />
              ))}
            </Box>
            );
          })()}

          {/* 底部统计栏 */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              pt: 1.5,
              mt: 'auto',
              borderTop: `1px solid ${colors.border}`,
            }}
          >
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <Tooltip title="下载">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: colors.textMuted, fontSize: '0.75rem' }}>
                  <Download sx={{ fontSize: 14 }} />
                  <span style={{ fontFamily: '"JetBrains Mono", monospace', fontWeight: 500 }}>
                    {formatNumber(resource.download_count)}
                  </span>
                </Box>
              </Tooltip>
              <Tooltip title="点赞">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: colors.success, fontSize: '0.75rem' }}>
                  <ThumbUp sx={{ fontSize: 14 }} />
                  <span style={{ fontFamily: '"JetBrains Mono", monospace', fontWeight: 500 }}>
                    {formatNumber(resource.like_count)}
                  </span>
                </Box>
              </Tooltip>
              <Tooltip title="收藏">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: colors.danger, fontSize: '0.75rem' }}>
                  <Favorite sx={{ fontSize: 14 }} />
                  <span style={{ fontFamily: '"JetBrains Mono", monospace', fontWeight: 500 }}>
                    {formatNumber(resource.favorite_count)}
                  </span>
                </Box>
              </Tooltip>
            </Box>
            <Typography
              variant="caption"
              sx={{
                color: colors.textMuted,
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: '0.7rem',
              }}
            >
              {formatDateRelative(resource.created_at)}
            </Typography>
          </Box>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}