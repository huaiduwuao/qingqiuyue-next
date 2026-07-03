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

4. **walk_to** — 数字人走到页面上某个位置(让 3D 角色在 UI 上"乱走", 体现灵性)
   { type: "walk_to", target: "sidebar" | "header" | "footer" | "center" | "cursor" | {x: number, y: number}, durationMs?: number }
   触发: "走到屏幕中间" "去侧边栏" "到这里来" "到我鼠标位置" "去页头"
   target:
     - "sidebar"  → 屏幕最左
     - "header"   → 屏幕最上
     - "footer"   → 屏幕最下
     - "center"   → 屏幕中央
     - "cursor"   → 用户鼠标位置
     - {x,y}      → 屏幕坐标
   durationMs: 走路时长, 默认 1500ms
   走路时 avatarAction='walk' 配合动作, 走完回 'idle'

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
                type: { type: 'string', enum: ['chat','navigate','open_external','walk_to','delegate','switch','return','cron','system','query','multi'] },
                text: { type: 'string' },
                agentId: { type: 'string' },
                path: { type: 'string' },
                url: { type: 'string' },
                mode: { type: 'string', enum: ['iframe','newtab'] },
                target: {
                  oneOf: [
                    { type: 'string', enum: ['sidebar','header','footer','center','cursor'] },
                    { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' } } },
                  ],
                },
                durationMs: { type: 'number' },
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

const NAVIGATION_KEYWORDS: Array<{ pattern: RegExp; path: string; label: string }> = [
  { pattern: /^(打开|去|进入|跳转|查看).*首页/, path: '/', label: '首页' },
  { pattern: /^(打开|去|进入|跳转|查看).*数字人(工作台|页面)?/, path: '/digital-human', label: '数字人' },
  { pattern: /^(打开|去|进入|跳转|查看).*个人中心/, path: '/account/center', label: '个人中心' },
  { pattern: /^(打开|去|进入|跳转|查看).*我的(内容|作品)/, path: '/account/content', label: '我的内容' },
  { pattern: /^(打开|去|进入|跳转|查看).*消息/, path: '/account/msg', label: '消息' },
  { pattern: /^(打开|去|进入|跳转|查看).*钱包/, path: '/account/wallet', label: '钱包' },
  { pattern: /^(打开|去|进入|跳转|查看).*悬赏/, path: '/reward', label: '悬赏中心' },
  { pattern: /^(打开|去|进入|跳转|查看).*管理(后台|面板)/, path: '/system/user', label: '管理后台' },
]

const EXTERNAL_KEYWORDS: Array<{ pattern: RegExp; url: string; label: string }> = [
  { pattern: /^(打开|搜索|查看)?\s*百度/, url: 'https://www.baidu.com', label: '百度' },
  { pattern: /^(打开|搜索|查看)?\s*知乎/, url: 'https://www.zhihu.com', label: '知乎' },
  { pattern: /^(打开|查看)?\s*github/i, url: 'https://github.com', label: 'GitHub' },
  { pattern: /^(打开|查看)?\s*wikipedia|维基百科/, url: 'https://zh.wikipedia.org', label: '维基百科' },
  { pattern: /^(打开|查看)?\s*谷歌|google/i, url: 'https://www.google.com', label: 'Google' },
]

const SYSTEM_KEYWORDS: Array<{ pattern: RegExp; action: SystemAction; replyText: string }> = [
  { pattern: /音量(增大|大一点|放大|提高|上升|增加|向上|\+)/, action: 'volume-up', replyText: '已调高音量' },
  { pattern: /音量(减小|小一点|降低|下降|减少|向下|-)/, action: 'volume-down', replyText: '已调低音量' },
  { pattern: /^(静音|关闭声音|关掉声音)/, action: 'mute', replyText: '已静音' },
  { pattern: /^(取消静音|恢复声音|打开声音)/, action: 'unmute', replyText: '已恢复声音' },
  { pattern: /^(亮色主题|浅色主题|浅色模式|明亮模式)/, action: 'theme-light', replyText: '已切换为浅色主题' },
  { pattern: /^(暗色主题|深色主题|深色模式|暗黑模式|黑暗模式)/, action: 'theme-dark', replyText: '已切换为深色主题' },
  { pattern: /^(全屏|进入全屏|打开全屏)/, action: 'fullscreen-on', replyText: '已进入全屏' },
  { pattern: /^(退出全屏|取消全屏|关闭全屏)/, action: 'fullscreen-off', replyText: '已退出全屏' },
  { pattern: /^(刷新|重新加载|reload|刷新页面)/, action: 'reload', replyText: '正在刷新页面' },
  { pattern: /^(退出登录|登出|logout|注销)/, action: 'logout', replyText: '正在退出登录' },
]

const WALK_KEYWORDS: Array<{ pattern: RegExp; target: Extract<Intent, { type: 'walk_to' }>['target'] }> = [
  { pattern: /(走到|去|移动到).*中间|中央|正中/, target: 'center' },
  { pattern: /(走到|去|移动到).*左边|左侧|侧边栏|最左/, target: 'sidebar' },
  { pattern: /(走到|去|移动到).*上边|顶部|页头|最上/, target: 'header' },
  { pattern: /(走到|去|移动到).*下边|底部|页脚|最下/, target: 'footer' },
  { pattern: /(走到|去|移动到).*鼠标|光标|指针/, target: 'cursor' },
]

function keywordRoute(input: string): IntentResult | null {
  const text = input.trim()
  for (const nav of NAVIGATION_KEYWORDS) {
    if (nav.pattern.test(text)) {
      return {
        intent: { type: 'navigate', path: nav.path, label: nav.label },
        replyText: `好的, 带你去${nav.label}`,
        emotion: 'neutral',
        action: 'point',
        awaitExecution: true,
      }
    }
  }
  for (const ext of EXTERNAL_KEYWORDS) {
    if (ext.pattern.test(text)) {
      return {
        intent: { type: 'open_external', url: ext.url, label: ext.label, mode: 'iframe' },
        replyText: `好的, 打开${ext.label}`,
        emotion: 'neutral',
        action: 'point',
        awaitExecution: true,
      }
    }
  }
  for (const sys of SYSTEM_KEYWORDS) {
    if (sys.pattern.test(text)) {
      return {
        intent: { type: 'system', action: sys.action },
        replyText: sys.replyText,
        emotion: 'neutral',
        action: 'wave',
        awaitExecution: true,
      }
    }
  }
  for (const walk of WALK_KEYWORDS) {
    if (walk.pattern.test(text)) {
      return {
        intent: { type: 'walk_to', target: walk.target },
        replyText: '好的, 我这就过去',
        emotion: 'smile',
        action: 'walk',
        awaitExecution: true,
      }
    }
  }
  return null
}

export async function routeIntent(
  userInput: string,
  opts: IntentRouterOptions = {}
): Promise<IntentResult> {
  const apiKey = opts.apiKey || process.env.OPENAI_API_KEY
  const baseUrl = (opts.baseUrl || process.env.OPENAI_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '')
  const model = opts.model || process.env.OPENAI_MODEL || DEFAULT_MODEL

  if (!apiKey) {
    // fallback: 关键词规则兜底, 避免所有非 chat 意图失效
    const kw = keywordRoute(userInput)
    if (kw) return kw
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
    const kw = keywordRoute(userInput)
    if (kw) return kw
    return {
      intent: { type: 'chat', text: userInput, agentId: 'digital_human' },
      replyText: '',
      awaitExecution: false,
    }
  }

  const j = await r.json()
  const toolCall = j?.choices?.[0]?.message?.tool_calls?.[0]
  if (!toolCall || toolCall.function?.name !== 'emit_intent') {
    // 没解析出工具调用, fallback chat (先尝试关键词兜底)
    const kw = keywordRoute(userInput)
    if (kw) return kw
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
    const kw = keywordRoute(userInput)
    if (kw) return kw
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