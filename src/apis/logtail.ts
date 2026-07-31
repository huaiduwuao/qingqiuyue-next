// logtail 日志平台前端调用。
//
// 链路:
//   - 生产:浏览器同源 /logs/* → nginx → APISIX(/logs/* → logtail-server)
//   - dev :浏览器直连 http://10.9.1.2:8089,失败时 fetcher try-catch 返回 []
//          (Next.js rewrites 不可达目标会 500,所以 dev 不走 rewrite)
//
// ⚠️ logtail 返回裸 JSON(数组 / { lines, truncated, total }),不是后端统一的
//    { code, msg, data } 信封,所以这里用原生 fetch,不能复用 src/lib/api/client
//    的 axios 实例(其响应拦截器会因缺少 code 字段而把成功响应判为失败)。

// dev 模式直连地址:logtail-server 宿主机映射端口(8089 → 容器 8080)
// 生产走 nginx,这里不影响
const LOGTAIL_BASE = 'http://10.9.1.2:8089';

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
 *  dev 模式直连 10.9.1.2:8089,失败 try-catch 返回 [] 让页面降级 */
export async function getProjects(): Promise<string[]> {
  try {
    return await getJSON<string[]>(`${LOGTAIL_BASE}/api/projects`);
  } catch (e) {
    console.warn('[logtail] getProjects 失败,返回空数组:', e);
    return [];
  }
}

/** 拉取某项目最新 n 行(实时模式按间隔轮询此接口) */
export async function tailLogs(project: string, n = 500): Promise<LogSearchResult> {
  try {
    const u = `${LOGTAIL_BASE}/api/logs?project=${encodeURIComponent(project)}&tail=${n}`;
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
    return await getJSON<LogSearchResult>(`${LOGTAIL_BASE}/api/logs?${p.toString()}`);
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
