'use client';

/**
 * 内容补全 —— /system/spider/backfill
 *
 * 通用内容补全框架的运营入口:任意已收录内容都能补抓缺失部分。
 * 按 content_type 自动选抓取方式 —— 小说补章节正文、音乐补音频、
 * 漫画补页面、影视只嗅探播放直链(不下载文件)。
 *
 * 面板本体在 components/spider/BackfillPanel.tsx,与
 * /account/spider/quick 的「内容补全」tab 共用同一份实现(那边传 compact)。
 */

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import BackfillPanel from '@/components/spider/BackfillPanel';

export default function SpiderBackfillPage() {
  return (
    // 不套 maxWidth 容器:结果列表是四列的表格形态(封面/标题/类型/入库状态),
    // 窄容器下类型和状态会被挤到看不见,而这两列正是"认得出要补哪条"的关键。
    <Box sx={{ width: '100%' }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        内容补全
      </Typography>
      <BackfillPanel />
    </Box>
  );
}
