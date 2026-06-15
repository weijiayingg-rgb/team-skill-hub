/**
 * Profile - 个人中心页（JokerPS 亮色清新风格）
 */

import { useParams, useSearchParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Avatar from '@mui/material/Avatar';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import CircularProgress from '@mui/material/CircularProgress';
import Button from '@mui/material/Button';
import Download from '@mui/icons-material/Download';
import Favorite from '@mui/icons-material/Favorite';
import apiClient from '../api/client';
import ResourceGrid from '../components/ResourceGrid';
import SyncGuide from '../components/SyncGuide';
import { formatNumber } from '../utils/format';
import { colors } from '../theme';

export default function Profile() {
  const { userId } = useParams();
  const [searchParams] = useSearchParams();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(0);

  // 通知列表状态
  const [notifs, setNotifs] = useState([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifPage, setNotifPage] = useState(1);
  const [notifHasMore, setNotifHasMore] = useState(true);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'notifications') {
      setTab(2);
    }
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const endpoint = userId ? `/users/${userId}` : '/users/me';
    apiClient.get(endpoint)
      .then(res => { if (!cancelled) setProfile(res.data); })
      .catch(err => console.error('Failed to fetch profile:', err))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [userId]);

  const fetchNotifications = async (page = 1, append = false) => {
    if (!append) setNotifLoading(true);
    try {
      const res = await apiClient.get(`/notifications?page=${page}&pageSize=20`);
      const data = res.data || [];
      setNotifs(prev => (append ? [...prev, ...data] : data));
      setNotifHasMore(data.length >= 20);
      setNotifPage(page);
    } catch (err) {
      console.error('获取通知失败:', err);
    } finally {
      setNotifLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 2) {
      fetchNotifications(1);
    }
  }, [tab]);

  const handleNotifClick = async (item) => {
    if (!item.read) {
      try {
        await apiClient.post(`/notifications/${item.id}/read`);
        setNotifs(prev =>
          prev.map(n => (n.id === item.id ? { ...n, read: true } : n))
        );
      } catch (err) {
        console.error('标记已读失败:', err);
      }
    }
  };

  const handleLoadMore = () => {
    fetchNotifications(notifPage + 1, true);
  };

  if (loading) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <CircularProgress sx={{ color: colors.primary }} />
      </Box>
    );
  }

  if (!profile) {
    return <Box sx={{ textAlign: 'center', py: 8 }}><Typography sx={{ color: colors.textMuted }}>用户不存在</Typography></Box>;
  }

  const stats = profile.stats || {};

  const statItems = [
    { label: '上传资源', value: stats.uploadedCount, accent: colors.primary },
    { label: '总下载', value: stats.totalDownloads, accent: colors.warning },
    { label: '收藏', value: stats.favoritesCount, accent: colors.success },
    { label: '下载记录', value: stats.downloadsCount, accent: colors.danger },
  ];

  return (
    <Box>
      {/* 紧凑头部：头像 + 信息 + 统计 一行 */}
      <Paper sx={{ px: 3, py: 2, mb: 2, bgcolor: colors.bgWhite }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          {/* 头像 + 用户信息 */}
          <Avatar
            sx={{
              width: 48,
              height: 48,
              fontSize: '1.3rem',
              bgcolor: colors.primaryMuted,
              color: colors.primary,
              border: `2px solid ${colors.border}`,
              flexShrink: 0,
            }}
          >
            {profile.display_name?.[0] || profile.username?.[0] || '?'}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="h6"
              sx={{ fontFamily: '"Play", sans-serif', color: colors.textPrimary, lineHeight: 1.2 }}
            >
              {profile.display_name}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                color: colors.textMuted,
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: '0.75rem',
              }}
            >
              @{profile.username} · {profile.role === 'admin' ? '管理员' : '成员'}
            </Typography>
          </Box>

          {/* 统计数字：横向排列在右侧 */}
          <Box sx={{ display: 'flex', gap: 2.5, ml: 'auto', flexShrink: 0 }}>
            {statItems.map((item) => (
              <Box key={item.label} sx={{ textAlign: 'center' }}>
                <Typography
                  sx={{
                    fontWeight: 700,
                    fontFamily: '"JetBrains Mono", monospace',
                    fontSize: '1.1rem',
                    color: item.accent,
                    lineHeight: 1.2,
                  }}
                >
                  {formatNumber(item.value)}
                </Typography>
                <Typography variant="caption" sx={{ color: colors.textMuted, fontSize: '0.7rem' }}>
                  {item.label}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      </Paper>

      {/* Tab 区域 */}
      <Tabs
        value={tab}
        onChange={(e, v) => setTab(v)}
        sx={{
          mb: 2,
          '& .MuiTabs-indicator': { backgroundColor: colors.primary, height: 2 },
        }}
      >
        <Tab
          label="上传的资源"
          sx={{
            color: tab === 0 ? colors.primary : colors.textSecondary,
            fontWeight: tab === 0 ? 600 : 500,
          }}
        />
        <Tab
          label="收藏"
          sx={{
            color: tab === 1 ? colors.primary : colors.textSecondary,
            fontWeight: tab === 1 ? 600 : 500,
          }}
        />
        {!userId && (
          <Tab
            label="通知"
            sx={{
              color: tab === 2 ? colors.primary : colors.textSecondary,
              fontWeight: tab === 2 ? 600 : 500,
            }}
          />
        )}
      </Tabs>

      {tab === 0 ? (
        <ResourceGrid resources={profile.resources || []} emptyText="暂无上传的资源" />
      ) : tab === 1 ? (
        <ResourceGrid resources={profile.favorites || []} emptyText="暂无收藏" />
      ) : tab === 2 && !userId ? (
        /* ===== 通知列表 ===== */
        <Paper sx={{ p: 2, bgcolor: colors.bgWhite }}>
          {notifLoading ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <CircularProgress size={28} sx={{ color: colors.primary }} />
            </Box>
          ) : notifs.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <Typography variant="body1" sx={{ color: colors.textMuted }}>
                暂无通知
              </Typography>
            </Box>
          ) : (
            <>
              <List dense disablePadding>
                {notifs.map((item) => {
                  const isThanks = item.type === 'thanks';
                  const Icon = isThanks ? Favorite : Download;
                  const iconColor = isThanks ? colors.danger : colors.primary;

                  return (
                    <ListItemButton
                      key={item.id}
                      onClick={() => handleNotifClick(item)}
                      sx={{
                        py: 1.5,
                        px: 2,
                        borderRadius: 1,
                        mb: 0.5,
                        bgcolor: item.read ? 'transparent' : colors.primaryMuted,
                        transition: 'background-color 0.2s',
                        '&:hover': { bgcolor: item.read ? 'rgba(0,0,0,0.02)' : 'rgba(28, 134, 226, 0.12)' },
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 40 }}>
                        <Icon sx={{ fontSize: 22, color: iconColor }} />
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Typography
                            variant="body2"
                            sx={{
                              color: item.read ? colors.textSecondary : colors.textPrimary,
                              fontWeight: item.read ? 400 : 500,
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
                              fontFamily: '"JetBrains Mono", monospace',
                              fontSize: '0.7rem',
                            }}
                          >
                            {item.created_at
                              ? new Date(item.created_at).toLocaleString('zh-CN')
                              : ''}
                          </Typography>
                        }
                      />
                    </ListItemButton>
                  );
                })}
              </List>

              {notifHasMore && (
                <Box sx={{ textAlign: 'center', mt: 2 }}>
                  <Button
                    onClick={handleLoadMore}
                    sx={{
                      color: colors.primary,
                      fontWeight: 600,
                      fontFamily: '"Play", sans-serif',
                      '&:hover': { bgcolor: colors.primaryMuted },
                    }}
                  >
                    加载更多
                  </Button>
                </Box>
              )}
            </>
          )}
        </Paper>
      ) : (
        <ResourceGrid resources={profile.resources || []} emptyText="暂无上传的资源" />
      )}

      {/* CLI 同步引导（底部折叠） */}
      <Box sx={{ mt: 3 }}>
        <SyncGuide />
      </Box>
    </Box>
  );
}