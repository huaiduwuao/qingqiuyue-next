/**
 * Intent Router — LLM function calling 识别意图
 *
 * 输入: 用户文本 (语音转写或键盘)
 * 输出: Intent 对象 + 给数字人朗读的确认文本
 */

import type { Intent, IntentResult, IntentRouterOptions, SystemAction } from './types'

const DEFAULT_MODEL = 'MiniMax-M2.7-highspeed'
const DEFAULT_BASE_URL = 'https://api.minimaxi.com/v1'

const SYSTEM_PROMPT = `你是数字人的"意图路由器"。把用户输入解析成结构化 Intent。

## 当前时间
当前日期: \${CURRENT_DATE}
星期: \${CURRENT_WEEKDAY}
(LLM 训练数据截止后的事,你没有这些信息 — 用户问"今天星期几"时,如实答 \${CURRENT_WEEKDAY} 即可,不要编)

## 可用 Intent 类型:

1. **chat** — 普通聊天 / 问答 / 寒暄
   { type: "chat", text: "回复文本", agentId: "digital_human" }
   例: "你好" "今天心情不错" "讲个笑话" "今天星期几"

2. **navigate** — 前端页面跳转(用户明确说要去某个页面)
   { type: "navigate", path: "/xxx", label: "页面名" }
   触发: "打开首页" "去悬赏中心" "跳到钱包" "我的个人中心" "看看数字人工作台"
   常见路径: / (首页) /home /digital-human /account /account/center
             /account/content /account/msg /system/moderation/reports (管理面)

3. **open_external** — 显示外部 URL(弹窗 iframe 或新标签页,用户想看的东西)
   { type: "open_external", url: "https://...", label: "页面名", mode: "iframe" | "newtab" }
   触发: "打开百度" "看看知乎" "搜索 xxx" "让我看谷歌" "打开 wikipedia"
   常见 URL: 百度 https://www.baidu.com / 知乎 https://www.zhihu.com
             github https://github.com / wikipedia https://zh.wikipedia.org
   缺省 mode: "iframe"(在站内弹窗显示,不离开 app)

3. **delegate** — 委派任务给其他 agent (异步执行, 完成后通知)
   { type: "delegate", agentId: "comfyui_helper", task: "具体任务描述" }
   可用 agent: comfyui_helper (出图), coder (代码/git), researcher (搜索)

4. **switch** — 切换当前对话角色 (长期)
   { type: "switch", agentId: "coder" }
   用户说"切换到前端开发"、"让代码助手来"等触发

5. **return** — 返回上一个角色 (从临时委派退出)
   { type: "return" }
   用户说"退回来"、"回到清秋月"、"结束专家模式"等触发

6. **cron** — 定时任务
   { type: "cron", cronExpr: "0 8 * * *", prompt: "到点要执行的内容", agentId?: "可选" }

7. **system** — 系统控制
   { type: "system", action: "volume-up" | "volume-down" | "mute" | "theme-dark" | ... }

8. **query** — 查询历史
   { type: "query", kind: "conversation" | "task" | "artifact", query: "搜索关键词" }

9. **multi** — 多个意图组合 (例: "画只猫并保存到收藏")
   { type: "multi", intents: [Intent, Intent, ...] }

## 规则:
- 模糊的寒暄/闲聊 / 知识问答 → chat
- **明确说要去某页面** → navigate (高优先级,不要 fallback 到 chat)
- 明确指令 → delegate / navigate / system / cron
- 多个独立任务 → multi
- 闲聊中夹杂任务 → multi (chat + 任务)
- 输出严格 JSON, 不要 markdown 代码块, 不要解释

## 数字人表情 + 动作 (必填, 让 3D 角色有灵性)
除 intents 数组外, 还要返回顶层 emotion + avatarAction:
- emotion: 这次回复的情绪(驱动 VRM 表情 BlendShape)
  - smile     → 友好/开心/同意
  - surprised → 惊讶/没想到/oh
  - angry     → 不满/生气/警告
  - sad       → 抱歉/难过/遗憾
  - neutral   → 默认/不知道
- avatarAction: 这次回复同时做的肢体动作(驱动 VRM bone rotation)
  - idle    → 默认,呼吸+摆头
  - wave    → 打招呼/再见
  - think   → 思考/分析/不知道
  - point   → 指向/这个/那边
  - bow     → 道歉/感谢
  - dance   → 庆祝/音乐/跳舞
  - sing    → 唱歌/哼歌
  - walk    → 走动/动起来
  - sit     → 累了/坐下
  - talk    → 说话时配合胸腔起伏

例:
  用户"今天好开心啊" → { emotion: 'smile', avatarAction: 'dance', intents: [{type:'chat', text:'是呢今天真不错', agentId:'digital_human'}] }
  用户"打开百度" → { emotion: 'neutral', avatarAction: 'point', intents: [{type:'open_external', url:'https://baidu.com', label:'百度'}] }
  用户"跳舞给我看" → { emotion: 'smile', avatarAction: 'dance', intents: [{type:'chat', text:'好呀!', agentId:'digital_human'}] }`

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'emit_intent',
      description: 'Emit the parsed intent(s) for the user input',
      parameters: {
        type: 'object',
        properties: {
          replyText: { type: 'string', description: '数字人简短确认文本 (1-2 句)' },
          intents: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                type: { type: 'string', enum: ['chat','navigate','open_external','delegate','switch','return','cron','system','query','multi'] },
                text: { type: 'string' },
                agentId: { type: 'string' },
                path: { type: 'string' },
                url: { type: 'string' },
                mode: { type: 'string', enum: ['iframe','newtab'] },
                label: { type: 'string' },
                task: { type: 'string' },
                cronExpr: { type: 'string' },
                prompt: { type: 'string' },
                action: { type: 'string' },
                params: { type: 'object' },
                kind: { type: 'string', enum: ['conversation','task','artifact'] },
                query: { type: 'string' },
                intents: { type: 'array', items: { type: 'object' } },
                emotion: { type: 'string', enum: ['smile','angry','sad','surprised','neutral'] },
                avatarAction: { type: 'string', enum: ['idle','wave','think','point','bow','dance','sing','walk','sit','talk'] },
              },
              required: ['type'],
            },
          },
        },
        required: ['replyText', 'intents'],
      },
    },
  },
]

export async function routeIntent(
  userInput: string,
  opts: IntentRouterOptions = {}
): Promise<IntentResult> {
  const apiKey = opts.apiKey || process.env.OPENAI_API_KEY
  const baseUrl = (opts.baseUrl || process.env.OPENAI_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '')
  const model = opts.model || process.env.OPENAI_MODEL || DEFAULT_MODEL

  if (!apiKey) {
    // fallback: 当成普通 chat
    return {
      intent: { type: 'chat', text: userInput, agentId: 'digital_human' },
      replyText: '',
      awaitExecution: false,
    }
  }

  // 注入当前日期(LLM 不知道真实时间)
  const now = new Date()
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
  const weekdayStr = weekdays[now.getDay()]
  const dynamicPrompt = SYSTEM_PROMPT
    .replace('${CURRENT_DATE}', dateStr)
    .replace('${CURRENT_WEEKDAY}', weekdayStr)

  let ctx = ''
  if (opts.availableAgents?.length) {
    ctx += `\n## 当前可用 agent:\n${opts.availableAgents.map((a) => `- ${a.id} (${a.displayName}): ${a.description}`).join('\n')}\n`
  }
  if (opts.systemContext) ctx += `\n## 当前页面/状态:\n${opts.systemContext}\n`

  const r = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: dynamicPrompt + ctx },
        { role: 'user', content: userInput },
      ],
      tools: TOOLS,
      tool_choice: { type: 'function', function: { name: 'emit_intent' } },
      temperature: 0.2,
    }),
  })

  if (!r.ok) {
    console.error('[router] LLM error:', r.status, await r.text().catch(() => ''))
    // fallback
    return {
      intent: { type: 'chat', text: userInput, agentId: 'digital_human' },
      replyText: '',
      awaitExecution: false,
    }
  }

  const j = await r.json()
  const toolCall = j?.choices?.[0]?.message?.tool_calls?.[0]
  if (!toolCall || toolCall.function?.name !== 'emit_intent') {
    // 没解析出工具调用, fallback chat
    return {
      intent: { type: 'chat', text: userInput, agentId: 'digital_human' },
      replyText: '',
      awaitExecution: false,
    }
  }

  let parsed: { replyText: string; intents: Intent[]; emotion?: string; avatarAction?: string }
  try {
    const args = toolCall.function.arguments
    parsed = typeof args === 'string' ? JSON.parse(args) : args
  } catch {
    return {
      intent: { type: 'chat', text: userInput, agentId: 'digital_human' },
      replyText: '',
      awaitExecution: false,
    }
  }

  // 取第一个 intent (multi 拆开递归)
  const intents = parsed.intents || []
  const first = intents[0]
  if (!first) {
    return {
      intent: { type: 'chat', text: userInput, agentId: 'digital_human' },
      replyText: parsed.replyText || '',
      awaitExecution: false,
    }
  }

  const intent: Intent = first as Intent

  // 需要 awaitExecution 的类型 (执行后才能回复)
  const awaitTypes = new Set(['navigate', 'open_external', 'system'])

  // 提取 LLM 决定的表情/动作(让数字人有"灵性",不只是傻站着)
  // emotion: smile | angry | sad | surprised | neutral
  // action:  idle | wave | think | point | bow | dance | sing | walk | sit | talk
  return {
    intent,
    replyText: parsed.replyText || '',
    emotion: parsed.emotion,
    action: parsed.avatarAction,
    awaitExecution: awaitTypes.has(intent.type),
  }
}