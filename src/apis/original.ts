import { accountClient } from '@/lib/api/client';

// 原创保护(后端 internal/originalapp):存证、站内疑似侵权、下架申诉与白名单。

export interface OriginalCert {
  id: string;
  contentId: string;
  title: string;
  cover: string;
  contentType: string;
  fingerprint: string; // sha256 hex
  certificateNo: string;
  status: 'monitoring' | 'paused';
  registeredAt: number;
  /** 待处理 + 申诉中的疑似侵权数 */
  infringeCount: number;
  totalViews: number;
}

export interface OriginalCase {
  id: string;
  workId: string;
  workTitle: string;
  workCover: string;
  certificateNo: string;
  suspectContentId: string;
  suspectTitle: string;
  suspectCover: string;
  infractorId: string;
  infractorName: string;
  views: number;
  status: 'pending' | 'ignored' | 'submitted' | 'takenDown' | 'rejected';
  reason?: string;
  reviewNote?: string;
  detectedAt: number;
  updatedAt: number;
}

export interface WhitelistEntry {
  userId: string;
  name: string;
}

const list = <T>(res: any): T[] => res?.list ?? res?.records ?? [];

export async function listCerts(): Promise<OriginalCert[]> {
  return list<OriginalCert>(await accountClient('/creator/original/protected'));
}

/** 疑似侵权:后端会先对监测中的存证做一次站内同名比对 */
export async function listSuspects(): Promise<OriginalCase[]> {
  return list<OriginalCase>(await accountClient('/creator/original/infringements'));
}

export async function listTakedowns(): Promise<OriginalCase[]> {
  return list<OriginalCase>(await accountClient('/creator/original/takedowns'));
}

export async function applyCerts(contentIds: string[]) {
  return accountClient.post('/original/apply', { contentIds });
}

export async function setCertStatus(id: string, status: 'monitoring' | 'paused') {
  return accountClient.post('/original/status', { id, status });
}

export async function removeCert(id: string) {
  return accountClient.post('/original/remove', { id });
}

/** 发起下架申诉:进入平台内容举报审核 */
export async function appealCase(id: string, reason: string) {
  return accountClient.post('/original/appeal', { id, reason });
}

export async function caseAction(id: string, action: 'ignore' | 'whitelist') {
  return accountClient.post('/original/case', { id, action });
}

export async function listWhitelist(): Promise<WhitelistEntry[]> {
  return list<WhitelistEntry>(await accountClient('/original/whitelist'));
}

export async function removeWhitelist(userId: string) {
  return accountClient.post('/original/whitelist/remove', { userId });
}
