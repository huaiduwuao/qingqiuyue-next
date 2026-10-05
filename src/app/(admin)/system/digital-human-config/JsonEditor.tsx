'use client';

import React from 'react';
import TextField from '@mui/material/TextField';
import { errMessage } from '@/lib/errMessage';

/**
 * 数字人配置各编辑器共用的「整对象 JSON」文本框:实时解析,只有合法 JSON 才写回对象。
 *
 * 外面(上方的表单字段)改了对象 → 重新格式化文本;自己刚写回去的那个对象不再回填。
 * 以前不分来源一律回填:一输入成合法 JSON 就被 JSON.stringify 重排,光标跳到末尾,
 * 「1.0」当场变成「1」,想输 0.05 这种数根本输不进去。
 */
export function JsonEditor<T>({ label, value, onChange, minRows = 12 }: { label: string; value: T; onChange: (v: T) => void; minRows?: number }) {
  const [text, setText] = React.useState(() => JSON.stringify(value, null, 2));
  const [error, setError] = React.useState<string | null>(null);
  // 文本当前对应的对象:外面传进来的,或自己刚解析出来写回去的
  const [synced, setSynced] = React.useState<T>(value);
  if (value !== synced) {
    setSynced(value);
    setText(JSON.stringify(value, null, 2));
    setError(null);
  }

  return (
    <TextField
      label={error ? `${label} (JSON 错误)` : label}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        try {
          const parsed = JSON.parse(e.target.value);
          setError(null);
          setSynced(parsed);
          onChange(parsed);
        } catch (err) {
          setError(errMessage(err) ?? null);
        }
      }}
      multiline
      minRows={minRows}
      maxRows={40}
      fullWidth
      error={!!error}
      helperText={error || '实时解析；只有合法 JSON 时才会写回对象'}
      sx={{ '& textarea': { fontFamily: 'ui-monospace, monospace', fontSize: 12 } }}
    />
  );
}
