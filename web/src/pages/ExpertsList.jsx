/**
 * ExpertsList - Expert 列表页
 *
 * 展示所有 Expert 类型的资源，预筛选 type=expert
 * 复用 SearchBar 和 ResourceGrid 组件
 */

import { useSearchParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import SearchBar from '../components/SearchBar';
import ResourceGrid from '../components/ResourceGrid';
import { useResources } from '../hooks/useResources';
import { getTypeMeta } from '../utils/constants';
import { colors } from '../theme';

export default function ExpertsList() {
  const [searchParams] = useSearchParams();
  const q = searchParams.get('q') || '';
  const page = parseInt(searchParams.get('page')) || 1;

  // 预筛选 type=expert
  const fetchParams = { q, type: 'expert', page, pageSize: 20 };
  const { resources, loading, error, meta } = useResources(fetchParams);

  const expertMeta = getTypeMeta('expert');

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
        Experts
      </Typography>
      <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 3 }}>
        完整的 AI 专家包，包含多种技能和工具的组合套餐
      </Typography>

      <Box sx={{ mb: 3 }}>
        <SearchBar initialQuery={q} initialType="expert" />
      </Box>

      {q && (
        <Typography variant="body2" sx={{ mb: 2, color: colors.textSecondary }}>
          找到{' '}
          <span style={{ color: expertMeta?.accent || colors.primary, fontFamily: '"JetBrains Mono", monospace', fontWeight: 600 }}>
            {meta.total}
          </span>{' '}
          个结果
        </Typography>
      )}

      <ResourceGrid resources={resources} loading={loading} error={error} emptyText="暂无 Expert 资源" />
    </Box>
  );
}