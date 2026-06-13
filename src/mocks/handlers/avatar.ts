/**
 * 数字人 avatar-api 的 MSW mock(dev 用)。
 * 生产环境前端 fetch /api/realtime/* 会经网关命中真 avatar-api(Go),
 * dev(USE_MOCK)下由这里返回,使"真·LLM"开关也能走通 RemoteLLM→服务 链路。
 *
 * 这里复刻 Go 服务的 mock 逻辑:关键词 → 回复 + toolCalls。
 */
import { http, HttpResponse } from 'msw';

const ok = (data: any) => HttpResponse.json({ code: 200, msg: 'OK', data });

// ─── 工作台 mock(资产 + 一键训练,带进度模拟)───
const STAGES = [
  { key: 'capture', label: '采集素材' },
  { key: 'preprocess', label: '预处理(抠像+SMPL-X拟合)' },
  { key: 'train', label: '训练高斯' },
  { key: 'export', label: '导出可驱动资产' },
  { key: 'deploy', label: '部署上线' },
];
const STAGE_LOGS: Record<string, string[]> = {
  capture: ['读取素材帧…', '抽帧完成'],
  preprocess: ['前景分割(SAM)…', '逐帧 SMPL-X 拟合…', '相机标定完成'],
  train: ['初始化高斯…', '优化中 iter 200…', '优化中 iter 800…', '蒙皮正则收敛'],
  export: ['导出 gaussians.bin / skinning.bin / smplx.json', '生成 avatar.ply'],
  deploy: ['上传资产', '登记可驱动数字人'],
};
let seq = 100;
const materials: any[] = [
  { id: 'm1', name: '本人转圈采集.mp4', type: 'video', sizeMB: 142, status: 'processed', durationSec: 95, createdAt: Date.now() - 96 * 3600e3, usedBy: 'a1' },
  { id: 'm2', name: '讲话片段_竖屏.mp4', type: 'clip', sizeMB: 38, status: 'uploaded', durationSec: 12, createdAt: Date.now() - 50 * 3600e3, usedBy: '' },
  { id: 'm3', name: '舞蹈片段.mp4', type: 'clip', sizeMB: 56, status: 'uploaded', durationSec: 18, createdAt: Date.now() - 20 * 3600e3, usedBy: '' },
];
const assets: any[] = [
  { id: 'a1', name: '默认数字人 · 小秋', mode: '3dgs', status: 'ready', active: true, published: true, thumbnail: 'https://picsum.photos/seed/avatar-a1/200/300', sizeMB: 86, joints: 55, hasFlame: true, assetUrl: '', createdAt: Date.now() - 72 * 3600e3 },
  { id: 'a2', name: '演示 · 2D 真人片段', mode: '2d', status: 'ready', active: false, published: false, thumbnail: 'https://picsum.photos/seed/avatar-a2/200/300', sizeMB: 24, joints: 0, hasFlame: false, assetUrl: '/avatar/clips.json', createdAt: Date.now() - 48 * 3600e3 },
];
const jobs: any[] = [];

// ─── 训练资源(GPU 节点)───
const resources: any[] = [
  { id: 'g1', name: '本地工作站 · 4070', gpu: 'RTX 4070', vramTotalGB: 12, vramUsedGB: 7.4, utilPct: 68, temp: 64, status: 'training', currentJob: '', maxConcurrent: 1 },
  { id: 'g2', name: '云 GPU · A100(按需)', gpu: 'A100 40G', vramTotalGB: 40, vramUsedGB: 0, utilPct: 0, temp: 0, status: 'offline', currentJob: '', maxConcurrent: 4 },
];

// ─── 模型服务(ASR / LLM / TTS)───
const models: any[] = [
  { id: 'asr1', name: 'FunASR · Paraformer', type: 'asr', provider: 'Xinference', status: 'online', endpoint: 'http://127.0.0.1:9997/v1', model: 'paraformer-zh', vramGB: 1.6, resource: 'g1', calls: 1284 },
  { id: 'llm1', name: 'Qwen2.5-Instruct', type: 'llm', provider: '云 API', status: 'online', endpoint: 'https://api.example.com/v1', model: 'qwen2.5-instruct', vramGB: 0, resource: '-', calls: 873 },
  { id: 'tts1', name: 'CosyVoice2', type: 'tts', provider: 'Xinference', status: 'online', endpoint: 'http://127.0.0.1:9997/v1', model: 'CosyVoice2', vramGB: 3.2, resource: 'g1', calls: 642 },
  { id: 'a2f1', name: 'Audio2Face(口型)', type: 'a2f', provider: '本地服务', status: 'offline', endpoint: 'http://127.0.0.1:8011', model: 'musetalk', vramGB: 2.4, resource: 'g1', calls: 0 },
];

function runJob(job: any) {
  let si = 0, li = 0;
  const tick = () => {
    if (job.status !== 'running') return;
    const st = STAGES[si];
    if (li === 0) { job.stage = st.key; job.logs.push('▶ ' + st.label); }
    const lines = STAGE_LOGS[st.key];
    if (li < lines.length) {
      job.logs.push('  ' + lines[li]);
      job.progress = Math.min(99, Math.floor((si * 100) / STAGES.length + li * 4));
      li++;
      setTimeout(tick, 700);
    } else {
      si++; li = 0;
      if (si >= STAGES.length) {
        const a = { id: 'a' + ++seq, name: job.name, mode: '3dgs', status: 'ready', active: false, published: false, thumbnail: `https://picsum.photos/seed/${job.id}/200/300`, sizeMB: 80 + (seq % 40), joints: 55, hasFlame: true, assetUrl: '', createdAt: Date.now() };
        assets.unshift(a);
        job.status = 'done'; job.progress = 100; job.assetId = a.id;
        job.logs.push('✅ 训练完成,资产已登记:' + a.id);
      } else setTimeout(tick, 500);
    }
  };
  setTimeout(tick, 400);
}

export const avatarHandlers = [
  http.get('*/api/realtime/config', () => {
    // assetUrl 默认从环境变量读;为空时前端走 2D 兜底(Canvas/Video)
    // 生产把训练产物放到 CDN,把 NEXT_PUBLIC_AVATAR_ASSET_URL 指过去即可
    const assetUrl = (typeof process !== 'undefined' && (process as any).env?.NEXT_PUBLIC_AVATAR_ASSET_URL) || '';
    return ok({
      avatarMode: assetUrl ? '3dgs' : 'video',
      assetUrl,
      clipsUrl: '/avatar/clips.json',
      features: { asr: false, tts: !!((process as any).env?.NEXT_PUBLIC_TTS_AUDIO_URL), llm: true },
      wsUrl: '/api/realtime/ws',
    });
  }),

  http.post('*/api/realtime/chat', async ({ request }) => {
    const body: any = await request.json().catch(() => ({}));
    const msg: string = (body?.message || '').trim();
    const has = (re: RegExp) => re.test(msg);

    if (has(/你好|您好|hi|hello|嗨/i))
      return ok({ text: '你好呀!我是清秋月数字助理,可以帮你查数据、跳页面。' });
    if (has(/悬赏|赏金|任务/))
      return ok({ text: '好的,带你去悬赏中心并查一下进行中的任务。', toolCalls: [{ name: 'openRewardCenter', args: {} }, { name: 'listRewardTasks', args: { status: '' } }] });
    if (has(/搜索|搜一下|查一下/)) {
      const kw = msg.replace(/.*(搜索|搜一下|查一下)/, '').trim() || '清秋月';
      return ok({ text: `帮你搜索「${kw}」。`, toolCalls: [{ name: 'searchContent', args: { keyword: kw } }] });
    }
    if (has(/用户管理|用户列表/))
      return ok({ text: '带你去用户管理页面。', toolCalls: [{ name: 'navigate', args: { path: '/system/user' } }] });
    if (has(/首页|推荐|回去|返回/))
      return ok({ text: '好的,回到首页推荐。', toolCalls: [{ name: 'goHomeFeed', args: {} }] });

    return ok({ text: `(server-mock)收到「${msg}」。配置真实 LLM 后我能理解更复杂的指令。` });
  }),

  // ─── 素材上传列表 ───
  http.get('*/api/realtime/materials', () => ok({ list: materials })),
  http.post('*/api/realtime/materials', async ({ request }) => {
    const b: any = await request.json().catch(() => ({}));
    const m = { id: 'm' + ++seq, name: b.name || `素材_${seq}.mp4`, type: b.type || 'video', sizeMB: b.sizeMB || (20 + (seq % 80)), status: 'uploaded', durationSec: b.durationSec || 30, createdAt: Date.now(), usedBy: '' };
    materials.unshift(m);
    return ok(m);
  }),
  http.delete('*/api/realtime/materials/:id', ({ params }) => {
    const i = materials.findIndex((m) => m.id === params.id);
    if (i >= 0) materials.splice(i, 1);
    return ok({ removed: params.id });
  }),

  // ─── 发布 ───
  http.post('*/api/realtime/assets/:id/publish', async ({ params, request }) => {
    const b: any = await request.json().catch(() => ({}));
    const a = assets.find((x) => x.id === params.id);
    if (a) a.published = b.published !== false;
    return ok({ id: params.id, published: a?.published });
  }),

  // ─── 训练资源(GPU)───
  http.get('*/api/realtime/resources', () => {
    // 把运行中任务挂到 g1
    const running = jobs.find((j) => j.status === 'running');
    resources[0].currentJob = running ? running.name : '';
    resources[0].status = running ? 'training' : 'idle';
    return ok({ list: resources });
  }),

  // ─── 调度队列 ───
  http.get('*/api/realtime/schedule', () => {
    const rows = jobs
      .filter((j) => j.status === 'running' || j.status === 'queued')
      .map((j, i) => ({ jobId: j.id, name: j.name, status: j.status, resource: '本地工作站 · 4070', priority: i === 0 ? '高' : '普通', eta: j.status === 'running' ? `${Math.max(1, Math.round((100 - j.progress) / 8))} 分钟` : '排队中' }));
    return ok({ list: rows, queued: rows.filter((r) => r.status === 'queued').length, running: rows.filter((r) => r.status === 'running').length });
  }),

  // ─── 模型服务(ASR/LLM/TTS)───
  http.get('*/api/realtime/models', () => ok({ list: models })),
  http.post('*/api/realtime/models/:id/toggle', ({ params }) => {
    const m = models.find((x) => x.id === params.id);
    if (m) m.status = m.status === 'online' ? 'offline' : 'online';
    return ok({ id: params.id, status: m?.status });
  }),
  http.post('*/api/realtime/models/:id/reload', ({ params }) => {
    const m = models.find((x) => x.id === params.id);
    if (m) m.status = 'online';
    return ok({ id: params.id, reloaded: true });
  }),

  // ─── 工作台:资产 + 一键训练 ───
  http.get('*/api/realtime/assets', () => ok({ list: assets, stages: STAGES })),
  http.post('*/api/realtime/assets/:id/activate', ({ params }) => {
    assets.forEach((a) => (a.active = a.id === params.id));
    return ok({ active: params.id });
  }),
  http.delete('*/api/realtime/assets/:id', ({ params }) => {
    const i = assets.findIndex((a) => a.id === params.id);
    if (i >= 0) assets.splice(i, 1);
    return ok({ removed: params.id });
  }),
  http.post('*/api/realtime/train', async ({ request }) => {
    const b: any = await request.json().catch(() => ({}));
    const job = { id: 'job' + ++seq, name: b.name || '新数字人', method: b.method || 'ExAvatar', status: 'running', stage: 'capture', progress: 0, logs: ['任务创建,来源:' + (b.source || '-')], createdAt: Date.now() };
    jobs.unshift(job);
    runJob(job);
    return ok({ jobId: job.id });
  }),
  http.get('*/api/realtime/jobs', () => ok({ list: jobs })),
  http.get('*/api/realtime/jobs/:id', ({ params }) => {
    const j = jobs.find((x) => x.id === params.id);
    return j ? ok(j) : HttpResponse.json({ code: 404, msg: 'not found' }, { status: 404 });
  }),
  http.post('*/api/realtime/jobs/:id/cancel', ({ params }) => {
    const j = jobs.find((x) => x.id === params.id);
    if (j && j.status === 'running') { j.status = 'canceled'; j.logs.push('已取消'); }
    return ok({ canceled: params.id });
  }),
];
