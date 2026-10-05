import { contentClient } from '@/lib/api/client';

// File upload - POST /api/content/file/upload
export async function fileUpload(params: Record<string, unknown>) {
  return contentClient("/file/upload", {
    method: "POST",
    data: params
  });
}

// Module list - GET /api/content/module/list
export async function moduleList(params?: Record<string, unknown>) {
  return contentClient("/module/list", { params });
}

// 模块内容分页 - GET /api/content/module/content/list
export async function moduleContentPage(params?: Record<string, unknown>) {
  return contentClient("/module/content/list", { params });
}

// 模块内容操作(点赞等) - POST /api/content/module/content/action
export async function moduleContentAction(params: Record<string, unknown>) {
  return contentClient("/module/content/action", {
    method: "POST",
    data: params
  });
}

// 获取评论 - GET /api/content/module/content/comment/{contentId}
// contentId 传字符串:内容 id 超过 JS 安全整数,转 Number 会查成另一条(不存在的)内容。
export async function getComments(contentId: string | number, params?: Record<string, unknown>) {
  return contentClient(`/module/content/comment/${contentId}`, { params });
}

// 发送评论 - POST /api/content/module/content/comment
export async function sendComment(params: Record<string, unknown>) {
  return contentClient("/module/content/comment", {
    method: "POST",
    data: params
  });
}

// 评论操作（点赞/点踩/收藏）- POST /api/content/module/content/comment/action
export async function commentAction(params: { commentId: string | number; action: 'agree' | 'disagree' | 'collect' }) {
  return contentClient("/module/content/comment/action", {
    method: "POST",
    data: params
  });
}

// 获取用户对评论的操作状态 - GET /api/content/module/content/comment/actions
export async function getUserCommentActions(commentIds: (string | number)[]) {
  return contentClient("/module/content/comment/actions", {
    params: { commentIds: commentIds.join(',') }
  });
}

// 搜索页「热门搜索」:core-api 从没挂过 /chart/day-search/list(404),改用站内热榜
// GET /api/content/analytics/hot,返回 { list: [{ title, ... }] },搜索页取 title 作热词。
export async function topKeywordInThirdMonth(params?: Record<string, unknown>) {
  return contentClient("/analytics/hot", { params: { limit: 10, ...params } });
}

// ========== Global/Other APIs ==========

// QA详情 - POST /api/content/question/qa
export async function qaDetail(params: Record<string, unknown>) {
  return contentClient("/question/qa", {
    method: "POST",
    data: params
  });
}

