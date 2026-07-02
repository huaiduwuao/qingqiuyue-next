import { adminClient, contentClient } from '@/lib/api/client';

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

export async function searchContent(params: Record<string, unknown>) {
  return contentClient("/search", {
    method: "POST",
    data: params
  });
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

export async function payUnlock(params: Record<string, unknown>) {
  return contentClient("/module/payUnlock", {
    params
  });
}

export async function passwordUnlock(params: Record<string, unknown>) {
  return contentClient("/module/passwordUnlock", {
    params
  });
}

export async function contentPayUnlock(params: Record<string, unknown>) {
  return contentClient("/module/content/payUnlock", {
    params
  });
}

export async function contentPasswordUnlock(params: Record<string, unknown>) {
  return contentClient("/module/content/passwordUnlock", {
    params
  });
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
