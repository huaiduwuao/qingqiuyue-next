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
  /** 国家网信办 AIGC 合规:后端已在 /api/avatar/chat 标记 true,前端用来显示「AI 生成」角标 */
  isAIGenerated?: boolean;
}

export interface ChatAvatarState {
  text: string;
  setText: (v: string) => void;
  chatBusy: boolean;
  chatLog: ChatLogItem[];
  emotion: Record<string, number>;
  viseme: Record<string, number>;
  action: string;
  /** 最新一次 AI 回复是否带 isAIGenerated 标记 (用于角标显示) */
  isAIGenerated: boolean;
  send: () => Promise<void>;
  /** 直接发送指定文本 (给 voice agent / 外部触发用, 绕过 text state) */
  sendText: (v: string) => Promise<void>;
  audioRef: React.MutableRefObject<HTMLAudioElement | null>;
  /** 语音输入(ASR)状态 */
  recording: boolean;
  recordingError: string | null;
  /** 点按开始/停止录音 → 自动调 send(text) */
  toggleRecording: () => Promise<void>;
  /** 打断当前回复 (barge-in: 数字人正在说话时被用户唤醒) */
  cancel: () => void;
  /** 是否在说话 (audio 正在播, 用于打断检测) */
  isSpeaking: () => boolean;
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

export function useChatAvatar(agentId: string = 'digital_human'): ChatAvatarState {
  const [text, setText] = useStateSafe('');
  const [chatBusy, setChatBusy] = useStateSafe(false);
  const [chatLog, setChatLog] = useStateSafe<ChatLogItem[]>([]);
  const [emotion, setEmotion] = useStateSafe<Record<string, number>>({});
  const [viseme, setViseme] = useStateSafe<Record<string, number>>({});
  const [action, setAction] = useStateSafe('idle');
  /** 最近一次 AI 回复的 isAIGenerated 标记 (后端 /api/avatar/chat 已设 true) */
  const [isAIGenerated, setIsAIGenerated] = useStateSafe(false);
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
            agentId,
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
      setIsAIGenerated(resp.isAIGenerated === true);  // AIGC 合规:把后端标记透传到 UI
      visemeTimelineRef.current = resp.visemes || [];

      // 2. 播放 TTS 音频 + 同步 viseme 时间线
      if (resp.audioUrl && audioRef.current) {
        const a = audioRef.current;
        a.onplay = () => {
          visemeStartRef.current = performance.now();
          visemeActiveRef.current = true;
          setIsAvatarPlaying(true);   // 通知 voice agent: 数字人在说话, VAD 段丢弃

          // 客户端口型: AnalyserNode 挂在 audio 元素上, 实时测音频能量驱动 viseme
          // (后端 viseme 时间线为 null/空时降级到客户端)
          if (!analyserRef.current && typeof window !== 'undefined' && (window.AudioContext || (window as any).webkitAudioContext)) {
            try {
              const AC = window.AudioContext || (window as any).webkitAudioContext
              const ctx = new AC()
              audioCtxRef.current = ctx
              const source = ctx.createMediaElementSource(a)
              const analyser = ctx.createAnalyser()
              analyser.fftSize = 512
              source.connect(analyser)
              // 不接 destination, 避免双重播放
              analyserRef.current = analyser
            } catch (e) {
              // CORS 限制或 autoplay policy,忽略
            }
          } else if (analyserRef.current && audioCtxRef.current) {
            // 重用已有 AnalyserNode(多次回复复用)
            audioCtxRef.current.resume?.()
          }
        };
        a.onended = () => {
          visemeActiveRef.current = false;
          setViseme({});
          setIsAvatarPlaying(false);
        };
        a.onerror = () => {
          // autoplay 失败,降级到纯文本 + 浏览器 TTS
          visemeStartRef.current = performance.now();
          visemeActiveRef.current = true;
          if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            try {
              window.speechSynthesis.cancel()
              const utter = new SpeechSynthesisUtterance(resp.text)
              utter.lang = 'zh-CN'
              speechUtterRef.current = utter
              utter.onstart = () => {
                visemeStartRef.current = performance.now()
                visemeActiveRef.current = true
              }
              utter.onend = () => {
                visemeActiveRef.current = false
                setViseme({})
                setIsAvatarPlaying(false)
              }
              window.speechSynthesis.speak(utter)
            } catch {}
          }
        };
        a.src = resp.audioUrl;
        a.play().catch((e) => {
          // autoplay 被拒,降级到纯文本 + 浏览器 TTS
          visemeStartRef.current = performance.now();
          visemeActiveRef.current = true;
          if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            try {
              window.speechSynthesis.cancel()
              const utter = new SpeechSynthesisUtterance(resp.text)
              utter.lang = 'zh-CN'
              speechUtterRef.current = utter
              utter.onstart = () => {
                visemeStartRef.current = performance.now()
                visemeActiveRef.current = true
                // 启动定时器: 随机切 viseme 模拟说话
                if (speechTimerRef.current) clearInterval(speechTimerRef.current)
                const visemes = ['aa', 'E', 'O', 'U', 'ih', 'closed']
                speechTimerRef.current = window.setInterval(() => {
                  if (!visemeActiveRef.current) return
                  const shape = visemes[Math.floor(Math.random() * (visemes.length - 1))]
                  setViseme({ [shape]: 0.4 + Math.random() * 0.4 })
                }, 90)
              }
              utter.onend = () => {
                visemeActiveRef.current = false
                setViseme({})
                setIsAvatarPlaying(false)
                if (speechTimerRef.current) {
                  clearInterval(speechTimerRef.current)
                  speechTimerRef.current = null
                }
              }
              window.speechSynthesis.speak(utter)
            } catch {}
          }
        });
      } else {
        // 无音频(纯文本):也启动 viseme 时间线
        visemeStartRef.current = performance.now();
        visemeActiveRef.current = true;
      }
    } catch (err) {
      setChatLog((c: ChatLogItem[]) => [...c, { who: 'ai', text: '抱歉,服务暂时不可用。' }]);
      setIsAIGenerated(false);  // 失败回执非 AIGC
    } finally {
      setChatBusy(false);
    }
  }, [text, chatBusy, chatLog]);

  // 直接发送文本 (绕过 text state), 给 voice agent 用
  const sendText = React.useCallback(async (v: string) => {
    const t = v.trim()
    if (!t || chatBusy) return
    setChatBusy(true)
    setChatLog((c: ChatLogItem[]) => [...c, { who: 'user', text: t }])
    try {
      const r = await fetch('/api/avatar/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: t,
          agentId,
          history: chatLog.map((m) => ({ role: m.who === 'user' ? 'user' : 'assistant', content: m.text })),
        }),
      })
      let resp: ChatResp
      if (r.ok) resp = await r.json()
      else { resp = mockReply(t) }
      setChatLog((c: ChatLogItem[]) => [...c, { who: 'ai', text: resp.text }])
      setEmotion(resp.emotion)
      setAction(resp.action)
      setViseme({})
      setIsAIGenerated(resp.isAIGenerated === true)  // AIGC 合规
      visemeTimelineRef.current = resp.visemes || []
      if (resp.audioUrl && audioRef.current) {
        const a = audioRef.current
        a.onplay = () => { visemeStartRef.current = performance.now(); visemeActiveRef.current = true }
        a.onended = () => { visemeActiveRef.current = false; setViseme({}) }
        a.src = resp.audioUrl
        a.play().catch(() => { visemeStartRef.current = performance.now(); visemeActiveRef.current = true })
      } else {
        visemeStartRef.current = performance.now()
        visemeActiveRef.current = true
      }
    } catch (err) {
      setChatLog((c: ChatLogItem[]) => [...c, { who: 'ai', text: '抱歉,服务暂时不可用。' }])
      setIsAIGenerated(false)
    } finally {
      setChatBusy(false)
    }
  }, [chatBusy, chatLog])

  // 3. viseme 驱动 rAF — 优先后端时间线,降级客户端 AnalyserNode + speechSynthesis
  //    (后端经常不返 visemes;客户端必须能自己驱动口型)
  const analyserRef = React.useRef<AnalyserNode | null>(null);
  const audioCtxRef = React.useRef<AudioContext | null>(null);
  const speechUtterRef = React.useRef<SpeechSynthesisUtterance | null>(null);
  const speechTimerRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    let raf = 0;
    let backendUsed = false;
    let lastTone = 'aa';
    let lastChangeMs = 0;

    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (!visemeActiveRef.current) return;

      // A) 优先: 后端返了 viseme 时间线
      const timeline = visemeTimelineRef.current;
      if (timeline.length > 0) {
        if (!backendUsed) backendUsed = true
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
        return;
      }

      // B) 客户端降级: AnalyserNode 监听 audio 元素 amplitude
      //    原理: TTS 音频的瞬时能量 → 分桶 → 映射到 5 个 viseme
      //    (aa 闭 / E 半开 / O 全开 / U 圆 / closed 静音)
      if (analyserRef.current) {
        const buf = new Uint8Array(analyserRef.current.fftSize)
        analyserRef.current.getByteTimeDomainData(buf)
        // 计算 RMS 能量 (0-1)
        let sum = 0
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128
          sum += v * v
        }
        const rms = Math.sqrt(sum / buf.length)

        // 静音(< 0.01) → closed
        // 高频/急促(变化快) → 选一个
        // 稳定能量 → 保持当前
        if (rms < 0.01) {
          setViseme({ closed: 1.0 })
          lastTone = 'closed'
          return
        }

        // 随机变化模拟自然语流(70ms 切一次,像真说话)
        const now = performance.now()
        const shouldChange = now - lastChangeMs > 70 + Math.random() * 60
        let chosenShape = lastTone
        if (shouldChange) {
          // 按 rms 强度选口型(弱音→E/ih,中→aa,强→O/U)
          const r = Math.random()
          if (rms < 0.03) chosenShape = r < 0.5 ? 'E' : 'ih'
          else if (rms < 0.08) chosenShape = r < 0.5 ? 'aa' : 'E'
          else chosenShape = r < 0.4 ? 'O' : (r < 0.7 ? 'U' : 'aa')
          lastChangeMs = now
          lastTone = chosenShape
        }

        // 强度映射成 weight (rms 越大张得越开)
        const weight = Math.min(1, rms * 4)
        setViseme({ [chosenShape]: weight })
        return
      }

      // C) 兜底: speechSynthesis 模式(tts 用 browser API,无 audio 元素)
      //    已在 onstart 时设了定时器,直接用 lastTone 维持
      if (lastTone && visemeActiveRef.current) {
        setViseme({ [lastTone]: 0.6 })
      }
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
      setIsAIGenerated(resp.isAIGenerated === true);  // AIGC 合规
      visemeTimelineRef.current = resp.visemes || [];
      if (resp.audioUrl && audioRef.current) {
        const a = audioRef.current;
        a.onplay = () => {
          visemeStartRef.current = performance.now();
          visemeActiveRef.current = true;
          setIsAvatarPlaying(true);   // 通知 voice agent: 数字人在说话, VAD 段丢弃
        };
        a.onended = () => {
          visemeActiveRef.current = false;
          setViseme({});
          setIsAvatarPlaying(false);  // 数字人说完了
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

  // 打断: 停 audio, 清 viseme 状态
  // voice agent 在数字人说话时检测到唤醒词会调这个
  const cancel = React.useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
    visemeActiveRef.current = false
    setViseme({})
    setIsAvatarPlaying(false)   // 同步标记
    setChatBusy(false)
  }, [])

  // 数字人是否在说话: 用于 voice agent 决定 VAD 段是否要丢
  // (数字人自己的音频会被 VAD 捕获, 不当作用户命令)
  const [isAvatarPlaying, setIsAvatarPlaying] = React.useState(false)

  // 是否在说话: 用于 voice agent 决定是否触发打断
  const isSpeaking = React.useCallback(() => {
    if (isAvatarPlaying) return true   // LLM 处理中 / 音频播放中
    const a = audioRef.current
    if (!a) return false
    return !a.paused && a.currentTime > 0 && !a.ended
  }, [isAvatarPlaying])

  return {
    text,
    setText,
    chatBusy,
    chatLog,
    emotion,
    viseme,
    action,
    isAIGenerated,
    send,
    sendText,
    audioRef,
    recording,
    recordingError,
    toggleRecording,
    cancel,
    isSpeaking,
  };
}

// helper: useState 包装 + 类型
function useStateSafe<T>(initial: T): [T, (v: T | ((prev: T) => T)) => void] {
  return React.useState<T>(initial);
}
