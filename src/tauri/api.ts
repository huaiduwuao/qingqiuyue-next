/**
 * Tauri 桌面端 API 调用
 * 对应 src-tauri/src/lib.rs 中的 Rust 命令
 */
import { invoke } from '@tauri-apps/api/core';

// 系统信息
export interface SystemInfo {
  os: string;
  arch: string;
  goVersion: string;
  numCpu: number;
  wailsBuild: boolean;
}

export async function getSystemInfo(): Promise<SystemInfo> {
  return invoke<SystemInfo>('get_system_info');
}

export async function getApiBase(): Promise<string> {
  return invoke<string>('get_api_base');
}

export async function setApiBase(url: string): Promise<void> {
  return invoke('set_api_base', { url });
}

export async function openExternal(url: string): Promise<void> {
  return invoke('open_external', { url });
}

export async function getVersion(): Promise<string> {
  return invoke<string>('get_version');
}

export async function isDev(): Promise<boolean> {
  return invoke<boolean>('is_dev');
}
