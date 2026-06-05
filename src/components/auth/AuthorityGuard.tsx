'use client';

import React, { type ReactNode } from 'react';
import { useAuthority } from '@/contexts/AuthContext';

export interface AuthorityGuardProps {
  /** 需要的 authority 标识,例如 'ADMIN'。需要多个时传数组(任意一个命中即通过)。 */
  need: string | string[];
  /** 命中时渲染的子节点;默认直接渲染 children。 */
  children: ReactNode;
  /** 命中时渲染,未命中时渲染什么(默认 null,即不渲染)。 */
  fallback?: ReactNode;
}

/**
 * 角色级权限守卫:根据 currentUser.authorities 控制子节点显隐。
 *
 * - 命中 → 渲染 children
 * - 未命中 → 渲染 fallback(默认 null,即不渲染)
 */
export function AuthorityGuard({ need, children, fallback = null }: AuthorityGuardProps) {
  const { hasAuthority } = useAuthority();
  const list = Array.isArray(need) ? need : [need];
  const allowed = list.some((auth) => hasAuthority(auth));
  return <>{allowed ? children : fallback}</>;
}
