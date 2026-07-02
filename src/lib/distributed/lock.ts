/**
 * distributed/lock.ts — 分布式锁 (基于 PostgreSQL advisory lock)
 *
 * 适用场景:
 *   - 爬虫 URL 去重锁
 *   - 域名级速率限制
 *   - 任务幂等执行
 *
 * 为什么用 PG advisory lock:
 *   - 项目已有 PostgreSQL, 无需额外 Redis 依赖
 *   - 会话级 / 事务级锁语义清晰
 */

import { pool } from '@/lib/db/client'

function keyToInt64(key: string): [number, number] {
  // 把字符串 hash 成两个 int32, 组合成 int64 的上下 32 位
  let h1 = 5381
  let h2 = 52711
  for (let i = 0; i < key.length; i++) {
    const c = key.charCodeAt(i)
    h1 = ((h1 << 5) + h1) + c
    h1 |= 0
    h2 = ((h2 << 5) + h2) + (c ^ 0x5a)
    h2 |= 0
  }
  return [h1 >>> 0, h2 >>> 0]
}

export interface DistributedLock {
  release: () => Promise<void>
}

/** 获取会话级 advisory lock (阻塞直到获得, 或超时) */
export async function acquireLock(
  key: string,
  timeoutMs = 5000,
): Promise<DistributedLock | null> {
  const [k1, k2] = keyToInt64(key)
  const client = await pool.connect()
  const start = Date.now()
  try {
    while (Date.now() - start < timeoutMs) {
      const r = await client.query('SELECT pg_try_advisory_lock($1, $2) AS ok', [k1, k2])
      if (r.rows[0]?.ok) {
        return {
          release: async () => {
            try {
              await client.query('SELECT pg_advisory_unlock($1, $2)', [k1, k2])
            } finally {
              client.release()
            }
          },
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
  } catch (e) {
    client.release()
    throw e
  }
  client.release()
  return null
}

/** 非阻塞尝试获取锁 */
export async function tryLock(key: string): Promise<DistributedLock | null> {
  return acquireLock(key, 0)
}

/** 检查某 key 是否已被锁定 */
export async function isLocked(key: string): Promise<boolean> {
  const [k1, k2] = keyToInt64(key)
  const r = await pool.query('SELECT COUNT(*)::int AS cnt FROM pg_locks WHERE locktype = $1 AND classid = $2 AND objid = $3', [
    'advisory', k1, k2,
  ])
  return (r.rows[0]?.cnt || 0) > 0
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
}

/** 基于 PG + 内存混合的滑动窗口限流 */
const rateMemory = new Map<string, number[]>()
export async function rateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const now = Date.now()
  const windowStart = now - windowMs
  const timestamps = rateMemory.get(key) || []
  const valid = timestamps.filter((t) => t > windowStart)

  if (valid.length >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: valid[0] + windowMs,
    }
  }

  valid.push(now)
  rateMemory.set(key, valid)
  return {
    allowed: true,
    remaining: maxRequests - valid.length,
    resetAt: now + windowMs,
  }
}

/** 爬虫 URL 去重锁: 如果已锁定, 说明正在/已爬取 */
export async function acquireCrawlLock(url: string, ttlMs = 3600_000): Promise<DistributedLock | null> {
  const key = `spider:url:${url}`
  // 先用内存做短期缓存 (减少 PG 压力)
  if (crawlLockMemory.has(key)) return null
  const lock = await acquireLock(key, 0)
  if (lock) {
    crawlLockMemory.add(key)
    setTimeout(() => crawlLockMemory.delete(key), ttlMs)
  }
  return lock
}

const crawlLockMemory = new Set<string>()

/** 域名级速率限制 */
export async function domainRateLimit(domain: string, maxRps = 2): Promise<RateLimitResult> {
  return rateLimit(`spider:domain:${domain}`, maxRps, 1000)
}
