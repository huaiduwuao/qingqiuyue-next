'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import ConstructionRoundedIcon from '@mui/icons-material/ConstructionRounded';

/**
 * NotImplemented —— 「这个功能后端没做」的统一空屏。
 *
 * 为什么需要它:此前未实现的功能有两种伪装法 —— 后端返 200 + 编造数据(共创中心
 * 的假伙伴和假分成、原创证书的假区块链哈希),或者返 200 + 空数组(我赞过的、
 * 稍后再看)。前者让人信以为真,后者和「你确实没有数据」长得一模一样。
 * 两种都让"没做"这件事在界面上不可见。
 *
 * 现在后端对未实现的接口统一返 501,前端用这个组件如实说明:功能没做、缺什么、
 * 什么时候能用。宁可显示一块空屏,也不要显示编出来的数字。
 */
export default function NotImplemented({
  feature,
  missing,
  detail,
}: {
  /** 功能名,如「共创中心」 */
  feature: string;
  /** 缺什么,如「co_create / co_create_invite 表」。会以代码样式展示。 */
  missing?: string;
  /** 补充说明:为什么没做、要做什么 */
  detail?: React.ReactNode;
}) {
  return (
    <Box
      sx={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.paper',
        borderRadius: 2,
        border: '1px dashed',
        borderColor: 'divider',
        p: 6,
        minHeight: 420,
        textAlign: 'center',
      }}
    >
      <ConstructionRoundedIcon sx={{ fontSize: 56, color: 'text.disabled', mb: 2 }} />

      <Typography variant="h6" sx={{ mb: 1 }}>
        {feature}尚未开放
      </Typography>

      <Chip
        size="small"
        label="后端未实现"
        sx={{ mb: 2, bgcolor: 'action.hover', color: 'text.secondary' }}
      />

      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 520, mb: missing ? 2 : 0 }}>
        {detail ?? '这个功能的后端接口还没有落地,页面暂不提供数据。'}
      </Typography>

      {missing && (
        <Typography
          variant="caption"
          sx={{
            fontFamily: 'monospace',
            color: 'text.disabled',
            bgcolor: 'action.hover',
            px: 1.5,
            py: 0.75,
            borderRadius: 1,
          }}
        >
          待补:{missing}
        </Typography>
      )}
    </Box>
  );
}
