/**
 * PlatformBadge - 平台徽章（JokerPS 亮色风格）
 */

import Chip from '@mui/material/Chip';
import Code from '@mui/icons-material/Code';
import Terminal from '@mui/icons-material/Terminal';
import SmartToy from '@mui/icons-material/SmartToy';
import { colors } from '../theme';

const PLATFORM_CONFIG = {
  workbuddy: { label: 'WorkBuddy', icon: SmartToy, color: colors.primary },
  cursor:    { label: 'Cursor',     icon: Code,     color: colors.warning },
  claude:    { label: 'Claude Code', icon: Terminal, color: colors.success },
};

export default function PlatformBadge({ platform, size = 'small' }) {
  const config = PLATFORM_CONFIG[platform] || { label: platform, icon: Code, color: colors.textSecondary };
  const IconComponent = config.icon;

  return (
    <Chip
      icon={<IconComponent sx={{ fontSize: 14, color: `${config.color} !important` }} />}
      label={config.label}
      size={size}
      variant="outlined"
      sx={{
        borderColor: config.color,
        color: config.color,
        fontWeight: 500,
        fontSize: size === 'medium' ? '0.8rem' : '0.7rem',
        borderRadius: 1,
      }}
    />
  );
}