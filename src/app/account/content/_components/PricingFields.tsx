'use client';

import React, { useState } from 'react';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { formatYuan } from '@/apis/paywall';

/** 与后端 socialmonetize.MaxContentPrice 一致(分)。 */
const MAX_PRICE_CENTS = 100000;

interface PricingFieldsProps {
  /** 价格(分),0 = 免费 */
  price: number;
  onPriceChange: (cents: number) => void;
  freeItems: number;
  onFreeItemsChange: (n: number) => void;
  /** 章节/分集类内容:允许设置免费试看的前 N 章(集) */
  serial?: boolean;
}

/**
 * 发布表单里的"免费 / 付费"设置。付费内容审核通过后,未购买的用户只能看到
 * 试读/试看部分,购买从钱包扣款,平台抽成后计入创作者钱包。
 */
export function PricingFields({ price, onPriceChange, freeItems, onFreeItemsChange, serial }: PricingFieldsProps) {
  const [yuanText, setYuanText] = useState(price > 0 ? formatYuan(price) : '');
  const paid = price > 0;

  const setPaid = (next: boolean) => {
    if (next === paid) return;
    if (next) {
      setYuanText('1');
      onPriceChange(100);
    } else {
      setYuanText('');
      onPriceChange(0);
      onFreeItemsChange(0);
    }
  };

  const onYuan = (raw: string) => {
    const text = raw.replace(/[^\d.]/g, '');
    setYuanText(text);
    const cents = Math.round(Number(text) * 100);
    onPriceChange(Number.isFinite(cents) ? Math.min(Math.max(cents, 0), MAX_PRICE_CENTS) : 0);
  };

  return (
    <Box sx={{ my: 2 }}>
      <Typography sx={{ fontSize: 13, fontWeight: 600, mb: 1 }}>定价</Typography>
      <ToggleButtonGroup
        exclusive
        size="small"
        value={paid ? 'paid' : 'free'}
        onChange={(_, v) => v && setPaid(v === 'paid')}
        aria-label="定价方式"
      >
        <ToggleButton value="free" sx={{ px: 2.5 }}>
          免费
        </ToggleButton>
        <ToggleButton value="paid" sx={{ px: 2.5 }}>
          付费
        </ToggleButton>
      </ToggleButtonGroup>

      {paid && (
        <Box sx={{ display: 'flex', gap: 1.5, mt: 1.5, flexWrap: 'wrap' }}>
          <TextField
            size="small"
            label="价格(元)"
            value={yuanText}
            onChange={(e) => onYuan(e.target.value)}
            slotProps={{ htmlInput: { inputMode: 'decimal' } }}
            helperText={`最高 ¥${formatYuan(MAX_PRICE_CENTS)}`}
            sx={{ width: 160 }}
          />
          {serial && (
            <TextField
              size="small"
              label="免费试看章节/集数"
              value={freeItems || ''}
              onChange={(e) => onFreeItemsChange(Math.max(0, Number(e.target.value.replace(/\D/g, '')) || 0))}
              slotProps={{ htmlInput: { inputMode: 'numeric' } }}
              helperText="前 N 章(集)免费"
              sx={{ width: 180 }}
            />
          )}
        </Box>
      )}
      <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 1 }}>
        {paid ? '读者用钱包余额购买,平台收取 10% 服务费,其余计入你的钱包' : '所有人都可以免费查看'}
      </Typography>
    </Box>
  );
}
