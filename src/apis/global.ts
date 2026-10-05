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

// 合集解锁。有副作用的操作走 POST;单条内容的付费解锁见 @/apis/paywall。

/** 合集钻石买断的结果(后端 moduleshare.PurchaseResult) */
export interface ModulePayResult {
  unlocked: boolean;
  /** 之前已买过 / 合集主本人,本次没有扣款 */
  alreadyUnlocked: boolean;
  /** 买断价(钻) */
  price: number;
  /** 本次实际扣款(钻) */
  paid: number;
  /** 解锁后的余额(钻) */
  balance: number;
}

/** 付费合集:用钻石买断(需登录;已买过不重复扣) */
export async function payUnlock(data: { moduleId: number }) {
  return contentClient<ModulePayResult>("/module/payUnlock", { method: "POST", data });
}

/** 口令合集:校验口令,返回通行证 pass(24 小时有效),之后读合集内容时以 modulePass 参数带上 */
export async function passwordUnlock(data: { moduleId: number; password: string }) {
  return contentClient<{ unlocked: boolean; pass?: string; expiresAt?: number }>("/module/passwordUnlock", { method: "POST", data });
}

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
