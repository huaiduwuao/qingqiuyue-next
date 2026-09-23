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
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import BackfillPanel from '@/components/spider/BackfillPanel';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { PERMISSIONS } from '@/lib/permissions';

export default function SpiderBackfillPage() {
  return (
    // 不套 maxWidth 容器:结果列表是四列的表格形态(封面/标题/类型/入库状态),
    // 窄容器下类型和状态会被挤到看不见,而这两列正是"认得出要补哪条"的关键。
    <Box sx={{ width: '100%' }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        内容补全
      </Typography>
      {/* 页内再挡一道:侧栏已经把菜单藏了,但直接敲 URL / 收藏夹进来仍会渲染。
          后端 POST /content/backfill 现在也会返 403,这里只是把"能看不能点"提前说清楚。 */}
      <PermissionGuard
        // 补全接口挂在爬虫配置组下(要 source:list),进度/最近任务要 item:list
        need={[
          PERMISSIONS.SYSTEM_SPIDER.BACKFILL_RUN,
          PERMISSIONS.SYSTEM_SPIDER.SOURCE_LIST,
          PERMISSIONS.SYSTEM_SPIDER.ITEM_LIST,
        ]}
        fallback={
          <Alert severity="warning">
            你没有「内容补全」权限。请联系管理员在 /system/role 里同时授予 system:spider:backfill:run、
            system:spider:source:list 和 system:spider:item:list。
          </Alert>
        }
      >
        <BackfillPanel />
      </PermissionGuard>
    </Box>
  );
}
