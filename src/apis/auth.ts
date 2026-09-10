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

/** 验证码用途:login 手机号登录(未注册自动注册)/ reset 找回密码 / bind 绑定手机号。 */
export type SmsType = 'login' | 'reset' | 'bind';

// SMS 发送请求
export interface SmsSendReq {
  mobile: string;
  type?: SmsType;
}

/** 当前真正可用的登录/注册方式(后端 /auth/options)。短信通道未接入时 sms=false。 */
export interface AuthOptions {
  password: boolean;
  register: boolean;
  sms: boolean;
  wechat: boolean;
}

// 可用登录方式 - GET /api/core/auth/options
export async function getAuthOptions() {
  return adminClient<AuthOptions>('/auth/options');
}

// 用户名密码注册,成功即登录 - POST /api/core/register
export async function register(data: { name: string; password: string; nickname?: string }) {
  return adminClient<LoginResp>('/register', { method: 'POST', data });
}

// 手机号 + 验证码登录(未注册自动注册)- POST /api/core/user/mobile/login
export async function mobileLogin(data: { mobile: string; code: string }) {
  return adminClient<LoginResp>('/user/mobile/login', { method: 'POST', data });
}

// 手机号 + 验证码重置密码 - POST /api/core/user/forgot/password
export async function resetPassword(data: { mobile: string; code: string; password: string }) {
  return adminClient('/user/forgot/password', { method: 'POST', data });
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
