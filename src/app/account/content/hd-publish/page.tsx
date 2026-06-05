'use client';

import { PlaceholderApplySection } from '../components/PlaceholderApplySection';

export default function HdPublishPage() {
  return (
    <PlaceholderApplySection
      slug="hd-publish"
      title="高清视频发布"
      description="支持 4K/60fps 高清视频上传,智能转码、极速审核,助你呈现最优质的画面细节。"
      features={[
        '4K 60fps 超清画质上传',
        '智能转码与封面抽取',
        '极速审核通道(< 10 分钟)',
        '多清晰度自适应播放',
        '视频 HDR 增强',
        '支持外挂字幕与音轨',
      ]}
      cta="开通高清权限"
    />
  );
}
