import axios, { AxiosError, AxiosResponse } from 'axios';

export type ApiErrorCategory = 'network' | 'auth' | 'business' | 'timeout' | 'unknown';

export class ApiError extends Error {
  category: ApiErrorCategory;
  code?: string | number;
  status?: number;
  response?: any;

  constructor(opts: {
    message: string;
    category: ApiErrorCategory;
    code?: string | number;
    status?: number;
    response?: any;
  }) {
    super(opts.message);
    this.name = 'ApiError';
    this.category = opts.category;
    this.code = opts.code;
    this.status = opts.status;
    this.response = opts.response;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function isAuthError(error: unknown): boolean {
  return isApiError(error) && error.category === 'auth';
}

export function isNetworkError(error: unknown): boolean {
  return isApiError(error) && (error.category === 'network' || error.category === 'timeout');
}

export function isBusinessError(error: unknown): boolean {
  return isApiError(error) && error.category === 'business';
}

export function formatApiError(error: unknown): string {
  if (isApiError(error)) {
    if (error.category === 'auth') return '登录已过期,请重新登录';
    if (error.category === 'network') return '网络连接失败,请检查网络';
    if (error.category === 'timeout') return '请求超时,请稍后重试';
    return error.message || '请求失败';
  }
  if (error instanceof Error) return error.message;
  return '未知错误';
}

// 走网关同源: /api/* 经 Next.js rewrites 反代到 API_PROXY_TARGET(详见 next.config.ts)
// 显式设为空串("")表示同源,未设时回退到 localhost:3000 同源(开发)。
const API_GATEWAY = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';

// 各模块 API 基地址 —— 前缀按 4 个合并服务收口:
//   core(admin+wx+reward)/ content(content+home)/ realtime(im+avatar)/ spider
export const API_BASE = {
  admin: `${API_GATEWAY}/api/core`,
  content: `${API_GATEWAY}/api/content`,
  reward: `${API_GATEWAY}/api/core`,
  wx: `${API_GATEWAY}/api/core`,
  spider: `${API_GATEWAY}/api/spider`,
  im: `${API_GATEWAY}/api/realtime`,
  account: `${API_GATEWAY}/api/core`,
  home: `${API_GATEWAY}/api/content/home`,
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
  // 兼容两种约定:
  //   1. 标准包装: { code: 200, msg: 'OK', data: {...} }
  //   2. 直接返 body: { items: [...], total: 0 } 或 { list: [...], total: 0 }
  // 第二种常见于 spider-api 等早期接口,这里归一为第一种,避免业务层分支判断。
  client.interceptors.response.use(
    (response: AxiosResponse) => {
      const { data, status } = response;

      // 1) 已经是 { code, msg, data } 包装:走原逻辑
      if (data && typeof data === 'object' && 'code' in data) {
        if (data.code !== 200 && data.code !== '200' && data.code !== 0) {
          const isAuth = status === 401 || data.code === 401 || data.code === '401';
          const error = new ApiError({
            message: data.msg || '请求失败',
            category: isAuth ? 'auth' : 'business',
            code: data.code,
            status,
            response: data,
          });
          return Promise.reject(error);
        }
        // 分页响应归一(同原逻辑)
        const payload = (data as any)?.data;
        if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
          if ('list' in payload && !('records' in payload)) payload.records = payload.list;
          if ('records' in payload && !('list' in payload)) payload.list = payload.records;
          if ('total' in payload && !('totalRow' in payload)) payload.totalRow = payload.total;
          if ('totalRow' in payload && !('total' in payload)) payload.total = payload.totalRow;
        }
        return data;
      }

      // 2) flat shape:把整个 body 当作 data 包一层,业务层用 res.data?.items / res.data?.list 读
      //    (业务层习惯 res.data?.data,所以这里也提供 res.data?.data 同名别名)
      const wrapped: any = {
        code: 200,
        msg: 'OK',
        data,
      };
      // 列表分页归一:flat { items } 也提供 list 别名
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        if ('items' in data && !('list' in data)) (wrapped.data as any).list = (data as any).items;
        if ('list' in data && !('records' in data)) (wrapped.data as any).records = (data as any).list;
        if ('total' in data && !('totalRow' in data)) (wrapped.data as any).totalRow = (data as any).total;
        if ('totalRow' in data && !('total' in data)) (wrapped.data as any).total = (data as any).totalRow;
      }
      return wrapped;
    },
    (error: AxiosError) => {
      const status = error.response?.status;
      const data = error.response?.data as { code?: string | number; msg?: string } | undefined;

      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        return Promise.reject(new ApiError({
          message: '请求超时,请稍后重试',
          category: 'timeout',
          status,
        }));
      }
      if (!error.response) {
        return Promise.reject(new ApiError({
          message: '网络连接失败,请检查网络',
          category: 'network',
        }));
      }

      if (status === 401) {
        return Promise.reject(new ApiError({
          message: '登录已过期,请重新登录',
          category: 'auth',
          status,
          response: data,
        }));
      }

      if (data && data.code !== 200 && data.code !== '200' && data.code !== 0) {
        return Promise.reject(new ApiError({
          message: data.msg || '请求失败',
          category: 'business',
          code: data.code,
          status,
          response: data,
        }));
      }

      return Promise.reject(new ApiError({
        message: error.message || '请求失败',
        category: status ? 'business' : 'unknown',
        status,
        response: data,
      }));
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
