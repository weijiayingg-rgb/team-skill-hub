/**
 * Profile - 个人中心页（JokerPS 亮色清新风格）
 */

import { useParams, useSearchParams } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
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
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Tooltip from '@mui/material/Tooltip';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import AddIcon from '@mui/icons-material/Add';
import Download from '@mui/icons-material/Download';
import Favorite from '@mui/icons-material/Favorite';
import SearchIcon from '@mui/icons-material/Search';
import apiClient from '../api/client';
import ResourceGrid from '../components/ResourceGrid';
import SyncGuide from '../components/SyncGuide';
import TypeBadge from '../components/TypeBadge';
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

  // 标签管理状态
  const [editingTags, setEditingTags] = useState(null);
  const [addingTagFor, setAddingTagFor] = useState(null);
  const [newTagValue, setNewTagValue] = useState('');
  const [tagError, setTagError] = useState('');

  // 删除确认对话框
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // 资源列表过滤状态（Tab 0 和 Tab 1 共用）
  const [filterText, setFilterText] = useState('');        // 搜索文本
  const [filterType, setFilterType] = useState('all');     // 类型筛选：all/skill/expert
  const [filterSort, setFilterSort] = useState('newest');  // 排序：newest/hot/downloads/favorites

  // 资源列表过滤 + 排序（前端纯计算，不额外请求 API）
  const filterAndSort = (items) => {
    let result = items || [];

    // 类型过滤
    if (filterType !== 'all') {
      result = result.filter(r => r.type === filterType);
    }

    // 搜索过滤（name + description 模糊匹配）
    if (filterText.trim()) {
      const keyword = filterText.trim().toLowerCase();
      result = result.filter(r =>
        (r.display_name || r.name || '').toLowerCase().includes(keyword) ||
        (r.description || '').toLowerCase().includes(keyword)
      );
    }

    // 排序
    const sorted = [...result];
    switch (filterSort) {
      case 'newest':
        sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        break;
      case 'hot':
        sorted.sort((a, b) => (b.hot_score || 0) - (a.hot_score || 0));
        break;
      case 'downloads':
        sorted.sort((a, b) => (b.download_count || 0) - (a.download_count || 0));
        break;
      case 'favorites':
        sorted.sort((a, b) => (b.favorite_count || 0) - (a.favorite_count || 0));
        break;
    }

    return sorted;
  };

  const handleDeleteResource = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiClient.delete(`/resources/${deleteTarget.id}`);
      // 从上传列表和收藏列表移除
      setProfile(prev => prev ? {
        ...prev,
        resources: prev.resources?.filter(r => r.id !== deleteTarget.id),
        favorites: prev.favorites?.filter(r => r.id !== deleteTarget.id),
      } : prev);
      setEditingTags(prev => prev ? prev.filter(r => r.id !== deleteTarget.id) : prev);
    } catch (err) {
      setTagError(`删除失败: ${err.message}`);
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  // 从 profile 同步标签数据
  useEffect(() => {
    if (profile?.resources) {
      setEditingTags(profile.resources.map(r => ({ ...r })));
    }
  }, [profile]);

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

  const fetchNotifications = useCallback(async (page = 1, append = false) => {
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
  }, []);

  useEffect(() => {
    if (tab === 2) {
      fetchNotifications(1);
    }
  }, [tab, fetchNotifications]);

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

  const handleLoadMore = useCallback(() => {
    setNotifPage(prev => {
      fetchNotifications(prev + 1, true);
      return prev;
    });
  }, [fetchNotifications]);

  // ── 标签管理 ──
  const updateTags = async (resourceId, updatedTags) => {
    await apiClient.put(`/resources/${resourceId}`, { tags: updatedTags });
    // 同步更新两个状态
    setEditingTags(prev => prev.map(r => r.id === resourceId ? { ...r, tags: updatedTags } : r));
    setProfile(prev => prev ? {
      ...prev,
      resources: prev.resources?.map(r => r.id === resourceId ? { ...r, tags: updatedTags } : r),
    } : prev);
  };

  const submitTag = async (resourceId) => {
    const tag = newTagValue.trim();
    setNewTagValue('');
    setAddingTagFor(null);
    if (!tag) return;
    const resource = editingTags?.find(r => r.id === resourceId);
    if (!resource) return;
    if (resource.tags.includes(tag)) return; // 已存在，静默跳过
    setTagError('');
    try {
      await updateTags(resourceId, [...resource.tags, tag]);
    } catch (err) {
      setTagError(`添加失败: ${err.message}`);
    }
  };

  const handleDeleteTag = async (resourceId, tagToRemove) => {
    const resource = editingTags?.find(r => r.id === resourceId);
    if (!resource) return;
    setTagError('');
    try {
      await updateTags(resourceId, resource.tags.filter(t => t !== tagToRemove));
    } catch (err) {
      setTagError(`删除失败: ${err.message}`);
    }
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
        {!userId && (
          <Tab
            label="标签管理"
            sx={{
              color: tab === 3 ? colors.primary : colors.textSecondary,
              fontWeight: tab === 3 ? 600 : 500,
            }}
          />
        )}
      </Tabs>

      {tab === 0 ? (
        <>
          {/* 过滤工具栏 */}
          <Box sx={{ mb: 2 }}>
            {/* 搜索框 */}
            <TextField
              size="small"
              placeholder="搜索资源名称或描述..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              sx={{
                mb: 1.5,
                width: '100%',
                '& .MuiInputBase-root': {
                  fontSize: '0.85rem',
                  bgcolor: colors.bgWhite,
                },
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: colors.textMuted, fontSize: 20 }} />
                  </InputAdornment>
                ),
              }}
            />

            {/* 类型 + 排序 */}
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
              {/* 类型筛选 */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Typography variant="caption" sx={{ color: colors.textMuted, mr: 0.5 }}>类型:</Typography>
                {['all', 'skill', 'expert'].map(t => (
                  <Chip
                    key={t}
                    label={t === 'all' ? '全部' : t === 'skill' ? 'Skill' : 'Expert'}
                    size="small"
                    clickable
                    onClick={() => setFilterType(t)}
                    sx={{
                      height: 28, fontSize: '0.78rem',
                      fontWeight: filterType === t ? 700 : 500,
                      bgcolor: filterType === t ? colors.primaryMuted : 'rgba(0,0,0,0.03)',
                      color: filterType === t ? colors.primary : colors.textSecondary,
                      border: filterType === t ? `1.5px solid ${colors.primary}` : '1.5px solid transparent',
                    }}
                  />
                ))}
              </Box>

              {/* 排序 */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Typography variant="caption" sx={{ color: colors.textMuted, mr: 0.5 }}>排序:</Typography>
                {[
                  { key: 'newest', label: '最新' },
                  { key: 'hot', label: '热度' },
                  { key: 'downloads', label: '下载量' },
                  { key: 'favorites', label: '收藏量' },
                ].map(s => (
                  <Chip
                    key={s.key}
                    label={s.label}
                    size="small"
                    clickable
                    onClick={() => setFilterSort(s.key)}
                    sx={{
                      height: 28, fontSize: '0.78rem',
                      fontWeight: filterSort === s.key ? 700 : 500,
                      bgcolor: filterSort === s.key ? colors.primaryMuted : 'rgba(0,0,0,0.03)',
                      color: filterSort === s.key ? colors.primary : colors.textSecondary,
                      border: filterSort === s.key ? `1.5px solid ${colors.primary}` : '1.5px solid transparent',
                    }}
                  />
                ))}
              </Box>
            </Box>
          </Box>
          <ResourceGrid resources={filterAndSort(profile.resources)} emptyText="暂无上传的资源" onDelete={setDeleteTarget} />
        </>
      ) : tab === 1 ? (
        <>
          {/* 过滤工具栏（与 Tab 0 共用状态） */}
          <Box sx={{ mb: 2 }}>
            <TextField
              size="small"
              placeholder="搜索资源名称或描述..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              sx={{
                mb: 1.5,
                width: '100%',
                '& .MuiInputBase-root': {
                  fontSize: '0.85rem',
                  bgcolor: colors.bgWhite,
                },
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: colors.textMuted, fontSize: 20 }} />
                  </InputAdornment>
                ),
              }}
            />
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Typography variant="caption" sx={{ color: colors.textMuted, mr: 0.5 }}>类型:</Typography>
                {['all', 'skill', 'expert'].map(t => (
                  <Chip
                    key={t}
                    label={t === 'all' ? '全部' : t === 'skill' ? 'Skill' : 'Expert'}
                    size="small"
                    clickable
                    onClick={() => setFilterType(t)}
                    sx={{
                      height: 28, fontSize: '0.78rem',
                      fontWeight: filterType === t ? 700 : 500,
                      bgcolor: filterType === t ? colors.primaryMuted : 'rgba(0,0,0,0.03)',
                      color: filterType === t ? colors.primary : colors.textSecondary,
                      border: filterType === t ? `1.5px solid ${colors.primary}` : '1.5px solid transparent',
                    }}
                  />
                ))}
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Typography variant="caption" sx={{ color: colors.textMuted, mr: 0.5 }}>排序:</Typography>
                {[
                  { key: 'newest', label: '最新' },
                  { key: 'hot', label: '热度' },
                  { key: 'downloads', label: '下载量' },
                  { key: 'favorites', label: '收藏量' },
                ].map(s => (
                  <Chip
                    key={s.key}
                    label={s.label}
                    size="small"
                    clickable
                    onClick={() => setFilterSort(s.key)}
                    sx={{
                      height: 28, fontSize: '0.78rem',
                      fontWeight: filterSort === s.key ? 700 : 500,
                      bgcolor: filterSort === s.key ? colors.primaryMuted : 'rgba(0,0,0,0.03)',
                      color: filterSort === s.key ? colors.primary : colors.textSecondary,
                      border: filterSort === s.key ? `1.5px solid ${colors.primary}` : '1.5px solid transparent',
                    }}
                  />
                ))}
              </Box>
            </Box>
          </Box>
          <ResourceGrid resources={filterAndSort(profile.favorites)} emptyText="暂无收藏" />
        </>
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
      ) : tab === 3 && !userId ? (
        /* ===== 标签管理 ===== */
        <Paper sx={{ p: 3, bgcolor: colors.bgWhite }}>
          <Typography variant="h6" sx={{ mb: 2, fontFamily: '"Play", sans-serif' }}>
            标签管理
          </Typography>
          <Typography variant="body2" sx={{ color: colors.textMuted, mb: 2 }}>
            为你的资源添加标签，方便搜索和分类
          </Typography>

          {tagError && (
            <Typography variant="body2" sx={{ color: colors.danger, mb: 2, fontWeight: 500 }}>
              {tagError}
            </Typography>
          )}

          {editingTags === null ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <CircularProgress size={28} sx={{ color: colors.primary }} />
            </Box>
          ) : editingTags.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <Typography variant="body1" sx={{ color: colors.textMuted }}>
                暂无上传的资源
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {editingTags.map(resource => (
                <Paper
                  key={resource.id}
                  variant="outlined"
                  sx={{
                    p: 2,
                    borderColor: colors.border,
                    transition: 'border-color 0.2s',
                    '&:hover': { borderColor: colors.borderHover },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <TypeBadge type={resource.type} size="small" />
                    <Typography
                      sx={{
                        fontWeight: 600,
                        color: colors.textPrimary,
                        fontFamily: '"Play", sans-serif',
                        fontSize: '0.9rem',
                      }}
                    >
                      {resource.display_name || resource.name}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                    {resource.tags.map(tag => (
                      <Chip
                        key={tag}
                        label={tag}
                        size="small"
                        onDelete={() => handleDeleteTag(resource.id, tag)}
                        sx={{
                          fontSize: '0.7rem',
                          height: 22,
                          bgcolor: 'rgba(28, 134, 226, 0.06)',
                          color: colors.primary,
                          border: '1px solid rgba(28, 134, 226, 0.2)',
                          '& .MuiChip-deleteIcon': {
                            fontSize: 14,
                            color: colors.textMuted,
                            '&:hover': { color: colors.danger },
                          },
                        }}
                      />
                    ))}
                    {addingTagFor === resource.id ? (
                      <TextField
                        size="small"
                        autoFocus
                        value={newTagValue}
                        onChange={e => setNewTagValue(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') submitTag(resource.id);
                          if (e.key === 'Escape') { setAddingTagFor(null); setNewTagValue(''); }
                        }}
                        onBlur={() => submitTag(resource.id)}
                        placeholder="输入标签，回车确认"
                        sx={{
                          '& .MuiInputBase-root': {
                            height: 26,
                            fontSize: '0.75rem',
                            minWidth: 160,
                          },
                        }}
                      />
                    ) : (
                      <Tooltip title="添加标签">
                        <IconButton
                          size="small"
                          onClick={() => setAddingTagFor(resource.id)}
                          sx={{
                            width: 22,
                            height: 22,
                            bgcolor: 'rgba(0,0,0,0.04)',
                            '&:hover': { bgcolor: colors.primaryMuted, color: colors.primary },
                          }}
                        >
                          <AddIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                </Paper>
              ))}
            </Box>
          )}
        </Paper>
      ) : (
        <ResourceGrid resources={profile.resources || []} emptyText="暂无上传的资源" />
      )}

      {/* CLI 同步引导（底部折叠） */}
      <Box sx={{ mt: 3 }}>
        <SyncGuide />
      </Box>

      {/* 删除确认对话框 */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogTitle sx={{ fontFamily: '"Play", sans-serif' }}>确认删除</DialogTitle>
        <DialogContent>
          <DialogContentText>
            确定要删除「{deleteTarget?.display_name || deleteTarget?.name}」吗？此操作不可撤销，将同时删除所有版本文件。
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)} disabled={deleting} sx={{ color: colors.textSecondary }}>
            取消
          </Button>
          <Button
            onClick={handleDeleteResource}
            disabled={deleting}
            sx={{ color: colors.danger, fontWeight: 600 }}
          >
            {deleting ? '删除中...' : '确认删除'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
