/**
 * 爬虫登录凭据 + 接入助手(后端 qingqiuyue-go internal/crawler/credential.go、source_setup.go)。
 *
 * 凭据只写不读:列表只有名称 / 域名 / 末 4 位,没有任何接口能把 Cookie 取回来。
 * 接入助手的草稿由数字人起草、试跑;保存(apply)只在草稿卡片上由人点。
 */

import { spiderClient } from '@/lib/api/client';

export interface CrawlCredential {
  id: number;
  name: string;
  domain: string;
  kind: string;
  note: string;
  has_value: boolean;
  hint: string;
  create_time: string;
  update_time: string;
  last_used_at: string | null;
}

export interface CredentialList {
  list: CrawlCredential[];
  /** 服务端配了加密密钥;false 时只能看,不能录入 */
  enabled: boolean;
}

export interface CredentialWrite {
  name: string;
  domain: string;
  /** 新建必填;编辑时留空 = 不改 */
  value: string;
  note: string;
}

export function listCredentials(domain?: string): Promise<CredentialList> {
  return spiderClient('/credentials', { params: domain ? { domain } : undefined }) as Promise<CredentialList>;
}

export function createCredential(body: CredentialWrite): Promise<CrawlCredential> {
  return spiderClient('/credentials', { method: 'POST', data: body }) as Promise<CrawlCredential>;
}

export function updateCredential(id: number, body: CredentialWrite): Promise<CrawlCredential> {
  return spiderClient(`/credentials/${id}`, { method: 'PUT', data: body }) as Promise<CrawlCredential>;
}

export function deleteCredential(id: number): Promise<unknown> {
  return spiderClient(`/credentials/${id}`, { method: 'DELETE' });
}

export interface SourceDraft {
  id: string;
  url: string;
  domain: string;
  category: string;
  kind: 'book' | 'video' | string;
  profile: unknown;
  credential_id: number;
  sample_title: string;
  sample_author: string;
  sample_year: string;
  ok: boolean;
  report: Record<string, unknown> | null;
  status: 'draft' | 'applied' | 'discarded' | string;
  source_id: string;
  template_id: string;
  create_time: string;
  update_time: string;
}

export function getSourceDraft(id: string): Promise<SourceDraft> {
  return spiderClient(`/source-setup/drafts/${encodeURIComponent(id)}`) as Promise<SourceDraft>;
}

export function applySourceDraft(id: string): Promise<SourceDraft> {
  return spiderClient(`/source-setup/drafts/${encodeURIComponent(id)}/apply`, { method: 'POST' }) as Promise<SourceDraft>;
}

export function discardSourceDraft(id: string): Promise<SourceDraft> {
  return spiderClient(`/source-setup/drafts/${encodeURIComponent(id)}/discard`, { method: 'POST' }) as Promise<SourceDraft>;
}

/** 试跑报告的一行摘要(卡片与测试共用)。 */
export function summarizeDraftReport(d: Pick<SourceDraft, 'kind' | 'report'>): string[] {
  const r = (d.report ?? {}) as Record<string, any>;
  const lines: string[] = [];
  const search = r.search as { count?: number; error?: string } | undefined;
  if (search) lines.push(search.error ? `搜索出错:${search.error}` : `搜索到 ${search.count ?? 0} 条`);
  if (r.resolve_error) lines.push(String(r.resolve_error));
  if (r.resolved?.title) lines.push(`定位到「${r.resolved.title}」${r.resolved.year ? `(${r.resolved.year})` : ''}`);
  if (d.kind === 'book') {
    const cat = r.catalog as { count?: number; error?: string; first?: { title?: string }; last?: { title?: string } } | undefined;
    if (cat) lines.push(cat.error ? `目录出错:${cat.error}` : `目录 ${cat.count ?? 0} 章:${cat.first?.title ?? ''} … ${cat.last?.title ?? ''}`);
    const ch = r.chapter as { title?: string; length?: number; error?: string } | undefined;
    if (ch) lines.push(ch.error ? `第 1 章出错:${ch.error}` : `第 1 章「${ch.title ?? ''}」${ch.length ?? 0} 字节`);
  } else {
    const eps = r.episodes as { count?: number; error?: string; first?: { title?: string }[] } | undefined;
    if (eps) lines.push(eps.error ? `分集出错:${eps.error}` : `共 ${eps.count ?? 0} 集:${(eps.first ?? []).map((e) => e.title).filter(Boolean).join('、')}`);
  }
  return lines;
}
