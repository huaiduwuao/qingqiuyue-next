'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import { useQuery } from '@tanstack/react-query';
import { getTopic, listTopics, type Topic } from '@/apis/topic';

interface Props {
  /** 意境 id,0 / undefined = 不属于任何意境 */
  value?: number;
  onChange: (topicId: number) => void;
  label?: string;
  helperText?: string;
  disabled?: boolean;
  size?: 'small' | 'medium';
}

const rows = (r: any): Topic[] => {
  const p = r?.data ?? r;
  return p?.list || p?.records || (Array.isArray(p) ? p : []);
};

/**
 * 意境选择器。需求发在哪个意境里、团队的主场是哪个意境,都用它。
 * 默认列热度靠前的意境,输入时按标题搜。
 */
export default function RealmSelect({ value, onChange, label = '意境', helperText, disabled, size = 'small' }: Props) {
  const [input, setInput] = useState('');
  const [keyword, setKeyword] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setKeyword(input.trim()), 300);
    return () => clearTimeout(t);
  }, [input]);

  const list = useQuery({
    queryKey: ['realm-select', keyword],
    queryFn: () => listTopics({ page: 1, pageSize: 20, status: 1, keyword: keyword || undefined }).then(rows),
    staleTime: 60_000,
  });

  // 已选的意境不一定在当前这页搜索结果里,单独取一次标题
  const selected = useQuery({
    queryKey: ['realm-select', 'one', value],
    queryFn: () => getTopic(value as number).then((r: any) => (r?.data ?? r) as Topic),
    enabled: !!value && !(list.data || []).some((t) => t.id === value),
    staleTime: 5 * 60_000,
  });

  const options = useMemo(() => {
    const base = list.data || [];
    const cur = selected.data;
    return cur && cur.id && !base.some((t) => t.id === cur.id) ? [cur, ...base] : base;
  }, [list.data, selected.data]);

  const current = options.find((t) => t.id === value) ?? null;

  return (
    <Autocomplete
      size={size}
      disabled={disabled}
      options={options}
      value={current}
      loading={list.isFetching}
      getOptionLabel={(t) => t.title || ''}
      isOptionEqualToValue={(a, b) => a.id === b.id}
      filterOptions={(x) => x}
      onInputChange={(_, v, reason) => {
        if (reason === 'input') setInput(v);
      }}
      onChange={(_, t) => onChange(t?.id ?? 0)}
      noOptionsText="没有找到意境"
      loadingText="加载中…"
      renderInput={(params) => <TextField {...params} label={label} helperText={helperText} placeholder="搜索意境标题" />}
    />
  );
}
