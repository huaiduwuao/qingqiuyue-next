'use client';

import Alert from '@mui/material/Alert';

/**
 * 详情页顶部的「未上线」提示。未上线(审核中/驳回/草稿/定时)的内容只有作者本人和内容运营
 * 能打开(content-api 的作者预览分支),别人看是「内容不存在」—— 这里说清楚现在谁能看到。
 * 已上线 / 爬虫数据(PUBLISH、active、空)不显示。
 */
const LABELS: Record<string, { text: string; severity: 'info' | 'warning' | 'error' }> = {
  REVIEWING: { text: '审核中:通过后才会公开,现在只有你和审核人员能看到', severity: 'info' },
  REJECTED: { text: '未通过审核:只有你和审核人员能看到,修改后可重新提交', severity: 'error' },
  UN_PUBLISH: { text: '草稿 / 私密:只有你能看到', severity: 'warning' },
  SCHEDULED: { text: '定时发布:到时间后自动公开,现在只有你能看到', severity: 'info' },
};

export function UnpublishedBanner({ status }: { status?: string | null }) {
  const hit = status ? LABELS[status.toUpperCase()] : undefined;
  if (!hit) return null;
  return (
    <Alert severity={hit.severity} sx={{ mb: 2, borderRadius: 2 }}>
      {hit.text}
    </Alert>
  );
}

export default UnpublishedBanner;
