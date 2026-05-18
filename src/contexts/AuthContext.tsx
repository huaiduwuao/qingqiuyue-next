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
  permissions: string[];
  login: (newToken: string) => void;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Public paths that don't require authentication
const PUBLIC_PATHS = ['/user/login', '/user/social-login'];

export function AuthContextProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('token');
    }
    return null;
  });
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const { setCurrentUser, setMenuData, setDict } = useApp();
  const prevTokenRef = useRef<string | null>(null);

  const login = useCallback((newToken: string) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiLogout(); // Call backend to invalidate session
    } catch (e) {
      // Ignore errors, clear local state anyway
    }
    localStorage.removeItem('token');
    setToken(null);
    setPermissions([]);
    prevTokenRef.current = null;
    router.push('/user/login');
  }, [router]);

  const checkAuth = useCallback(async () => {
    // Prevent re-fetching if token hasn't changed
    if (prevTokenRef.current === token) {
      return;
    }
    prevTokenRef.current = token;

    if (!token) {
      if (!PUBLIC_PATHS.some(path => pathname?.startsWith(path))) {
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
      // Token invalid or expired
      if (error instanceof Error && error.message.includes(' unauthorized')) {
        logout();
      }
    } finally {
      setIsLoading(false);
    }
  }, [token, pathname, router, logout, setCurrentUser, setMenuData, setDict]);

  useEffect(() => {
    checkAuth();
  }, [token]);

  const value: AuthContextValue = {
    isAuthenticated: !!token,
    token,
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
