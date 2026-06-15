/**
 * ScenesList - 场景列表页
 *
 * 展示所有企业工作流场景，场景 = Rules + Skills + Hook 的组合。
 * 使用 /api/scenes 端点获取数据。
 */
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import Pagination from '@mui/material/Pagination';
import CircularProgress from '@mui/material/CircularProgress';
import Button from '@mui/material/Button';
import AddIcon from '@mui/icons-material/Add';
import SceneCard from '../components/SceneCard';
import { colors } from '../theme';
import apiClient from '../api/client';

export default function ScenesList() {
  const [searchParams] = useSearchParams();
  const page = parseInt(searchParams.get('page')) || 1;

  const [scenes, setScenes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [meta, setMeta] = useState({ total: 0, page: 1, pageSize: 20 });

  useEffect(() => {
    setLoading(true);
    setError(null);
    apiClient.get(`/scenes?page=${page}&pageSize=20&sort=hot`)
      .then(res => {
        setScenes(res.data || []);
        setMeta(res.meta || { total: 0, page: 1, pageSize: 20 });
      })
      .catch(err => setError(err.message || '加载失败'))
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <Box>
      {/* 页面标题 */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box>
          <Typography
            variant="h4"
            sx={{
              fontFamily: '"Play", sans-serif',
              color: colors.textPrimary,
              mb: 0.5,
            }}
          >
            场景
          </Typography>
          <Typography variant="body2" sx={{ color: colors.textSecondary }}>
            企业工作流场景方案：规范 + 技能 + 自动化，一键安装到你的工作环境
            {meta.total > 0 && (
              <span style={{ color: '#7C3AED', fontFamily: '"JetBrains Mono", monospace', fontWeight: 600 }}>
                {' '}· 共 {meta.total} 个场景
              </span>
            )}
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          href="/scenes/create"
          sx={{
            bgcolor: '#7C3AED',
            '&:hover': { bgcolor: '#6D28D9' },
            textTransform: 'none',
            fontWeight: 600,
          }}
        >
          创建场景
        </Button>
      </Box>

      {/* 场景列表 */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress size={40} sx={{ color: '#7C3AED' }} />
        </Box>
      ) : error ? (
        <Box sx={{ textAlign: 'center', py: 8, color: colors.textMuted }}>
          <Typography>{error}</Typography>
        </Box>
      ) : scenes.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h6" sx={{ color: colors.textSecondary, mb: 2 }}>
            还没有场景
          </Typography>
          <Typography variant="body2" sx={{ color: colors.textMuted, mb: 3 }}>
            创建你的第一个企业场景：选择一个规范 + 几个技能 + 可选的自动化钩子
          </Typography>
          <Button
            variant="outlined"
            href="/scenes/create"
            sx={{
              borderColor: '#7C3AED',
              color: '#7C3AED',
              textTransform: 'none',
            }}
          >
            创建场景
          </Button>
        </Box>
      ) : (
        <>
          <Grid container spacing={2.5}>
            {scenes.map(scene => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={scene.id}>
                <SceneCard scene={scene} />
              </Grid>
            ))}
          </Grid>

          {meta.total > meta.pageSize && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
              <Pagination
                count={Math.ceil(meta.total / meta.pageSize)}
                page={meta.page}
                onChange={(_, p) => {
                  window.location.href = `/scenes?page=${p}`;
                }}
                sx={{
                  '& .MuiPaginationItem-root': {
                    color: colors.textSecondary,
                  },
                  '& .Mui-selected': {
                    bgcolor: 'rgba(124, 58, 237, 0.1)',
                    color: '#7C3AED',
                  },
                }}
              />
            </Box>
          )}
        </>
      )}
    </Box>
  );
}