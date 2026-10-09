'use client';

import React, { useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Popper from '@mui/material/Popper';
import type { ContentTypeItem, FacetItem } from '@/apis/home-discover';
import { SearchModeSwitch } from './SearchBanners';

type SetString = React.Dispatch<React.SetStateAction<string>>;

/**
 * 结构化筛选条:类型/导演/演员/类型标签/年代(走后端 /search metadata 筛选)+ 普通/AI 搜索切换。
 * memo:改搜索框文字时不跟着重渲染。
 */
export const SearchFilterBar = React.memo(function SearchFilterBar({
  aiEnabled,
  aiMode,
  onSwitchMode: switchMode,
  contentTypes,
  facetField,
  setFacetField,
  facetSuggestions,
  fType,
  setFType,
  fDirector,
  setFDirector,
  fActor,
  setFActor,
  fGenre,
  setFGenre,
  fYear,
  setFYear,
  fUsable,
  setFUsable,
}: {
  aiEnabled: boolean;
  aiMode: boolean;
  onSwitchMode: (ai: boolean) => void;
  contentTypes: ContentTypeItem[];
  facetField: string;
  setFacetField: SetString;
  facetSuggestions: FacetItem[];
  fType: string;
  setFType: SetString;
  fDirector: string;
  setFDirector: SetString;
  fActor: string;
  setFActor: SetString;
  fGenre: string;
  setFGenre: SetString;
  fYear: string;
  setFYear: SetString;
  fUsable: boolean;
  setFUsable: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: { xs: 2, md: 3 },
        py: 1,
        overflowX: 'auto',
        bgcolor: 'var(--bg-topbar, rgba(10,10,15,0.9))',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.06))',
        '&::-webkit-scrollbar': { display: 'none' },
      }}
    >
      {aiEnabled && <SearchModeSwitch ai={aiMode} onChange={switchMode} />}
      {aiMode ? (
        <Typography sx={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
          不用想关键词,AI 会读懂你的描述并说明每个结果为什么合适
        </Typography>
      ) : (
      <>
      <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted, rgba(255,255,255,0.4))', flexShrink: 0, textTransform: 'uppercase', letterSpacing: 0.5 }}>筛选</Typography>
      <Select
        size="small"
        value={fType}
        displayEmpty
        onChange={(e) => setFType(e.target.value)}
        sx={{ flexShrink: 0, minWidth: 96, height: 30, fontSize: 12, color: 'var(--text-primary, #fff)' }}
      >
        <MenuItem value="">全部分类</MenuItem>
        {contentTypes.map((ct) => (
          <MenuItem key={ct.code} value={ct.code}>{ct.name}</MenuItem>
        ))}
      </Select>
      <FilterField
        value={fDirector}
        onChange={setFDirector}
        onFocus={() => setFacetField('director')}
        placeholder="导演"
        suggestions={facetField === 'director' ? facetSuggestions : []}
      />
      <FilterField
        value={fActor}
        onChange={setFActor}
        onFocus={() => setFacetField('cast')}
        placeholder="演员"
        suggestions={facetField === 'cast' ? facetSuggestions : []}
      />
      <FilterField
        value={fGenre}
        onChange={setFGenre}
        onFocus={() => setFacetField('genre')}
        placeholder="类型(科幻/喜剧)"
        suggestions={facetField === 'genre' ? facetSuggestions : []}
      />
      <FilterField value={fYear} onChange={setFYear} placeholder="年代(2020)" inputMode="numeric" />
      <Box
        component="button"
        aria-pressed={fUsable}
        onClick={() => setFUsable((v) => !v)}
        sx={{
          flexShrink: 0,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
          px: 1.25,
          py: 0.35,
          borderRadius: 999,
          border: '1px solid',
          borderColor: fUsable ? '#22c55e' : 'var(--border-color, rgba(255,255,255,0.12))',
          bgcolor: fUsable ? '#22c55e1F' : 'transparent',
          color: fUsable ? '#22c55e' : 'var(--text-muted, rgba(255,255,255,0.65))',
          fontSize: 11.5,
          fontWeight: fUsable ? 600 : 400,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: fUsable ? '#22c55e' : 'currentColor', opacity: fUsable ? 1 : 0.5 }} />
        只看能看的
      </Box>
      {(fType || fDirector || fActor || fGenre || fYear) && (
        <Box
          component="button"
          onClick={() => { setFType(''); setFDirector(''); setFActor(''); setFGenre(''); setFYear(''); }}
          sx={{
            flexShrink: 0,
            px: 1.25,
            py: 0.35,
            borderRadius: 999,
            border: '1px solid var(--border-color, rgba(255,255,255,0.12))',
            bgcolor: 'transparent',
            color: 'var(--text-muted, rgba(255,255,255,0.65))',
            fontSize: 11.5,
            cursor: 'pointer',
            '&:hover': { color: 'var(--text-primary, #fff)' },
          }}
        >
          清除
        </Box>
      )}
      </>
      )}
    </Box>
  );
});

// FilterField 结构化筛选小输入框(导演/演员/类型/年代),紧凑样式;支持聚焦时展示聚合候选。
export function FilterField({ value, onChange, placeholder, inputMode, onFocus, suggestions }: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  inputMode?: 'text' | 'numeric';
  onFocus?: () => void;
  suggestions?: FacetItem[];
}) {
  const [focused, setFocused] = useState(false);
  const show = focused && (suggestions?.length ?? 0) > 0;
  const anchorRef = useRef<HTMLDivElement | null>(null);
  return (
    <Box ref={anchorRef} sx={{ position: 'relative', flexShrink: 0 }}>
      <TextField
        size="small"
        value={value}
        inputMode={inputMode}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => { setFocused(true); onFocus?.(); }}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        placeholder={placeholder}
        sx={{
          width: 132,
          '& .MuiInputBase-root': {
            height: 30,
            fontSize: 12,
            color: 'var(--text-primary, #fff)',
            bgcolor: 'var(--bg-input, rgba(255,255,255,0.06))',
            borderRadius: 2,
          },
          '& fieldset': { borderColor: 'var(--border-color, rgba(255,255,255,0.1))' },
          '& input::placeholder': { color: 'var(--text-muted, rgba(255,255,255,0.4))', opacity: 1, fontSize: 12 },
          '& .Mui-focused fieldset': { borderColor: 'var(--brand-color, #FE2C55)' },
        }}
      />
      {/* 候选列表走 Popper(挂到 body):筛选条是横向滚动容器,里面 absolute 的下拉会被裁掉 */}
      <Popper open={show} anchorEl={anchorRef.current} placement="bottom-start" sx={{ zIndex: 1300 }}>
        <Box
          sx={{
            mt: 0.5,
            minWidth: 180,
            maxHeight: 220,
            overflowY: 'auto',
            borderRadius: 1.5,
            border: '1px solid var(--border-color, rgba(255,255,255,0.1))',
            bgcolor: 'var(--bg-elevated)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
            backdropFilter: 'blur(12px)',
          }}
        >
          {suggestions!.map((s) => (
            <Box
              key={s.name}
              component="button"
              type="button"
              onClick={() => { onChange(s.name); setFocused(false); }}
              sx={{
                display: 'block',
                width: '100%',
                px: 1.5,
                py: 0.75,
                border: 'none',
                bgcolor: 'transparent',
                color: 'var(--text-primary, #fff)',
                fontSize: 12.5,
                textAlign: 'left',
                cursor: 'pointer',
                '&:hover': { bgcolor: 'var(--bg-hover, rgba(255,255,255,0.06))' },
              }}
            >
              {s.name}
              <Box component="span" sx={{ ml: 1, color: 'var(--text-muted, rgba(255,255,255,0.4))', fontSize: 11 }}>
                {s.count}
              </Box>
            </Box>
          ))}
        </Box>
      </Popper>
    </Box>
  );
}
