/**
 * SearchResult - 搜索结果页（JokerPS 亮色清新风格）
 *
 * 改动说明：
 * - 改用 useResources hook，删除手写的 useEffect 数据获取代码
 * - SearchBar 接收 initialQuery/initialType，回显当前筛选条件
 * - 使用 getTypeMeta 显示类型筛选 Chip 的中文标签
 */

import { useSearchParams } from 'react-router-dom';
import { useMemo } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Pagination from '@mui/material/Pagination';
import Chip from '@mui/material/Chip';
import SearchBar from '../components/SearchBar';
import ResourceGrid from '../components/ResourceGrid';
import { useResources } from '../hooks/useResources';
import { getTypeMeta } from '../utils/constants';
import { colors } from '../theme';

export default function SearchResult() {
  const [searchParams, setSearchParams] = useSearchParams();

  const q = searchParams.get('q') || '';
  const type = searchParams.get('type') || '';
  const page = parseInt(searchParams.get('page')) || 1;

  // 使用 useMemo 稳定 params 引用，避免不必要的重新请求
  const fetchParams = useMemo(() => ({
    q, type, page, pageSize: 20,
  }), [q, type, page]);

  // 使用 useResources hook 替代手写的 useEffect 数据获取
  const { resources, loading, error, meta } = useResources(fetchParams);

  // 获取类型的中文标签
  const typeLabel = type ? (getTypeMeta(type)?.label || type) : null;

  const handlePageChange = (e, p) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', p);
    setSearchParams(params);
  };

  const handleTypeClear = () => {
    const params = new URLSearchParams(searchParams);
    params.delete('type');
    params.delete('page');
    setSearchParams(params);
  };

  return (
    <Box>
      <Typography
        variant="h4"
        sx={{
          mb: 3,
          fontFamily: '"Play", sans-serif',
          color: colors.textPrimary,
        }}
      >
        搜索技能{q && ` "${q}"`}
      </Typography>

      <Box sx={{ mb: 3 }}>
        <SearchBar initialQuery={q} initialType={type} />
      </Box>

      {(q || type) && (
        <Typography
          variant="body2"
          component="div"
          sx={{ mb: 2, color: colors.textSecondary }}
        >
          找到{' '}
          <span style={{ color: colors.primary, fontFamily: '"JetBrains Mono", monospace', fontWeight: 600 }}>
            {meta.total}
          </span>{' '}
          个结果
          {typeLabel && (
            <Chip
              label={typeLabel}
              size="small"
              onDelete={handleTypeClear}
              sx={{ ml: 1 }}
              variant="outlined"
            />
          )}
        </Typography>
      )}

      <ResourceGrid resources={resources} loading={loading} error={error} emptyText="未找到匹配的资源" />

      {meta.total > meta.pageSize && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <Pagination
            count={Math.ceil(meta.total / meta.pageSize)}
            page={meta.page}
            onChange={handlePageChange}
          />
        </Box>
      )}
    </Box>
  );
}