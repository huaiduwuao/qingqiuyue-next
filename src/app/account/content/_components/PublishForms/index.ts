// PublishForms barrel — 12 个非 VIDEO 发布表单组件的统一入口。
// VIDEO 表单仍内联在 hd-publish/page.tsx 中(任务 #10 跳过)。
// 由 dispatcher (hd-publish/page.tsx) 按 chip 选中的 contentType 懒加载。

export { default as ImageForm } from './ImageForm';
export { default as ImageMvForm } from './ImageMvForm';
export { default as ArticleForm } from './ArticleForm';
export { default as NovelForm } from './NovelForm';
export { default as NewsForm } from './NewsForm';
export { default as MusicForm } from './MusicForm';
export { default as ComicsForm } from './ComicsForm';
export { default as VshowForm } from './VshowForm';
export { default as TeleplayForm } from './TeleplayForm';
export { default as FilmForm } from './FilmForm';
export { default as AnimationForm } from './AnimationForm';
export { default as LiveForm } from './LiveForm';

export type { PublishFormProps } from './types';

import dynamic from 'next/dynamic';

// 12 个非-VIDEO 表单按需懒加载(发布时只有一种类型被打开,首次
// 切换时拉 JS,后续直接命中缓存)。
export const ImageFormLazy = dynamic(() => import('./ImageForm'), { ssr: false });
export const ImageMvFormLazy = dynamic(() => import('./ImageMvForm'), { ssr: false });
export const ArticleFormLazy = dynamic(() => import('./ArticleForm'), { ssr: false });
export const NovelFormLazy = dynamic(() => import('./NovelForm'), { ssr: false });
export const NewsFormLazy = dynamic(() => import('./NewsForm'), { ssr: false });
export const MusicFormLazy = dynamic(() => import('./MusicForm'), { ssr: false });
export const ComicsFormLazy = dynamic(() => import('./ComicsForm'), { ssr: false });
export const VshowFormLazy = dynamic(() => import('./VshowForm'), { ssr: false });
export const TeleplayFormLazy = dynamic(() => import('./TeleplayForm'), { ssr: false });
export const FilmFormLazy = dynamic(() => import('./FilmForm'), { ssr: false });
export const AnimationFormLazy = dynamic(() => import('./AnimationForm'), { ssr: false });
export const LiveFormLazy = dynamic(() => import('./LiveForm'), { ssr: false });
