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
  return adminClient("/user/profile", {
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

// 支付密码 API
export async function setPayPassword(password: string): Promise<void> {
  await adminClient('/user/pay-password', { method: 'POST', data: { password } });
}

export async function verifyPayPassword(password: string): Promise<boolean> {
  const res = await adminClient('/user/verify-pay-password', { method: 'POST', data: { password } });
  return res?.code === 0;
}

export async function hasPayPassword(): Promise<boolean> {
  const res = await adminClient('/user/has-pay-password');
  return (res as any)?.data?.hasPayPassword ?? false;
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
