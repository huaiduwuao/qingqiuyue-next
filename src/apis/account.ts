import { adminClient, contentClient } from '@/lib/api/client';

export async function checkPassword(params: Record<string, unknown>) {
  return adminClient("/user/checkPassword", {
    params
  });
}

export async function connectList(params: Record<string, unknown>) {
  return adminClient("/user/connectList", {
    params
  });
}

export async function queryProvince() {
  return adminClient("/area/provinces");
}

export async function queryCity(params: Record<string, unknown>) {
  return adminClient(`/area/cities/${params.provinceCode}`, {
    params
  });
}

export async function updateUser(params: Record<string, unknown>) {
  return adminClient("/user/updateMe", {
    method: 'PUT',
    data: params
  });
}

export async function systemUpdate(params: Record<string, unknown>) {
  return adminClient("/user/systemUpdate", {
    method: 'PUT',
    data: params
  });
}

export async function upload(params: FormData | Record<string, unknown>) {
  return adminClient("/user/upload", {
    method: "POST",
    data: params
  });
}

export async function moduleContentActionPage(params: Record<string, unknown>) {
  return contentClient("/module/content/action/page", {
    params
  });
}

export async function novelBookshelf(params: Record<string, unknown>) {
  return contentClient("/novelBookshelf/my", {
    params
  });
}

export async function removeNovel(params: Record<string, unknown>) {
  return contentClient("/novelBookshelf/remove", {
    params
  });
}
