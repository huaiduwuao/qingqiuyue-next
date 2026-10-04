import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Capabilities, Episode, Overview, Shot } from '@/apis/shortdrama';

const api = vi.hoisted(() => ({
  overview: vi.fn(),
  episode: vi.fn(),
  capabilities: vi.fn(),
  startTask: vi.fn(),
  updateProject: vi.fn(),
  updateShot: vi.fn(),
  subtitles: vi.fn(),
}));

vi.mock('@/apis/shortdrama', async (orig) => ({
  ...(await orig<typeof import('@/apis/shortdrama')>()),
  dramaAPI: api,
}));

import PostSection from './PostSection';

const episode = {
  id: 11, project_id: 1, no: 1, title: '重逢', synopsis: '', hook: '', cliffhanger: '', beats: [], script: {}, script_text: 'x', pacing: {}, qc: {},
  status: 'checked', duration_sec: 8,
  finals: { zh: { url: 'https://x/qq-video/f.mp4', vtt_url: 'https://x/qq-text/s.vtt', duration: 200, width: 1080, height: 1920, shots: 2, dubbed: 1, cues: 2, burned: true, bgm: false, at: '2026-09-29T10:00:00+08:00' } },
  distribution: { en: { tiktok: { title: '', caption: 'She came back. He never left.', hashtags: ['shortdrama', 'revenge'] } } },
} as unknown as Episode;

const shot = (no: number, extra: Partial<Shot>): Shot =>
  ({ id: no, project_id: 1, episode_id: 11, no, dialogue: '', frame_url: '', video_url: '', character_ids: [], prop_ids: [], qc_issues: [], ...extra }) as Shot;

const shots = [
  shot(1, { dialogue: '林夏:你怎么在这?', frame_url: 'https://x/f1.png', translations: { en: '林夏:Why are you here?' }, audio: { zh: { url: 'https://x/a.wav', duration: 1.2, voice: 'nova', hash: 'h' } } }),
  shot(2, { dialogue: '陈默:我一直都在。', frame_url: 'https://x/f2.png' }),
  shot(3, {}),
];

const overview = (settings: Record<string, unknown>): Overview =>
  ({ project: { id: 1, title: 't', aspect: '9:16', settings }, characters: [], scenes: [], props: [], episodes: [episode], shot_stats: {}, tasks: [], running: null }) as unknown as Overview;

const caps = (post?: Capabilities['post']): Capabilities =>
  ({ capabilities: { t2i: { available: true, workflows: [], minCost: 0 } }, llm_ready: true, post }) as unknown as Capabilities;

const fullPost: NonNullable<Capabilities['post']> = {
  tts: true, tts_online: true, voices: ['alloy', 'nova'], storage: true, ffmpeg: true, fonts: true,
  languages: [
    { code: 'zh', name: '中文', en: 'Simplified Chinese', cjk: true, dubbing: true },
    { code: 'en', name: 'English', en: 'English', cjk: false, dubbing: true },
    { code: 'es', name: 'Español', en: 'Spanish', cjk: false, dubbing: false },
  ],
  platforms: [
    { code: 'tiktok', name: 'TikTok', lang: '', title_max: 0, caption_max: 300, tags: 5, max_sec: 600 },
    { code: 'youtube_shorts', name: 'YouTube Shorts', lang: '', title_max: 100, caption_max: 500, tags: 5, max_sec: 180 },
  ],
};

function mount() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <PostSection projectId={1} episodeId={11} setEpisodeId={() => undefined} setSection={() => undefined} setFeedbackTarget={() => undefined} />
    </QueryClientProvider>,
  );
}

describe('PostSection', () => {
  beforeEach(() => {
    Object.values(api).forEach((f) => f.mockReset());
    api.episode.mockResolvedValue({ episode, shots });
    api.startTask.mockResolvedValue({ task: {} });
    api.updateProject.mockResolvedValue({ project: {} });
  });

  it('shows the source-language cut and warns about platform length limits', async () => {
    api.overview.mockResolvedValue(overview({ languages: ['en'] }));
    api.capabilities.mockResolvedValue(caps(fullPost));
    mount();
    expect(await screen.findByText('成片 · 中文')).toBeTruthy();
    await screen.findByText('1080×1920');
    expect(screen.getByText('字幕已烧录')).toBeTruthy();
    // 200 秒超过 Shorts 的 180 秒,但没超过 TikTok 的 600 秒
    expect(screen.getByText(/YouTube Shorts 单条上限 3:00/)).toBeTruthy();
    expect(screen.queryByText(/TikTok 单条上限/)).toBeNull();
    // 原声不需要译配
    expect(screen.queryByRole('button', { name: /译配|补译/ })).toBeNull();
  });

  it('switches language: translation progress, per-language actions and copy', async () => {
    api.overview.mockResolvedValue(overview({ languages: ['en'] }));
    api.capabilities.mockResolvedValue(caps(fullPost));
    mount();
    fireEvent.click(await screen.findByRole('tab', { name: 'English' }));
    expect(await screen.findByText('成片 · English')).toBeTruthy();
    expect(screen.getByText(/还没有English版成片/)).toBeTruthy();
    expect(screen.getByText('She came back. He never left.')).toBeTruthy();
    expect(screen.getByText('#shortdrama #revenge')).toBeTruthy();
    // 两句台词只译了一句
    fireEvent.click(screen.getByRole('button', { name: '补译' }));
    await waitFor(() => expect(api.startTask).toHaveBeenCalledWith(1, 'localize', { episode_id: 11, episode_no: 1, lang: 'en', force: false }));
    fireEvent.click(screen.getByRole('button', { name: '合成成片' }));
    await waitFor(() => expect(api.startTask).toHaveBeenCalledWith(1, 'compose', { episode_id: 11, episode_no: 1, lang: 'en' }));
  });

  it('toggles a target language into project settings without dropping other settings', async () => {
    api.overview.mockResolvedValue(overview({ languages: ['en'], style_prefix: 'cinematic' }));
    api.capabilities.mockResolvedValue(caps(fullPost));
    mount();
    fireEvent.click(await screen.findByText('Español'));
    await waitFor(() => expect(api.updateProject).toHaveBeenCalledWith(1, { settings: { languages: ['en', 'es'], style_prefix: 'cinematic' } }));
  });

  it('degrades against a backend without post capabilities', async () => {
    api.overview.mockResolvedValue(overview({}));
    api.capabilities.mockResolvedValue(caps(undefined));
    mount();
    expect(await screen.findByText('成片 · 中文')).toBeTruthy();
    await screen.findByText('1080×1920');
    expect((screen.getByRole('button', { name: '重新合成' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: '补配音' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
