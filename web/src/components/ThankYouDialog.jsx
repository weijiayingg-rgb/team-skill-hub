/**
 * ThankYouDialog — 感谢弹窗组件（JokerPS 亮色清新风格）
 *
 * 在用户下载资源后弹出，可发送感谢语给作者。
 * 使用 localStorage 做 7 天去重，避免频繁打扰。
 */
import { useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Favorite from '@mui/icons-material/Favorite';
import apiClient from '../api/client';
import { colors } from '../theme';

export default function ThankYouDialog({ open, onClose, resourceName, authorName, resourceId }) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [snackbar, setSnackbar] = useState(false);

  /** 发送感谢 */
  const handleSend = async () => {
    setSending(true);
    try {
      await apiClient.post(`/resources/${resourceId}/thanks`, {
        message: message.trim() || '',
      });
      setSent(true);
      setTimeout(() => {
        onClose();
        setTimeout(() => {
          setSent(false);
          setMessage('');
        }, 300);
      }, 2000);
    } catch (err) {
      setSnackbar(true);
    } finally {
      setSending(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(`thanks_dialog_dismissed_${resourceId}`, Date.now().toString());
    onClose();
  };

  const handleClose = () => {
    onClose();
    setSent(false);
    setMessage('');
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={sent ? handleClose : handleDismiss}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: colors.bgWhite,
            border: `1px solid ${colors.border}`,
            borderRadius: 2,
            backgroundImage: 'none',
          },
        }}
      >
        {sent ? (
          /* ===== 发送成功状态 ===== */
          <Box sx={{ textAlign: 'center', py: 6, px: 4 }}>
            <Favorite
              sx={{
                fontSize: 56,
                color: colors.danger,
                mb: 2,
                animation: 'thankYouPulse 0.6s ease',
              }}
            />
            <Typography
              variant="h6"
              sx={{
                fontFamily: '"Play", sans-serif',
                color: colors.textPrimary,
                fontWeight: 700,
                mb: 1,
              }}
            >
              感谢已发送！
            </Typography>
            <Typography variant="body2" sx={{ color: colors.textSecondary }}>
              作者会收到通知
            </Typography>
          </Box>
        ) : (
          /* ===== 输入状态 ===== */
          <>
            <DialogTitle
              sx={{
                fontFamily: '"Play", sans-serif',
                fontWeight: 700,
                color: colors.textPrimary,
                fontSize: '1.15rem',
              }}
            >
              觉得「{resourceName}」对你有帮助？
            </DialogTitle>
            <DialogContent>
              <Typography
                variant="body2"
                sx={{ color: colors.textSecondary, mb: 2 }}
              >
                给 {authorName} 发一句感谢 （选填）
              </Typography>
              <TextField
                autoFocus
                multiline
                minRows={3}
                maxRows={5}
                fullWidth
                placeholder="说点什么吧..."
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, 200))}
                helperText={`${message.length}/200`}
                FormHelperTextProps={{
                  sx: { color: colors.textMuted, textAlign: 'right' },
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    bgcolor: colors.bgPage,
                    color: colors.textPrimary,
                    '& fieldset': { borderColor: colors.border },
                    '&:hover fieldset': { borderColor: colors.borderHover },
                    '&.Mui-focused fieldset': { borderColor: colors.primary },
                  },
                  '& .MuiOutlinedInput-input::placeholder': {
                    color: colors.textMuted,
                    opacity: 1,
                  },
                }}
              />
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2.5 }}>
              <Button
                onClick={handleDismiss}
                sx={{
                  color: colors.textMuted,
                  fontWeight: 500,
                  '&:hover': { color: colors.textSecondary, bgcolor: 'transparent' },
                }}
              >
                以后再说
              </Button>
              <Button
                variant="contained"
                onClick={handleSend}
                disabled={sending}
                startIcon={<Favorite sx={{ fontSize: 18 }} />}
                sx={{
                  bgcolor: colors.primary,
                  color: '#FFFFFF',
                  fontWeight: 600,
                  '&:hover': { bgcolor: colors.primaryHover },
                }}
              >
                发送感谢
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* 错误提示 */}
      <Snackbar
        open={snackbar}
        autoHideDuration={3000}
        onClose={() => setSnackbar(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity="error" variant="filled" onClose={() => setSnackbar(false)}>
          发送失败，请稍后重试
        </Alert>
      </Snackbar>

      {/* 心跳动画（成功状态） */}
      <style>{`
        @keyframes thankYouPulse {
          0% { transform: scale(0.5); opacity: 0; }
          50% { transform: scale(1.2); }
          100% { transform: scale(1); opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes thankYouPulse {
            0% { opacity: 0; }
            100% { opacity: 1; }
          }
        }
      `}</style>
    </>
  );
}