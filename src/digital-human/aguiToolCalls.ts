/**
 * AG-UI 对话里工具调用 / 工具结果 / 自定义事件的处理(从 useChatAvatarWS.ts 的 aguiChatOnce 拆出,行为不变)。
 */
import type React from 'react';
import { devLog } from '@/lib/dev-log';
import type { ChatLogItem } from './useChatAvatar';
import {
  SCENE_PANEL_DISMISS_TOOL,
  SCENE_PANEL_TOOLS,
  scenePanelFromToolCall,
  type ScenePanel,
} from './scene-ui/types';
import { normalizeChoices, normalizeContentRefs, rememberContentRefs, type ContentRef } from './scene-ui/content';
import { playPlaylist, playTracks, queueTracks } from '@/lib/player/playlist';
import { markToolResult, safeParseArgs } from './chatLogOps';

/** 业务工具执行时给用户的可见反馈(否则一次搜索十几秒界面是死的) */
export const TOOL_RUNNING_HINT: Record<string, string> = {
  resource_search: '正在搜资源…',
  playlist_list: '正在看你的歌单…',
  media_play: '正在准备播放…',
  bounty_list: '正在查悬赏…',
  bounty_create: '正在发布悬赏…',
  workflow_execute: '正在跑工作流…',
  browser_open: '正在打开网页…',
  screen_open: '正在屏幕上打开…',
  content_backfill: '正在补抓该条内容…',
};

/** 数字人对场景显示器的操作:打开一个作品 / 地址,或关掉一块(不给 screen = 全部)屏 */
export interface ScreenCommand {
  op: 'open' | 'close';
  screen?: string;
  id?: string;
  contentType?: string;
  url?: string;
  title?: string;
}

/** screen_open / screen_close 的参数 → ScreenCommand(数字/字符串都收,空串当没给) */
export function screenCommandFromArgs(name: 'screen_open' | 'screen_close', args: Record<string, any>): ScreenCommand {
  const str = (v: unknown) => (typeof v === 'string' || typeof v === 'number' ? String(v).trim() : '') || undefined;
  return {
    op: name === 'screen_open' ? 'open' : 'close',
    screen: str(args.screen), id: str(args.id), contentType: str(args.contentType), url: str(args.url), title: str(args.title),
  };
}

/**
 * media_play:数字人让站内播放器放歌。播放器在浏览器里,所以这个工具由前端执行 ——
 * 服务端那边只是回一句「已交给播放器」。返回给用户看的一句结果。
 */
export async function runMediaPlay(args: Record<string, unknown>): Promise<string> {
  const append = args.mode === 'append';
  const shuffle = args.shuffle === true;
  const playlistId = typeof args.playlistId === 'string' || typeof args.playlistId === 'number' ? String(args.playlistId).trim() : '';
  if (playlistId) {
    const n = await playPlaylist(playlistId, { shuffle, append });
    return n > 0 ? (append ? `歌单里的 ${n} 首已加入队列` : `开始播放歌单 · ${n} 首`) : '这张歌单里没有能放的歌';
  }
  const songs = normalizeContentRefs(args.items).filter((r) => !r.contentType || r.contentType === 'MUSIC');
  if (songs.length === 0) return '没有拿到要播放的歌曲';
  const seeds = songs.map((r) => ({ id: r.id, title: r.title, artist: r.author, cover: r.cover }));
  if (append) {
    const n = queueTracks(seeds);
    return n > 0 ? `已加入播放队列 · ${n} 首` : '这些歌已经在队列里了';
  }
  playTracks(seeds, { shuffle, source: { kind: 'assistant', name: '小月点的歌' } });
  return `开始播放 · ${seeds.length} 首`;
}

export type WorldToolName = 'world_place' | 'world_edit' | 'scene_go' | 'room_design';

/** 工具处理用到的回调(结构上是 UseChatAvatarWSOptions 的子集) */
export interface AguiToolOptions {
  onToolCalls?: (calls: Array<{ name: string; args: Record<string, any> }>) => void;
  onScenePanel?: (panel: ScenePanel | null) => void;
  onScreen?: (cmd: ScreenCommand) => void;
  onWorldTool?: (e: { name: WorldToolName; args: Record<string, any>; result?: any }) => void;
  onContentResults?: (items: ContentRef[]) => void;
}

export interface AguiToolContext {
  setChatLog: React.Dispatch<React.SetStateAction<ChatLogItem[]>>;
  /** 发这轮消息时的 options(onScreen / onScenePanel / onToolCalls 用它) */
  options: AguiToolOptions;
  /** 最新的 options(onWorldTool / onContentResults 用它:结果可能晚到) */
  optionsRef: React.MutableRefObject<AguiToolOptions>;
  /** 言出法随:world_place 的结果回来时要知道参数,按工具调用 id 记一下 */
  worldCalls: Map<string, { name: string; args: Record<string, any> }>;
}

/** AG-UI onToolCall:留一张工具卡,再按工具名分派 */
export function handleAguiToolCall(name: string, toolCallId: string, argsJSON: string | undefined, ctx: AguiToolContext) {
  const { setChatLog, options, optionsRef } = ctx;
  // 操作日志:每个工具调用都在对话里留一张卡,结果回来后补上
  setChatLog((c) => [...c, { who: 'tool', text: name, tool: { id: toolCallId || `${name}-${Date.now()}`, name, args: safeParseArgs(argsJSON), status: 'running' } }]);
  // 到这里 args 已经由 api.ts 攒完整了(TOOL_CALL_END 才交付),
  // 不用再自己缓冲补参、也不会拿到半截 JSON。
  let args: Record<string, any> = {};
  if (argsJSON) {
    try {
      const parsed = JSON.parse(argsJSON);
      if (parsed && typeof parsed === 'object') args = parsed;
    } catch {
      devLog.warn('[agui] 工具参数解析失败:', name, argsJSON?.slice(0, 200));
    }
  }

  // 对话里的快捷选项:点了就替用户把那句话发出去
  if (name === 'ui_show_choices') {
    const choices = normalizeChoices(args);
    if (choices) setChatLog((c) => [...c, { who: 'choices', text: '', choices }]);
    return;
  }
  // 放歌:播放器在浏览器里,由前端执行
  if (name === 'media_play') {
    runMediaPlay(args)
      .then((msg) => devLog.debug('[agui] media_play:', msg))
      .catch((e) => setChatLog((c) => [...c, { who: 'ai', text: `⚠️ 播放失败:${e?.message || e}` }]));
    return;
  }

  // 场景里的显示器:在屏幕上打开作品/网页,或关屏
  if (name === 'screen_open' || name === 'screen_close') {
    options.onScreen?.(screenCommandFromArgs(name, args));
    return;
  }

  // 言出法随:摆东西要等服务端挑好素材(结果里),挪 / 删 / 换场景现在就执行
  if (name === 'world_place' || name === 'world_edit' || name === 'scene_go' || name === 'room_design') {
    // 摆东西 / 布置方案要等服务端配好素材(结果里)
    if (name === 'world_place' || name === 'room_design') ctx.worldCalls.set(toolCallId, { name, args });
    else optionsRef.current.onWorldTool?.({ name, args });
    return;
  }

  // 生成式 UI 工具 → 3D 场景面板(列表 / 网格 / 表单)
  if (name === SCENE_PANEL_DISMISS_TOOL) {
    options.onScenePanel?.(null);
    return;
  }
  if (SCENE_PANEL_TOOLS[name]) {
    const panel = scenePanelFromToolCall(name, args, toolCallId);
    if (panel) options.onScenePanel?.(panel);
    else devLog.warn('[agui] UI 工具参数不合法,不弹面板:', name, args);
    return;
  }

  // 其余工具走 dispatcher 通路:数字人形象/动作/换装/移动驱动
  options.onToolCalls?.([{ name, args }]);
}

/** AG-UI onToolResult:言出法随交付素材,工具卡补上结果 */
export function handleAguiToolResult(toolCallId: string, content: string, ctx: AguiToolContext) {
  const wc = ctx.worldCalls.get(toolCallId);
  if (wc) {
    ctx.worldCalls.delete(toolCallId);
    let result: any = null;
    try { result = JSON.parse(content); } catch { /* ERROR: 开头的纯文本 */ }
    if (result) ctx.optionsRef.current.onWorldTool?.({ name: wc.name as 'world_place' | 'room_design', args: wc.args, result });
  }
  ctx.setChatLog((c) => markToolResult(c, toolCallId, content));
}

/** AG-UI onCustom:content_results 记下来并在对话里出一排作品卡片 */
export function handleAguiCustom(name: string, value: unknown, userText: string, ctx: AguiToolContext) {
  if (name !== 'content_results') return;
  // 搜索结果的完整结构化数据:记下来(之后 ui_show_content 只给 id 也能补全封面),
  // 并直接在对话里出一排能点的作品卡片 —— 不依赖模型再转述一遍。
  const items: ContentRef[] = normalizeContentRefs((value as { items?: unknown })?.items);
  if (items.length === 0) return;
  rememberContentRefs(items);
  ctx.setChatLog((c) => [...c, { who: 'cards', text: '', contents: items, label: userText.slice(0, 20) }]);
  ctx.optionsRef.current.onContentResults?.(items);
}
