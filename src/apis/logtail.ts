// 服务日志(/system/log)前端调用。
//
// 链路:adminClient → /api/core/ops/logs/* → core-api(超管守卫)→ 内网 logtail-server。
//
// ⚠️ 以前直接 fetch 同源 /logs/api/*,但 APISIX 的 /logs 路由挂了 basic-auth,
//    fetch 拿到 401 后这里把错误吞成空数组,页面就一直显示「无项目 / 暂无日志」。
//    现在失败会原样抛出,由页面显示错误,不要再 catch 成空结果。

import { adminClient } from '@/lib/api/client';

export interface LogSearchResult {
  lines: string[];
  truncated: boolean;
  total: number;
}

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';

export interface ParsedLine {
  ts: string;
  level: LogLevel | '';
  src: string;
  msg: string;
  raw: string;
}

/** 项目列表(= 各服务名,logtail-server 扫描 logs 目录得到) */
export async function getProjects(): Promise<string[]> {
  const r = await adminClient<{ list?: string[] }>('/ops/logs/projects');
  return r?.list ?? [];
}

/** 拉取某项目最新 n 行(实时模式按间隔轮询此接口) */
export async function tailLogs(project: string, n = 500): Promise<LogSearchResult> {
  const r = await adminClient<LogSearchResult>('/ops/logs', { params: { project, tail: n } });
  return { lines: r?.lines ?? [], truncated: !!r?.truncated, total: r?.total ?? 0 };
}

/** 按日期范围 + 关键字检索历史日志 */
export async function searchLogs(
  project: string,
  start: string,
  end: string,
  q: string,
): Promise<LogSearchResult> {
  const r = await adminClient<LogSearchResult>('/ops/logs', { params: { project, start, end, q } });
  return { lines: r?.lines ?? [], truncated: !!r?.truncated, total: r?.total ?? 0 };
}

const LEVELS = new Set<LogLevel>(['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL']);

/**
 * 解析一行日志。优先 Tab 格式 `ts\tLEVEL\tsrc\tmsg`,兼容 `[时间] LEVEL src msg`
 * 空格分隔;都不匹配则整行作为 msg、级别留空。与 logtail 内嵌 UI 的解析保持一致。
 */
export function parseLine(raw: string): ParsedLine {
  const text = raw.replace(/\x1b\[[0-9;]*m/g, ''); // 去掉 ANSI 颜色码

  const parts = text.split('\t');
  if (parts.length >= 3) {
    const lvl = parts[1].trim().toUpperCase() as LogLevel;
    if (LEVELS.has(lvl)) {
      return {
        ts: parts[0].replace(/^\[|\]$/g, '').trim(),
        level: lvl,
        src: (parts[2] || '').trim(),
        msg: parts.slice(3).join('\t').trim(),
        raw,
      };
    }
  }

  const m = text.match(/^(\[[\d\- :]+\])\s+(\w+)\s+(\S+)\s*(.*)/);
  if (m) {
    const lvl = m[2].toUpperCase() as LogLevel;
    if (LEVELS.has(lvl)) {
      return { ts: m[1].replace(/^\[|\]$/g, ''), level: lvl, src: m[3], msg: m[4], raw };
    }
  }

  return { ts: '', level: '', src: '', msg: raw, raw };
}

/** 级别配色(与 logtail 设计稿一致) */
export const LEVEL_COLOR: Record<LogLevel, string> = {
  DEBUG: '#8a8f98',
  INFO: '#4caf50',
  WARN: '#ff9800',
  ERROR: '#f44336',
  FATAL: '#f44336',
};

export const ALL_LEVELS: LogLevel[] = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'];
