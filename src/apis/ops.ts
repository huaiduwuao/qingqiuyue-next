import { adminClient } from '@/lib/api/client';

// 运维控制台(超管)。后端:core-api /api/core/ops/*
export const overview = () => adminClient('/ops/overview');
export const containers = () => adminClient('/ops/containers');
export const middlewares = () => adminClient('/ops/middlewares');
export const containerLogs = (id: string, tail = 200) =>
  adminClient(`/ops/containers/${id}/logs`, { params: { tail } });
export const startContainer = (id: string) => adminClient(`/ops/containers/${id}/start`, { method: 'POST' });
export const stopContainer = (id: string) => adminClient(`/ops/containers/${id}/stop`, { method: 'POST' });
export const restartContainer = (id: string) => adminClient(`/ops/containers/${id}/restart`, { method: 'POST' });
