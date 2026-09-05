// 本文件由 tools/gen-contract 从 contracts/content_type.yaml 生成,请勿手改。
// 修改类型/标签/路由请改 YAML 后跑:qingqiuyue-go 仓库里跑 make gen-contract

export const CONTENT_TYPES = [
  'NOVEL',
  'MUSIC',
  'FILM',
  'TELEPLAY',
  'SHORT_DRAMA',
  'ANIMATION',
  'COMICS',
  'VIDEO',
  'VSHOW',
  'LIVE',
  'ARTICLE',
  'NEWS',
  'WALLPAPER',
] as const;

export type ContentType = (typeof CONTENT_TYPES)[number];

/** 类型 → 详情页路由。与后端同源,勿手改。 */
export const TYPE_TO_ROUTE: Record<string, string> = {
  NOVEL: '/detail/novel-detail',
  MUSIC: '/detail/music-detail',
  FILM: '/detail/film-detail',
  TELEPLAY: '/detail/teleplay-detail',
  SHORT_DRAMA: '/detail/teleplay-detail',
  ANIMATION: '/detail/animation-detail',
  COMICS: '/detail/comics-detail',
  VIDEO: '/detail/video-detail',
  VSHOW: '/detail/vshow-detail',
  LIVE: '/detail/live-detail',
  ARTICLE: '/detail/article-detail',
  NEWS: '/detail/news-detail',
  WALLPAPER: '/detail/image-detail',
  PICTURE: '/detail/image-detail',
  PICTURE_ALBUM: '/detail/image-detail',
  PICTURE_MV: '/detail/image-detail',
};

/** 类型 → 中文名。与后端同源,勿手改。 */
export const TYPE_LABEL: Record<string, string> = {
  NOVEL: '小说',
  MUSIC: '音乐',
  FILM: '电影',
  TELEPLAY: '电视剧',
  SHORT_DRAMA: '短剧',
  ANIMATION: '动漫',
  COMICS: '漫画',
  VIDEO: '视频',
  VSHOW: '综艺',
  LIVE: '直播',
  ARTICLE: '文章',
  NEWS: '新闻',
  WALLPAPER: '图文',
  PICTURE: '图文',
  PICTURE_ALBUM: '图文',
  PICTURE_MV: '图文',
};
