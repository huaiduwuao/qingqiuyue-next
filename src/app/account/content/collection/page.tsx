'use client';

import { PlaceholderApplySection } from '../components/PlaceholderApplySection';

export default function CollectionPage() {
  return (
    <PlaceholderApplySection
      slug="collection"
      title="合集管理"
      description="将相关作品整理为合集,提升用户观看时长和粉丝粘性,系统化运营你的内容矩阵。"
      features={[
        '一键创建视频合集',
        '自定义合集封面与描述',
        '合集自动排序与推荐',
        '合集数据看板',
        '系列化内容追踪',
        '合集订阅提醒',
      ]}
      cta="创建合集"
    />
  );
}
