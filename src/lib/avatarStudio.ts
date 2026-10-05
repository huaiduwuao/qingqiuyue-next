/**
 * 数字人工作台(/system/digital-human)的接口与纯函数。字段对齐 Go internal/avatarapp/studio.go。
 *
 * realtime-api 的回包:成功 {code:200,msg:"OK",data},失败要么是非 2xx + {code,msg},
 * 要么是 200 + {code:1,msg}(素材上传失败走这条)。两种都要当失败处理。
 */
import { API_PREFIX } from '@/lib/api/prefix';
import { authFetch } from '@/lib/api/auth';
import { normalizeClips, type ClipEntry } from '@/digital-human/clip-avatar';

export type JobStatus = 'queued' | 'running' | 'done' | 'failed' | 'canceled';

export interface DHAsset {
  id: string;
  name: string;
  mode: '3dgs' | '2d';
  status: 'ready' | 'training' | 'failed';
  active: boolean;
  published: boolean;
  thumbnail: string;
  sizeMB: number;
  joints: number;
  hasFlame: boolean;
  /** 资产目录公开基址(以 / 结尾);2D 资产目录里有 clips.json */
  assetUrl: string;
  createdAt: string;
}

export interface DHJob {
  id: string;
  name: string;
  method: string;
  source?: string;
  status: JobStatus;
  stage: string;
  progress: number;
  logs: string[] | null;
  assetId?: string;
  createdAt: string;
  failReason?: string;
  /** 缺什么才能跑:AVATAR_TRAIN_CMD / ffmpeg / MINIO_ENDPOINT … */
  needs?: string;
  startedAt?: string;
  finishedAt?: string;
}

export interface DHMaterial {
  id: string;
  name: string;
  type: 'video' | 'clip' | 'image' | string;
  sizeMB: number;
  status: string;
  durationSec: number;
  usedBy: string;
  url?: string;
  key?: string;
  createdAt: string;
}

export interface TrainMethodCap {
  key: string;
  label: string;
  mode: '3dgs' | '2d';
  needsGpu: boolean;
  available: boolean;
  reason: string;
  needs: string;
}

export interface StudioCapabilities {
  trainCmd: boolean;
  ffmpeg: boolean;
  storage: boolean;
  methods: TrainMethodCap[];
}

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  queued: '排队中',
  running: '运行中',
  done: '已完成',
  failed: '失败',
  canceled: '已取消',
};

export const STAGE_LABELS: Record<string, string> = {
  capture: '采集素材',
  preprocess: '预处理',
  train: '训练',
  export: '导出',
  deploy: '部署',
};

/** 缺失项 → 给运维看的一句话说明 */
export const NEEDS_HINTS: Record<string, string> = {
  AVATAR_TRAIN_CMD: '没有接入 GPU 训练节点:在 realtime-api 配置 AVATAR_TRAIN_CMD 指向 GPU 训练脚本(契约见 docker-compose.yml 注释)',
  ffmpeg: 'realtime-api 里没有 ffmpeg,非 MP4/WebM 素材无法转码、也截不了封面',
  MINIO_ENDPOINT: '对象存储未初始化:检查 realtime-api 的 MINIO_* 配置',
};

export function needsHint(needs?: string): string {
  if (!needs) return '';
  return NEEDS_HINTS[needs] || `缺少 ${needs}`;
}

/** 排队中、运行中的任务都能取消(排队中立即取消,运行中通知执行实例停下)。 */
export function canCancel(status: JobStatus): boolean {
  return status === 'queued' || status === 'running';
}

export function isTerminal(status: JobStatus): boolean {
  return status === 'done' || status === 'failed' || status === 'canceled';
}

/** 能力总览里要醒目提示的缺失项(去重,保持顺序)。 */
export function missingCapabilities(caps: StudioCapabilities | null | undefined): { key: string; text: string }[] {
  if (!caps) return [];
  const out: { key: string; text: string }[] = [];
  const add = (key: string) => {
    if (!out.some((x) => x.key === key)) out.push({ key, text: needsHint(key) });
  };
  if (!caps.storage) add('MINIO_ENDPOINT');
  if (!caps.trainCmd) add('AVATAR_TRAIN_CMD');
  if (!caps.ffmpeg) add('ffmpeg');
  for (const m of caps.methods || []) if (!m.available && m.needs) add(m.needs);
  return out;
}

/** 选一个默认训练方式:当前选的还能用就保留,否则第一个可用的,都不可用就第一个。 */
export function pickMethod(caps: StudioCapabilities | null | undefined, current: string): string {
  const methods = caps?.methods || [];
  if (methods.length === 0) return current;
  const cur = methods.find((m) => m.key === current);
  if (cur?.available) return cur.key;
  return (methods.find((m) => m.available) || cur || methods[0]).key;
}

/** 2D 资产的片段表地址;assetUrl 不以 / 结尾也能拼对。 */
export function clipsUrlFor(asset: Pick<DHAsset, 'mode' | 'assetUrl'>): string {
  if (asset.mode !== '2d' || !asset.assetUrl) return '';
  return asset.assetUrl.replace(/\/?$/, '/') + 'clips.json';
}

/** 片段表 → 有序列表(先按播放语义的常用顺序,再按其余 key)。 */
const CLIP_ORDER = ['idle', 'speaking', 'thinking', 'greet', 'wave', 'point', 'walk', 'dance', 'sing', 'sit', 'enter', 'leave'];
export const CLIP_LABELS: Record<string, string> = {
  idle: '待机', speaking: '说话', thinking: '思考', greet: '打招呼', wave: '挥手', point: '指向',
  walk: '走路', dance: '跳舞', sing: '唱歌', sit: '坐', enter: '入场', leave: '离场',
};
export function clipList(raw: unknown): (ClipEntry & { key: string })[] {
  const clips = normalizeClips(raw);
  const rank = (k: string) => {
    const i = CLIP_ORDER.indexOf(k);
    return i < 0 ? CLIP_ORDER.length : i;
  };
  return Object.keys(clips)
    .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
    .map((key) => ({ key, ...clips[key] }));
}

/** 解开 realtime-api 回包;失败抛出带后端 msg 的错误。 */
export function unwrapRealtime<T>(httpStatus: number, body: unknown, what: string): T {
  const b = (body && typeof body === 'object' ? body : {}) as { code?: number; msg?: string; data?: unknown };
  const failed = httpStatus < 200 || httpStatus >= 300 || (typeof b.code === 'number' && b.code !== 200 && b.code !== 0);
  if (failed) throw new Error(b.msg ? `${what}:${b.msg}` : `${what}(${httpStatus})`);
  return (b.data ?? body) as T;
}

async function call<T>(path: string, what: string, init?: RequestInit): Promise<T> {
  const r = await authFetch(API_PREFIX + '/api/realtime' + path, init);
  let body: unknown = null;
  try {
    body = await r.json();
  } catch {
    /* 非 JSON 回包按 HTTP 状态判断 */
  }
  return unwrapRealtime<T>(r.status, body, what);
}

const post = (body?: unknown): RequestInit => ({
  method: 'POST',
  ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
});

export const studioApi = {
  capabilities: () => call<StudioCapabilities>('/capabilities', '获取训练能力失败'),
  assets: async () => (await call<{ list: DHAsset[] | null }>('/assets', '获取资产列表失败'))?.list ?? [],
  deleteAsset: (id: string) => call<unknown>(`/assets/${encodeURIComponent(id)}`, '删除失败', { method: 'DELETE' }),
  activateAsset: (id: string) => call<unknown>(`/assets/${encodeURIComponent(id)}/activate`, '设为当前形象失败', post()),
  jobs: async () => (await call<{ list: DHJob[] | null }>('/jobs', '获取任务列表失败'))?.list ?? [],
  cancelJob: (id: string) => call<{ canceled: string; status: string }>(`/jobs/${encodeURIComponent(id)}/cancel`, '取消失败', post()),
  train: (name: string, method: string, source: string) =>
    call<{ jobId: string }>('/train', '启动训练失败', post({ name, method, source })),
  materials: async () => (await call<{ list: DHMaterial[] | null }>('/materials', '获取素材失败'))?.list ?? [],
  uploadMaterial: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return call<DHMaterial>('/materials', '上传素材失败', { method: 'POST', body: fd });
  },
  deleteMaterial: (id: string) => call<unknown>(`/materials/${encodeURIComponent(id)}`, '删除素材失败', { method: 'DELETE' }),
};

/** 资产目录里的片段表(公开地址,不用登录)。 */
export async function fetchClipList(asset: Pick<DHAsset, 'mode' | 'assetUrl'>, fetchFn: typeof fetch = fetch) {
  const url = clipsUrlFor(asset);
  if (!url) return [];
  const r = await fetchFn(url, { cache: 'no-store' });
  if (!r.ok) throw new Error(`片段表读取失败(${r.status})`);
  return clipList(await r.json());
}
