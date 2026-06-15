/**
 * ExpertCard - Expert 专家包卡片（JokerPS 亮色清新风格）
 *
 * 设计要点：
 * - 比 Skill 卡片稍大（高度约 120px），信息密度更高
 * - 左侧橙色竖线标识 Expert 类型（accent: #FF6600）
 * - hover 时橙色边框 + 微阴影
 * - 展示：专家名称、一句话定位、标签、平台、热度指标
 */

import { useNavigate } from 'react-router-dom';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardActionArea from '@mui/material/CardActionArea';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import ThumbUp from '@mui/icons-material/ThumbUp';
import Download from '@mui/icons-material/Download';
import TypeBadge from './TypeBadge';
import TagChip from './TagChip';
import { formatNumber } from '../utils/format';
import { getTypeMeta, PLATFORM_CONFIG } from '../utils/constants';
import { colors } from '../theme';

// 安全解析 JSON 字符串，失败时返回空数组
function safeJSONParse(val) {
  if (typeof val !== 'string') return [];
  try { return JSON.parse(val); } catch { return []; }
}

// 截断描述为最多 100 字
function truncateDescription(desc, maxLength = 100) {
  if (!desc) return '';
  if (desc.length <= maxLength) return desc;
  return desc.slice(0, maxLength - 1).trim() + '…';
}

export default function ExpertCard({ resource }) {
  const navigate = useNavigate();
  const typeInfo = getTypeMeta(resource.type);
  const accent = typeInfo?.accent || colors.textMuted;

  // 获取标签名称（兼容 tags 和 tags_detail 两种格式，以及 tags 为 JSON 字符串的情况）
  const rawTags = resource.tags_detail?.map(t => t.name) || resource.tags || [];
  const tags = Array.isArray(rawTags) ? rawTags : (typeof rawTags === 'string' ? safeJSONParse(rawTags) : []);

  // 截取描述
  const shortDesc = truncateDescription(resource.description, 100);

  // 解析平台
  const platforms = resource.platforms || [];

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
          borderColor: accent,
          borderLeftColor: accent,
          boxShadow: '0 2px 8px rgba(255, 102, 0, 0.12)',
        },
      }}
    >
      <CardActionArea onClick={() => navigate(`/resources/${resource.id}`)} sx={{ height: '100%' }}>
        <CardContent sx={{ p: 2.5, display: 'flex', flexDirection: 'column', height: '100%', gap: 1 }}>
          {/* 标题行 + 类型徽章 */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography
              variant="h6"
              sx={{
                fontSize: '1.1rem',
                fontWeight: 700,
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

          {/* 一句话定位 */}
          {shortDesc && (
            <Typography
              variant="body2"
              sx={{
                fontSize: '0.85rem',
                lineHeight: 1.5,
                color: colors.textSecondary,
                mb: 0.5,
              }}
            >
              {shortDesc}
            </Typography>
          )}

          {/* 标签（最多 3 个） */}
          {tags.length > 0 && (
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 0.5 }}>
              {tags.slice(0, 3).map(tag => (
                <TagChip key={tag} label={tag} />
              ))}
            </Box>
          )}

          <Box sx={{ flex: 1 }} />

          {/* 底部信息栏：平台 + 热度 */}
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
            {/* 平台标签 */}
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              {platforms.map(platformKey => {
                const platform = PLATFORM_CONFIG[platformKey];
                if (!platform) return null;
                return (
                  <Box
                    key={platformKey}
                    sx={{
                      fontSize: '0.7rem',
                      fontFamily: '"JetBrains Mono", monospace',
                      fontWeight: 500,
                      color: accent,
                      bgcolor: 'rgba(255, 102, 0, 0.08)',
                      px: 1,
                      py: 0.25,
                      borderRadius: 1,
                    }}
                  >
                    {platform.name}
                  </Box>
                );
              })}
            </Box>

            {/* 热度指标 */}
            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
              <Tooltip title="下载">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3, color: colors.textMuted, fontSize: '0.75rem' }}>
                  <Download sx={{ fontSize: 13 }} />
                  <span style={{ fontFamily: '"JetBrains Mono", monospace', fontWeight: 600 }}>
                    {formatNumber(resource.download_count)}
                  </span>
                </Box>
              </Tooltip>
              <Tooltip title="点赞">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3, color: colors.success, fontSize: '0.75rem' }}>
                  <ThumbUp sx={{ fontSize: 13 }} />
                  <span style={{ fontFamily: '"JetBrains Mono", monospace', fontWeight: 600 }}>
                    {formatNumber(resource.like_count)}
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

/**
 * ExpertCardSkeleton - Expert 卡片骨架屏（加载状态占位）
 */
export function ExpertCardSkeleton() {
  return (
    <Card
      sx={{
        height: '100%',
        borderRadius: 2,
        bgcolor: colors.bgCard,
        border: `1px solid ${colors.border}`,
        borderLeft: `3px solid ${colors.bgCard}`,
      }}
    >
      <CardContent sx={{ p: 2.5, display: 'flex', flexDirection: 'column', height: '100%', gap: 1 }}>
        {/* 标题骨架 */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
          <Skeleton variant="text" width="60%" height={24} />
          <Skeleton variant="text" width={50} height={24} />
        </Box>

        {/* 描述骨架 */}
        <Skeleton variant="text" width="80%" height={18} />
        <Skeleton variant="text" width="50%" height={18} />

        {/* 标签骨架 */}
        <Box sx={{ display: 'flex', gap: 0.5, mb: 0.5 }}>
          <Skeleton variant="rounded" width={40} height={20} />
          <Skeleton variant="rounded" width={50} height={20} />
          <Skeleton variant="rounded" width={45} height={20} />
        </Box>

        <Box sx={{ flex: 1 }} />

        {/* 底部骨架 */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 1, borderTop: `1px solid ${colors.border}` }}>
          <Skeleton variant="rounded" width={50} height={20} />
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Skeleton variant="text" width={40} height={16} />
            <Skeleton variant="text" width={35} height={16} />
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}