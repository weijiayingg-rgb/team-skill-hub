/**
 * ResourceGrid - 资源网格（JokerPS 亮色风格）
 */

import Typography from '@mui/material/Typography';
import Skeleton from '@mui/material/Skeleton';
import Box from '@mui/material/Box';
import ResourceCard from './ResourceCard';
import ExpertCard from './ExpertCard';
import { colors } from '../theme';

export default function ResourceGrid({ resources, loading, error, emptyText = '暂无资源' }) {
  if (loading) {
    return (
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, 1fr)',
            md: 'repeat(3, 1fr)',
            lg: 'repeat(4, 1fr)',
          },
          gap: 2,
        }}
      >
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton
            key={i}
            variant="rounded"
            height={180}
            sx={{
              bgcolor: colors.bgCard,
              borderRadius: 2,
            }}
          />
        ))}
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ textAlign: 'center', py: 6 }}>
        <Typography sx={{ color: colors.danger }}>加载失败: {error.message}</Typography>
      </Box>
    );
  }

  if (!resources || resources.length === 0) {
    return (
      <Box
        sx={{
          textAlign: 'center',
          py: 8,
          border: `1px dashed ${colors.border}`,
          borderRadius: 2,
          bgcolor: colors.bgCard,
        }}
      >
        <Typography sx={{ color: colors.textMuted, fontSize: '0.95rem' }}>
          {emptyText}
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: '1fr',
          sm: 'repeat(2, 1fr)',
          md: 'repeat(3, 1fr)',
          lg: 'repeat(4, 1fr)',
        },
        gap: 2,
      }}
    >
      {resources.map(resource => (
        resource.type === 'expert'
          ? <ExpertCard key={resource.id} resource={resource} />
          : <ResourceCard key={resource.id} resource={resource} />
      ))}
    </Box>
  );
}