/**
 * Layout - 全局布局组件（JokerPS 亮色清爽风格）
 *
 * 白色/半透顶栏 + 亮蓝品牌标识 + 灰蓝文字导航
 * 保持原有认证逻辑不变，仅重构视觉层。
 */

import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Container from '@mui/material/Container';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Avatar from '@mui/material/Avatar';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Badge from '@mui/material/Badge';
import Logout from '@mui/icons-material/Logout';
import NotificationsIcon from '@mui/icons-material/Notifications';
import apiClient from '../api/client';
import NotificationsPopover from './NotificationsPopover';
import { colors } from '../theme';

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [notifAnchor, setNotifAnchor] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);

  // 获取当前用户信息（逻辑不变）
  useEffect(() => {
    const token = localStorage.getItem('skhub_token');
    if (!token) {
      navigate('/login', { replace: true });
      return;
    }

    let cancelled = false;
    async function fetchUser() {
      try {
        const res = await apiClient.get('/users/me');
        if (!cancelled) {
          setUser(res.data);
        }
      } catch (err) {
        if (!cancelled) {
          localStorage.removeItem('skhub_token');
          navigate('/login', { replace: true });
        }
      }
    }
    fetchUser();
    return () => { cancelled = true; };
  }, [navigate]);

  // 每 60 秒轮询未读通知数
  useEffect(() => {
    const token = localStorage.getItem('skhub_token');
    if (!token) return;

    const fetchUnread = async () => {
      try {
        const res = await apiClient.get('/notifications/unread-count');
        setUnreadCount(res.data?.count ?? 0);
      } catch (err) {
        // 静默失败，不影响用户体验
      }
    };

    fetchUnread();
    const interval = setInterval(fetchUnread, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('skhub_token');
    navigate('/login', { replace: true });
  };

  const navItems = [
    { label: '首页', path: '/' },
    { label: 'Skills', path: '/skills' },
    { label: '场景', path: '/scenes' },
    { label: 'Experts', path: '/experts' },
    { label: '贡献榜', path: '/leaderboard' },
    { label: '上传', path: '/upload' },
    { label: '我的', path: '/profile' },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* ── 顶栏：白色背景 + 底部浅边框 ── */}
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          bgcolor: 'rgba(255, 255, 255, 0.92)',
          borderBottom: `1px solid ${colors.border}`,
          backdropFilter: 'blur(12px)',
        }}
      >
        <Toolbar>
          {/* Logo：纯文字 + 亮蓝点缀 */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              cursor: 'pointer',
              mr: 4,
              transition: 'opacity 0.2s',
              '&:hover': { opacity: 0.85 },
            }}
            onClick={() => navigate('/')}
          >
            {/* CSS 绘制的简洁方框图标 */}
            <Box
              sx={{
                width: 24,
                height: 24,
                border: `2px solid ${colors.primary}`,
                borderRadius: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
              }}
            >
              <Box
                sx={{
                  width: 10,
                  height: 2,
                  bgcolor: colors.primary,
                  borderRadius: 1,
                }}
              />
            </Box>
            <Typography
              variant="h6"
              sx={{
                fontFamily: '"Play", sans-serif',
                fontWeight: 700,
                color: colors.textPrimary,
                letterSpacing: '-0.02em',
              }}
            >
              Skill<span style={{ color: colors.primary }}>Hub</span>
            </Typography>
          </Box>

          {/* 导航菜单：灰蓝文字 + 亮蓝下划线指示器 */}
          <Box sx={{ display: 'flex', gap: 0.5, flex: 1 }}>
            {navItems.map((item) => {
              const isActive = item.exact
                  ? location.pathname === item.path
                  : location.pathname === item.path || (item.path.includes('?') && `${location.pathname}${location.search}` === item.path);
              return (
                <Button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  sx={{
                    px: 2,
                    py: 0.75,
                    borderRadius: 1,
                    color: isActive ? colors.primary : colors.textSecondary,
                    fontWeight: isActive ? 600 : 500,
                    fontSize: '0.875rem',
                    bgcolor: 'transparent',
                    position: 'relative',
                    transition: 'color 0.2s ease',
                    // 底部指示条
                    '&::after': isActive ? {
                      content: '""',
                      position: 'absolute',
                      bottom: 4,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: '60%',
                      height: 2,
                      bgcolor: colors.primary,
                      borderRadius: 1,
                    } : {},
                    '&:hover': {
                      bgcolor: 'transparent',
                      color: isActive ? colors.primary : colors.textPrimary,
                    },
                  }}
                >
                  {item.label}
                </Button>
              );
            })}
          </Box>

          {/* 用户信息 */}
          {user && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              {/* 通知图标 */}
              <Tooltip title="通知">
                <IconButton
                  size="small"
                  onClick={(e) => setNotifAnchor(e.currentTarget)}
                  sx={{
                    color: colors.textSecondary,
                    transition: 'all 0.2s',
                    '&:hover': {
                      color: colors.primary,
                      bgcolor: colors.primaryMuted,
                    },
                  }}
                >
                  <Badge
                    badgeContent={unreadCount}
                    color="error"
                    sx={{
                      '& .MuiBadge-badge': {
                        fontSize: '0.65rem',
                        height: 16,
                        minWidth: 16,
                        fontFamily: '"Play", sans-serif',
                        fontWeight: 700,
                      },
                    }}
                  >
                    <NotificationsIcon sx={{ fontSize: 20 }} />
                  </Badge>
                </IconButton>
              </Tooltip>

              <Avatar
                sx={{
                  width: 32,
                  height: 32,
                  bgcolor: colors.primaryMuted,
                  color: colors.primary,
                  fontSize: '0.8rem',
                  border: `1px solid ${colors.border}`,
                }}
              >
                {(user.display_name || user.username || '?')[0].toUpperCase()}
              </Avatar>
              <Typography
                variant="body2"
                sx={{
                  color: colors.textSecondary,
                  fontWeight: 500,
                  fontFamily: '"Play", sans-serif',
                }}
              >
                {user.display_name || user.username}
              </Typography>
              <Tooltip title="退出登录">
                <IconButton
                  size="small"
                  onClick={handleLogout}
                  sx={{
                    color: colors.textMuted,
                    transition: 'all 0.2s',
                    '&:hover': {
                      color: colors.danger,
                      bgcolor: 'rgba(255, 77, 79, 0.06)',
                    },
                  }}
                >
                  <Logout sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
            </Box>
          )}
        </Toolbar>
      </AppBar>

      {/* ── 主内容区 ── */}
      <Box component="main" sx={{ flex: 1 }}>
        <Container maxWidth="xl" sx={{ py: 4, maxWidth: '1680px !important' }}>
          <Outlet />
        </Container>
      </Box>

      {/* 通知下拉菜单 */}
      <NotificationsPopover
        open={Boolean(notifAnchor)}
        anchorEl={notifAnchor}
        onClose={() => setNotifAnchor(null)}
      />
    </Box>
  );
}