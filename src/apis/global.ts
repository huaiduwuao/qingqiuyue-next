import { adminClient, contentClient } from '@/lib/api/client';
import { searchContent as searchApi, type SearchOptions } from '@/apis/search';

export async function getNotices(params: Record<string, unknown>) {
  return adminClient('/notice/list', {
    params
  });
}

export async function updateNotices(params: Record<string, unknown>) {
  return adminClient('/notice/update', {
    method: 'PUT',
    data: params
  });
}

export async function getNoticeSize(params: Record<string, unknown>) {
  return adminClient('/notice/size', {
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

export async function parseContent(params: Record<string, unknown>) {
  return contentClient("/parse", {
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

// 合集解锁。有副作用的操作走 POST;单条内容的付费解锁见 @/apis/paywall。
export async function payUnlock(data: { moduleId: number }) {
  return contentClient("/module/payUnlock", { method: "POST", data });
}

export async function passwordUnlock(data: { moduleId: number; password: string }) {
  return contentClient("/module/passwordUnlock", { method: "POST", data });
}

export async function userPointMe(params: Record<string, unknown>) {
  return adminClient("/point/user", {
    params
  });
}

export async function userRelationRecord(params: Record<string, unknown>) {
  return adminClient("/user-relation/record", {
    method: "POST",
    data: params
  });
}

export async function userRelationPage(params: Record<string, unknown>) {
  return adminClient("/user-relation/list", {
    params
  });
}

export async function userHasSign(params: Record<string, unknown>) {
  return adminClient("/user-sign/hasSign", {
    params
  });
}

export async function goSign(params: Record<string, unknown>) {
  return adminClient("/user-sign/sign", {
    params
  });
}

export async function signRecord(params: Record<string, unknown>) {
  return adminClient("/user-sign/record", {
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
