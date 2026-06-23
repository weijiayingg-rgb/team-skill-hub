/**
 * TypeNavigation - 资源类型导航（Skill + Expert 紧凑胶囊按钮）
 *
 * 设计要点：
 * - Skill 和 Expert 紧凑胶囊按钮，单行展示
 * - Skill 蓝色主题，Expert 橙色主题
 * - 压缩视觉权重，让内容区更突出
 */

import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import PsychologyIcon from '@mui/icons-material/Psychology';
import { colors } from '../theme';

export default function TypeNavigation() {
  const navigate = useNavigate();

  return (
    <Box sx={{ mb: 3 }}>
      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        {/* Skills 胶囊按钮 */}
        <Paper
          sx={{
            flex: 1,
            p: 2,
            cursor: 'pointer',
            bgcolor: colors.bgWhite,
            border: `1px solid ${colors.border}`,
            transition: 'all 0.2s',
            '&:hover': {
              borderColor: colors.primary,
              boxShadow: `0 2px 8px ${colors.primary}20`,
            },
          }}
          onClick={() => navigate('/skills')}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AutoAwesomeIcon sx={{ fontSize: 18, color: colors.primary }} />
            <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: colors.primary }}>
              Skills
            </Typography>
            <Typography variant="caption" sx={{ color: colors.textMuted }}>
              单文件 AI 技能
            </Typography>
          </Box>
        </Paper>

        {/* Experts 胶囊按钮 */}
        <Paper
          sx={{
            flex: 1,
            p: 2,
            cursor: 'pointer',
            bgcolor: colors.bgWhite,
            border: `1px solid ${colors.border}`,
            transition: 'all 0.2s',
            '&:hover': {
              borderColor: '#FF6600',
              boxShadow: '0 2px 8px rgba(255,102,0,0.2)',
            },
          }}
          onClick={() => navigate('/experts')}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PsychologyIcon sx={{ fontSize: 18, color: '#FF6600' }} />
            <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: '#FF6600' }}>
              Experts
            </Typography>
            <Typography variant="caption" sx={{ color: colors.textMuted }}>
              完整 AI 专家包
            </Typography>
          </Box>
        </Paper>
      </Box>
    </Box>
  );
}