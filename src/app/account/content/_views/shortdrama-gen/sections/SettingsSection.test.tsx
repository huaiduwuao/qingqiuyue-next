import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Overview } from '@/apis/shortdrama';

const api = vi.hoisted(() => ({
  overview: vi.fn(),
  capabilities: vi.fn(),
  updateProject: vi.fn(),
}));

vi.mock('@/apis/shortdrama', async (orig) => ({
  ...(await orig<typeof import('@/apis/shortdrama')>()),
  dramaAPI: api,
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuthority: () => ({ isAdmin: false }) }));

import SettingsSection from './SettingsSection';

const overview = (title: string, extra: Partial<Overview> = {}): Overview =>
  ({
    project: { id: 1, title, intent: '', genre: '', style: '', tone: '', audience: '', episodes: 3, ep_seconds: 60, aspect: '9:16', width: 768, height: 1344, settings: {}, stage: 'script' },
    characters: [], scenes: [], props: [], episodes: [], shot_stats: {}, tasks: [], running: null,
    ...extra,
  }) as unknown as Overview;

function mount(qc: QueryClient) {
  return render(
    <QueryClientProvider client={qc}>
      <SettingsSection projectId={1} episodeId={0} setEpisodeId={() => undefined} setSection={() => undefined} setFeedbackTarget={() => undefined} />
    </QueryClientProvider>,
  );
}

describe('SettingsSection', () => {
  beforeEach(() => {
    Object.values(api).forEach((f) => f.mockReset());
    api.capabilities.mockResolvedValue({ capabilities: {}, llm_ready: true });
  });

  it('任务运行中 overview 刷新,不冲掉正在改的项目设置;服务端真改了才回填', async () => {
    api.overview.mockResolvedValue(overview('原标题'));
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    mount(qc);
    const title = (await screen.findByLabelText('标题')) as HTMLInputElement;
    expect(title.value).toBe('原标题');
    fireEvent.change(title, { target: { value: '正在改的标题' } });

    // 别的任务在跑:overview 换了新对象(任务列表、阶段变了),可编辑字段没变
    api.overview.mockResolvedValue(overview('原标题', { shot_stats: { done: 2 }, tasks: [{ id: 9 }] as unknown as Overview['tasks'] }));
    await qc.invalidateQueries();
    await waitFor(() => expect(api.overview).toHaveBeenCalledTimes(2));
    await new Promise((r) => setTimeout(r, 20));
    expect(title.value).toBe('正在改的标题');

    api.overview.mockResolvedValue(overview('别处改的标题'));
    await qc.invalidateQueries();
    await waitFor(() => expect(title.value).toBe('别处改的标题'));
  });
});
