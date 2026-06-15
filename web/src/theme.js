/**
 * SkillHub Theme — "JokerPS" 亮色清新风格
 *
 * 设计语言：浅灰蓝底 + 白色容器卡片 + 亮蓝交互色 + 活力橙标题点缀
 * 参考 jokerps.com 的设计系统，字体使用 Play。
 */
import { createTheme } from '@mui/material/styles';

// ─── 色彩令牌 ───────────────────────────────────────────────
export const colors = {
  // 品牌色
  primary: '#1C86E2',       // 亮蓝 — 主交互色（满足 WCAG AA 对比度）
  primaryHover: '#1675CC',
  primaryMuted: 'rgba(28, 134, 226, 0.08)',  // hover 背景高亮

  // 功能色
  success: '#52C41A',       // 翠绿
  danger: '#FF4D4F',        // 红色
  info: '#1C86E2',          // 亮蓝（同 primary）
  warning: '#FF6600',       // 活力橙

  // 表面层级（从浅到深）
  bgPage: '#E1E5EB',         // 页面底色 — 浅灰蓝
  bgWhite: '#FFFFFF',        // 纯白
  bgCard: 'rgba(255, 255, 255, 0.9)',  // 卡片/面板底色（半透白）
  bgCardHover: '#F5F7FA',

  // 边框
  border: 'rgba(0, 40, 83, 0.08)',
  borderHover: 'rgba(0, 40, 83, 0.16)',

  // 文字
  textPrimary: '#475669',    // 深灰蓝 — 主文字
  textSecondary: '#738192',  // 灰蓝 — 次要文字
  textMuted: '#6B7D93',      // 浅灰蓝 — 辅助文字（满足对比度）

  // 代码块（保留暗色，代码阅读体验好）
  codeBg: '#1E293B',
  codeText: '#CDD6F4',
};

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: colors.primary,
      light: '#5CB8FF',
      dark: colors.primaryHover,
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: colors.warning, // 活力橙作为 secondary
    },
    error: {
      main: colors.danger,
    },
    success: {
      main: colors.success,
    },
    info: {
      main: colors.info,
    },
    background: {
      default: colors.bgPage,
      paper: colors.bgWhite,
    },
    text: {
      primary: colors.textPrimary,
      secondary: colors.textSecondary,
    },
    divider: colors.border,
  },

  typography: {
    fontFamily: '"Play", "Microsoft YaHei", "PingFang SC", sans-serif',
    h1: { fontFamily: '"Play", sans-serif', fontWeight: 700, letterSpacing: '-0.02em' },
    h2: { fontFamily: '"Play", sans-serif', fontWeight: 700, color: '#FF6600', letterSpacing: '-0.01em' },
    h3: { fontFamily: '"Play", sans-serif', fontWeight: 700, letterSpacing: '-0.01em' },
    h4: { fontFamily: '"Play", sans-serif', fontWeight: 700, letterSpacing: '-0.01em' },
    h5: { fontFamily: '"Play", sans-serif', fontWeight: 600 },
    h6: { fontFamily: '"Play", sans-serif', fontWeight: 600 },
    subtitle1: { fontWeight: 600 },
    body1: { lineHeight: 1.7 },
    body2: { lineHeight: 1.6, fontSize: '0.875rem' },
  },

  shape: {
    borderRadius: 6, // 全局圆角 6px
  },

  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          scrollbarColor: `${colors.border} transparent`,
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 6,
          fontFamily: '"Play", sans-serif',
          letterSpacing: '0.01em',
        },
        contained: {
          boxShadow: 'none',
          '&:hover': {
            boxShadow: 'none',
          },
        },
        outlined: {
          borderColor: colors.border,
          color: colors.textPrimary,
          '&:hover': {
            borderColor: colors.primary,
            backgroundColor: colors.primaryMuted,
            color: colors.primary,
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          border: `1px solid ${colors.border}`,
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
          backgroundColor: colors.bgWhite,
          transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
          '&:hover': {
            borderColor: colors.primary,
            boxShadow: '0 2px 8px rgba(28, 134, 226, 0.08)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none', // 去掉 MUI 默认的渐变叠加
          borderRadius: 8,
          border: `1px solid ${colors.border}`,
          backgroundColor: colors.bgCard,
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          fontFamily: '"Play", sans-serif',
        },
        outlined: {
          borderColor: colors.border,
          color: colors.textSecondary,
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 6,
            backgroundColor: colors.bgWhite,
            '& fieldset': { borderColor: colors.border },
            '&:hover fieldset': { borderColor: colors.borderHover },
            '&.Mui-focused fieldset': { borderColor: colors.primary },
          },
          '& .MuiInputLabel-root.Mui-focused': { color: colors.primary },
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontFamily: '"Play", sans-serif',
          fontWeight: 500,
          color: colors.textSecondary,
          '&.Mui-selected': {
            color: colors.primary,
            fontWeight: 600,
          },
        },
      },
    },
    MuiAvatar: {
      styleOverrides: {
        root: {
          backgroundColor: colors.primaryMuted,
          color: colors.primary,
          fontFamily: '"Play", sans-serif',
          fontWeight: 700,
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: colors.bgWhite,
          color: colors.textPrimary,
          border: `1px solid ${colors.border}`,
          borderRadius: 6,
          fontSize: '0.75rem',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: {
          backgroundColor: colors.primary,
          height: 2,
        },
      },
    },
    MuiPaginationItem: {
      styleOverrides: {
        root: {
          '&.Mui-selected': {
            backgroundColor: colors.primary,
            color: '#FFFFFF',
            '&:hover': { backgroundColor: colors.primaryHover },
          },
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        standardError: {
          backgroundColor: 'rgba(255, 77, 79, 0.06)',
          color: colors.danger,
          border: `1px solid rgba(255, 77, 79, 0.2)`,
        },
        standardSuccess: {
          backgroundColor: 'rgba(82, 196, 26, 0.06)',
          color: colors.success,
          border: `1px solid rgba(82, 196, 26, 0.2)`,
        },
        standardInfo: {
          backgroundColor: 'rgba(28, 134, 226, 0.06)',
          color: colors.info,
          border: `1px solid rgba(28, 134, 226, 0.2)`,
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 8,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
        },
      },
    },
  },
});

export default theme;