/**
 * Drizzle schema — 对应 docker/sql/postgresql/digital_human_schema.sql
 * 与 PG schema 严格对齐, 改 PG 时同步改这里.
 */

import {
  pgTable, uuid, text, timestamp, jsonb, boolean, integer, bigserial, real,
  customType,
} from 'drizzle-orm/pg-core'

// drizzle 0.45.x 没导出 bytea —— 自定义一个, 等升级后再换官方 API
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() { return 'bytea' },
})

// ============================================
// 1. users
// ============================================
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name'),
  email: text('email').unique(),
  voiceprint: bytea('voiceprint'),
  preferences: jsonb('preferences').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
})

// ============================================
// 2. agents — 动态管理
// ============================================
export const agents = pgTable('agents', {
  id: text('id').primaryKey(),                     // 'digital_human' / 'comfyui_helper'
  displayName: text('display_name').notNull(),
  description: text('description'),
  persona: text('persona').notNull(),
  model: text('model').notNull(),
  voice: text('voice'),
  hermesUrl: text('hermes_url'),
  hermesUsername: text('hermes_username'),
  hermesPassword: text('hermes_password'),
  hermesSessionId: text('hermes_session_id'),
  tools: jsonb('tools').notNull().default([]),
  skills: jsonb('skills').notNull().default([]),
  memoryScope: text('memory_scope').notNull().default('role-based'),
  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ============================================
// 3. conversations
// ============================================
export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  title: text('title'),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp('ended_at', { withTimezone: true }),
  metadata: jsonb('metadata').notNull().default({}),
})

// ============================================
// 4. messages
// ============================================
export const messages = pgTable('messages', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  conversationId: uuid('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  agentId: text('agent_id'),
  role: text('role').notNull(),                     // 'user' | 'assistant' | 'tool' | 'system'
  content: text('content'),
  audioUrl: text('audio_url'),
  emotion: jsonb('emotion'),
  action: text('action'),
  actionParams: jsonb('action_params'),
  visemes: jsonb('visemes'),
  toolCalls: jsonb('tool_calls'),
  toolResults: jsonb('tool_results'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ============================================
// 5. tasks — 异步任务
// ============================================
export const tasks = pgTable('tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  conversationId: uuid('conversation_id').references(() => conversations.id, { onDelete: 'cascade' }),
  agentId: text('agent_id').references(() => agents.id),
  taskType: text('task_type').notNull().default('hermes'), // 'hermes' | 'comfyui' | 'video' | 'spider' | 'pipeline'
  status: text('status').notNull().default('queued'),       // 'queued' | 'running' | 'done' | 'failed' | 'cancelled'
  prompt: text('prompt'),
  payload: jsonb('payload').notNull().default({}),
  context: jsonb('context'),
  result: jsonb('result'),
  hermesRunId: text('hermes_run_id'),
  progress: integer('progress').notNull().default(0),       // 0-100
  stages: jsonb('stages').notNull().default([]),            // [{ name, status, progress, message, ts }]
  error: text('error'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
})

// ============================================
// 6. artifacts
// ============================================
export const artifacts = pgTable('artifacts', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id').references(() => conversations.id, { onDelete: 'cascade' }),
  agentId: text('agent_id').notNull(),
  kind: text('kind').notNull(),                     // 'image' | 'video' | 'audio' | 'file' | 'code'
  url: text('url').notNull(),
  mime: text('mime'),
  filename: text('filename'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ============================================
// 7. voice_events — 唤醒词历史
// ============================================
export const voiceEvents = pgTable('voice_events', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  userId: uuid('user_id').references(() => users.id),
  conversationId: uuid('conversation_id').references(() => conversations.id),
  wakeWord: text('wake_word'),
  transcript: text('transcript'),
  intent: text('intent'),                           // 'chat' | 'command' | 'wake'
  intentPayload: jsonb('intent_payload'),
  confidence: real('confidence'),
  vadScore: real('vad_score'),
  latencyMs: integer('latency_ms'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ============================================
// 8. cron_jobs
// ============================================
export const cronJobs = pgTable('cron_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  agentId: text('agent_id').references(() => agents.id),
  cronExpr: text('cron_expr').notNull(),
  prompt: text('prompt').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  lastRunAt: timestamp('last_run_at', { withTimezone: true }),
  nextRunAt: timestamp('next_run_at', { withTimezone: true }),
  hermesJobId: text('hermes_job_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ============================================
// 9. wake_words
// ============================================
export const wakeWords = pgTable('wake_words', {
  id: text('id').primaryKey(),
  displayName: text('display_name').notNull(),
  phonemes: text('phonemes').notNull(),
  modelPath: text('model_path').notNull(),
  sensitivity: real('sensitivity').default(0.7),
  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// 类型导出
export type User = typeof users.$inferSelect
export type Agent = typeof agents.$inferSelect
export type Conversation = typeof conversations.$inferSelect
export type Message = typeof messages.$inferSelect
export type Task = typeof tasks.$inferSelect
export type Artifact = typeof artifacts.$inferSelect
export type VoiceEvent = typeof voiceEvents.$inferSelect
export type CronJob = typeof cronJobs.$inferSelect
export type WakeWord = typeof wakeWords.$inferSelect