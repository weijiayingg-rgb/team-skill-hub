/**
 * FileUploader - 文件上传组件（JokerPS 亮色风格）
 *
 * 支持三种模式：
 * - 默认模式：多文件上传，接受常见文档格式
 * - acceptZip：ZIP-only 单文件上传
 * - acceptExpert：Expert 双模式，同时接受 ZIP 和散文件（.md/.yaml/.json），多选
 */

import { useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import IconButton from '@mui/material/IconButton';
import CloudUpload from '@mui/icons-material/CloudUpload';
import Delete from '@mui/icons-material/Delete';
import InsertDriveFile from '@mui/icons-material/InsertDriveFile';
import ArchiveIcon from '@mui/icons-material/Archive';
import { formatFileSize } from '../utils/format';
import { colors } from '../theme';

// Expert 模式接受的文件类型
const EXPERT_ACCEPT = '.zip,.md,.markdown,.yaml,.yml,.json,.txt';

export default function FileUploader({ files, setFiles, maxFiles = 20, maxSize = 10 * 1024 * 1024, acceptZip = false, acceptExpert = false }) {
  const [isDragActive, setIsDragActive] = useState(false);
  const inputRef = useRef(null);

  // 判断是否为单文件 ZIP-only 模式（不含 Expert 双模式）
  const isZipOnly = acceptZip && !acceptExpert;

  const handleDragEnter = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragActive(true); };
  const handleDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragActive(false); };
  const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragActive(true); };
  const handleDrop = (e) => {
    e.preventDefault(); e.stopPropagation(); setIsDragActive(false);
    addFiles(Array.from(e.dataTransfer.files));
  };

  const handleFileSelect = (e) => {
    addFiles(Array.from(e.target.files));
    e.target.value = '';
  };

  const addFiles = (newFiles) => {
    const validFiles = newFiles.filter(f => f.size <= maxSize);
    if (isZipOnly) {
      // ZIP-only 模式：只保留第一个 ZIP 文件
      const zipFiles = validFiles.filter(f => f.name.toLowerCase().endsWith('.zip'));
      setFiles(zipFiles.slice(0, 1));
    } else {
      // 多文件模式（含 Expert 双模式）
      setFiles(prev => [...prev, ...validFiles].slice(0, maxFiles));
    }
  };

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  // 根据模式确定 accept 属性
  const acceptAttr = acceptExpert ? EXPERT_ACCEPT : (isZipOnly ? '.zip' : undefined);

  return (
    <Box>
      <Box
        onClick={() => inputRef.current?.click()}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        sx={{
          border: '2px dashed',
          borderColor: isDragActive ? colors.primary : colors.border,
          borderRadius: 1,
          p: 4,
          textAlign: 'center',
          cursor: 'pointer',
          bgcolor: isDragActive ? colors.primaryMuted : colors.bgPage,
          transition: 'all 0.2s',
          '&:hover': { borderColor: colors.primary, bgcolor: colors.primaryMuted },
        }}
      >
        <input
          ref={inputRef}
          type="file"
          multiple={!isZipOnly}
          accept={acceptAttr}
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
        <CloudUpload sx={{ fontSize: 48, color: colors.textMuted, mb: 1 }} />
        <Typography variant="body1" fontWeight={500} sx={{ color: colors.textPrimary }}>
          {isDragActive
            ? '释放文件以上传'
            : acceptExpert
              ? '拖拽 ZIP 专家包或散文件（prompt.md + skills/*.md）到此处'
              : isZipOnly
                ? '拖拽 ZIP 包到此处或点击选择'
                : '拖拽文件到此处或点击选择'}
        </Typography>
        <Typography variant="caption" sx={{ color: colors.textMuted }}>
          {acceptExpert
            ? `支持 .zip / .md / .yaml / .json，单文件最大 ${formatFileSize(maxSize)}，可多选`
            : isZipOnly
              ? `支持 .zip 格式，最大 ${formatFileSize(maxSize)}`
              : `支持 md, yaml, json, sh, txt 等格式，单文件最大 ${formatFileSize(maxSize)}`}
        </Typography>
      </Box>

      {files.length > 0 && (
        <List dense sx={{ mt: 2 }}>
          {files.map((file, index) => (
            <ListItem
              key={`${file.name}-${index}`}
              secondaryAction={
                <IconButton edge="end" onClick={() => removeFile(index)} size="small" sx={{ color: colors.textMuted }}>
                  <Delete fontSize="small" />
                </IconButton>
              }
            >
              {file.name.toLowerCase().endsWith('.zip')
                ? <ArchiveIcon sx={{ mr: 1, color: colors.primary, fontSize: 20 }} />
                : <InsertDriveFile sx={{ mr: 1, color: colors.textSecondary, fontSize: 20 }} />}
              <ListItemText
                primary={file.name}
                secondary={formatFileSize(file.size)}
                primaryTypographyProps={{ variant: 'body2', sx: { color: colors.textPrimary } }}
                secondaryTypographyProps={{ sx: { color: colors.textMuted } }}
              />
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );
}