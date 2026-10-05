import { adminClient, contentClient } from '@/lib/api/client';
import { searchContent as searchApi, type SearchOptions } from '@/apis/search';

export async function getNotices(params: Record<string, unknown>) {
  return adminClient('/notice/list', {
    params
  });
}

export async function listDictData(params: Record<string, unknown>) {
  return adminClient("/dict/data/list", {
    params
  });
}

export async function listAllDictData(params: Record<string, unknown>) {
  return adminClient("/dict/data/all", {
    params
  });
}

export async function reportContent(params: Record<string, unknown>) {
  return contentClient("/report", {
    method: "POST",
    data: params
  });
}

export async function searchContent(kw: string, opts?: SearchOptions) {
  // 统一走 GET /api/content/search(后端是 GET kw 语义),见 src/apis/search.ts。
  return searchApi(kw, opts);
}

export async function collectContent(params: Record<string, unknown>) {
  return contentClient("/collect", {
    method: "POST",
    data: params
  });
}

export async function fileUpload(params: Record<string, unknown>) {
  return contentClient("/file/upload", {
    method: "POST",
    data: params
  });
}

export async function listDataPermission(params: Record<string, unknown>) {
  return adminClient("/data-permission/list", {
    params
  });
}

// 频道(module)一律公开,没有口令 / 付费解锁;单条内容的付费解锁见 @/apis/paywall,
// 付费合集(用户合集)的买断见 @/apis/my-list 的 unlockList。

export async function userPointMe(params: Record<string, unknown>) {
  return adminClient("/point/user", {
    params
  });
}

export async function pullStream(params: Record<string, unknown>) {
  return adminClient("/notice/pullStream", {
    method: "POST",
    data: params
  });
}

export async function qaDetail(params: Record<string, unknown>) {
  return contentClient("/question/qa", {
    method: "POST",
    data: params
  });
}
