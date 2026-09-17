'use client';

import React from 'react';
import Link from 'next/link';
import Box from '@mui/material/Box';
import type { SxProps, Theme } from '@mui/material/styles';
import {
  ICP_NUMBER,
  ICP_QUERY_URL,
  LEGAL_PATH,
  LEGAL_SECTIONS,
  POLICE_BEIAN_NUMBER,
  SITE_NAME,
  policeBeianUrl,
} from '@/constants/site';

const LINKS: { label: string; hash: string }[] = [
  { label: '关于', hash: LEGAL_SECTIONS.about },
  { label: '免责声明', hash: LEGAL_SECTIONS.disclaimer },
  { label: '数据采集说明', hash: LEGAL_SECTIONS.dataCollection },
  { label: '侵权投诉', hash: LEGAL_SECTIONS.complaint },
];

const linkSx = {
  color: 'inherit',
  textDecoration: 'none',
  '&:hover': { color: 'var(--text-secondary, currentColor)', textDecoration: 'underline' },
};

/**
 * SiteLegalFooter —— 合规信息小字:声明链接 + 一句话采集说明 + ICP 备案号。
 *
 * 首页是整屏应用式布局,没有传统页脚,所以放在左侧栏底部(设置键上方);
 * 移动端没有侧栏,同一组件挂在「我的」页底部。备案号未配置时该行不显示。
 */
export function SiteLegalFooter({ sx }: { sx?: SxProps<Theme> }) {
  return (
    <Box
      component="footer"
      sx={[
        {
          fontSize: 11,
          lineHeight: 1.7,
          color: 'var(--text-muted, currentColor)',
          wordBreak: 'break-word',
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      <Box sx={{ display: 'flex', flexWrap: 'wrap', columnGap: 1 }}>
        {LINKS.map((l) => (
          <Box key={l.hash} component={Link} href={`${LEGAL_PATH}#${l.hash}`} prefetch={false} sx={linkSx}>
            {l.label}
          </Box>
        ))}
      </Box>
      <Box sx={{ mt: 0.5, opacity: 0.85 }}>
        榜单与摘要整理自互联网公开信息,仅作索引并链接回来源,版权归原作者所有。
      </Box>
      <Box sx={{ mt: 0.5 }}>
        {ICP_NUMBER && (
          <Box component="a" href={ICP_QUERY_URL} target="_blank" rel="noopener noreferrer nofollow" sx={{ ...linkSx, display: 'block' }}>
            {ICP_NUMBER}
          </Box>
        )}
        {POLICE_BEIAN_NUMBER && (
          <Box component="a" href={policeBeianUrl(POLICE_BEIAN_NUMBER)} target="_blank" rel="noopener noreferrer nofollow" sx={{ ...linkSx, display: 'block' }}>
            {POLICE_BEIAN_NUMBER}
          </Box>
        )}
        <Box component="span" suppressHydrationWarning>© {new Date().getFullYear()} {SITE_NAME}</Box>
      </Box>
    </Box>
  );
}

export default SiteLegalFooter;
