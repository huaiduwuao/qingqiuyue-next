import { adminClient, contentClient, rewardClient } from '@/lib/api/client';

// 文件上传 - POST /api/content/file/upload (if exists in swagger)
export async function fileUpload(params: any) {
  return contentClient("/file/upload", {
    method: "POST",
    data: params
  });
}

// 模块列表 - GET /api/content/module/list
export async function moduleList(params?: any) {
  return contentClient("/module/list", { params });
}

// 模块内容分页 - GET /api/content/module/content/list
export async function moduleContentPage(params?: any) {
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
