import axios, { AxiosError, AxiosResponse } from 'axios';

const MOCK_API_PORT = 3001;
// MSW 启动时必须用同源 URL(空串),否则 Service Worker 拦截不到跨域 XHR
const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === '1' || process.env.NEXT_PUBLIC_USE_MOCK === 'true';
const API_GATEWAY = USE_MOCK
  ? ''
  : process.env.NEXT_PUBLIC_API_BASE_URL || `http://localhost:${MOCK_API_PORT}`;

// 各模块API基地址
export const API_BASE = {
  admin: `${API_GATEWAY}/api/admin`,
  content: `${API_GATEWAY}/api/content`,
  reward: `${API_GATEWAY}/api/reward`,
  wx: `${API_GATEWAY}/api/wx`,
  spider: `${API_GATEWAY}/api/spider`,
  im: `${API_GATEWAY}/api/im`,
  account: `${API_GATEWAY}/api/account`,
  home: `${API_GATEWAY}/api/home`,
};

// 创建指定baseURL的axios实例
function createApiClient(baseURL: string) {
  const client = axios.create({
    baseURL,
    withCredentials: false,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Request interceptor
  client.interceptors.request.use(
    (config) => {
      if (typeof window !== 'undefined') {
        // 优先 cookie(供 middleware 同步),localStorage 兜底
        const fromCookie = document.cookie
          .split('; ')
          .find((r) => r.startsWith('auth-token='))
          ?.split('=')[1];
        const token = fromCookie || localStorage.getItem('token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      }
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  // Response interceptor - 适配后端响应格式 { code, msg, data }
  client.interceptors.response.use(
    (response: AxiosResponse) => {
      const { data } = response;
      // 0 和 200 都是成功状态码
      if (data.code !== 200 && data.code !== '200' && data.code !== 0) {
        const error = new Error(data.msg || '请求失败');
        (error as any).code = data.code;
        (error as any).response = data;
        return Promise.reject(error);
      }
      // 返回 data 而不是 response，方便使用
      return data;
    },
    (error: AxiosError) => {
      if (error.response?.data) {
        const data = error.response.data as { code?: string | number; msg?: string };
        if (data.code !== 200 && data.code !== '200' && data.code !== 0) {
          const err = new Error(data.msg || '请求失败');
          (err as any).code = data.code;
          (err as any).response = data;
          return Promise.reject(err);
        }
      }
      return Promise.reject(error);
    }
  );

  return client;
}

// 各模块API客户端
export const adminClient = createApiClient(API_BASE.admin);
export const contentClient = createApiClient(API_BASE.content);
export const rewardClient = createApiClient(API_BASE.reward);
export const wxClient = createApiClient(API_BASE.wx);
export const spiderClient = createApiClient(API_BASE.spider);
export const imClient = createApiClient(API_BASE.im);
export const accountClient = createApiClient(API_BASE.account);
export const homeClient = createApiClient(API_BASE.home);

// 默认导出admin客户端（兼容现有代码）
export const apiClient = adminClient;

export interface ApiResponse<T = any> {
  code: string | number;
  msg: string;
  data: T;
  success?: boolean;
}
