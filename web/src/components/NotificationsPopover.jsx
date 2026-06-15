/**
 * NotificationsPopover — 通知下拉组件（JokerPS 亮色风格）
 *
 * 显示最近 10 条通知，支持标记已读、查看全部。
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Popover from '@mui/material/Popover';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import CircularProgress from '@mui/material/CircularProgress';
import Download from '@mui/icons-material/Download';
import Favorite from '@mui/icons-material/Favorite';
import apiClient from '../api/client';
import { colors } from '../theme';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const now = Date.now();
  const past = new Date(dateStr).getTime();
  const diff = Math.floor((now - past) / 1000);

  if (diff < 60) return '刚刚';
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} 天前`;
  return new Date(dateStr).toLocaleDateString('zh-CN');
}

export default function NotificationsPopover({ open, anchorEl, onClose }) {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/notifications?pageSize=10');
      setNotifications(res.data || []);
    } catch (err) {
      console.error('获取通知失败:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchNotifications();
    }
  }, [open]);

  const handleClick = async (item) => {
    if (!item.read) {
      try {
        await apiClient.post(`/notifications/${item.id}/read`);
        setNotifications(prev =>
          prev.map(n => (n.id === item.id ? { ...n, read: true } : n))
        );
      } catch (err) {
        console.error('标记已读失败:', err);
      }
    }
    if (item.resource_id) {
      navigate(`/resources/${item.resource_id}`);
    }
    onClose();
  };

  const handleReadAll = async () => {
    try {
      await apiClient.post('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (err) {
      console.error('全部已读失败:', err);
    }
  };

  const handleViewAll = () => {
    navigate('/profile?tab=notifications');
    onClose();
  };

  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      slotProps={{
        paper: {
          sx: {
            width: 360,
            maxHeight: 480,
            bgcolor: colors.bgWhite,
            border: `1px solid ${colors.border}`,
            borderRadius: 2,
            backgroundImage: 'none',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
            mt: 1,
          },
        },
      }}
    >
      {/* 标题栏 */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 1.5,
          borderBottom: `1px solid ${colors.border}`,
        }}
      >
        <Typography
          sx={{
            fontFamily: '"Play", sans-serif',
            fontWeight: 700,
            color: colors.textPrimary,
            fontSize: '0.95rem',
          }}
        >
          通知
        </Typography>
        <Button
          size="small"
          onClick={handleReadAll}
          sx={{
            fontSize: '0.75rem',
            color: colors.textSecondary,
            fontWeight: 500,
            minWidth: 'auto',
            px: 1,
            '&:hover': { color: colors.primary, bgcolor: 'transparent' },
          }}
        >
          全部已读
        </Button>
      </Box>

      {/* 通知列表 */}
      {loading ? (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <CircularProgress size={24} sx={{ color: colors.primary }} />
        </Box>
      ) : notifications.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 5, px: 2 }}>
          <Typography variant="body2" sx={{ color: colors.textMuted }}>
            暂无通知
          </Typography>
        </Box>
      ) : (
        <List dense disablePadding>
          {notifications.map((item, idx) => {
            const isThanks = item.type === 'thanks';
            const Icon = isThanks ? Favorite : Download;
            const iconColor = isThanks ? colors.danger : colors.primary;

            return (
              <Box key={item.id}>
                {idx > 0 && <Divider sx={{ borderColor: colors.border, mx: 2 }} />}
                <ListItemButton
                  onClick={() => handleClick(item)}
                  sx={{
                    py: 1.5,
                    px: 2,
                    bgcolor: item.read ? 'transparent' : colors.primaryMuted,
                    transition: 'background-color 0.2s',
                    '&:hover': { bgcolor: item.read ? 'rgba(0,0,0,0.02)' : 'rgba(28, 134, 226, 0.12)' },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <Icon sx={{ fontSize: 20, color: iconColor }} />
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Typography
                        variant="body2"
                        sx={{
                          color: item.read ? colors.textSecondary : colors.textPrimary,
                          fontWeight: item.read ? 400 : 500,
                          fontSize: '0.85rem',
                          lineHeight: 1.4,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {item.message || item.content || '新通知'}
                      </Typography>
                    }
                    secondary={
                      <Typography
                        variant="caption"
                        sx={{
                          color: colors.textMuted,
                          fontSize: '0.7rem',
                          fontFamily: '"JetBrains Mono", monospace',
                        }}
                      >
                        {timeAgo(item.created_at)}
                      </Typography>
                    }
                    secondaryTypographyProps={{ component: 'div' }}
                  />
                </ListItemButton>
              </Box>
            );
          })}
        </List>
      )}

      {/* 底部查看全部 */}
      <Box
        sx={{
          borderTop: `1px solid ${colors.border}`,
          px: 2,
          py: 1,
          textAlign: 'center',
        }}
      >
        <Button
          fullWidth
          onClick={handleViewAll}
          sx={{
            fontSize: '0.8rem',
            color: colors.primary,
            fontWeight: 600,
            fontFamily: '"Play", sans-serif',
            '&:hover': { bgcolor: colors.primaryMuted },
          }}
        >
          查看全部
        </Button>
      </Box>
    </Popover>
  );
}