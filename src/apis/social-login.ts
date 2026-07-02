import { adminClient } from '@/lib/api/client';

interface ConnectWxParams {
  code: string;
  state: string;
}

interface LoginParams {
  providerId: string;
  openId: string;
  token: string;
}

export async function connectWx(params: ConnectWxParams) {
  return adminClient(`/api/oauth/WECHAT_OPEN/callback?code=${params.code}&state=${params.state}`, {
    method: 'GET',
  });
}

export async function login(params: LoginParams) {
  const formdata = new FormData();
  formdata.append('providerId', params.providerId);
  formdata.append('openId', params.openId);
  formdata.append('token', params.token);
  return adminClient('/authentication/openid', {
    method: 'POST',
    data: formdata,
  });
}
