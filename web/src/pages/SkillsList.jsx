/**
 * SkillsList - Skill 列表页
 *
 * 展示所有 Skill 类型的资源，预筛选 type=skill
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

export default function SkillsList() {
  const [searchParams] = useSearchParams();
  const q = searchParams.get('q') || '';
  const page = parseInt(searchParams.get('page')) || 1;

  // 预筛选 type=skill
  const fetchParams = { q, type: 'skill', page, pageSize: 20 };
  const { resources, loading, error, meta } = useResources(fetchParams);

  const skillMeta = getTypeMeta('skill');

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