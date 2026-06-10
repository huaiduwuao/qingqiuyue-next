/**
 * AgentController —— 数字人的"大脑+编排中枢"。
 * 链路:用户输入(文/语音) → LLM(带工具) → 执行工具 + TTS说话 → 驱动动作状态机。
 */
import type { AgentEvent, ToolDef } from '../types';
import type { LLM } from './llm';
import type { SpeechInput } from '../voice/asr';
import type { SpeechOutput } from '../voice/tts';
import { ActionStateMachine } from '../ActionStateMachine';

export interface AgentDeps {
  llm: LLM;
  tools: ToolDef[];
  asr: SpeechInput;
  tts: SpeechOutput;
  fsm: ActionStateMachine;
  onEvent?: (e: AgentEvent) => void;
}

export class AgentController {
  private history: { role: string; content: string }[] = [];
  private busy = false;

  constructor(private deps: AgentDeps) {
    const { asr, tts, fsm } = deps;
    asr.onResult = (text, final) => {
      this.emit({ type: 'asr', text, final });
      if (final) this.handle(text);
    };
    asr.onError = (m) => this.emit({ type: 'error', message: `ASR: ${m}` });
    tts.onMouth = (open) => {
      fsm.setMouthOpen(open);
      this.emit({ type: 'speaking', mouthOpen: open });
    };
    tts.onStart = () => fsm.enterSpeaking();
    tts.onEnd = () => fsm.endSpeaking();
  }

  startListening() {
    this.deps.asr.start();
  }
  stopListening() {
    this.deps.asr.stop();
  }

  /** 文本/语音统一入口 */
  async handle(userText: string) {
    if (this.busy || !userText.trim()) return;
    this.busy = true;
    const { llm, tools, tts, fsm } = this.deps;
    try {
      this.history.push({ role: 'user', content: userText });
      fsm.enterThinking();
      this.emit({ type: 'thinking' });

      const reply = await llm.chat(userText, tools, this.history);
      this.history.push({ role: 'assistant', content: reply.text });
      this.emit({ type: 'reply', reply });

      // 执行工具调用
      for (const call of reply.toolCalls ?? []) {
        const tool = tools.find((t) => t.name === call.name);
        if (!tool) {
          this.emit({ type: 'tool', name: call.name, args: call.args, error: '未注册的工具' });
          continue;
        }
        try {
          const result = await tool.run(call.args || {});
          this.emit({ type: 'tool', name: call.name, args: call.args, result });
        } catch (err: any) {
          this.emit({ type: 'tool', name: call.name, args: call.args, error: err?.message || String(err) });
        }
      }

      // 表情/动作 + 说话
      fsm.applyReply(reply.text, reply.action, reply.emotion);
      await tts.speak(reply.text);
      this.emit({ type: 'done' });
    } catch (err: any) {
      this.emit({ type: 'error', message: err?.message || String(err) });
    } finally {
      this.busy = false;
    }
  }

  private emit(e: AgentEvent) {
    this.deps.onEvent?.(e);
  }
}
