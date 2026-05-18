import { adminClient, contentClient } from '@/lib/api/client';

export async function getNotices(params: any) {
  return adminClient('/notice/list', {
    params
  });
}

export async function updateNotices(params: any) {
  return adminClient('/notice/update', {
    method: 'PUT',
    data: params
  });
}

export async function getNoticeSize(params: any) {
  return adminClient('/notice/size', {
    params
  });
}

export async function listDictData(params: any) {
  return adminClient("/dict/data/list", {
    params
  });
}

export async function listAllDictData(params: any) {
  return adminClient("/dict/data/all", {
    params
  });
}

export async function parseContent(params: any) {
  return adminClient("/content/parse", {
    params
  });
}

export async function reportContent(params: any) {
  return adminClient("/content/report", {
    method: "POST",
    data: params
  });
}

export async function searchContent(params: any) {
  return adminClient("/content/search", {
    method: "POST",
    data: params
  });
}

export async function collectContent(params: any) {
  return adminClient("/content/collect", {
    method: "POST",
    data: params
  });
}

export async function fileUpload(params: any) {
  return adminClient("/content/file/upload", {
    method: "POST",
    data: params
  });
}

export async function listDataPermission(params: any) {
  return adminClient("/data-permission/list", {
    params
  });
}

export async function payUnlock(params: any) {
  return contentClient("/module/payUnlock", {
    params
  });
}

export async function passwordUnlock(params: any) {
  return contentClient("/module/passwordUnlock", {
    params
  });
}

export async function contentPayUnlock(params: any) {
  return contentClient("/module/content/payUnlock", {
    params
  });
}

export async function contentPasswordUnlock(params: any) {
  return contentClient("/module/content/passwordUnlock", {
    params
  });
}

export async function userPointMe(params: any) {
  return adminClient("/point/user", {
    params
  });
}

export async function userRelationRecord(params: any) {
  return adminClient("/user-relation/record", {
    method: "POST",
    data: params
  });
}

export async function userRelationPage(params: any) {
  return adminClient("/user-relation/list", {
    params
  });
}

export async function userHasSign(params: any) {
  return adminClient("/user-sign/hasSign", {
    params
  });
}

export async function goSign(params: any) {
  return adminClient("/user-sign/sign", {
    params
  });
}

export async function signRecord(params: any) {
  return adminClient("/user-sign/record", {
    params
  });
}

export async function pullStream(params: any) {
  return adminClient("/notice/pullStream", {
    method: "POST",
    data: params
  });
}

export async function qaDetail(params: any) {
  return adminClient("/content/question/qa", {
    method: "POST",
    data: params
  });
}
