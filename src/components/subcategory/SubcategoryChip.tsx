'use client';

import * as React from 'react';
import Chip from '@mui/material/Chip';
import { useQuery } from '@tanstack/react-query';
import { fetchSubcategories } from '@/apis/home-discover';

interface SubcategoryItem {
  parent_type: string;
  code: string;
  name: string;
  sort: number;
}

interface SubcategoryMap {
  [code: string]: { name: string; parent_type: string };
}

/**
 * useSubcategories —— 缓存的 subcategory 字典查询。
 *
 * 直接 fetch 会每个组件各自请求一次;用 useQuery 缓存。
 * 字典稳定(几乎不变),staleTime 设为 10 分钟。
 */
export function useSubcategories(parent: string = 'NEWS') {
  return useQuery<SubcategoryItem[]>({
    queryKey: ['subcategories', parent],
    queryFn: async () => {
      const data = await fetchSubcategories(parent);
      return (data?.data ?? data ?? []) as SubcategoryItem[];
    },
    staleTime: 10 * 60 * 1000,
  });
}

/**
 * useSubcategoryMap —— 把 subcategory 数组拍平为 {code: {name, parent_type}}。
 * 用于在 DetailHeader 等处按 subcategory_code 反查中文名。
 */
export function useSubcategoryMap(parent: string = 'NEWS') {
  const { data } = useSubcategories(parent);
  return React.useMemo<SubcategoryMap>(() => {
    const map: SubcategoryMap = {};
    (data ?? []).forEach((s) => {
      map[s.code] = { name: s.name, parent_type: s.parent_type };
    });
    return map;
  }, [data]);
}

export interface SubcategoryChipProps {
  code?: string;
  /** 自定义 label,优先级高于字典里的 name */
  label?: string;
  size?: 'small' | 'medium';
  /** 点击行为(默认无) */
  onClick?: () => void;
}

/**
 * SubcategoryChip —— 胶囊标签:`<历史 · 人物>`。
 *
 * 接收 code,内部用 useSubcategoryMap 反查中文名 + parent 名;
 * 没找到时降级显示 code 字面量。
 */
export function SubcategoryChip({ code, label, size = 'small', onClick }: SubcategoryChipProps) {
  const map = useSubcategoryMap('NEWS');
  const entry = code ? map[code] : undefined;

  let display = label;
  if (!display && code) {
    if (entry) {
      const [family, variant] = code.split('.');
      const variantLabel = entry.name;
      display = family && variant ? `${familyLabel(family)} · ${variantLabel}` : variantLabel;
    } else {
      display = code;
    }
  }
  if (!display) return null;

  return (
    <Chip
      label={display}
      size={size}
      onClick={onClick}
      sx={{
        bgcolor: 'action.hover',
        color: 'text.secondary',
        fontWeight: 500,
        fontSize: 12,
      }}
    />
  );
}

function familyLabel(family: string): string {
  const m: Record<string, string> = {
    history: '历史',
    automotive: '汽车',
    weather: '天气',
    finance: '财经',
    sports: '体育',
    lol: '英雄联盟',
    tft: '云顶',
  };
  return m[family] ?? family;
}

export default SubcategoryChip;