import { useParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import CircularProgress from '@mui/material/CircularProgress';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/client';
import PlatformBadge from '../components/PlatformBadge';
import { formatDate } from '../utils/format';
import { colors } from '../theme';

export default function BundleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [bundle, setBundle] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    apiClient.get(`/bundles/${id}`)
      .then(res => { if (!cancelled) setBundle(res.data); })
      .catch(err => console.error('Failed to fetch bundle:', err))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  if (loading) return <Box sx={{ textAlign: 'center', py: 8 }}><CircularProgress sx={{ color: colors.primary }} /></Box>;

  if (!bundle) return <Box sx={{ textAlign: 'center', py: 8 }}><Typography color={colors.textMuted}>Bundle 不存在</Typography></Box>;

  const resources = bundle.resources || [];

  return (
    <Box>
      <Paper sx={{ p: 3, mb: 3, bgcolor: colors.bgWhite }}>
        <Typography variant="h4" sx={{ mb: 0.5, fontFamily: '"Play", sans-serif' }}>{bundle.name}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          v{bundle.version} · 包含 {resources.length} 个资源 · {formatDate(bundle.created_at)}
        </Typography>
        {bundle.description && (
          <Typography variant="body1" sx={{ mb: 2 }}>{bundle.description}</Typography>
        )}
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          {(bundle.platforms || []).map(p => (
            <PlatformBadge key={p} platform={p} size="medium" />
          ))}
        </Box>
      </Paper>

      <Paper sx={{ p: 3, bgcolor: colors.bgWhite }}>
        <Typography variant="h6" sx={{ mb: 2, fontFamily: '"Play", sans-serif' }}>包含的资源</Typography>
        <List>
          {resources.map((resource, index) => (
            <Box key={resource.name || index}>
              {index > 0 && <Divider />}
              <ListItemButton onClick={() => navigate(`/resources/${resource.id || resource}`)}>
                <ListItemText
                  primary={resource.display_name || resource.name || resource}
                  secondary={resource.type || ''}
                />
              </ListItemButton>
            </Box>
          ))}
          {resources.length === 0 && (
            <Typography color="text.secondary" variant="body2">暂无资源</Typography>
          )}
        </List>
      </Paper>
    </Box>
  );
}