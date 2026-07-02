/**
 * DB 客户端 — 单例 pool
 *
 * 连接 postgres-dh 容器 (Docker 网络内 DNS 名) 或 host (localhost)
 * env: DATABASE_URL 默认 "postgresql://qingqiuyue:qingqiuyue123@localhost:5432/digital_human"
 */

import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import * as schema from './schema'

const DATABASE_URL = process.env.DATABASE_URL
  || 'postgresql://qingqiuyue:qingqiuyue123@localhost:5432/digital_human'

declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined
}

const pool = global.__pgPool ?? new Pool({
  connectionString: DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
})

if (process.env.NODE_ENV !== 'production') global.__pgPool = pool

export const db = drizzle(pool, { schema })
export { pool, schema }

/**
 * 健康检查 + 简单 ping
 */
export async function pingDb(): Promise<boolean> {
  try {
    const r = await pool.query('SELECT 1 AS ok')
    return r.rows[0]?.ok === 1
  } catch (e) {
    console.error('[db] ping failed:', (e as Error).message)
    return false
  }
}