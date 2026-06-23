/**
 * SkillsList - Skill 列表页
 *
 * 展示所有 Skill 类型的资源，预筛选 type=skill
 * 支持排序切换和热门标签筛选
 * 复用 SearchBar 和 ResourceGrid 组件
 */

import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import SearchBar from '../components/SearchBar';
import ResourceGrid from '../components/ResourceGrid';
import { useResources } from '../hooks/useResources';
import { getTypeMeta } from '../utils/constants';
import { colors } from '../theme';
import apiClient from '../api/client';

// 排序选项配置
const SORT_OPTIONS = [
  { value: 'hot', label: '热度' },
  { value: 'newest', label: '最新' },
  { value: 'downloads', label: '下载量' },
  { value: 'favorites', label: '收藏量' },
];

/**
 * 生成 Chip 样式：激活态 / 未激活态
 */
function chipStyle(active) {
  return {
    bgcolor: active ? colors.primaryMuted : 'rgba(0,0,0,0.03)',
    color: active ? colors.primary : colors.textSecondary,
    border: active ? `1.5px solid ${colors.primary}` : '1.5px solid transparent',
    fontWeight: active ? 600 : 400,
    cursor: 'pointer',
    '&:hover': {
      bgcolor: active ? colors.primaryMuted : 'rgba(0,0,0,0.06)',
    },
  };
}

export default function SkillsList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get('q') || '';
  const page = parseInt(searchParams.get('page')) || 1;
  const sort = searchParams.get('sort') || 'hot';
  const tag = searchParams.get('tag') || '';

  // 获取热门标签
  const [popularTags, setPopularTags] = useState([]);
  useEffect(() => {
    apiClient.get('/tags/popular', { params: { type: 'skill', limit: 10 } })
      .then(res => setPopularTags(res.data || []))
      .catch(() => {});
  }, []);

  // 预筛选 type=skill，传入 sort 和 tag
  const fetchParams = { q, type: 'skill', page, pageSize: 20, sort, tag };
  const { resources, loading, error, meta } = useResources(fetchParams);

  const skillMeta = getTypeMeta('skill');

  // 切换排序，重置页码
  const handleSortChange = (newSort) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('sort', newSort);
      next.delete('page');
      return next;
    });
  };

  // 切换标签筛选，重置页码
  const handleTagChange = (newTag) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (newTag) {
        next.set('tag', newTag);
      } else {
        next.delete('tag');
      }
      next.delete('page');
      return next;
    });
  };

  return (
    <Box>
      <Typography
        variant="h4"
        sx={{
          mb: 1,
          fontFamily: '"Play", sans-serif',
          color: colors.textPrimary,
        }}
      >
        Skills
      </Typography>
      <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 3 }}>
        可安装的 AI 能力单元，为 Claude 提供特定领域的专业技能
      </Typography>

      <Box sx={{ mb: 3 }}>
        <SearchBar initialQuery={q} initialType="skill" />
      </Box>

      {/* 排序 + 标签筛选工具栏 */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2, alignItems: 'center' }}>
        {/* 排序栏 */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="caption" sx={{ color: colors.textSecondary, whiteSpace: 'nowrap' }}>
            排序：
          </Typography>
          {SORT_OPTIONS.map(opt => (
            <Chip
              key={opt.value}
              label={opt.label}
              size="small"
              onClick={() => handleSortChange(opt.value)}
              sx={chipStyle(sort === opt.value)}
            />
          ))}
        </Box>

        {/* 标签筛选栏 */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 1 }}>
          <Typography variant="caption" sx={{ color: colors.textSecondary, whiteSpace: 'nowrap' }}>
            标签：
          </Typography>
          <Chip
            label="全部"
            size="small"
            onClick={() => handleTagChange('')}
            sx={chipStyle(tag === '')}
          />
          {popularTags.map(t => (
            <Chip
              key={t.name}
              label={t.name}
              size="small"
              onClick={() => handleTagChange(t.name === tag ? '' : t.name)}
              sx={chipStyle(tag === t.name)}
            />
          ))}
        </Box>
      </Box>

      {q && (
        <Typography variant="body2" sx={{ mb: 2, color: colors.textSecondary }}>
          找到{' '}
          <span style={{ color: colors.primary, fontFamily: '"JetBrains Mono", monospace', fontWeight: 600 }}>
            {meta.total}
          </span>{' '}
          个结果
        </Typography>
      )}

      <ResourceGrid resources={resources} loading={loading} error={error} emptyText="暂无 Skill 资源" />
    </Box>
  );
}
