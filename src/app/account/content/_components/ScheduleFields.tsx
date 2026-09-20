'use client';

import React from 'react';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';

interface ScheduleFieldsProps {
  /** 定时发布时间(毫秒时间戳);0/undefined = 立即发布 */
  publishAt: number;
  onChange: (ms: number) => void;
}

/** 把毫秒时间戳转成 datetime-local 输入框要的 'YYYY-MM-DDTHH:mm'。 */
function toLocalInput(ms: number): string {
  if (!ms) return '';
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * 发布表单里的「定时发布」设置。默认立即发布;选「定时」后出现时间选择器,
 * 到点由后端调度器自动上线。与 PricingFields 并列,放在提交按钮之前。
 */
export function ScheduleFields({ publishAt, onChange }: ScheduleFieldsProps) {
  const scheduled = publishAt > 0;
  const setMode = (next: boolean) => {
    if (next === scheduled) return;
    if (!next) {
      onChange(0);
    } else {
      // 默认一小时后,免得用户不选直接提交被后端「必须晚于当前时间」拒掉。
      onChange(Date.now() + 3600_000);
    }
  };

  return (
    <Box sx={{ my: 2 }}>
      <Typography sx={{ fontSize: 13, fontWeight: 600, mb: 1 }}>发布时间</Typography>
      <ToggleButtonGroup
        exclusive
        size="small"
        value={scheduled ? 'scheduled' : 'now'}
        onChange={(_, v) => v && setMode(v === 'scheduled')}
        aria-label="发布时间"
      >
        <ToggleButton value="now" sx={{ px: 2.5 }}>立即发布</ToggleButton>
        <ToggleButton value="scheduled" sx={{ px: 2.5 }}>定时发布</ToggleButton>
      </ToggleButtonGroup>

      {scheduled && (
        <Box sx={{ mt: 1.5 }}>
          <TextField
            size="small"
            type="datetime-local"
            label="上线时间"
            value={toLocalInput(publishAt)}
            onChange={(e) => {
              const v = e.target.value;
              onChange(v ? new Date(v).getTime() : 0);
            }}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ width: 240 }}
          />
          <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 1 }}>
            到点后系统自动发布上线;之前会停在「已定时」状态,可随时回到工作台提前发布。
          </Typography>
        </Box>
      )}
    </Box>
  );
}
