'use client';

import { PlaceholderApplySection } from '../components/PlaceholderApplySection';

export default function CoCreatePage() {
  return (
    <PlaceholderApplySection
      slug="cocreate"
      title="共创中心"
      description="与其他创作者联合创作,共享流量与收益。找到匹配的合作对象,一起产出爆款内容。"
      features={[
        '创作者匹配推荐',
        '联合投稿与收益分成',
        '粉丝互通共享',
        '话题联合运营',
        '素材协作工作台',
        '跨账号数据看板',
      ]}
      cta="开启共创"
    />
  );
}
