'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { queryCurrent, logout as apiLogout } from '@/apis/user';
import { getMenuData } from '@/apis/menu';
import { listAllDictData } from '@/apis/global';
import { useApp } from './AppContext';

interface AuthContextValue {
  isAuthenticated: boolean;
  token: string | null;
  sessionId: string | null;  // 用于跨服务认证
  permissions: string[];
  login: (newToken: string, newSessionId?: string) => void;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Public paths that don't require authentication
export const PUBLIC_PATHS = ['/user/login', '/user/social-login', '/home'];

// Cookie name used to bridge Edge middleware (which can't read localStorage)
const TOKEN_COOKIE = 'auth-token';
function setTokenCookie(token: string | null) {
  if (typeof document === 'undefined') return;
  if (token) {
    document.cookie = `${TOKEN_COOKIE}=${token}; path=/; max-age=86400; SameSite=Lax`;
  } else {
    document.cookie = `${TOKEN_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
  }
}

export function AuthContextProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const { setCurrentUser, setMenuData, setDict } = useApp();
  const prevTokenRef = useRef<string | null>(null);

  // 客户端 hydration 后从 localStorage 读 token 和 session_id
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const savedToken = localStorage.getItem('token');
    const savedSessionId = localStorage.getItem('session_id');
    if (savedToken) setToken(savedToken);
    if (savedSessionId) setSessionId(savedSessionId);
    setHydrated(true);
  }, []);

  const login = useCallback((newToken: string, newSessionId?: string) => {
    localStorage.setItem('token', newToken);
    setTokenCookie(newToken);
    setToken(newToken);
    if (newSessionId) {
      localStorage.setItem('session_id', newSessionId);
      setSessionId(newSessionId);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } catch (e) {
      // Ignore
    }
    localStorage.removeItem('token');
    localStorage.removeItem('session_id');
    setTokenCookie(null);
    setToken(null);
    setSessionId(null);
    setPermissions([]);
    setCurrentUser(null);
    prevTokenRef.current = null;
    router.push('/user/login');
  }, [router, setCurrentUser]);

  const checkAuth = useCallback(async () => {
    if (prevTokenRef.current === token) return;
    prevTokenRef.current = token;

    if (!token) {
      if (!PUBLIC_PATHS.some((p) => pathname?.startsWith(p))) {
        router.push('/user/login');
      }
      return;
    }

    setIsLoading(true);
    try {
      const [userRes, menuRes, dictRes] = await Promise.all([
        queryCurrent(),
        getMenuData({}),
        listAllDictData({}),
      ]);

      if (userRes.data) {
        setCurrentUser(userRes.data);
        setPermissions(userRes.data.permissions || []);
      }
      if (menuRes.data) {
        setMenuData(menuRes.data || []);
      }
      if (dictRes.data) {
        setDict(dictRes.data || []);
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes(' unauthorized')) {
        logout();
      }
    } finally {
      setIsLoading(false);
    }
  }, [token, pathname, router, logout, setCurrentUser, setMenuData, setDict]);

  useEffect(() => {
    if (hydrated) checkAuth();
  }, [hydrated, token, checkAuth]);

  const value: AuthContextValue = {
    isAuthenticated: !!token,
    token,
    sessionId,
    permissions,
    login,
    logout,
    checkAuth,
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
 *
 * 用法:
 *   const { isAdmin, hasAuthority, hasPermission } = useAuthority();
 *   if (isAdmin) { ... }
 *   if (hasAuthority('ADMIN')) { ... }
 *   if (hasPermission('system:role:create')) { ... }
 *
 * 注:数据权限(行级过滤)由后端 GORM 插件根据 token 自动注入 WHERE,
 *    前端不参与也不展示,不要在这里加 dataScope 相关字段。
 */
export function useAuthority() {
  const { currentUser } = useApp();
  const { permissions } = useAuth();
  // 后端 service/user.go Login/MobileLogin/FormLogin 现在发的是 role.code(英文),
  // 见 qingqiuyue-go/internal/model/entity/base.go RoleEntity.Code 与 schema.sql 的
  // role.code 列及回填 SQL。这里前端只用 code 判断,不再做中英文别名映射。
  const authorities = (currentUser as any)?.roles ?? currentUser?.authorities ?? [];

  const hasAuthority = useCallback(
    (auth: string) => authorities.includes(auth),
    [authorities]
  );
  const hasPermission = useCallback(
    (code: string) => permissions.includes(code),
    [permissions]
  );
  const can = hasPermission;
  const isAdmin = hasAuthority('ADMIN') || hasAuthority('SUPER_ADMIN');
  const isSuperAdmin = hasAuthority('SUPER_ADMIN');
  const roles = authorities;

  return { isAdmin, isSuperAdmin, hasAuthority, hasPermission, can, roles };
}
