/**
 * TagChip - 标签组件（JokerPS 亮色风格）
 *
 * 支持 category 属性来按分类着色：
 * - team: 蓝色
 * - tool: 绿色
 * - workflow: 橙色
 */
import Chip from '@mui/material/Chip';
import { colors } from '../theme';

// 标签分类颜色映射
const CATEGORY_COLORS = {
  team: { bg: 'rgba(37, 99, 235, 0.06)', text: '#2563EB', border: 'rgba(37, 99, 235, 0.2)' },
  tool: { bg: 'rgba(5, 150, 105, 0.06)', text: '#059669', border: 'rgba(5, 150, 105, 0.2)' },
  workflow: { bg: 'rgba(217, 119, 6, 0.06)', text: '#D97706', border: 'rgba(217, 119, 6, 0.2)' },
};

export default function TagChip({ label, onClick, onDelete, selected = false, size = 'small', category }) {
  const catColor = category ? CATEGORY_COLORS[category] : null;

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
        ...(catColor && !selected
          ? {
              bgcolor: catColor.bg,
              color: catColor.text,
              border: `1px solid ${catColor.border}`,
            }
          : selected
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