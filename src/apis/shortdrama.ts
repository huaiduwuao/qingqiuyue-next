/**
 * AI 短剧生成工作台(agentmanager-api /shortdrama)。
 *
 * 后端:internal/agentmanager/shortdrama。十个数字员工(编剧 / 角色美术 / 分镜 / 视觉生成 / 节奏 /
 * 质检 / 反馈优化 / 译配 / 后期合成 / 发行运营)按环节(step)以任务(Task)形式运行,产物落成项目 /
 * 角色 / 场景 / 道具 / 剧集 / 镜头实体;出图出片经 gen-api(ComfyUI),配音走 TTS,成片由 ffmpeg 合成。
 *
 * agentmanager 的响应不套 {code,msg,data} 壳,错误是 {error}。事件流用 fetch 读 SSE
 * (EventSource 不能带 Authorization 头)。
 */

import { API_PREFIX } from '@/lib/api/prefix';
import { authFetch } from '@/lib/api/auth';

const BASE = `${API_PREFIX}/api/agentmanager/shortdrama`;

export type Step =
  | 'screenwriter'
  | 'script'
  | 'visual_design'
  | 'storyboard'
  | 'pacing'
  | 'visual_gen'
  | 'qc'
  | 'localize'
  | 'dubbing'
  | 'compose'
  | 'distribute'
  | 'feedback'
  | 'pipeline';

export type TaskStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';

export interface AgentSpec {
  agentId: string;
  name: string;
  description: string;
  persona: string;
  steps: Step[];
  tags: string[];
}

export interface StepInfo {
  step: Step;
  label: string;
  agent: string;
  scope: 'project' | 'episode' | 'any';
}

export interface Capability {
  available: boolean;
  workflows: string[];
  minCost: number;
  /** 不可用原因(ComfyUI 未连接 / 模型没装 / 没有启用的模板),gen-api 实测得出 */
  reason?: string;
}

/** 一个可选语种 */
export interface Lang {
  code: string;
  name: string;
  en: string;
  cjk: boolean;
  /** 当前 TTS 能不能配这个语种;不能的只出字幕 */
  dubbing: boolean;
}

/** 一个分发平台及其文案限制 */
export interface Platform {
  code: string;
  name: string;
  lang: string;
  title_max: number;
  caption_max: number;
  tags: number;
  max_sec: number;
}

/** 后期能力:哪样没配,对应的按钮就不可点 */
export interface PostCapability {
  tts: boolean;
  tts_online: boolean;
  voices: string[] | null;
  storage: boolean;
  ffmpeg: boolean;
  fonts: boolean;
  languages: Lang[];
  platforms: Platform[];
}

export interface Capabilities {
  capabilities: Record<'t2i' | 'i2i' | 't2v' | 'i2v', Capability>;
  llm_ready: boolean;
  /** 旧后端没有这个字段 */
  post?: PostCapability;
  error?: string;
}

/** 某语种的成片 */
export interface FinalCut {
  url: string;
  srt_url?: string;
  vtt_url?: string;
  duration: number;
  width: number;
  height: number;
  shots: number;
  dubbed: number;
  cues: number;
  burned: boolean;
  bgm: boolean;
  size?: number;
  at: string;
}

/** 发到 YouTube / TikTok 的一条记录(按账号) */
export interface SocialPostRecord {
  platform: string;
  account_id: number;
  account_name: string;
  lang: string;
  task_id: number;
  status: 'pending' | 'uploading' | 'publishing' | 'success' | 'failed';
  remote_id?: string;
  remote_url?: string;
  error?: string;
  /** 平台限制提示:应用未过审只能私享 / 仅自己可见、超过 3 分钟不进 Shorts 等 */
  notice?: string;
  privacy?: string;
  retry_count?: number;
  at: string;
}

/** 某平台的发布文案 */
export interface PlatformCopy {
  title: string;
  caption: string;
  hashtags: string[];
  /** YouTube / TikTok 的发布记录,键是平台账号 id */
  posts?: Record<string, SocialPostRecord>;
}

export interface SocialPostResult {
  created: number;
  reused: number;
  skipped: string[] | null;
  errors: string[] | null;
  distribution: Episode['distribution'];
}

/** 某语种的配音 */
export interface ShotAudio {
  url: string;
  duration: number;
  voice: string;
  hash: string;
}

export interface Project {
  id: number;
  user_id: number;
  title: string;
  intent: string;
  genre: string;
  style: string;
  logline: string;
  synopsis: string;
  audience: string;
  tone: string;
  episodes: number;
  ep_seconds: number;
  aspect: string;
  width: number;
  height: number;
  settings: Record<string, unknown>;
  status: 'draft' | 'in_progress' | 'done';
  stage: string;
  cover_url: string;
  /** 发布成的作品 id(module_content,SHORT_DRAMA);0 = 还没发布。再次发布更新同一件作品 */
  content_id: number;
  published_at: string | null;
  /** 各目标语种的项目文案与人名对照表 */
  localized?: Record<string, { title?: string; logline?: string; synopsis?: string; names?: Record<string, string> }> | null;
  created_at: string;
  updated_at: string;
}

/** 发布结果 */
export interface PublishResult {
  content_id: number;
  status: string;
  episodes: number;
  shots: number;
  missing_render: number;
  /** 用了合成成片的集数 */
  finals?: number;
}

export interface Character {
  id: number;
  project_id: number;
  name: string;
  role: string;
  age: string;
  gender: string;
  bio: string;
  personality: string;
  arc: string;
  appearance: string;
  visual_prompt: string;
  negative_prompt: string;
  palette: string;
  outfit: string;
  voice_style: string;
  /** 配音音色;空 = 按性别自动 */
  voice?: string;
  /** 和哪个角色同一张脸(0 = 独立长相);定妆照用那个角色的定妆照改 */
  based_on_id?: number;
  ref_image_url: string;
  seed: number;
  sort_order: number;
  status: string;
}

export interface Scene {
  id: number;
  project_id: number;
  name: string;
  description: string;
  time_of_day: string;
  mood: string;
  visual_prompt: string;
  negative_prompt: string;
  ref_image_url: string;
  seed: number;
  sort_order: number;
  status: string;
}

export interface Prop {
  id: number;
  project_id: number;
  name: string;
  description: string;
  significance: string;
  visual_prompt: string;
  ref_image_url: string;
  sort_order: number;
  status: string;
}

export interface ScriptLine {
  character: string;
  text: string;
  emotion?: string;
}

export interface ScriptScene {
  scene: string;
  time?: string;
  characters?: string[];
  action?: string;
  lines?: ScriptLine[];
}

export interface Episode {
  id: number;
  project_id: number;
  no: number;
  title: string;
  synopsis: string;
  hook: string;
  cliffhanger: string;
  beats: string[];
  script: { title?: string; duration_sec?: number; scenes?: ScriptScene[] };
  script_text: string;
  pacing: {
    curve?: { shot_no: number; tension: number; beat: string; duration_sec: number }[];
    payoffs?: { shot_no: number; why: string }[];
    notes?: string;
    hook_ok?: boolean;
    at?: string;
  };
  qc: { score?: number; summary?: string; issues?: QCIssue[]; flagged?: number; at?: string };
  status: string;
  duration_sec: number;
  /** 后期产物,键是语种代码 */
  localized?: Record<string, { title?: string; synopsis?: string; hook?: string; cliffhanger?: string }> | null;
  finals?: Record<string, FinalCut> | null;
  distribution?: Record<string, Record<string, PlatformCopy>> | null;
}

export interface QCIssue {
  shot_no: number;
  type: string;
  severity: 'low' | 'medium' | 'high';
  message: string;
  suggestion?: string;
  source?: 'rule' | 'agent';
}

export type ShotStatus = 'draft' | 'generating' | 'done' | 'failed' | 'qc_flagged' | 'approved';

export interface Shot {
  id: number;
  project_id: number;
  episode_id: number;
  no: number;
  scene_id: number;
  character_ids: number[];
  prop_ids: number[];
  action: string;
  dialogue: string;
  shot_type: string;
  camera_move: string;
  angle: string;
  duration_sec: number;
  emotion: string;
  /** 两层分镜:beat 是剧本里的一段(「镜头 N」),sub_no 是段内第几个分镜;旧数据 beat = 0 */
  beat?: number;
  /** 这一段对应的剧本原文,主体写成 @[名字] */
  beat_text?: string;
  sub_no?: number;
  /** 构图,取值见 COMPOSITIONS */
  composition?: string;
  /** 光影(中文) */
  lighting?: string;
  /** 音效(中文) */
  sfx?: string;
  beat_type: string;
  tension: number;
  image_prompt: string;
  video_prompt: string;
  final_prompt: string;
  negative_prompt: string;
  frame_url: string;
  video_url: string;
  ref_image_url: string;
  seed: number;
  gen_job_id: number;
  video_job_id: number;
  gen_error: string;
  qc_issues: QCIssue[];
  qc_score: number;
  status: ShotStatus;
  version: number;
  /** 台词译文,键是语种代码;行结构与 dialogue 一致 */
  translations?: Record<string, string> | null;
  audio?: Record<string, ShotAudio> | null;
}

export interface TaskLog {
  ts: string;
  level: 'info' | 'warn' | 'error';
  text: string;
}

export interface Task {
  id: number;
  project_id: number;
  episode_id: number;
  user_id: number;
  step: Step;
  agent: string;
  title: string;
  status: TaskStatus;
  progress: number;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  logs: TaskLog[];
  error: string;
  parent_id: number;
  created_at: string;
  started_at?: string;
  finished_at?: string;
}

export interface Revision {
  id: number;
  project_id: number;
  target_type: string;
  target_id: number;
  instruction: string;
  plan: Record<string, unknown>;
  task_id: number;
  status: string;
  created_at: string;
}

export interface Overview {
  project: Project;
  characters: Character[];
  scenes: Scene[];
  props: Prop[];
  episodes: Episode[];
  shot_stats: Record<string, number>;
  /** 每集镜头进度,键是 episode id;旧后端没有 */
  episode_stats?: Record<string, EpisodeStat>;
  tasks: Task[];
  running: Task | null;
}

export interface EpisodeStat {
  shots: number;
  /** 已有画面 */
  framed: number;
  /** 已出视频 */
  videos: number;
}

export interface DramaEvent {
  type: 'task' | 'entity' | 'ready';
  data: unknown;
  at: number;
}

export function isTaskTerminal(s: TaskStatus): boolean {
  return s === 'succeeded' || s === 'failed' || s === 'cancelled';
}


async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await authFetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers as Record<string, string>) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || `HTTP ${res.status}`);
  }
  return res.json();
}

const json = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body) });
const put = (body: unknown): RequestInit => ({ method: 'PUT', body: JSON.stringify(body) });
const del: RequestInit = { method: 'DELETE' };

export const dramaAPI = {
  agents: () => call<{ agents: AgentSpec[]; llm_ready: boolean }>('/agents'),
  steps: () => call<{ steps: StepInfo[] }>('/steps'),
  capabilities: () => call<Capabilities>('/capabilities'),
  /** 用某个音色念一句(默认一句自我介绍),返回可直接播放的音频链接;同音色同句子只合成一次 */
  voicePreview: (voice: string, text?: string) =>
    call<{ url?: string; error?: string }>(`/voices/preview?voice=${encodeURIComponent(voice)}${text ? `&text=${encodeURIComponent(text)}` : ''}`),

  /** 风格库里上架的风格卡片(管理员维护) */
  styles: async () => (await call<{ list: DramaStyle[] }>('/styles')).list ?? [],

  listProjects: async () => (await call<{ list: Project[] }>('/projects')).list ?? [],
  /** style_id 选风格库里的风格,后端把它的提示词和出图参数拷进项目 */
  createProject: (body: Partial<Project> & { style_id?: number }, autostart?: 'pipeline' | 'screenwriter') =>
    call<{ project: Project; task: Task | null }>(`/projects${autostart ? `?autostart=${autostart}` : ''}`, json(body)),
  overview: (id: number) => call<Overview>(`/projects/${id}`),
  /** style_id 换风格库里的风格(只影响之后生成的图和视频) */
  updateProject: (id: number, fields: Partial<Project> & { style_id?: number }) => call<{ project: Project }>(`/projects/${id}`, put(fields)),
  deleteProject: (id: number) => call<{ status: string }>(`/projects/${id}`, del),
  /** 发布/更新为标准作品(走 content-api 投稿接口,进内容审核) */
  publish: (id: number) => call<PublishResult>(`/projects/${id}/publish`, { method: 'POST' }),

  listTasks: async (pid: number, limit = 50) => call<{ list: Task[]; running: number }>(`/projects/${pid}/tasks?limit=${limit}`),
  startTask: (pid: number, step: Step, input: Record<string, unknown> = {}) =>
    call<{ task: Task }>(`/projects/${pid}/tasks`, json({ step, input })),
  feedback: (pid: number, body: { target_type: string; target_id: number; instruction: string }) =>
    call<{ task: Task }>(`/projects/${pid}/feedback`, json(body)),
  revisions: async (pid: number) => (await call<{ list: Revision[] }>(`/projects/${pid}/revisions`)).list ?? [],
  task: (id: number) => call<{ task: Task }>(`/tasks/${id}`),
  cancelTask: (id: number) => call<{ status: string }>(`/tasks/${id}/cancel`, { method: 'POST' }),

  listCharacters: async (pid: number) => (await call<{ list: Character[] }>(`/projects/${pid}/characters`)).list ?? [],
  createCharacter: (pid: number, body: Partial<Character>) => call<{ character: Character }>(`/projects/${pid}/characters`, json(body)),
  updateCharacter: (id: number, fields: Partial<Character>) => call<{ character: Character }>(`/characters/${id}`, put(fields)),
  deleteCharacter: (id: number) => call<{ status: string }>(`/characters/${id}`, del),

  listScenes: async (pid: number) => (await call<{ list: Scene[] }>(`/projects/${pid}/scenes`)).list ?? [],
  createScene: (pid: number, body: Partial<Scene>) => call<{ scene: Scene }>(`/projects/${pid}/scenes`, json(body)),
  updateScene: (id: number, fields: Partial<Scene>) => call<{ scene: Scene }>(`/scenes/${id}`, put(fields)),
  deleteScene: (id: number) => call<{ status: string }>(`/scenes/${id}`, del),

  listProps: async (pid: number) => (await call<{ list: Prop[] }>(`/projects/${pid}/props`)).list ?? [],
  createProp: (pid: number, body: Partial<Prop>) => call<{ prop: Prop }>(`/projects/${pid}/props`, json(body)),
  updateProp: (id: number, fields: Partial<Prop>) => call<{ prop: Prop }>(`/props/${id}`, put(fields)),
  deleteProp: (id: number) => call<{ status: string }>(`/props/${id}`, del),

  listEpisodes: async (pid: number) => (await call<{ list: Episode[] }>(`/projects/${pid}/episodes`)).list ?? [],
  createEpisode: (pid: number, body: Partial<Episode>) => call<{ episode: Episode }>(`/projects/${pid}/episodes`, json(body)),
  episode: (id: number) => call<{ episode: Episode; shots: Shot[] }>(`/episodes/${id}`),
  updateEpisode: (id: number, fields: Partial<Episode>) => call<{ episode: Episode }>(`/episodes/${id}`, put(fields)),
  deleteEpisode: (id: number) => call<{ status: string }>(`/episodes/${id}`, del),

  listShots: async (epId: number) => (await call<{ list: Shot[] }>(`/episodes/${epId}/shots`)).list ?? [],
  createShot: (epId: number, body: Partial<Shot>) => call<{ shot: Shot }>(`/episodes/${epId}/shots`, json(body)),
  reorderShots: (epId: number, ids: number[]) => call<{ status: string }>(`/episodes/${epId}/shots/reorder`, json({ ids })),
  updateShot: (id: number, fields: Partial<Shot>) => call<{ shot: Shot }>(`/shots/${id}`, put(fields)),
  deleteShot: (id: number) => call<{ status: string }>(`/shots/${id}`, del),

  /** 字幕文本(按当前镜头与配音时长现算,和成片同一条时间线) */
  /** 发布到 YouTube / TikTok:只由用户点按钮触发;上传在 core-api 里异步进行,进度用 socialRefresh 拉 */
  socialPost: (
    epId: number,
    body: { lang: string; platforms?: string[]; account_ids?: number[]; privacy?: string; force?: boolean },
  ) => call<SocialPostResult>(`/episodes/${epId}/social/post`, json(body)),
  /** 把进行中的发布记录同步成最新状态,返回最新 distribution */
  socialRefresh: (epId: number) =>
    call<{ distribution: Episode['distribution'] }>(`/episodes/${epId}/social/refresh`, { method: 'POST' }),
  subtitles: async (epId: number, lang: string, format: 'srt' | 'vtt' = 'srt'): Promise<string> => {
    const res = await authFetch(`${BASE}/episodes/${epId}/subtitles?lang=${encodeURIComponent(lang)}&format=${format}`);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error((body as { error?: string }).error || `HTTP ${res.status}`);
    }
    return res.text();
  },
};

/** 解析 SSE 文本块(和 runs/api.ts 同一套约定)。 */
export function parseDramaSSE(buffer: string): { events: DramaEvent[]; rest: string } {
  const blocks = buffer.replace(/\r\n/g, '\n').split('\n\n');
  const rest = blocks.pop() ?? '';
  const events: DramaEvent[] = [];
  for (const block of blocks) {
    let type = '';
    const data: string[] = [];
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) type = line.slice(6).trim();
      else if (line.startsWith('data:')) data.push(line.slice(5).trimStart());
    }
    if (data.length === 0) continue;
    try {
      const parsed = JSON.parse(data.join('\n'));
      events.push({ type: (type || parsed.type || 'entity') as DramaEvent['type'], data: parsed.data ?? parsed, at: parsed.at ?? Date.now() });
    } catch {
      /* 坏帧跳过 */
    }
  }
  return { events, rest };
}

/**
 * 订阅项目事件流。断线按指数退避重连,signal 取消时结束。
 * 事件:task(任务快照)/ entity({kind,id,deleted?,episode_id?})。
 */
export async function streamProjectEvents(
  projectId: number,
  onEvent: (e: DramaEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  let failures = 0;
  while (!signal.aborted) {
    try {
      const res = await authFetch(`${BASE}/projects/${projectId}/events`, { signal });
      if (!res.ok || !res.body) throw new Error(`事件流连接失败 HTTP ${res.status}`);
      failures = 0;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parsed = parseDramaSSE(buf);
        buf = parsed.rest;
        parsed.events.forEach(onEvent);
      }
    } catch {
      if (signal.aborted) return;
      failures++;
    }
    await new Promise((r) => setTimeout(r, Math.min(1000 * 2 ** failures, 15000)));
  }
}

/** gen-api 工作流模板(管理员维护),走 /api/ai。 */
export interface GenWorkflowAdmin {
  id: number;
  name: string;
  description: string;
  contentType: string;
  kind: 't2i' | 'i2i' | 't2v' | 'i2v';
  workflowJson: string;
  costCredits: number;
  status: 'active' | 'draft' | 'disabled';
  sortOrder: number;
  placeholder: boolean;
  /** 后端没有参数时给的是 null,不是空数组 */
  placeholders: string[] | null;
}

async function aiCall<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await authFetch(API_PREFIX + `/api/ai${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers as Record<string, string>) },
  });
  const body = (await res.json().catch(() => ({}))) as { code?: number; msg?: string; data?: T };
  if (!res.ok || (body.code !== undefined && body.code !== 0 && body.code !== 200)) {
    throw new Error(body.msg || `HTTP ${res.status}`);
  }
  return body.data as T;
}

export const genAdminAPI = {
  list: () => aiCall<GenWorkflowAdmin[]>('/generate/admin/workflows'),
  create: (body: Partial<GenWorkflowAdmin>) => aiCall<GenWorkflowAdmin>('/generate/admin/workflows', json(body)),
  update: (id: number, body: Partial<GenWorkflowAdmin>) => aiCall<GenWorkflowAdmin>(`/generate/admin/workflows/${id}`, put(body)),
};

/** 风格卡片(用户看到的部分) */
export interface DramaStyle {
  id: number;
  name: string;
  description: string;
  cover_url: string;
}

/** 风格完整定义(管理员):prompt/negative 进项目 settings 的 style_prefix/global_negative,settings 原样并入 */
export interface DramaStyleAdmin extends DramaStyle {
  prompt: string;
  negative: string;
  settings: Record<string, unknown>;
  sort_order: number;
  status: 'active' | 'disabled';
}

export const styleAdminAPI = {
  list: async () => (await call<{ list: DramaStyleAdmin[] }>('/admin/styles')).list ?? [],
  save: (s: Partial<DramaStyleAdmin>) => call<{ style: DramaStyleAdmin }>(s.id ? `/admin/styles/${s.id}` : '/admin/styles', s.id ? put(s) : json(s)),
  remove: (id: number) => call<{ status: string }>(`/admin/styles/${id}`, del),
};

/** 一部剧的钻石预估(区间)。照分镜员工的拆法:单镜头 2~5 秒,每个镜头一张图,另有角色定妆照与场景概念图;
 *  出片(图生视频)是分镜页单独点的,每个镜头一段,另算。单价取各种类最便宜的已启用模板(和后端选模板一致)。
 *  实际按每次出图/出片扣,失败自动退回。 */
export interface CostEstimate {
  /** 一键生成(只出图) */
  image: [number, number];
  imageCount: [number, number];
  /** 再把每个镜头做成视频;0 = 没有可用的图生视频模板 */
  video: [number, number];
}

export function estimateCost(caps: Capabilities | undefined, episodes: number, epSeconds: number): CostEstimate | null {
  const c = caps?.capabilities;
  const t2i = c?.t2i?.available ? c.t2i.minCost : 0;
  const shot = c?.i2i?.available ? c.i2i.minCost : t2i;
  const vid = c?.i2v?.available ? c.i2v.minCost : 0;
  if (!t2i && !shot) return null;
  const shots: [number, number] = [Math.ceil(epSeconds / 5) * episodes, Math.ceil(epSeconds / 2) * episodes];
  // 定妆照:主要角色约 3~6 个;场景概念图:约每集 1~2 个,至少 2 个
  const setup: [number, number] = [3 + Math.max(2, episodes), 6 + Math.max(2, episodes * 2)];
  return {
    image: [setup[0] * t2i + shots[0] * shot, setup[1] * t2i + shots[1] * shot],
    imageCount: [setup[0] + shots[0], setup[1] + shots[1]],
    video: [shots[0] * vid, shots[1] * vid],
  };
}

export const SHOT_TYPES: Record<string, string> = {
  wide: '远景', full: '全景', medium: '中景', medium_close_up: '近景', close_up: '特写', extreme_close_up: '大特写', over_shoulder: '过肩', pov: '主观', two_shot: '双人',
};
export const COMPOSITIONS: Record<string, string> = {
  center: '中心构图', thirds: '三分法', symmetric: '对称构图', diagonal: '对角线构图', frame: '框架构图', leading_lines: '引导线构图', foreground: '前景遮挡', negative_space: '留白构图',
};
export const CAMERA_MOVES: Record<string, string> = {
  static: '固定', pan: '横摇', tilt: '俯仰', dolly_in: '推', dolly_out: '拉', tracking: '跟', handheld: '手持', zoom: '变焦', crane: '升降',
};
export const ANGLES: Record<string, string> = { eye_level: '平视', low: '仰拍', high: '俯拍', dutch: '荷兰角' };
export const BEATS: Record<string, string> = { setup: '铺垫', rising: '上升', turn: '转折', payoff: '爽点', cliffhanger: '悬念', breather: '喘息' };
export const STEP_LABELS: Record<Step, string> = {
  screenwriter: '剧本框架', script: '分场剧本', visual_design: '视觉设定', storyboard: '分镜', pacing: '节奏',
  visual_gen: '出图/出片', qc: '质检', localize: '译配', dubbing: '配音', compose: '成片合成', distribute: '分发文案',
  feedback: '反馈优化', pipeline: '一键生成',
};
export const AGENT_LABELS: Record<string, string> = {
  'drama-screenwriter': '编剧', 'drama-character': '角色/美术', 'drama-storyboard': '分镜师', 'drama-visual': '视觉生成',
  'drama-pacing': '节奏控制', 'drama-qc': '质检', 'drama-feedback': '反馈优化',
  'drama-localizer': '译配', 'drama-editor': '后期合成', 'drama-publisher': '发行运营',
};

/** 分镜的显示编号:分了组的是「镜头-分镜」(3-2),旧数据是「镜头 N」 */
export function shotLabel(s: Pick<Shot, 'no' | 'beat' | 'sub_no'>): string {
  return s.beat ? `分镜 ${s.beat}-${s.sub_no || 1}` : `镜头 ${s.no}`;
}
