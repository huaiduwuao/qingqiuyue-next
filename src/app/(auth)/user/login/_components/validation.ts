// 登录/注册表单校验。规则与后端 internal/service/user_register.go 保持一致,
// 前端先拦一道只是为了即时反馈,服务端仍会再校验。

export const USERNAME_RE = /^[A-Za-z][A-Za-z0-9_]{3,19}$/;
export const MOBILE_RE = /^1\d{10}$/;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 64;
export const SMS_CODE_LENGTH = 6;

export function usernameError(name: string): string | null {
  return USERNAME_RE.test(name.trim()) ? null : '用户名需为 4-20 位字母、数字或下划线,且以字母开头';
}

export function passwordError(password: string, confirm?: string): string | null {
  const n = [...password].length;
  if (n < PASSWORD_MIN || n > PASSWORD_MAX) return `密码长度需为 ${PASSWORD_MIN}-${PASSWORD_MAX} 位`;
  if (confirm !== undefined && confirm !== password) return '两次输入的密码不一致';
  return null;
}

export function mobileError(mobile: string): string | null {
  return MOBILE_RE.test(mobile) ? null : '请输入正确的手机号';
}

export function smsCodeError(code: string): string | null {
  return code.length === SMS_CODE_LENGTH ? null : `请输入 ${SMS_CODE_LENGTH} 位验证码`;
}
