'use client';

/**
 * useChatAvatar —— 数字人对话 hook(LLM + TTS + viseme + 表情 + 动作)
 *
 * FloatingDigitalHuman 和 ImmersiveDigitalHuman 共用,
 * 统一 LLM endpoint(xinference OpenAI 兼容),失败降级到 mock。
 *
 * 返回:
 *   text / setText           输入文本
 *   chatBusy                  是否在请求
 *   chatLog / setChatLog      聊天记录
 *   emotion                   VRM expression dict(smile/angry/...)
 *   viseme                    VRM expression dict(aa/ih/ou/...)
 *   action                    当前动作(idle/wave/walk/run/dance/sit/point/think/talk/bow)
 *   send()                    发送消息
 *   audioRef                  隐藏的 <audio> 引用
 *   isTyping                  同 chatBusy(给 UI 用)
 *
 * VRM 标准表情映射(12 个):
 *   smile → joy
 *   angry → angry
 *   sad → sorrow
 *   surprised → fun
 *   blink → blink(VRM 自带)
 *   aa/ih/ou/E/O/U/closed → 同名
 *
 * 10 个动作:由后端 LLM 决策 + mock 关键词匹配
 */

import React from 'react';

export interface ChatLogItem {
  who: 'user' | 'ai';
  text: string;
}

export interface VisemeFrame {
  t: number;       // 秒
  shape: string;   // aa/ih/ou/E/O/U/closed
  weight: number;  // 0~1
}

export interface ChatResp {
  text: string;
  emotion: Record<string, number>;
  action: string;
  visemes: VisemeFrame[];
  audioUrl: string | null;
}

export interface ChatAvatarState {
  text: string;
  setText: (v: string) => void;
  chatBusy: boolean;
  chatLog: ChatLogItem[];
  emotion: Record<string, number>;
  viseme: Record<string, number>;
  action: string;
  send: () => Promise<void>;
  audioRef: React.MutableRefObject<HTMLAudioElement | null>;
  /** 语音输入(ASR)状态 */
  recording: boolean;
  recordingError: string | null;
  /** 点按开始/停止录音 → 自动调 send(text) */
  toggleRecording: () => Promise<void>;
}

// mock 关键词匹配(LLM 失败时降级)
function mockReply(text: string): ChatResp {
  const lower = text.toLowerCase();
  let emotion: Record<string, number> = { smile: 0, blink: 0 };
  let action = 'idle';
  if (/hi|hello|你好|嗨|欢迎|在吗/.test(lower)) {
    emotion = { smile: 0.8, blink: 0 };
    action = 'wave';
  } else if (/再见|拜拜|88/.test(lower)) {
    emotion = { smile: 0.8, blink: 0 };
    action = 'wave';
  } else if (/谢|thanks|感谢/.test(lower)) {
    emotion = { smile: 0.6, blink: 0 };
    action = 'bow';
  } else if (/为什么|怎么|思考|想想/.test(lower)) {
    emotion = { blink: 0 };
    action = 'think';
  } else if (/看|这个|那里|那边|指/.test(lower)) {
    emotion = { smile: 0.2, blink: 0 };
    action = 'point';
  } else if (/累|休息|坐/.test(lower)) {
    emotion = { smile: 0, blink: 0.5 };
    action = 'sit';
  } else if (/跑|快/.test(lower)) {
    emotion = { surprised: 0.6, blink: 0 };
    action = 'run';
  } else if (/跳|舞|开心|哈哈|乐/.test(lower)) {
    emotion = { joy: 0.8, blink: 0 };
    action = 'dance';
  } else if (/走|逛/.test(lower)) {
    emotion = { blink: 0 };
    action = 'walk';
  } else if (/讲|说|聊|怎么|如何/.test(lower)) {
    emotion = { smile: 0.3, blink: 0 };
    action = 'talk';
  }
  // 生成简单 viseme timeline(根据字符数,每个字符 150ms,全用 aa/closed 交替)
  const visemes: VisemeFrame[] = [];
  for (let i = 0; i < text.length; i++) {
    visemes.push({
      t: i * 0.15,
      shape: i % 2 === 0 ? 'aa' : 'closed',
      weight: 0.7,
    });
  }
  visemes.push({ t: text.length * 0.15, shape: 'closed', weight: 1 });
  return {
    text: `(本地模式)你说:"${text}",我可以帮你查数据、跳页面、回答问题。`,
    emotion,
    action,
    visemes,
    audioUrl: null,
  };
}

export function useChatAvatar(): ChatAvatarState {
  const [text, setText] = useStateSafe('');
  const [chatBusy, setChatBusy] = useStateSafe(false);
  const [chatLog, setChatLog] = useStateSafe<ChatLogItem[]>([]);
  const [emotion, setEmotion] = useStateSafe<Record<string, number>>({});
  const [viseme, setViseme] = useStateSafe<Record<string, number>>({});
  const [action, setAction] = useStateSafe('idle');
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const visemeTimelineRef = React.useRef<VisemeFrame[]>([]);
  const visemeStartRef = React.useRef<number>(0);
  const visemeActiveRef = React.useRef<boolean>(false);

  const send = React.useCallback(async () => {
    const t = text.trim();
    if (!t || chatBusy) return;
    setChatBusy(true);
    setChatLog((c: ChatLogItem[]) => [...c, { who: 'user', text: t }]);
    setText('');
    try {
      // 1. 调 chat 路由(LLM 优先 xinference,失败 mock)
      let resp: ChatResp;
      try {
        const r = await fetch('/api/avatar/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: t,
            history: chatLog.map((m) => ({ role: m.who === 'user' ? 'user' : 'assistant', content: m.text })),
          }),
        });
        if (r.ok) {
          resp = await r.json();
        } else {
          console.warn(`[chat] chat 路由返 ${r.status},用 mock 降级`);
          resp = mockReply(t);
        }
      } catch (e) {
        console.warn('[chat] chat 路由失败:', (e as Error).message);
        resp = mockReply(t);
      }
      setChatLog((c: ChatLogItem[]) => [...c, { who: 'ai', text: resp.text }]);
      setEmotion(resp.emotion);
      setAction(resp.action);
      setViseme({});  // 清空旧 viseme
      visemeTimelineRef.current = resp.visemes || [];

      // 2. 播放 TTS 音频 + 同步 viseme 时间线
      if (resp.audioUrl && audioRef.current) {
        const a = audioRef.current;
        a.onplay = () => {
          visemeStartRef.current = performance.now();
          visemeActiveRef.current = true;
        };
        a.onended = () => {
          visemeActiveRef.current = false;
          setViseme({});
        };
        a.src = resp.audioUrl;
        a.play().catch(() => {
          // autoplay 被拒,纯文本模式
          visemeStartRef.current = performance.now();
          visemeActiveRef.current = true;
        });
      } else {
        // 无音频(纯文本):也启动 viseme 时间线
        visemeStartRef.current = performance.now();
        visemeActiveRef.current = true;
      }
    } catch (err) {
      setChatLog((c: ChatLogItem[]) => [...c, { who: 'ai', text: '抱歉,服务暂时不可用。' }]);
    } finally {
      setChatBusy(false);
    }
  }, [text, chatBusy, chatLog]);

  // 3. viseme 驱动 rAF
  React.useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (!visemeActiveRef.current) return;
      const timeline = visemeTimelineRef.current;
      if (timeline.length === 0) return;
      const elapsed = (performance.now() - visemeStartRef.current) / 1000;
      let current = timeline[0];
      for (const v of timeline) {
        if (v.t <= elapsed) current = v;
        else break;
      }
      const next = { [current.shape]: current.weight };
      setViseme((prev: Record<string, number>) => {
        const k = Object.keys(next)[0];
        if (prev[k] === next[k]) return prev;
        return next;
      });
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // 4. 语音输入(ASR):MediaRecorder 录音 → /api/avatar/asr → 自动 send
  const [recording, setRecording] = React.useState(false);
  const [recordingError, setRecordingError] = React.useState<string | null>(null);
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);

  const toggleRecording = React.useCallback(async () => {
    if (recording) {
      // 停止录音 → POST /asr → send
      try {
        const mr = mediaRecorderRef.current;
        if (mr && mr.state !== 'inactive') {
          mr.stop();
          // onstop 回调里处理 chunks
          return;
        }
      } catch (e) {
        console.warn('[record] stop failed:', (e as Error).message);
        setRecording(false);
      }
      return;
    }
    // 开始录音
    try {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        setRecordingError('当前浏览器不支持麦克风');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
      const mr = new MediaRecorder(stream, { mimeType: mime });
      mediaRecorderRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        // 关闭 mic
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        const blob = new Blob(chunksRef.current, { type: mime });
        chunksRef.current = [];
        if (blob.size === 0) {
          setRecordingError('录音为空');
          return;
        }
        // POST /api/avatar/asr
        const fd = new FormData();
        fd.append('file', new File([blob], 'recording.webm', { type: mime }));
        try {
          const r = await fetch('/api/avatar/asr', { method: 'POST', body: fd });
          if (r.ok) {
            const j = await r.json();
            if (j.text) {
              setText(j.text);
              // 自动 send(用 ref,因为 setText 是异步的)
              setTimeout(() => {
                if (text !== j.text) sendTextRef.current?.(j.text);
              }, 50);
            } else {
              setRecordingError('ASR 返回空');
            }
          } else {
            const j = await r.json().catch(() => ({}));
            setRecordingError(j.msg || `ASR 失败 (${r.status})`);
          }
        } catch (e) {
          setRecordingError(`ASR 请求失败: ${(e as Error).message}`);
        }
      };
      mr.onerror = (e) => {
        console.error('[record] error:', e);
        setRecordingError('录音出错');
        setRecording(false);
      };
      mr.start();
      setRecordingError(null);
      setRecording(true);
    } catch (e: any) {
      console.error('[record] failed:', e);
      setRecordingError(e?.message || '无法访问麦克风');
      setRecording(false);
    }
  }, [recording, text]);

  // sendRef 给 onstop 用(拿到最新 send)
  const sendTextRef = React.useRef<((t: string) => Promise<void>) | null>(null);
  React.useEffect(() => {
    sendTextRef.current = async (t: string) => {
      // 模拟 send 但用新文本
      if (chatBusyRef.current) return;
      setChatLog((c: ChatLogItem[]) => [...c, { who: 'user', text: t }]);
      let resp: ChatResp;
      try {
        const r = await fetch('/api/avatar/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: t,
            history: [],
          }),
        });
        if (r.ok) {
          resp = await r.json();
        } else {
          resp = mockReply(t);
        }
      } catch {
        resp = mockReply(t);
      }
      setChatLog((c: ChatLogItem[]) => [...c, { who: 'ai', text: resp.text }]);
      setEmotion(resp.emotion);
      setAction(resp.action);
      setViseme({});
      visemeTimelineRef.current = resp.visemes || [];
      if (resp.audioUrl && audioRef.current) {
        const a = audioRef.current;
        a.onplay = () => {
          visemeStartRef.current = performance.now();
          visemeActiveRef.current = true;
        };
        a.onended = () => {
          visemeActiveRef.current = false;
          setViseme({});
        };
        a.src = resp.audioUrl;
        a.play().catch(() => {
          visemeStartRef.current = performance.now();
          visemeActiveRef.current = true;
        });
      } else {
        visemeStartRef.current = performance.now();
        visemeActiveRef.current = true;
      }
    };
  }, []);

  const chatBusyRef = React.useRef(chatBusy);
  chatBusyRef.current = chatBusy;

  return {
    text,
    setText,
    chatBusy,
    chatLog,
    emotion,
    viseme,
    action,
    send,
    audioRef,
    recording,
    recordingError,
    toggleRecording,
  };
}

// helper: useState 包装 + 类型
function useStateSafe<T>(initial: T): [T, (v: T | ((prev: T) => T)) => void] {
  return React.useState<T>(initial);
}
