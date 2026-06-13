import { adminClient } from '@/lib/api/client';
import { login, sendSmsCode, verifySmsCode, getCurrentUser, LoginReq, LoginResp, UserInfo } from './auth';

// Re-export auth functions for convenience
export { login, sendSmsCode, verifySmsCode, getCurrentUser };
export type { LoginReq, LoginResp, UserInfo };

// 登出 - POST /api/core/user/logout
export async function logout() {
  return adminClient('/user/logout', {
    method: 'POST',
  });
}

// 账户登录
export async function accountLogin(params: { name: string; password: string }) {
  return login(params);
}

// 手机号登录 - POST /api/core/user/mobile/login
export async function mobileLogin(params: { mobile: string; captcha: string }) {
  return adminClient<LoginResp>('/user/mobile/login', {
    method: 'POST',
    data: params,
  });
}

// 获取当前用户
export async function queryCurrent(): Promise<any> {
  return getCurrentUser();
}

// 检查用户名是否可用 - GET /api/core/user/name/available
export const isNameAvail = async (params: any) => {
  return adminClient('/user/name/available', { params });
};

// 获取用户资料 - GET /api/core/user/profile
export const getUserProfile = async () => {
  return adminClient('/user/profile', { method: 'GET' });
};

// 更新用户资料 - PUT /api/core/user/profile
export const updateUserProfile = async (data: any) => {
  return adminClient('/user/profile', { method: 'PUT', data });
};

// 获取用户列表 - GET /api/core/user/list
export async function listUsers(params?: any) {
  return adminClient('/user/list', { method: 'GET', params });
}

// 创建用户 - POST /api/core/user
export async function createUser(data: any) {
  return adminClient('/user', { method: 'POST', data });
}

// 更新用户 - PUT /api/core/user/{id}
export async function updateUser(id: number, data: any) {
  return adminClient(`/user/${id}`, { method: 'PUT', data });
}

// 删除用户 - DELETE /api/core/user/{id}
export async function deleteUser(id: number) {
  return adminClient(`/user/${id}`, { method: 'DELETE' });
}

// 发送验证码 (alias)
export const getLoginCaptcha = sendSmsCode;
