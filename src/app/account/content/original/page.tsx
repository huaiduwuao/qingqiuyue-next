'use client';

import { PlaceholderApplySection } from '../components/PlaceholderApplySection';

export default function OriginalPage() {
  return (
    <PlaceholderApplySection
      slug="original"
      title="原创保护中心"
      description="全方位保护你的原创内容,一键存证、监测搬运、自动维权。让抄袭无处遁形。"
      features={[
        '区块链原创存证',
        '全网搬运监测',
        '一键下架申诉',
        '侵权视频自动比对',
        '维权进度实时追踪',
        '原创作者认证',
      ]}
      cta="申请原创保护"
    />
  );
}
