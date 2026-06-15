/**
 * TypeBrowse - 类型浏览页
 *
 * 从 URL params 获取 type，展示该类型的所有资源
 * 复用 SearchBar 和 ResourceGrid 组件
 */

import { useParams, useSearchParams } from 'react-router-dom';
import { useMemo } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import SearchBar from '../components/SearchBar';
import ResourceGrid from '../components/ResourceGrid';
import { useResources } from '../hooks/useResources';
import { getTypeMeta } from '../utils/constants';
import { colors } from '../theme';
import { useNavigate } from 'react-router-dom';

export default function TypeBrowse() {
  const { type } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const q = searchParams.get('q') || '';
  const page = parseInt(searchParams.get('page')) || 1;

  // 获取类型元数据
  const typeMeta = useMemo(() => {
    if (!type) return null;
    return getTypeMeta(type);
  }, [type]);

  // 如果类型无效，重定向到首页
  if (!typeMeta) {
    navigate('/', { replace: true });
    return null;
  }

  const fetchParams = { q, type, page, pageSize: 20 };
  const { resources, loading, error, meta } = useResources(fetchParams);

  const handleTypeClear = () => {
    navigate(`/search${q ? `?q=${encodeURIComponent(q)}` : ''}`);
  };

  return (
    <Box>
      <Typography
        variant="h4"
        sx={{
          mb: 1,
          fontFamily: '"Play", sans-serif',
          color: typeMeta.accent,
        }}
      >
        {typeMeta.label}
      </Typography>
      <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 3 }}>
        {typeMeta.desc}
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
          {type && (
            <Chip
              label={typeMeta.label}
              size="small"
              onDelete={handleTypeClear}
              sx={{ ml: 1 }}
              variant="outlined"
            />
          )}
        </Typography>
      )}

      <ResourceGrid resources={resources} loading={loading} error={error} emptyText={`暂无 ${typeMeta.label} 资源`} />
    </Box>
  );
}