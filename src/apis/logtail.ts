// logtail 日志平台前端调用。
//
// 链路(统一走 APISIX,跟生产一致):
//   浏览器同源 /logs/* → nginx(生产) / Next.js rewrites(dev) → APISIX
//   APISIX(/logs/* → logtail-server 容器内网 8080) → logtail-server
//
// ⚠️ logtail 返回裸 JSON(数组 / { lines, truncated, total }),不是后端统一的
//    { code, msg, data } 信封,所以这里用原生 fetch,不能复用 src/lib/api/client
//    的 axios 实例(其响应拦截器会因缺少 code 字段而把成功响应判为失败)。

const BASE = '/logs';

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

async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    throw new Error(`日志服务请求失败(${res.status})`);
  }
  return res.json() as Promise<T>;
}

/** 项目列表(= 各服务名,扫描 logtail-server 的 logs 目录得到)
 *  logtail 不可达时返回 [],页面降级显示「无项目」而不是报错 */
export async function getProjects(): Promise<string[]> {
  try {
    return await getJSON<string[]>(`${BASE}/api/projects`);
  } catch (e) {
    console.warn('[logtail] getProjects 失败,返回空数组:', e);
    return [];
  }
}

/** 拉取某项目最新 n 行(实时模式按间隔轮询此接口) */
export async function tailLogs(project: string, n = 500): Promise<LogSearchResult> {
  try {
    const u = `${BASE}/api/logs?project=${encodeURIComponent(project)}&tail=${n}`;
    return await getJSON<LogSearchResult>(u);
  } catch (e) {
    return { lines: [], truncated: false, total: 0 };
  }
}

/** 按日期范围 + 关键字检索历史日志 */
export async function searchLogs(
  project: string,
  start: string,
  end: string,
  q: string,
): Promise<LogSearchResult> {
  try {
    const p = new URLSearchParams({ project, start, end, q });
    return await getJSON<LogSearchResult>(`${BASE}/api/logs?${p.toString()}`);
  } catch (e) {
    return { lines: [], truncated: false, total: 0 };
  }
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
