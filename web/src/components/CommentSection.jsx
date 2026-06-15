import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Avatar from '@mui/material/Avatar';
import Paper from '@mui/material/Paper';
import CircularProgress from '@mui/material/CircularProgress';
import apiClient from '../api/client';
import { formatDateRelative } from '../utils/format';

export default function CommentSection({ resourceId }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchComments = async () => {
    if (!resourceId) return;
    setLoading(true);
    try {
      const res = await apiClient.get(`/resources/${resourceId}/comments`);
      setComments(res.data || []);
    } catch (err) {
      console.error('Failed to fetch comments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComments();
  }, [resourceId]);

  const handleSubmit = async () => {
    if (!content.trim()) return;
    setSubmitting(true);
    try {
      await apiClient.post(`/resources/${resourceId}/comment`, { content: content.trim() });
      setContent('');
      await fetchComments();
    } catch (err) {
      console.error('Failed to post comment:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2, fontFamily: '"Play", sans-serif', fontWeight: 600 }}>评论 ({comments.length})</Typography>

      {/* 评论输入 */}
      <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
        <TextField
          fullWidth
          multiline
          rows={2}
          placeholder="写下你的评论..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          size="small"
        />
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={!content.trim() || submitting}
          sx={{ alignSelf: 'flex-end', minWidth: 80 }}
        >
          {submitting ? <CircularProgress size={20} color="inherit" /> : '发表'}
        </Button>
      </Box>

      {/* 评论列表 */}
      {loading ? (
        <Box sx={{ textAlign: 'center', py: 2 }}><CircularProgress size={24} /></Box>
      ) : comments.length === 0 ? (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>暂无评论，来第一个评论吧</Typography>
      ) : (
        comments.map(comment => (
          <Paper key={comment.id} variant="outlined" sx={{ p: 2, mb: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Avatar sx={{ width: 28, height: 28, fontSize: '0.8rem' }}>
                {comment.author_display_name?.[0] || comment.author_name?.[0] || '?'}
              </Avatar>
              <Typography variant="body2" fontWeight={600}>
                {comment.author_display_name || comment.author_name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {formatDateRelative(comment.created_at)}
              </Typography>
            </Box>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
              {comment.content}
            </Typography>
          </Paper>
        ))
      )}
    </Box>
  );
}