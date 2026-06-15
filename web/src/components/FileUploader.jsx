/**
 * FileUploader - 文件上传组件（JokerPS 亮色风格）
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

export default function FileUploader({ files, setFiles, maxFiles = 20, maxSize = 10 * 1024 * 1024, acceptZip = false }) {
  const [isDragActive, setIsDragActive] = useState(false);
  const inputRef = useRef(null);

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
    if (acceptZip) {
      setFiles(validFiles.slice(0, 1));
    } else {
      setFiles(prev => [...prev, ...validFiles].slice(0, maxFiles));
    }
  };

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

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
          multiple={!acceptZip}
          accept={acceptZip ? '.zip' : undefined}
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
        <CloudUpload sx={{ fontSize: 48, color: colors.textMuted, mb: 1 }} />
        <Typography variant="body1" fontWeight={500} sx={{ color: colors.textPrimary }}>
          {isDragActive
            ? '释放文件以上传'
            : acceptZip
              ? '拖拽 ZIP 专家包到此处或点击选择'
              : '拖拽文件到此处或点击选择'}
        </Typography>
        <Typography variant="caption" sx={{ color: colors.textMuted }}>
          {acceptZip
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
              {acceptZip
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