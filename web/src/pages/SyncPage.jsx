/**
 * SyncPage - Web 协作同步页面
 *
 * 用户通过 CLI 命令 `skhub sync --web <sessionId>` 引导到此页面。
 * 页面读取 sessionId 参数，直接进入同步流程。
 */

import { useParams, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import HomeIcon from '@mui/icons-material/Home';
import SyncPanel from '../components/SyncPanel';
import { colors } from '../theme';

export default function SyncPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  if (!sessionId) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Typography variant="h5" sx={{ color: colors.textPrimary, fontWeight: 700, mb: 2 }}>
          无效的同步会话
        </Typography>
        <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 3 }}>
          请通过 CLI 命令生成同步会话后再访问此页面
        </Typography>
        <Button
          variant="contained"
          startIcon={<HomeIcon />}
          onClick={() => navigate('/')}
          sx={{ bgcolor: colors.primary, fontWeight: 600 }}
        >
          返回首页
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 720, mx: 'auto' }}>
      <Paper
        elevation={0}
        sx={{ p: 2, mb: 3, bgcolor: colors.bgWhite, border: `1px solid ${colors.border}`, borderRadius: 2 }}
      >
        <Typography variant="caption" sx={{ color: colors.textMuted, fontFamily: '"JetBrains Mono", monospace' }}>
          同步会话: {sessionId}
        </Typography>
      </Paper>

      <SyncPanel initialSessionId={sessionId} />
    </Box>
  );
}
