'use client';

// 专题节点(人生感悟的主题 / 分支、文明图谱的领域 / 门类 / 分支)的行为埋点。
// 后端见 qingqiuyue-go internal/handler/topic_hub.go:曝光、打开、点作品、停留 → 真实反馈打分 → 个性化排序。
//
// 与作品埋点(lib/track.ts)不同,这里游客也记:用随机访客 id(不含任何个人信息),
// 只用来让「你常看的领域」排在前面。攒一批再发,页面隐藏时用 keepalive 把剩下的送出去。

import React from 'react';
import { contentClient } from '@/lib/api/client';
import { API_PREFIX } from '@/lib/api/prefix';
import { getAuthToken } from '@/lib/api/auth';
import { visitorId } from '@/lib/track';

export type TopicAction = 'impression' | 'open' | 'work' | 'dwell';

interface TopicEvent {
  key: string;
  action: TopicAction;
  workId?: string;
  dwellMs?: number;
}

let queue: TopicEvent[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
// 同一页面生命周期里,同一节点的曝光只记一次
const seenImpressions = new Set<string>();

function flush(keepalive = false) {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (!queue.length) return;
  const events = queue.slice(0, 60);
  queue = queue.slice(60);
  const body = { vid: visitorId(), events };
  try {
    if (keepalive) {
      const token = getAuthToken();
      void fetch(`${API_PREFIX}/api/content/topic/track`, {
        method: 'POST',
        keepalive: true,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(body),
      }).catch(() => {});
    } else {
      void contentClient.post('/topic/track', body).catch(() => {});
    }
  } catch {
    /* 埋点失败静默 */
  }
  if (queue.length) schedule();
}

function schedule() {
  if (!timer) timer = setTimeout(() => flush(), 2000);
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => flush(true));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush(true);
  });
}

export function topicTrack(key: string, action: TopicAction, extra?: { workId?: string; dwellMs?: number }) {
  if (typeof window === 'undefined' || !key) return;
  if (action === 'impression') {
    if (seenImpressions.has(key)) return;
    seenImpressions.add(key);
  }
  queue.push({ key, action, ...extra });
  schedule();
}

/** 列表渲染出来的节点记一次曝光(按 key 去重)。 */
export function useTopicImpressions(keys: string[]) {
  const sig = keys.join('|');
  React.useEffect(() => {
    if (!sig) return;
    sig.split('|').forEach((k) => topicTrack(k, 'impression'));
  }, [sig]);
}

/** 打开一个节点页:记一次打开,离开时记停留时长(切到后台不算)。 */
export function useTopicOpen(key: string | undefined) {
  React.useEffect(() => {
    if (!key) return;
    topicTrack(key, 'open');
    let visibleSince = document.visibilityState === 'visible' ? Date.now() : 0;
    let total = 0;
    const onVis = () => {
      if (document.visibilityState === 'hidden') {
        if (visibleSince) total += Date.now() - visibleSince;
        visibleSince = 0;
        if (total > 3000) {
          topicTrack(key, 'dwell', { dwellMs: total });
          total = 0;
        }
      } else {
        visibleSince = Date.now();
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      if (visibleSince) total += Date.now() - visibleSince;
      if (total > 3000) topicTrack(key, 'dwell', { dwellMs: total });
    };
  }, [key]);
}

/** 节点页里的作品网格:点卡片时记「在这个节点里点开了哪部作品」(卡片上有 data-work-id)。 */
export function workClickCapture(key: string | undefined) {
  return (e: React.MouseEvent) => {
    if (!key) return;
    const el = (e.target as HTMLElement).closest?.('[data-work-id]');
    const id = el?.getAttribute('data-work-id');
    if (id) topicTrack(key, 'work', { workId: id });
  };
}
