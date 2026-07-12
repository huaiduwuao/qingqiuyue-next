'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';

export type PublishStep = 0 | 1 | 2;

const STEPS: Array<{ label: string; hint: string }> = [
  { label: '基本信息', hint: '标题 · 简介 · 标签' },
  { label: '内容详情', hint: '按所选类型上传/编辑内容' },
  { label: '预览提交', hint: '确认信息后提交审核' },
];

/**
 * PublishStepper — 发布表单顶部的 3 步指示器。
 *
 * 当前 activeStep 由父组件按 PublishForm 内部滚动位置驱动(IntersectionObserver
 * 检测到对应 section 进入视口时切到对应 step)。如未接 IO,默认全部显示
 * "未完成"灰色状态,用户也能从视觉感知流程顺序。
 *
 * 注:本 stepper 是**视觉辅助**,不是强约束的导航器;各 PublishForm 内部
 * 仍保持单页连续滚动(下/上方向键 + 内部"提交"按钮即可走完)。
 * 真要做"上一步/下一步"导航得让各 PublishForm 暴露 step section 锚点,
 * 是更大的重构,本组件先占位。
 */
export function PublishStepper({ activeStep }: { activeStep: PublishStep | null }) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'stretch',
        gap: 0,
        p: 2,
        borderRadius: 2,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      {STEPS.map((s, i) => {
        const isDone = activeStep !== null && i < activeStep;
        const isActive = activeStep === i;
        const isPending = activeStep !== null && i > activeStep;
        const color = isDone ? '#5DDB96' : isActive ? 'primary.main' : 'text.disabled';
        const bg = isDone ? 'rgba(93, 219, 150, 0.12)' : isActive ? 'rgba(254, 44, 85, 0.12)' : 'action.hover';
        return (
          <React.Fragment key={s.label}>
            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  bgcolor: bg,
                  color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 14,
                  fontWeight: 700,
                  flexShrink: 0,
                  border: '1px solid',
                  borderColor: isActive ? 'primary.main' : 'transparent',
                  transition: 'all 0.18s',
                }}
              >
                {isDone ? <CheckRoundedIcon sx={{ fontSize: 18 }} /> : i + 1}
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: 13, fontWeight: isActive ? 700 : 500, color: isPending ? 'text.disabled' : 'text.primary' }}>
                  {s.label}
                </Typography>
                <Typography sx={{ fontSize: 10.5, color: 'text.secondary', mt: 0.15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.hint}
                </Typography>
              </Box>
            </Box>
            {i < STEPS.length - 1 && (
              <Box
                sx={{
                  flex: '0 0 32px',
                  alignSelf: 'center',
                  height: 2,
                  bgcolor: isDone ? '#5DDB96' : 'divider',
                  mx: 1,
                  transition: 'background-color 0.18s',
                }}
              />
            )}
          </React.Fragment>
        );
      })}
    </Box>
  );
}
