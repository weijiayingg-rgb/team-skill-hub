/**
 * TypeBadge - 资源类型徽章（JokerPS 亮色清新风格）
 *
 * 每种类型有独立的语义色，从 constants.js 统一取值。
 */

import Chip from '@mui/material/Chip';
// 6种类型各用独立图标，提升区分度
import AutoFixHigh from '@mui/icons-material/AutoFixHigh';
import Psychology from '@mui/icons-material/Psychology';
import Gavel from '@mui/icons-material/Gavel';
import Cached from '@mui/icons-material/Cached';
import AccountTree from '@mui/icons-material/AccountTree';
import ContentCopy from '@mui/icons-material/ContentCopy';
import { RESOURCE_TYPES } from '../utils/constants';
import { colors } from '../theme';

// 图标映射：每种类型独立图标
const ICON_MAP = {
  AutoFixHigh, Psychology, Gavel, Cached, AccountTree, ContentCopy,
};

export default function TypeBadge({ type, size = 'small' }) {
  const typeInfo = RESOURCE_TYPES.find(t => t.key === type);
  if (!typeInfo) return <Chip label={type} size={size} />;

  const IconComponent = ICON_MAP[typeInfo.icon];
  const colorCfg = typeInfo.badge || { bg: 'rgba(0,0,0,0.04)', text: colors.textSecondary, border: colors.border };

  return (
    <Chip
      icon={IconComponent ? <IconComponent sx={{ fontSize: 14, color: `${colorCfg.text} !important` }} /> : undefined}
      label={typeInfo.label}
      size={size}
      sx={{
        bgcolor: colorCfg.bg,
        color: colorCfg.text,
        border: `1px solid ${colorCfg.border}`,
        fontWeight: 600,
        fontSize: '0.7rem',
        height: size === 'medium' ? 28 : 22,
        '& .MuiChip-icon': { ml: 0.5 },
      }}
    />
  );
}