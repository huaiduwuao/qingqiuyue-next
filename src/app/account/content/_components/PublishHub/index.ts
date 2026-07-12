// PublishHub barrel — 顶部 chip + 列表 + 详情 drawer 三件套。

export { default as PublishTypeChips } from './PublishTypeChips';
export { default as UnifiedContentList } from './UnifiedContentList';
export { default as ContentDetailDrawer } from './ContentDetailDrawer';

export type UnifiedContentPayload = {
  id: string | number;
  title: string;
  cover?: string;
  contentType: string;
  createdAt: number;
  views?: number;
  likes?: number;
  comments?: number;
  status: string;
};
