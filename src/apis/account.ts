import { adminClient, contentClient } from '@/lib/api/client';

export async function checkPassword(params: any) {
  return adminClient("/user/checkPassword", {
    params
  });
}

export async function connectList(params: any) {
  return adminClient("/user/connectList", {
    params
  });
}

export async function queryProvince() {
  return adminClient("/area/provinces");
}

export async function queryCity(params: any) {
  return adminClient(`/area/cities/${params.provinceCode}`, {
    params
  });
}

export async function updateUser(params: any) {
  return adminClient("/user/updateMe", {
    method: 'PUT',
    data: params
  });
}

export async function systemUpdate(params: any) {
  return adminClient("/user/systemUpdate", {
    method: 'PUT',
    data: params
  });
}

export async function upload(params: any) {
  return adminClient("/user/upload", {
    method: "POST",
    data: params
  });
}

export async function moduleContentActionPage(params: any) {
  return contentClient("/module/content/action/page", {
    params
  });
}

export async function novelBookshelf(params: any) {
  return contentClient("/novelBookshelf/my", {
    params
  });
}

export async function removeNovel(params: any) {
  return contentClient("/novelBookshelf/remove", {
    params
  });
}
