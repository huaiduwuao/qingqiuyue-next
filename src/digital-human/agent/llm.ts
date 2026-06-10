/**
 * LLM 接入层(可插拔)。
 * - MockIntentLLM:零依赖的本地意图路由,先把整条链跑通(关键词→回复+工具+动作)。
 * - RemoteLLM:对接真实大模型 function-calling 接口(/api/avatar/chat),按需替换。
 */
import type { AgentReply, ToolDef } from '../types';
import { toolsAsPrompt } from './tools';

export interface LLM {
  chat(userText: string, tools: ToolDef[], history: { role: string; content: string }[]): Promise<AgentReply>;
}

// ── 本地 mock:够撑起 demo,并演示"调接口/跳路由" ──
export class MockIntentLLM implements LLM {
  async chat(userText: string, tools: ToolDef[]): Promise<AgentReply> {
    const t = userText.trim();
    const has = (re: RegExp) => re.test(t);

    if (has(/你好|您好|hi|hello|嗨/i))
      return { text: '你好呀!我是清秋月的数字助理,可以帮你查数据、跳页面、点按钮、填表、指数据。', emotion: 'happy', action: 'greet' };

    // 操作界面:点击 / 填写 / 指向
    let m = t.match(/(?:点击|点一下|按一下|按)\s*[""]?([^""，。]+?)[""]?\s*(?:按钮|菜单|这个)?$/);
    if (m) return { text: `好的,帮你点击「${m[1].trim()}」。`, toolCalls: [{ name: 'clickButton', args: { text: m[1].trim() } }] };

    m = t.match(/(?:填|输入|写)\s*[""]?([^""，。]+?)[""]?\s*(?:为|=|:|:)\s*[""]?([^""，。]+)/);
    if (m) return { text: `好的,把「${m[1].trim()}」填成「${m[2].trim()}」。`, toolCalls: [{ name: 'fillInput', args: { near: m[1].trim(), value: m[2].trim() } }] };

    m = t.match(/[""]?([^""，。]+?)[""]?\s*在哪|指出?\s*[""]?([^""，。]+)|指给我看?\s*[""]?([^""，。]+)/);
    if (m) { const q = (m[1] || m[2] || m[3] || '').trim(); if (q) return { text: `它在这里 👉`, toolCalls: [{ name: 'pointAt', args: { text: q } }] }; }

    if (has(/悬赏|赏金|任务/))
      return { text: '好的,这就带你去悬赏中心,顺便查一下进行中的任务。', action: 'wave', toolCalls: [{ name: 'openRewardCenter', args: {} }, { name: 'listRewardTasks', args: { status: '' } }] };

    if (has(/搜索|搜一下|查一下/)) {
      const kw = t.replace(/.*(搜索|搜一下|查一下)/, '').trim() || '清秋月';
      return { text: `好的,帮你搜索「${kw}」。`, toolCalls: [{ name: 'searchContent', args: { keyword: kw } }] };
    }

    if (has(/用户管理|用户列表/))
      return { text: '带你去用户管理页面。', toolCalls: [{ name: 'navigate', args: { path: '/system/user' } }] };

    if (has(/首页|推荐|回去|返回/))
      return { text: '好的,回到首页推荐。', toolCalls: [{ name: 'goHomeFeed', args: {} }] };

    if (has(/跳.{0,2}舞|舞蹈/)) return { text: '来段舞蹈!', action: 'dance', emotion: 'happy' };
    if (has(/唱.{0,2}歌/)) return { text: '为你唱一首~', action: 'sing', emotion: 'happy' };
    if (has(/坐.{0,2}下|坐会|坐一/)) return { text: '好的,我坐下啦。', action: 'sit' };
    if (has(/再见|拜拜|bye/i)) return { text: '再见啦,下次见!', action: 'leave', emotion: 'happy' };

    // 兜底:回显 + 提示能力(并把工具清单作为"能力说明")
    return {
      text: `我听到你说「${t}」。我能帮你跳转页面、查询悬赏/内容等。`,
      emotion: 'neutral',
    };
  }
}

// ── 真实大模型:POST 到你的网关 /api/avatar/chat,服务端做 function-calling ──
export class RemoteLLM implements LLM {
  constructor(private endpoint = '/api/avatar/chat') {}
  async chat(userText: string, tools: ToolDef[], history: { role: string; content: string }[]): Promise<AgentReply> {
    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: userText,
        history,
        toolsPrompt: toolsAsPrompt(tools),
        tools: tools.map((t) => ({ name: t.name, description: t.description, params: t.params })),
      }),
    });
    if (!res.ok) throw new Error(`LLM ${res.status}`);
    const data = await res.json();
    // 期望服务端返回 { text, emotion?, action?, toolCalls? }
    return (data?.data ?? data) as AgentReply;
  }
}
