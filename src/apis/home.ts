import { adminClient, contentClient, rewardClient } from '@/lib/api/client';

const MOCK_ENABLED = true;

// Mock data
const mockModuleList = {
  list: [
    { id: 1, title: '热门小说', subtitle: '最受欢迎的小说推荐', type: 'NOVEL', status: 'PUBLISH', updateTime: '2026-05-27T10:00:00Z' },
    { id: 2, title: '最新视频', subtitle: '最新上传的视频内容', type: 'VIDEO', status: 'PUBLISH', updateTime: '2026-05-27T10:00:00Z' },
    { id: 3, title: '热播剧集', subtitle: '正在热播的电视剧', type: 'TELEPLAY', status: 'PUBLISH', updateTime: '2026-05-27T10:00:00Z' },
    { id: 4, title: '热门音乐', subtitle: '热门音乐推荐', type: 'MUSIC', status: 'PUBLISH', updateTime: '2026-05-27T10:00:00Z' },
    { id: 5, title: '动漫推荐', subtitle: '热门动漫推荐', type: 'ANIMATION', status: 'PUBLISH', updateTime: '2026-05-27T10:00:00Z' },
  ],
  total: 5,
};

const mockContentList = {
  list: [
    { id: 1, title: '清秋月物语', subtitle: '江南小镇的秋日恋歌', contentType: 'NOVEL', coverUrl: 'https://picsum.photos/seed/nv1/400/500', status: 'PUBLISH', agreeCount: 1234, collectCount: 456, commentCount: 78, viewCount: 89000, author: { id: 101, nickname: '林清秋' } },
    { id: 2, title: '山月不知心底事', subtitle: '古风言情长篇', contentType: 'NOVEL', coverUrl: 'https://picsum.photos/seed/nv2/400/500', status: 'PUBLISH', agreeCount: 2345, collectCount: 567, commentCount: 89, viewCount: 120000, author: { id: 102, nickname: '沈复生' } },
    { id: 3, title: '苏州一日游', subtitle: '跟着镜头游江南', contentType: 'VIDEO', coverUrl: 'https://picsum.photos/seed/vd1/400/500', status: 'PUBLISH', agreeCount: 3456, collectCount: 678, commentCount: 90, viewCount: 210000, author: { id: 103, nickname: '老苏州' } },
    { id: 4, title: '徽州古村行', subtitle: '徽派建筑之美', contentType: 'VIDEO', coverUrl: 'https://picsum.photos/seed/vd2/400/500', status: 'PUBLISH', agreeCount: 4567, collectCount: 789, commentCount: 101, viewCount: 156000, author: { id: 104, nickname: '行走的镜头' } },
    { id: 5, title: '清秋月主题音乐', subtitle: '原创主题曲', contentType: 'MUSIC', coverUrl: 'https://picsum.photos/seed/mu1/400/500', status: 'PUBLISH', agreeCount: 5678, collectCount: 890, commentCount: 112, viewCount: 78000, author: { id: 105, nickname: '清秋月工作室' } },
    { id: 6, title: '夏日微风', subtitle: '轻音乐合集', contentType: 'MUSIC', coverUrl: 'https://picsum.photos/seed/mu2/400/500', status: 'PUBLISH', agreeCount: 3456, collectCount: 567, commentCount: 67, viewCount: 56000, author: { id: 106, nickname: '海潮乐队' } },
    { id: 7, title: '山河故人', subtitle: '贾樟柯经典文艺片', contentType: 'FILM', coverUrl: 'https://picsum.photos/seed/fl1/400/500', status: 'PUBLISH', agreeCount: 4321, collectCount: 876, commentCount: 145, viewCount: 320000, author: { id: 107, nickname: '贾樟柯' } },
    { id: 8, title: '归来', subtitle: '张艺谋导演作品', contentType: 'FILM', coverUrl: 'https://picsum.photos/seed/fl2/400/500', status: 'PUBLISH', agreeCount: 3210, collectCount: 654, commentCount: 123, viewCount: 280000, author: { id: 108, nickname: '张艺谋' } },
    { id: 9, title: '人世间', subtitle: '跨越 50 年的家庭史诗', contentType: 'TELEPLAY', coverUrl: 'https://picsum.photos/seed/tv1/400/500', status: 'PUBLISH', agreeCount: 8765, collectCount: 1234, commentCount: 234, viewCount: 560000, author: { id: 109, nickname: '李路' } },
    { id: 10, title: '觉醒年代', subtitle: '建党献礼剧', contentType: 'TELEPLAY', coverUrl: 'https://picsum.photos/seed/tv2/400/500', status: 'PUBLISH', agreeCount: 7654, collectCount: 1098, commentCount: 198, viewCount: 480000, author: { id: 110, nickname: '张永新' } },
    { id: 11, title: '你的名字', subtitle: '新海诚经典', contentType: 'ANIMATION', coverUrl: 'https://picsum.photos/seed/an1/400/500', status: 'PUBLISH', agreeCount: 9876, collectCount: 1567, commentCount: 312, viewCount: 720000, author: { id: 111, nickname: '新海诚' } },
    { id: 12, title: '铃芽之旅', subtitle: '新海诚最新作', contentType: 'ANIMATION', coverUrl: 'https://picsum.photos/seed/an2/400/500', status: 'PUBLISH', agreeCount: 6789, collectCount: 987, commentCount: 198, viewCount: 450000, author: { id: 112, nickname: '新海诚' } },
    { id: 13, title: '步天歌', subtitle: '古风少女漫画', contentType: 'COMICS', coverUrl: 'https://picsum.photos/seed/cm1/400/500', status: 'PUBLISH', agreeCount: 5432, collectCount: 876, commentCount: 156, viewCount: 234000, author: { id: 113, nickname: '清秋月' } },
    { id: 14, title: '狐妖小红娘', subtitle: '国漫经典', contentType: 'COMICS', coverUrl: 'https://picsum.photos/seed/cm2/400/500', status: 'PUBLISH', agreeCount: 8765, collectCount: 1342, commentCount: 245, viewCount: 580000, author: { id: 114, nickname: '小新' } },
    { id: 15, title: '朗读者', subtitle: '文化访谈综艺', contentType: 'VSHOW', coverUrl: 'https://picsum.photos/seed/vs1/400/500', status: 'PUBLISH', agreeCount: 4321, collectCount: 765, commentCount: 134, viewCount: 290000, author: { id: 115, nickname: '董卿' } },
    { id: 16, title: '中国诗词大会', subtitle: '诗词文化综艺', contentType: 'VSHOW', coverUrl: 'https://picsum.photos/seed/vs2/400/500', status: 'PUBLISH', agreeCount: 5678, collectCount: 890, commentCount: 167, viewCount: 380000, author: { id: 116, nickname: '董卿' } },
    { id: 17, title: '秋日书斋:重拾阅读的仪式感', subtitle: '从一本纸质书的温度说起', contentType: 'ARTICLE', coverUrl: 'https://picsum.photos/seed/ar1/400/500', status: 'PUBLISH', agreeCount: 1280, collectCount: 856, commentCount: 64, viewCount: 24500, author: { id: 117, nickname: '林清秋' } },
    { id: 18, title: '非遗手工艺的数字化传承', subtitle: '从江南刺绣说起', contentType: 'ARTICLE', coverUrl: 'https://picsum.photos/seed/ar2/400/500', status: 'PUBLISH', agreeCount: 980, collectCount: 432, commentCount: 45, viewCount: 18000, author: { id: 118, nickname: '陈墨' } },
    { id: 19, title: '非遗手工艺传承新路径', subtitle: '数字技术助力传统工艺', contentType: 'NEWS', coverUrl: 'https://picsum.photos/seed/nw1/400/500', status: 'PUBLISH', agreeCount: 1230, collectCount: 234, commentCount: 89, viewCount: 86400, author: { id: 119, nickname: '人民日报' } },
    { id: 20, title: '国风文化持续升温', subtitle: '年轻人成为消费主力', contentType: 'NEWS', coverUrl: 'https://picsum.photos/seed/nw2/400/500', status: 'PUBLISH', agreeCount: 870, collectCount: 156, commentCount: 67, viewCount: 52000, author: { id: 120, nickname: '光明日报' } },
  ],
  total: 20,
  pageNum: 1,
  pageSize: 30,
  pages: 1,
};

// File upload - POST /api/content/file/upload (if exists in swagger)
export async function fileUpload(params: any) {
  if (MOCK_ENABLED) return { code: 200, data: { url: 'https://picsum.photos/200' } };
  return contentClient("/file/upload", {
    method: "POST",
    data: params
  });
}

// Module list - GET /api/content/module/list
export async function moduleList(params?: any) {
  if (MOCK_ENABLED) return { code: 200, data: mockModuleList };
  return contentClient("/module/list", { params });
}

// 模块内容分页 - GET /api/content/module/content/list
export async function moduleContentPage(params?: any) {
  if (MOCK_ENABLED) {
    const ct = params?.contentType;
    const filtered = ct ? mockContentList.list.filter((x) => x.contentType === ct) : mockContentList.list;
    return { code: 200, data: { ...mockContentList, list: filtered, total: filtered.length } };
  }
  return contentClient("/module/content/list", { params });
}

// 模块内容操作(点赞等) - POST /api/content/module/content/action
export async function moduleContentAction(params: any) {
  return contentClient("/module/content/action", {
    method: "POST",
    data: params
  });
}

// 获取评论 - GET /api/content/module/content/comment/{contentId}
export async function getComments(contentId: number, params?: any) {
  return contentClient(`/module/content/comment/${contentId}`, { params });
}

// 发送评论 - POST /api/content/module/content/comment
export async function sendComment(params: any) {
  return contentClient("/module/content/comment", {
    method: "POST",
    data: params
  });
}

// ========== Reward APIs (use rewardClient) ==========

// 项目列表 - GET /api/reward/project/list
export async function listProjects(params?: any) {
  return rewardClient("/project/list", { params });
}

// 进行中的项目
export async function queryDoingProject() {
  return rewardClient("/project/list", { params: { status: 'DOING' } });
}

// 用户活动列表 - GET /api/reward/user-activity/list
export async function listUserActivities(params?: any) {
  return rewardClient("/user-activity/list", { params });
}

export async function queryActivities() {
  return rewardClient("/user-activity/list", {});
}

// 图表数据 - GET /api/reward/chart/overview/list
export async function listChartOverviews(params?: any) {
  return rewardClient("/chart/overview/list", { params });
}

// 图表数据 - GET /api/reward/chart/day-search/list
export async function listChartDaySearches(params?: any) {
  return rewardClient("/chart/day-search/list", { params });
}

// 雷达图 - GET /api/reward/chart/radar/list
export async function listChartContentRadars(params?: any) {
  return rewardClient("/chart/radar/list", { params });
}

export async function queryRadar() {
  return rewardClient("/chart/radar/list", {});
}

// 搜索建议 - GET /api/reward/chart/search/list
export async function searchSuggest(params?: any) {
  return rewardClient("/chart/search/list", { params });
}

// 热词 - GET /api/reward/chart/day-search/list
export async function topKeywordInThirdMonth(params?: any) {
  return rewardClient("/chart/day-search/list", { params });
}

// ========== Global/Other APIs ==========

// QA详情 - POST /api/content/question/qa (if exists in swagger)
export async function qaDetail(params: any) {
  return contentClient("/question/qa", {
    method: "POST",
    data: params
  });
}
