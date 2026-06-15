/**
 * SearchBar - 搜索栏（JokerPS 亮色风格）
 *
 * 白色输入框 + 亮蓝焦点环 + 圆形搜索按钮
 * hero 变体用于首页大搜索区域
 * 支持 initialQuery/initialType props，用于搜索页回显筛选条件
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import FormControl from '@mui/material/FormControl';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Box from '@mui/material/Box';
import SearchIcon from '@mui/icons-material/Search';
import { RESOURCE_TYPES } from '../utils/constants';
import { colors } from '../theme';

export default function SearchBar({ variant = 'default', initialQuery = '', initialType = '' }) {
  const [query, setQuery] = useState(initialQuery);
  const [type, setType] = useState(initialType);
  const navigate = useNavigate();

  // 当外部 initialQuery/initialType 变化时同步到内部状态（如 URL 参数更新）
  useEffect(() => {
    if (initialQuery !== undefined) setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    if (initialType !== undefined) setType(initialType);
  }, [initialType]);

  const isHero = variant === 'hero';

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (type) params.set('type', type);
    navigate(`/search?${params.toString()}`);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSearch();
  };

  // 共享的输入框样式
  const inputSx = {
    '& .MuiOutlinedInput-root': {
      borderRadius: isHero ? 8 : 6,
      bgcolor: colors.bgWhite,
      fontSize: isHero ? '1rem' : '0.875rem',
      color: colors.textPrimary,
      transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
      '& fieldset': {
        borderColor: colors.border,
      },
      '&:hover fieldset': {
        borderColor: colors.borderHover,
      },
      '&.Mui-focused': {
        boxShadow: `0 0 0 3px ${colors.primaryMuted}`,
        '& fieldset': {
          borderColor: colors.primary,
        },
      },
    },
  };

  return (
    <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
      <TextField
        id="search-query"
        name="search-query"
        placeholder="搜索 AI 技能名称、标签、描述..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        size={isHero ? 'medium' : 'small'}
        sx={{
          minWidth: isHero ? 400 : 280,
          flex: 1,
          ...inputSx,
        }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon sx={{ color: colors.textMuted, fontSize: isHero ? 24 : 20 }} />
            </InputAdornment>
          ),
        }}
      />

      <FormControl size={isHero ? 'medium' : 'small'} sx={{ minWidth: 130 }}>
        <Select
          id="search-type"
          name="search-type"
          value={type}
          onChange={(e) => setType(e.target.value)}
          displayEmpty
          sx={{
            borderRadius: isHero ? 8 : 6,
            bgcolor: colors.bgWhite,
            fontSize: isHero ? '1rem' : '0.875rem',
            color: type ? colors.textPrimary : colors.textSecondary,
            '& fieldset': {
              borderColor: colors.border,
            },
            '&:hover fieldset': {
              borderColor: colors.borderHover,
            },
            '&.Mui-focused': {
              boxShadow: `0 0 0 3px ${colors.primaryMuted}`,
              '& fieldset': {
                borderColor: colors.primary,
              },
            },
            '& .MuiSvgIcon-root': {
              color: colors.textMuted,
            },
          }}
        >
          <MenuItem value="">全部类型</MenuItem>
          {RESOURCE_TYPES.map(t => (
            <MenuItem key={t.key} value={t.key}>{t.label}</MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* 搜索按钮：亮蓝填充 */}
      <IconButton
        onClick={handleSearch}
        sx={{
          bgcolor: colors.primary,
          color: '#FFFFFF',
          width: isHero ? 48 : 40,
          height: isHero ? 48 : 40,
          borderRadius: isHero ? 8 : 6,
          transition: 'all 0.2s ease',
          '&:hover': {
            bgcolor: colors.primaryHover,
            boxShadow: `0 0 0 3px ${colors.primaryMuted}`,
          },
        }}
      >
        <SearchIcon fontSize={isHero ? 'medium' : 'small'} />
      </IconButton>
    </Box>
  );
}