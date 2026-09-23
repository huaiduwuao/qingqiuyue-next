'use client';

/**
 * 内容修复 —— 多源聚合,补缺 + 纠错。
 * 与「内容补全」的分工:补全只补缺、不判断已有内容对不对;修复会多源比对。
 */

import React from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import ContentRepairPanel from '@/components/spider/ContentRepairPanel';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { PERMISSIONS } from '@/lib/permissions';

export default function SpiderRepairPage() {
  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2 }}>内容修复</Typography>
      {/* 修复的 apply 会原地改写线上章节正文 —— 比"补一个缺"重得多,所以单独一个码
          (repair:run),不与 backfill:run 共用。诊断(dry-run)也走这条码:
          它照样会去外部站真抓一遍,不是纯读操作。 */}
      <PermissionGuard
        // 修复接口挂在爬虫配置组下,后端同时要 source:list;只给 repair:run 会全是 403
        need={[PERMISSIONS.SYSTEM_SPIDER.REPAIR_RUN, PERMISSIONS.SYSTEM_SPIDER.SOURCE_LIST]}
        fallback={
          <Alert severity="warning">
            你没有「内容修复」权限。请联系管理员在 /system/role 里同时授予 system:spider:repair:run 和 system:spider:source:list。
          </Alert>
        }
      >
        <ContentRepairPanel />
      </PermissionGuard>
    </Box>
  );
}
