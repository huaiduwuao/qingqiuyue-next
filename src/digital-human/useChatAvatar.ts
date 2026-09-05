'use client';

/**
 * useChatAvatar —— 数字人对话 hook(LLM + TTS + viseme + 表情 + 动作)
 *
 * FloatingDigitalHuman 和 ImmersiveDigitalHuman 共用,
 * 统一 LLM endpoint(OpenAI 兼容),失败降级到 mock。
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
  /** 当前会话 id(002 hermeschat);null 表示未启用会话级 chat 或未创建 */
  conversationId: string | null;
  /** 开始新会话(清 localStorage + 切回无 ID 状态;下次 send 时 server 会新建) */
  newConversation: () => void;
  /** 切换到指定历史会话 */
  switchConversation: (cid: string) => void;
  /** 加载指定会话的历史消息(从 agentmanager 会话记录拉取),填充 chatLog */
  loadConversationMessages?: (cid: string) => Promise<void>;
  /** LLM 驱动的情绪 (chat/回答后调用,驱动 VRM 表情); 接收 emotion name 或 blendshape dict) */
  setEmotion: (e: string | Record<string, number>) => void;
  /** LLM 驱动的动作 (驱动 VRM bone rotation) */
  setAction: (a: string) => void;
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
  /** 直接追加聊天消息（给外部注入未知动作提示用） */
  setChatLog: (fn: React.SetStateAction<ChatLogItem[]>) => void;
  /** 思考过程日志（<think> 内容） */
  thinkingLog: string;
  setThinkingLog: (v: string) => void;
  /** 直接更新 viseme 状态（给 dispatcher 驱动口型用） */
  setViseme: (v: Record<string, number>) => void;
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
  /** 数字人是否在说话: 用于 voice agent 决定 VAD 段是否要丢 */
  const [isAvatarPlaying, setIsAvatarPlaying] = React.useState(false);
  /** 思考过程日志;此 hook 走一次性 HTTP 响应,不像 useChatAvatarWS 那样流式拆出
   *  <think> 片段,故这里始终为空,仅为满足 ChatAvatarState 接口一致性而保留 */
  const [thinkingLog, setThinkingLog] = useStateSafe('');

  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const visemeTimelineRef = React.useRef<VisemeFrame[]>([]);
  const visemeStartRef = React.useRef<number>(0);
  const visemeActiveRef = React.useRef<boolean>(false);
  const analyserRef = React.useRef<AnalyserNode | null>(null);
  const audioCtxRef = React.useRef<AudioContext | null>(null);
  const speechUtterRef = React.useRef<SpeechSynthesisUtterance | null>(null);
  const speechTimerRef = React.useRef<number | null>(null);

  const send = React.useCallback(async () => {
    const t = text.trim();
    if (!t || chatBusy) return;
    setChatBusy(true);
    setChatLog((c: ChatLogItem[]) => [...c, { who: 'user', text: t }]);
    setText('');
    try {
      // 1. 调 chat 路由(LLM 优先真实 OpenAI 兼容后端,失败直接报错)
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
          const errBody = await r.json().catch(() => ({})) as any;
          throw new Error(errBody?.error || errBody?.msg || `服务返回 ${r.status}`);
        }
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        console.error('[chat] chat 路由失败:', errMsg);
        setChatLog((c: ChatLogItem[]) => [...c, { who: 'ai', text: `抱歉，服务暂时不可用：${errMsg}` }]);
        setIsAIGenerated(false);
        setChatBusy(false);
        return;
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
          if (!analyserRef.current && getAudioContextClass()) {
            try {
              const AC = getAudioContextClass()
              if (!AC) return
              const ctx = new AC()
              audioCtxRef.current = ctx
              const source = ctx.createMediaElementSource(a)
              const analyser = ctx.createAnalyser()
              analyser.fftSize = 512
              source.connect(analyser)
              // 不接 destination, 避免双重播放
              analyserRef.current = analyser
            } catch {
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
        a.play().catch(() => {
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
    } catch {
      setChatLog((c: ChatLogItem[]) => [...c, { who: 'ai', text: '抱歉,服务暂时不可用。' }]);
      setIsAIGenerated(false);  // 失败回执非 AIGC
    } finally {
      setChatBusy(false);
    }
  }, [text, chatBusy, chatLog, agentId, setAction, setChatBusy, setChatLog, setEmotion, setIsAIGenerated, setIsAvatarPlaying, setText, setViseme]);

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
      if (r.ok) {
        resp = await r.json()
      } else {
        const errBody = await r.json().catch(() => ({})) as any
        throw new Error(errBody?.error || errBody?.msg || `服务返回 ${r.status}`)
      }
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
    } catch {
      setChatLog((c: ChatLogItem[]) => [...c, { who: 'ai', text: '抱歉,服务暂时不可用。' }])
      setIsAIGenerated(false)
    } finally {
      setChatBusy(false)
    }
  }, [chatBusy, chatLog, agentId, setAction, setChatBusy, setChatLog, setEmotion, setIsAIGenerated, setViseme])

  // 3. viseme 驱动 rAF — 优先后端时间线,降级客户端 AnalyserNode + speechSynthesis
  //    (后端经常不返 visemes;客户端必须能自己驱动口型)
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
  }, [setViseme]);

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
        console.warn('[record] stop failed:', e instanceof Error ? e.message : String(e));
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
              // 自动 send(绕过 text state 的异步,直接用 sendText 发送识别结果)
              setTimeout(() => {
                sendText(j.text);
              }, 50);
            } else {
              setRecordingError('ASR 返回空');
            }
          } else {
            const j = await r.json().catch(() => ({}));
            setRecordingError(j.msg || `ASR 失败 (${r.status})`);
          }
        } catch (e) {
          setRecordingError(`ASR 请求失败: ${e instanceof Error ? e.message : String(e)}`);
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
    } catch (e) {
      console.error('[record] failed:', e);
      setRecordingError((e instanceof Error ? e.message : String(e)) || '无法访问麦克风');
      setRecording(false);
    }
  }, [recording, sendText, setRecording, setRecordingError, setText]);

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
  }, [setChatBusy, setIsAvatarPlaying, setViseme])

  // 是否在说话: 用于 voice agent 决定是否触发打断
  const isSpeaking = React.useCallback(() => {
    if (isAvatarPlaying) return true   // LLM 处理中 / 音频播放中
    const a = audioRef.current
    if (!a) return false
    return !a.paused && a.currentTime > 0 && !a.ended
  }, [isAvatarPlaying])

  // LLM 驱动的表情: emotion name → 1.0 weight blend shape
  const setEmotionExternal = React.useCallback((name: string | Record<string, number>) => {
    if (!name) return
    if (typeof name === 'object') {
      setEmotion(name)
      return
    }
    const map: Record<string, Record<string, number>> = {
      smile:     { smile: 1.0 },
      surprised: { surprised: 1.0 },
      angry:     { angry: 1.0 },
      sad:       { sad: 1.0 },
      neutral:   { smile: 0, surprised: 0, angry: 0, sad: 0 },
    }
    setEmotion(map[name] || map.neutral)
    setTimeout(() => setEmotion({ smile: 0.1, blink: 0 }), 5000)
  }, [setEmotion])

  // LLM 驱动的动作: 直接 setAction(BlenderAvatar 通过 prop 接住)
  const setActionExternal = React.useCallback((name: string) => {
    if (!name) return
    setAction(name)
    // 6 秒后回 idle(动作不要太长)
    setTimeout(() => setAction('idle'), 6000)
  }, [setAction])

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
    conversationId: null,
    newConversation: () => {},
    switchConversation: () => {},
    setEmotion: setEmotionExternal,
    setAction: setActionExternal,
    thinkingLog,
    setThinkingLog,
    setChatLog,
    setViseme: setEmotion, // viseme 复用 emotion 驱动(VrmStage 通过 emotion prop 驱动 blendshape)
    audioRef,
    recording,
    recordingError,
    toggleRecording,
    cancel,
    isSpeaking,
  };
}

function getAudioContextClass(): typeof AudioContext | undefined {
  if (typeof window === 'undefined') return undefined;
  return (
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  );
}

// helper: useState 包装 + 类型
function useStateSafe<T>(initial: T): [T, (v: T | ((prev: T) => T)) => void] {
  return React.useState<T>(initial);
}
