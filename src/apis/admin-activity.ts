import { adminClient } from '@/lib/api/client';

// 运营后台:创作者活动(/api/core/admin/activity/*,内容运营角色可用)。

export interface ActivityPrize {
  rank: string;
  count: number;
  reward: string;
  color: string;
}

export interface AdminActivity {
  id?: number;
  title: string;
  subtitle: string;
  desc: string;
  category: 'official' | 'topic' | 'challenge' | 'brand' | 'support';
  gradient: string;
  organizer: string;
  rules: string[];
  requirements: string[];
  prizes: ActivityPrize[];
  totalReward: string;
  totalRewardValue: number;
  signupAt: string; // ISO
  startAt: string;
  endAt: string;
  resultAt: string;
  published: boolean;
  status?: 'upcoming' | 'signup' | 'active' | 'judging' | 'ended';
  signupCount?: number;
  submissionCount?: number;
}

export interface AdminSubmission {
  id: number;
  activityId: number;
  contentId: number;
  userId: number;
  userName: string;
  workTitle: string;
  views: number;
  likes: number;
  caption: string;
  result: '' | 'shortlist' | 'won' | 'lost';
  prizeRank: string;
  reward: string;
  createdAt: string;
}

type ListResp<T> = { list?: T[] };

export async function listActivities(): Promise<AdminActivity[]> {
  const res = (await adminClient('/admin/activity')) as ListResp<AdminActivity>;
  return res?.list ?? [];
}

export async function saveActivity(a: AdminActivity) {
  return a.id
    ? adminClient(`/admin/activity/${a.id}`, { method: 'PUT', data: a })
    : adminClient('/admin/activity', { method: 'POST', data: a });
}

export async function listSubmissions(activityId: number): Promise<AdminSubmission[]> {
  const res = (await adminClient(`/admin/activity/${activityId}/submissions`)) as ListResp<AdminSubmission>;
  return res?.list ?? [];
}

export async function judgeSubmission(id: number, body: { result: string; prizeRank?: string; reward?: string }) {
  return adminClient(`/admin/activity/submissions/${id}`, { method: 'PUT', data: body });
}
