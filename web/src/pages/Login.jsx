/**
 * Login - 登录页面（JokerPS 亮色清新风格）
 *
 * 设计要点：
 * - 全屏浅灰蓝底 + 居中白色卡片
 * - 亮蓝 Logo + 活力橙强调
 * - 输入框简洁清爽
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import apiClient from '../api/client';
import { colors } from '../theme';

const MIN_NICKNAME_LENGTH = 1;

export default function Login() {
  const navigate = useNavigate();
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [nicknameTouched, setNicknameTouched] = useState(false);

  const trimmedNickname = nickname.trim();
  const isNicknameValid = trimmedNickname.length >= MIN_NICKNAME_LENGTH;
  const nicknameError = nicknameTouched && !isNicknameValid ? '请输入你的花名' : '';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setNicknameTouched(true);

    if (!isNicknameValid) {
      setError('请输入你的花名');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiClient.post('/auth/login', { nickname: trimmedNickname });
      const token = res.data?.token;
      if (token) {
        localStorage.setItem('skhub_token', token);
        navigate('/', { replace: true });
      } else {
        setError('登录响应异常，请重试');
      }
    } catch (err) {
      setError(err.message || '登录失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: colors.bgPage,
        px: 2,
      }}
    >
      <Paper
        elevation={0}
        sx={{
          p: 5,
          width: '100%',
          maxWidth: 420,
          borderRadius: 2,
          border: `1px solid ${colors.border}`,
          bgcolor: colors.bgWhite,
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
        }}
      >
        {/* Logo / 标题 */}
        <Box sx={{ mb: 4, textAlign: 'center' }}>
          <Typography
            variant="h4"
            sx={{
              fontWeight: 700,
              fontFamily: '"Play", sans-serif',
              color: colors.textPrimary,
              mb: 0.5,
            }}
          >
            Skill<span style={{ color: colors.primary }}>Hub</span>
          </Typography>
          <Typography
            variant="body2"
            sx={{ color: colors.textMuted }}
          >
            AI 技能分发中心
          </Typography>
        </Box>

        {/* 错误提示 */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {/* 登录表单 */}
        <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <TextField
            id="login-nickname"
            name="nickname"
            label="花名"
            placeholder="输入你的花名即可进入"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            onBlur={() => setNicknameTouched(true)}
            fullWidth
            autoFocus
            error={!!nicknameError}
            helperText={nicknameError}
            sx={{
              '& .MuiInputLabel-root.Mui-focused': { color: colors.primary },
            }}
          />
          <Button
            type="submit"
            variant="contained"
            fullWidth
            disabled={submitting || !isNicknameValid}
            sx={{
              py: 1.5,
              fontSize: '1rem',
              borderRadius: 1,
              mt: 1,
            }}
          >
            {submitting ? '登录中...' : '进入 SkillHub'}
          </Button>
        </Box>

        {/* 底部提示 */}
        <Typography
          variant="caption"
          align="center"
          sx={{
            display: 'block',
            mt: 3,
            color: colors.textMuted,
            fontSize: '0.75rem',
          }}
        >
          内部使用 · 输入花名即可进入
        </Typography>
      </Paper>
    </Box>
  );
}