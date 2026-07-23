'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { queryCurrent, logout as apiLogout } from '@/apis/user';
import { getMenuData } from '@/apis/menu';
import { listAllDictData } from '@/apis/global';
import { useApp } from './AppContext';

interface AuthContextValue {
  isAuthenticated: boolean;
  sessionId: string | null;  // 统一用 session_id
  permissions: string[];
  login: (sessionId: string) => void;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Public paths that don't require authentication
export const PUBLIC_PATHS = ['/user/login', '/user/social-login', '/home'];

export function AuthContextProvider({ children }: { children: React.ReactNode }) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const { setCurrentUser, setMenuData, setDict } = useApp();
  const prevSessionIdRef = useRef<string | null>(null);

  // 客户端 hydration 后从 localStorage 读 session_id
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const savedSessionId = localStorage.getItem('session_id');
    if (savedSessionId) setSessionId(savedSessionId);
    setHydrated(true);
  }, []);

  const login = useCallback((newSessionId: string) => {
    localStorage.setItem('session_id', newSessionId);
    setSessionId(newSessionId);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } catch (e) {
      // Ignore
    }
    localStorage.removeItem('session_id');
    setSessionId(null);
    setPermissions([]);
    setCurrentUser(null);
    prevSessionIdRef.current = null;
    router.push('/user/login');
  }, [router, setCurrentUser]);

  const checkAuth = useCallback(async () => {
    if (prevSessionIdRef.current === sessionId) return;
    prevSessionIdRef.current = sessionId;

    if (!sessionId) {
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
  }, [sessionId, pathname, router, logout, setCurrentUser, setMenuData, setDict]);

  useEffect(() => {
    if (hydrated) checkAuth();
  }, [hydrated, sessionId, checkAuth]);

  const value: AuthContextValue = {
    isAuthenticated: !!sessionId,
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
 */
export function useAuthority() {
  const { currentUser } = useApp();
  const { permissions } = useAuth();
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
