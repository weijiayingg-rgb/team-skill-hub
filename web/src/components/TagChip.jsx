/**
 * TagChip - 标签组件（JokerPS 亮色风格）
 */
import Chip from '@mui/material/Chip';
import { colors } from '../theme';

export default function TagChip({ label, onClick, onDelete, selected = false, size = 'small' }) {
  return (
    <Chip
      label={label}
      size={size}
      onClick={onClick}
      onDelete={onDelete}
      sx={{
        fontSize: '0.7rem',
        fontWeight: 500,
        cursor: onClick ? 'pointer' : 'default',
        height: size === 'small' ? 22 : 28,
        borderRadius: 1,
        ...(selected
          ? {
              bgcolor: colors.primaryMuted,
              color: colors.primary,
              border: `1px solid rgba(28, 134, 226, 0.3)`,
            }
          : {
              bgcolor: 'transparent',
              color: colors.textMuted,
              border: `1px solid ${colors.border}`,
              '&:hover': {
                borderColor: colors.borderHover,
                color: colors.textSecondary,
              },
            }),
      }}
    />
  );
}