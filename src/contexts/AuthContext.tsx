'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { queryCurrent, logout as apiLogout } from '@/apis/user';
import { getMenuData } from '@/apis/menu';
import { listAllDictData } from '@/apis/global';
import { isAuthError } from '@/lib/api/client';
import { AUTH_EXPIRED_EVENT, SESSION_KEY, getAuthToken, setAuthToken } from '@/lib/api/auth';
import { isProtectedPath } from '@/lib/auth/routes';
import { LOGIN_PATH, loginHref } from '@/lib/auth/redirect';
import { useApp } from './AppContext';


/**
 * 登录态三个阶段:
 *   loading       —— 还没读出本地会话,或正在用会话拉取当前用户
 *   authenticated —— 会话有效
 *   anonymous     —— 没有会话,或会话已失效
 *
 * 此前只有 isAuthenticated = !!sessionId:首屏 hydration 之前一律为 false,需要登录的
 * 组件先渲染成"未登录"再闪回;会话过期后接口返回 401,但判断条件是错误文案里含
 * ' unauthorized'(实际文案是中文),永远匹配不上,前端一直显示已登录。
 */
export type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

interface AuthContextValue {
  status: AuthStatus;
  isAuthenticated: boolean;
  sessionId: string | null;
  permissions: string[];
  // 以下两个字段历史上由 AuthContext 提供,但当前实现里没有写入。多处页面
  // (group / my-list shared) 仍按旧约定读,先把字段声明为可选避免 tsc 报错。
  // 后续如有真实读源,应改成从 queryCurrent() 的缓存里取。
  currentUser?: { id?: number | string; nickname?: string; avatar?: string } | null;
  user?: { id?: number | string; nickname?: string; avatar?: string } | null;
  /** 登录/注册成功后调用:保存会话并拉取当前用户,完成后再跳转。 */
  login: (sessionId: string) => Promise<void>;
  logout: () => Promise<void>;
  /** 重新拉取当前用户(修改资料后)。 */
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function readSession(): string | null {
  return getAuthToken();
}

function writeSession(sessionId: string | null) {
  // 登出时连旧的 'token' 键一起清,别让裸 fetch 再捡起来用
  setAuthToken(sessionId);
}

export function AuthContextProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { setCurrentUser, setMenuData, setDict } = useApp();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [permissions, setPermissions] = useState<string[]>([]);
  // 每次登录/登出/重新加载递增;异步结果回来时序号不一致就丢弃,避免旧请求覆盖新状态。
  const loadSeq = useRef(0);

  const clearLocal = useCallback(() => {
    loadSeq.current++;
    writeSession(null);
    setSessionId(null);
    setPermissions([]);
    setCurrentUser(null);
    setMenuData([]);
    setStatus('anonymous');
  }, [setCurrentUser, setMenuData]);

  const loadUser = useCallback(
    async (sid: string) => {
      const seq = ++loadSeq.current;
      setSessionId(sid);
      setStatus('loading');
      try {
        const user = await queryCurrent();
        if (seq !== loadSeq.current) return;
        if (!user) {
          clearLocal();
          return;
        }
        setCurrentUser(user);
        setPermissions(user.permissions ?? []);
        setStatus('authenticated');
      } catch (err) {
        if (seq !== loadSeq.current) return;
        if (isAuthError(err)) {
          clearLocal();
        } else {
          // 网络抖动等暂时性错误:保留会话,不因为断网把用户登出。
          setStatus('authenticated');
        }
        return;
      }
      // 菜单、字典各自独立:任何一个失败都不影响登录态(此前 Promise.all 一起失败)。
      const [menu, dict] = await Promise.allSettled([getMenuData({}), listAllDictData({})]);
      if (seq !== loadSeq.current) return;
      if (menu.status === 'fulfilled') setMenuData(menu.value ?? []);
      if (dict.status === 'fulfilled') setDict(dict.value ?? []);
    },
    [clearLocal, setCurrentUser, setMenuData, setDict],
  );

  // 启动:读本地会话 → 有则校验并拉取用户,无则直接匿名。
  const booted = useRef(false);
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    const sid = readSession();
    if (sid) void loadUser(sid);
    else setStatus('anonymous');
  }, [loadUser]);

  // 受保护页面只在确定是匿名后才跳登录,并带上回跳地址。
  useEffect(() => {
    if (status === 'anonymous' && pathname && isProtectedPath(pathname)) {
      router.replace(loginHref());
    }
  }, [status, pathname, router]);

  // 带着会话的接口返回 401 → 向 core-api 复核一次,确认失效才清会话;其它标签页登录/登出 → 同步。
  // 此前任何一个 401 都直接清会话:Steward 等其它服务鉴权失败(与会话是否有效无关)时,
  // 打开 /system 下的某些页就会被踢回登录页。
  useEffect(() => {
    let checking = false;
    const onExpired = async () => {
      if (checking || !readSession()) return;
      checking = true;
      try {
        await queryCurrent();
      } catch (err) {
        if (isAuthError(err)) clearLocal();
      } finally {
        checking = false;
      }
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key !== SESSION_KEY) return;
      if (e.newValue) void loadUser(e.newValue);
      else clearLocal();
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
      window.removeEventListener('storage', onStorage);
    };
  }, [clearLocal, loadUser]);

  const login = useCallback(
    async (newSessionId: string) => {
      writeSession(newSessionId);
      await loadUser(newSessionId);
      // 匿名时缓存的数据(付费墙、相关推荐等)按登录身份重新拉取。
      await queryClient.invalidateQueries();
    },
    [loadUser, queryClient],
  );

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } catch {
      /* 服务端注销失败也要清掉本地会话 */
    }
    clearLocal();
    queryClient.clear();
    router.push(LOGIN_PATH);
  }, [clearLocal, queryClient, router]);

  const refresh = useCallback(async () => {
    const sid = readSession();
    if (sid) await loadUser(sid);
  }, [loadUser]);

  const value: AuthContextValue = {
    status,
    isAuthenticated: status === 'authenticated',
    sessionId,
    permissions,
    login,
    logout,
    refresh,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthContextProvider');
  }
  return context;
}

/**
 * 角色 / 权限判断 hook。组合 useAuth + useApp,提供更便捷的判断。
 */
export function useAuthority() {
  const { currentUser } = useApp();
  const { permissions } = useAuth();
  const authorities = (currentUser as any)?.roles ?? currentUser?.authorities ?? [];
  // 超级管理员(持有内置角色)在后端放行全部功能权限,前端保持一致。
  const isSuperAdmin = Boolean((currentUser as any)?.superAdmin) || authorities.includes('SUPER_ADMIN');

  const hasAuthority = useCallback(
    (auth: string) => authorities.includes(auth),
    [authorities]
  );
  const hasPermission = useCallback(
    (code: string) => isSuperAdmin || permissions.includes(code),
    [permissions, isSuperAdmin]
  );
  const can = hasPermission;
  const isAdmin = hasAuthority('ADMIN') || isSuperAdmin;
  const roles = authorities;

  return { isAdmin, isSuperAdmin, hasAuthority, hasPermission, can, roles };
}
