/**
 * VersionUploadDialog — 上传新版本对话框
 *
 * 在资源详情页中触发，支持：
 *   - 版本号自动递增（patch / minor / major）
 *   - 更新日志
 *   - 文件上传（Expert 类型支持 ZIP 或多文件，普通类型支持多文件）
 *
 * API: POST /api/resources/:id/versions
 *   - auto_version: 'patch' | 'minor' | 'major'
 *   - changelog: string
 *   - files: File[]
 */

import { useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import apiClient from '../api/client';
import FileUploader from './FileUploader';
import { colors } from '../theme';

/**
 * 根据 semver 规则计算下一个版本号
 * @param {string} current - 当前版本号 (e.g. "1.2.3")
 * @param {'patch'|'minor'|'major'} bump - 递增类型
 * @returns {string} 下一个版本号
 */
function getNextVersion(current, bump) {
  const parts = (current || '1.0.0').split('.').map(Number);
  while (parts.length < 3) parts.push(0);
  switch (bump) {
    case 'patch': parts[2]++; break;
    case 'minor': parts[1]++; parts[2] = 0; break;
    case 'major': parts[0]++; parts[1] = 0; parts[2] = 0; break;
    default: break;
  }
  return parts.join('.');
}

/**
 * @param {object} props
 * @param {boolean} props.open - 对话框是否打开
 * @param {Function} props.onClose - 关闭回调
 * @param {object} props.resource - 资源对象 { id, name, display_name, type, current_version }
 * @param {Function} props.onSuccess - 上传成功后回调（用于刷新页面数据）
 */
export default function VersionUploadDialog({ open, onClose, resource, onSuccess }) {
  const [versionBump, setVersionBump] = useState('patch');
  const [changelog, setChangelog] = useState('');
  const [files, setFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const isExpert = resource?.type === 'expert';
  const nextVersion = getNextVersion(resource?.current_version, versionBump);

  const resetAndClose = () => {
    setFiles([]);
    setChangelog('');
    setError('');
    setVersionBump('patch');
    onClose();
  };

  const handleSubmit = async () => {
    if (files.length === 0) {
      setError('请至少上传一个文件');
      return;
    }

    setSubmitting(true);
    setError('');

    const formData = new FormData();
    formData.append('auto_version', versionBump);
    formData.append('changelog', changelog || `更新至 v${nextVersion}`);
    for (const file of files) {
      formData.append('files', file);
    }

    try {
      await apiClient.post(`/resources/${resource.id}/versions`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      resetAndClose();
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err.message || '上传失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={resetAndClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontFamily: '"Play", sans-serif', pb: 1 }}>
        上传新版本
        <Typography variant="caption" sx={{ ml: 1, color: colors.textMuted, fontWeight: 400 }}>
          {resource?.display_name}
        </Typography>
      </DialogTitle>

      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {/* 版本号选择 */}
        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600, color: colors.textPrimary }}>
          版本号
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
          <ToggleButtonGroup
            value={versionBump}
            exclusive
            onChange={(e, val) => val && setVersionBump(val)}
            size="small"
          >
            {['patch', 'minor', 'major'].map(bump => (
              <ToggleButton
                key={bump}
                value={bump}
                sx={{
                  textTransform: 'none',
                  fontWeight: versionBump === bump ? 600 : 400,
                  borderColor: versionBump === bump ? colors.primary : colors.border,
                  color: versionBump === bump ? colors.primary : colors.textSecondary,
                  '&.Mui-selected': {
                    bgcolor: colors.primaryMuted,
                    color: colors.primary,
                    '&:hover': { bgcolor: colors.primaryMuted },
                  },
                }}
              >
                {bump}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          <Typography variant="body2" sx={{ color: colors.textMuted }}>
            v{resource?.current_version} →
          </Typography>
          <Chip
            label={`v${nextVersion}`}
            size="small"
            sx={{
              bgcolor: colors.primaryMuted,
              color: colors.primary,
              fontWeight: 600,
              fontFamily: '"JetBrains Mono", monospace',
            }}
          />
        </Box>

        {/* 更新日志 */}
        <TextField
          label="更新日志"
          value={changelog}
          onChange={e => setChangelog(e.target.value)}
          multiline
          rows={3}
          fullWidth
          placeholder="描述这个版本的变更..."
          sx={{ mb: 2.5 }}
        />

        {/* 文件上传 */}
        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600, color: colors.textPrimary }}>
          上传文件
          {isExpert && (
            <Typography component="span" variant="caption" sx={{ ml: 0.5, color: colors.textMuted, fontWeight: 400 }}>
              （上传 prompt.md 等文件，或整个 ZIP 包）
            </Typography>
          )}
        </Typography>
        <FileUploader
          files={files}
          setFiles={setFiles}
          maxFiles={20}
          maxSize={50 * 1024 * 1024}
          acceptZip={isExpert}
        />
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={resetAndClose} disabled={submitting} sx={{ color: colors.textSecondary }}>
          取消
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={submitting || files.length === 0}
        >
          {submitting ? <CircularProgress size={20} sx={{ color: '#FFF' }} /> : `发布 v${nextVersion}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
