import { adminClient } from '@/lib/api/client';

// 登录请求
export interface LoginReq {
  name: string;
  password: string;
}

// 登录响应
export interface LoginResp {
  session_id: string;
  user: UserInfo;
}

// 用户信息
export interface UserInfo {
  id: number;
  name: string;
  nickname: string;
  email: string;
  mobile: string;
  avatar: string;
  status: number;
  tenantId: number;
  roles: string[];
  permissions: string[];
}

// SMS 发送请求
export interface SmsSendReq {
  mobile: string;
  type?: string;
}

// SMS 验证请求
export interface SmsVerifyReq {
  mobile: string;
  code: string;
  type?: string;
}

// 登录 - POST /api/core/login
export async function login(params: LoginReq) {
  return adminClient<LoginResp>('/login', {
    method: 'POST',
    data: params,
  });
}

// 发送验证码 - POST /api/core/sms/send
export async function sendSmsCode(params: SmsSendReq) {
  return adminClient('/sms/send', {
    method: 'POST',
    data: params,
  });
}

// 验证验证码 - POST /api/core/sms/verify
export async function verifySmsCode(params: SmsVerifyReq) {
  return adminClient('/sms/verify', {
    method: 'POST',
    data: params,
  });
}

// 获取当前用户信息 - GET /api/core/user/current
export async function getCurrentUser() {
  return adminClient<UserInfo>('/user/current', {
    method: 'GET',
  });
}

// 获取用户权限 - GET /api/core/user/permissions
export async function getUserPermissions() {
  return adminClient<{ permissions: string[] }>('/user/permissions', {
    method: 'GET',
  });
}
