'use client';

import React, { type ReactNode } from 'react';
import { useAuthority } from '@/contexts/AuthContext';

export interface PermissionGuardProps {
  /** 需要的权限码,例如 'system:role:list'。需要多个时传数组(全部需要,AND 关系)。 */
  need: string | string[];
  /** 命中时渲染的子节点。 */
  children: ReactNode;
  /** 未命中时渲染什么(默认 null)。 */
  fallback?: ReactNode;
}

/**
 * 权限码级守卫:根据 useAuth().permissions 控制子节点显隐。
 *
 * - 命中 → 渲染 children
 * - 未命中 → 渲染 fallback
 *
 * 多权限码时为 AND 关系(全部需要);若想 OR,请在外层用 <>{any && children}</>。
 */
export function PermissionGuard({ need, children, fallback = null }: PermissionGuardProps) {
  const { hasPermission } = useAuthority();
  const list = Array.isArray(need) ? need : [need];
  const allowed = list.every((code) => hasPermission(code));
  return <>{allowed ? children : fallback}</>;
}
