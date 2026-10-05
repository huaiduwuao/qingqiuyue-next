/**
 * useChatAvatarWS 拆出来的纯函数 / 消息分派(avatarDirectives、chatLogOps、aguiToolCalls、
 * wsConnection、wsMessageHandler)。
 */
import { describe, expect, it, vi } from 'vitest';
import type { ChatLogItem } from '../useChatAvatar';
import {
  collectAvatarCalls,
  extractUiDirectives,
  filterTTSContent,
  lastSentenceEnd,
  maskDirectives,
  parseAvatarDirectives,
  unescapeDirectives,
} from '../avatarDirectives';
import {
  aguiHistory,
  applyFinalText,
  applyStreamToken,
  chatLogFromServerMessages,
  chatLogToHistory,
  emotionToVRM,
  insertThought,
  markToolResult,
  pcm16B64ToFloat32,
  safeParseArgs,
  upsertTurnText,
} from '../chatLogOps';
import { screenCommandFromArgs } from '../aguiToolCalls';
import { reconnectDelay } from '../wsConnection';
import { createWSMessageHandler, type WSMessageDeps } from '../wsMessageHandler';

describe('avatarDirectives', () => {
  it('lastSentenceEnd 找最后一个句末标点之后', () => {
    expect(lastSentenceEnd('你好。再见')).toBe(3);
    expect(lastSentenceEnd('没有标点')).toBe(0);
    expect(lastSentenceEnd('a!b?')).toBe(4);
  });

  it('maskDirectives 等长打码,不留标点', () => {
    const s = '好<ui:{"url":"https://a.b"}/>的。<emotion:smile/>';
    const m = maskDirectives(s);
    expect(m.length).toBe(s.length);
    expect(lastSentenceEnd(m)).toBe(s.indexOf('。') + 1);
  });

  it('extractUiDirectives 能跨嵌套花括号,坏 JSON 丢掉,没闭合原样保留', () => {
    const r = extractUiDirectives('前<ui:{"type":"iframe","a":{"b":1}}/>后<ui:{bad}/>尾');
    expect(r.uis).toEqual([{ type: 'iframe', a: { b: 1 } }]);
    expect(r.stripped).toBe('前后尾');
    expect(extractUiDirectives('x<ui:{"type":"i"').stripped).toBe('x<ui:{"type":"i"');
  });

  it('collectAvatarCalls 按 动作 → 表情 → 口型 的顺序', () => {
    const calls = collectAvatarCalls('<emotion:smile/>你好<action:wave/><mouth:speak/>');
    expect(calls.map((c) => c.name)).toEqual(['body.playAction', 'face.setExpression', 'mouth.speak']);
    expect(calls[0].args).toEqual({ name: 'wave' });
    expect(calls[2].args).toEqual({ text: '你好' });
  });

  it('unescapeDirectives 还原被转义的尖括号', () => {
    expect(unescapeDirectives('\\u003cemotion:sad/\\u003e')).toBe('<emotion:sad/>');
  });

  it('parseAvatarDirectives 派发工具调用和带 type 的 UI 指令', () => {
    const onToolCalls = vi.fn();
    const onUI = vi.fn();
    parseAvatarDirectives('<action:nod/>好<ui:{"type":"iframe"}/><ui:{"x":1}/>', { onToolCalls, onUI });
    expect(onToolCalls).toHaveBeenCalledWith([{ name: 'body.playAction', args: { name: 'nod' } }]);
    expect(onUI).toHaveBeenCalledTimes(1);
    expect(onUI).toHaveBeenCalledWith({ type: 'iframe' });
    const quiet = vi.fn();
    parseAvatarDirectives('纯文本', { onToolCalls: quiet });
    expect(quiet).not.toHaveBeenCalled();
  });

  it('filterTTSContent 跳过代码 / 链接 / 标题,太短不读', () => {
    expect(filterTTSContent('# 标题\n今天天气不错\nhttps://a.com\n```\n{"a":1}')).toBe('今天天气不错');
    expect(filterTTSContent('好')).toBe('');
    expect(filterTTSContent('')).toBe('');
    expect(filterTTSContent('字'.repeat(600)).length).toBe(500);
  });
});

describe('chatLogOps', () => {
  const log: ChatLogItem[] = [
    { who: 'user', text: '问' },
    { who: 'ai', text: '答' },
    { who: 'tool', text: 't', tool: { id: 'c1', name: 't', args: {}, status: 'running' } },
  ];

  it('upsertTurnText 改本轮 AI 气泡,工具卡后面不另开', () => {
    expect(upsertTurnText(log, '答全了').map((m) => m.text)).toEqual(['问', '答全了', 't']);
    expect(upsertTurnText([{ who: 'user', text: '问' }], '新')).toEqual([{ who: 'user', text: '问' }, { who: 'ai', text: '新' }]);
  });

  it('insertThought 插在本轮第一条之前', () => {
    expect(insertThought(log, '想').map((m) => m.who)).toEqual(['user', 'thought', 'ai', 'tool']);
  });

  it('applyStreamToken / applyFinalText 只看最后一条', () => {
    expect(applyStreamToken([{ who: 'user', text: '问' }], '全文', 'tok')).toEqual([{ who: 'user', text: '问' }, { who: 'ai', text: 'tok' }]);
    expect(applyStreamToken([{ who: 'ai', text: 'a' }], '全文', 'tok')).toEqual([{ who: 'ai', text: '全文' }]);
    expect(applyFinalText([{ who: 'user', text: '问' }], '最终')).toEqual([{ who: 'user', text: '问' }, { who: 'ai', text: '最终' }]);
    expect(applyFinalText([{ who: 'ai', text: 'a' }], '最终')).toEqual([{ who: 'ai', text: '最终' }]);
  });

  it('markToolResult 按 ERROR: 前缀标状态', () => {
    expect(markToolResult(log, 'c1', 'ok')[2].tool).toMatchObject({ status: 'done', result: 'ok' });
    expect(markToolResult(log, 'c1', 'ERROR: x')[2].tool).toMatchObject({ status: 'error' });
    expect(markToolResult(log, 'other', 'ok')[2]).toBe(log[2]);
  });

  it('历史上下文:WS 全量映射,AG-UI 只要问答且最近 10 条', () => {
    expect(chatLogToHistory(log).map((m) => m.role)).toEqual(['user', 'assistant', 'assistant']);
    const many: ChatLogItem[] = Array.from({ length: 12 }, (_, i) => ({ who: i % 2 ? 'ai' : 'user', text: String(i) }));
    const h = aguiHistory([...many, { who: 'thought', text: 'x' }]);
    expect(h).toHaveLength(10);
    expect(h[0]).toEqual({ role: 'user', content: '2' });
  });

  it('chatLogFromServerMessages 剥指令、丢工具行和空消息', () => {
    expect(
      chatLogFromServerMessages([
        { role: 'user', content: '你好' },
        { role: 'assistant', content: '<mouth:speak/>在呢' },
        { role: 'assistant', content: '<emotion:smile/>' },
        { role: 'tool', content: 'resource_search' },
        { role: 'assistant', content: '  ' },
      ]),
    ).toEqual([{ who: 'user', text: '你好' }, { who: 'ai', text: '在呢' }]);
  });

  it('safeParseArgs / emotionToVRM', () => {
    expect(safeParseArgs('{"a":1}')).toEqual({ a: 1 });
    expect(safeParseArgs('bad')).toEqual({});
    expect(safeParseArgs('1')).toEqual({});
    expect(safeParseArgs()).toEqual({});
    expect(emotionToVRM('smile')).toEqual({ smile: 1 });
    expect(emotionToVRM('nope')).toEqual({});
  });

  it('pcm16B64ToFloat32 小端 PCM16 → [-1, 1)', () => {
    const b64 = btoa(String.fromCharCode(0x00, 0x40, 0x00, 0x80));
    expect(Array.from(pcm16B64ToFloat32(b64))).toEqual([0.5, -1]);
  });
});

describe('aguiToolCalls / wsConnection', () => {
  it('screenCommandFromArgs 收数字和字符串,空串当没给', () => {
    expect(screenCommandFromArgs('screen_open', { id: 12, url: ' ', title: ' 片名 ' })).toEqual({
      op: 'open', screen: undefined, id: '12', contentType: undefined, url: undefined, title: '片名',
    });
    expect(screenCommandFromArgs('screen_close', {}).op).toBe('close');
  });

  it('reconnectDelay 指数退避封顶 15s', () => {
    expect([0, 1, 2, 3, 4, 5].map(reconnectDelay)).toEqual([1000, 2000, 4000, 8000, 15000, 15000]);
  });
});

describe('wsMessageHandler', () => {
  function deps(): WSMessageDeps & { log: ChatLogItem[] } {
    const d = {
      log: [] as ChatLogItem[],
      fullTextRef: { current: '' },
      nextAudioTimeRef: { current: 5 },
      conversationIdRef: { current: null as string | null },
      onToolCallsRef: { current: vi.fn() },
      playAudioChunk: vi.fn(),
      setChatLog: vi.fn(),
      setChatBusy: vi.fn(),
      setViseme: vi.fn(),
      setEmotion: vi.fn(),
      setAction: vi.fn(),
      setIsAvatarPlaying: vi.fn(),
      setConversationId: vi.fn(),
    };
    d.setChatLog.mockImplementation((u: (p: ChatLogItem[]) => ChatLogItem[]) => {
      d.log = u(d.log);
    });
    return d;
  }

  it('text_token 累积全文并打字机', () => {
    const d = deps();
    const on = createWSMessageHandler(d);
    on({ type: 'text_token', token: '你' });
    on({ type: 'text_token', token: '好' });
    expect(d.fullTextRef.current).toBe('你好');
    expect(d.log).toEqual([{ who: 'ai', text: '你好' }]);
  });

  it('done 收尾:全文、表情、工具调用、会话 id、音频结束', () => {
    const d = deps();
    const on = createWSMessageHandler(d);
    on({ type: 'done', textDone: true, audioDone: true, fullText: '全文', emotion: 'sad', action: 'nod', toolCalls: [{ name: 'x' }], conversationId: 'c-1' });
    expect(d.setChatBusy).toHaveBeenCalledWith(false);
    expect(d.log).toEqual([{ who: 'ai', text: '全文' }]);
    expect(d.setEmotion).toHaveBeenCalledWith({ sad: 1 });
    expect(d.setAction).toHaveBeenCalledWith('nod');
    expect(d.onToolCallsRef.current).toHaveBeenCalledWith([{ name: 'x', args: {} }]);
    expect(d.setConversationId).toHaveBeenCalledWith('c-1');
    expect(d.setViseme).toHaveBeenCalledWith({});
    expect(d.setIsAvatarPlaying).toHaveBeenCalledWith(false);
    expect(d.nextAudioTimeRef.current).toBe(0);
  });

  it('viseme_frames / frame 驱动口型,asr_result 转成窗口事件', () => {
    const d = deps();
    const on = createWSMessageHandler(d);
    on({ type: 'viseme_frames', visemes: [{ shape: 'aa', weight: 0.2 } as never, { shape: 'oh', weight: 0.7 } as never] });
    expect(d.setViseme).toHaveBeenLastCalledWith({ oh: 0.7 });
    on({ type: 'frame', blendshapes: { jawOpen: 0.3 } });
    expect(d.setViseme).toHaveBeenLastCalledWith({ jawOpen: 0.3 });
    const seen = vi.fn();
    window.addEventListener('ws-asr-result', seen as EventListener);
    on({ type: 'asr_result', asrText: '你好', asrIsFinal: true });
    window.removeEventListener('ws-asr-result', seen as EventListener);
    expect((seen.mock.calls[0][0] as CustomEvent).detail).toEqual({ text: '你好', isFinal: true });
  });
});
