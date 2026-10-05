/**
 * 数字人回复文本里的形象指令(<emotion:x/> / <action:y/> / <mouth:speak/> / <ui:{json}/> / 旁注)
 * 的纯解析:切句、剥离、提取。从 useChatAvatarWS.ts 拆出,行为不变。
 */
import { devLog } from '@/lib/dev-log';

/** 句末标点:流式朗读按这些切句 */
const SENTENCE_END = /[。！？!?；;\n]/;

/**
 * 返回 text 中最后一个句末标点之后的位置(没有则返回 0)。
 * 用于「攒够一整句就先读出来」——首次出声不必等整段生成完。
 */
export function lastSentenceEnd(text: string): number {
  for (let i = text.length - 1; i >= 0; i--) {
    if (SENTENCE_END.test(text[i])) return i + 1;
  }
  return 0;
}

// 智能过滤 TTS 内容:跳过代码块、复杂数据、URL、文件路径等
export function filterTTSContent(text: string): string {
  if (!text) return '';

  // 按行分割
  const lines = text.split('\n');
  const filtered: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    // 跳过空行
    if (!trimmed) continue;

    // 跳过英文思考过程 (user is saying..., I should..., Let me...)
    if (/^(user is|i should|let me|i need|i will|i'm going|the user|this is)/i.test(trimmed)) continue;

    // 跳过代码块标记
    if (trimmed.startsWith('```') || trimmed.startsWith('`') && trimmed.endsWith('`')) continue;

    // 跳过纯代码行(包含大量编程符号)
    if (/^[\s]*[{}();=<>!@#$%^&*+\[\]|\\\/~`"'-][\s]*$/.test(trimmed) && trimmed.length > 3) continue;

    // 跳过 URL
    if (/^https?:\/\//.test(trimmed) || /^www\./.test(trimmed)) continue;

    // 跳过文件路径
    if (/^[A-Za-z]:\\/.test(trimmed) || /^\/[a-z]/.test(trimmed)) continue;

    // 跳过 markdown 标题
    if (/^#{1,6}\s/.test(trimmed)) continue;

    // 跳过列表标记开头的复杂内容(如 "- [x] task")
    if (/^[-*+]\s*\[/.test(trimmed)) continue;

    // 跳过 JSON/XML 片段
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) continue;
    if (trimmed.startsWith('<') && trimmed.endsWith('>')) continue;

    // 跳过数字列表项(如 "1. item")
    if (/^\d+\.\s/.test(trimmed) && trimmed.length < 5) continue;

    // 保留有意义的文本
    filtered.push(trimmed);
  }

  // 合并并限制长度
  const result = filtered.join(' ').trim();
  // 如果过滤后太短,返回空(不读)
  if (result.length < 3) return '';
  // 限制 TTS 长度 (避免读太长)
  return result.slice(0, 500);
}

/**
 * 模型有时在回答末尾写一段 <annotation>…</annotation> 旁注(自述这句为什么这么答),
 * 不是说给用户的:气泡里不显示,也不朗读。
 */
const ANNOTATION_RE = /<annotation\b[^>]*>[\s\S]*?<\/annotation>/g;

/**
 * 从原始流式文本里切出「下一批可以念的完整句子」,保留其中的形象指令。
 *
 * 在原文(带标签)上切,而不是在剥掉标签的文本上切 —— 只有这样才知道每个标签属于哪一句。
 * 标签先按原长度打码再找句末标点:<ui:{"url":"https://a.b"}/> 里的句点不能当成句子结尾。
 * 末尾没闭合的标签(还在流式传输中)整个留到下一轮。
 */
export function cutSpeakable(raw: string, from: number, final: boolean): { chunk: string; next: number } {
  let pending = raw.slice(from);
  if (!final) {
    const open = pending.lastIndexOf('<');
    const tail = open >= 0 ? pending.slice(open) : '';
    const heads = ['<emotion:', '<action:', '<mouth:', '<ui:', '<annotation'];
    if (tail && !tail.includes('/>') && heads.some((h) => tail.startsWith(h) || h.startsWith(tail))) {
      pending = pending.slice(0, open);
    }
    // 旁注 <annotation>…</annotation> 还没写完:先别读到它,等闭合了整段剥掉
    const ann = pending.search(/<annotation\b[^>]*>(?![\s\S]*<\/annotation>)/);
    if (ann >= 0) pending = pending.slice(0, ann);
  }
  if (!pending) return { chunk: '', next: from };
  if (final) return { chunk: pending, next: from + pending.length };

  const masked = maskDirectives(pending);
  const cut = lastSentenceEnd(masked);
  if (cut <= 0) return { chunk: '', next: from };
  return { chunk: pending.slice(0, cut), next: from + cut };
}

/** 把完整的形象指令标签替换成等长的占位符(不含任何标点)。 */
export function maskDirectives(text: string): string {
  let out = text.replace(/<(?:emotion|action):[a-zA-Z_]+\/>|<mouth:speak\/>/g, (m) => '\u0001'.repeat(m.length));
  // <ui:{json}/>:用剥离器找出它剥掉了哪些区间太绕,直接按「<ui: 到下一个 />」打码即可 ——
  // 多码一点只会让句子切得晚一些,不会切错。
  out = out.replace(/<ui:[\s\S]*?\/>/g, (m) => '\u0001'.repeat(m.length));
  // 旁注里有句号,不能在它中间切句
  out = out.replace(ANNOTATION_RE, (m) => '\u0001'.repeat(m.length));
  return out;
}

// G2: 解析数字人形象指令 <emotion:x/> / <action:y/> / <mouth:speak/>,
// 映射成 onToolCalls 能识别的 DhToolCall(face.setExpression / body.playAction / mouth.speak)。
/**
 * 扫出文本里的 <ui:{json}/> 指令(目前只剩 iframe 一种用法:让数字人开网页/视频)。
 *
 * 用花括号配对扫描,不用正则。旧代码这里有两条写法不一致的正则:
 *   解析用 /<ui:(\{[^}]*(?:,\s*"[^"]*"\s*:[^}]*)*\})\/>/  —— [^}] 跨不过嵌套花括号
 *   剥离用 /<ui:((?:[^{}]|\{[^{}]*\})*)\/>/                —— 能跨一层
 * 于是带嵌套的 UI 指令「既解析不出来、也剥不掉」,原始 JSON 直接漏进聊天气泡,
 * 还会被 TTS 一字一句念出来。
 *
 * 列表/表单/网格已改走 AG-UI 工具调用(ui_show_list 等),不再从这条文本通道走。
 *
 * 返回解析出的对象和剥掉指令后的文本,保证「解析到的」与「剥掉的」永远是同一批。
 */
export function extractUiDirectives(text: string): { uis: unknown[]; stripped: string } {
  const TAG = '<ui:';
  const uis: unknown[] = [];
  let out = '';
  let i = 0;

  while (i < text.length) {
    const start = text.indexOf(TAG, i);
    if (start < 0) { out += text.slice(i); break; }

    // 从 '{' 开始做花括号配对(跳过字符串字面量里的括号)
    let j = start + TAG.length;
    if (text[j] !== '{') { out += text.slice(i, j); i = j; continue; }
    let depth = 0;
    let inStr = false;
    let esc = false;
    let end = -1;
    for (; j < text.length; j++) {
      const ch = text[j];
      if (inStr) {
        if (esc) esc = false;
        else if (ch === '\\') esc = true;
        else if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') inStr = true;
      else if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) { end = j; break; }
      }
    }
    // 没闭合(还在流式传输中)→ 原样保留,等后续 chunk
    if (end < 0) { out += text.slice(i); break; }
    if (text.slice(end + 1, end + 3) !== '/>') {
      out += text.slice(i, end + 1);
      i = end + 1;
      continue;
    }

    out += text.slice(i, start);
    try {
      const parsed = JSON.parse(text.slice(start + TAG.length, end + 1));
      if (parsed && typeof parsed === 'object') uis.push(parsed);
    } catch { /* JSON 坏了就整条丢弃,不阻断对话 */ }
    i = end + 3;
  }

  return { uis, stripped: out };
}

/**
 * 剥掉形象指令标签,得到可显示 / 可朗读的纯文本。
 * <emotion:x/> / <action:x/> / <mouth:speak/> 用正则,<ui:{json}/> 用上面的配对扫描。
 */
export function stripAvatarDirectives(text: string): string {
  return extractUiDirectives(text).stripped
    .replace(/<emotion:[a-zA-Z_]+\/>/g, '')
    .replace(/<action:[a-zA-Z_]+\/>/g, '')
    .replace(/<mouth:speak\/>/g, '')
    .replace(ANNOTATION_RE, '')
    // 流式输出里还没闭合的旁注:先藏起来,闭合后上面那条整段剥掉
    .replace(/<annotation\b[^>]*>[\s\S]*$/, '')
    .trimEnd();
}

export type AvatarToolCall = { name: string; args: Record<string, any> };

/** I1: LLM 可能把 < > 转义成 </>,先还原再解析 */
export function unescapeDirectives(text: string): string {
  return text
    .replace(/\\u003c/g, '<')
    .replace(/\\u003e/g, '>')
    .replace(/\\u0026/g, '&')
    .replace(/\\"/g, '"');
}

/** 从(已还原转义的)文本里按派发顺序收集形象指令:动作 → 表情 → 口型 */
export function collectAvatarCalls(raw: string): AvatarToolCall[] {
  const calls: AvatarToolCall[] = [];
  let m: RegExpExecArray | null;
  // 动作 <action:xxx/> —— 排在表情前面:舞台在播动作时会顺手套上这个动作的默认表情,
  // 表情后派发,模型明确写的 <emotion:x/> 才不会被动作的默认表情盖掉。
  const actRe = /<action:([a-zA-Z_]+)\/>/g;
  while ((m = actRe.exec(raw))) {
    calls.push({ name: 'body.playAction', args: { name: m[1] } });
  }
  // 表情 <emotion:xxx/>
  const emoRe = /<emotion:([a-zA-Z_]+)\/>/g;
  while ((m = emoRe.exec(raw))) {
    calls.push({ name: 'face.setExpression', args: { name: m[1] } });
  }
  // 口型 <mouth:speak/> —— 按字数猜的口型时间线,只在没有真实语音可分析时当兜底
  //(见 VrmStage:音频在驱动嘴时时间线自动让位)
  const mouthRe = /<mouth:speak\/>/g;
  while ((m = mouthRe.exec(raw))) {
    calls.push({ name: 'mouth.speak', args: { text: stripAvatarDirectives(raw) } });
  }
  return calls;
}

/**
 * 解析形象指令。
 *
 * ⚠️ 必须只喂「新到达的那一段文本」,不能喂累积全文。
 * 旧代码每收到一个 delta 就把 fullText 整段重解析一遍,于是开头的
 * <action:wave/> 会在每一片上重复触发一次 —— 一条回复分 N 片就派发 N 次动作,
 * 动画被反复打断重启,动态 UI 面板也会重复弹 N 次。
 */
export function parseAvatarDirectives(
  text: string,
  options: { onUI?: (ui: any) => void; onToolCalls?: (calls: AvatarToolCall[]) => void },
) {
  const raw = unescapeDirectives(text);
  const calls = collectAvatarCalls(raw);
  // <ui:{json}/>:目前只剩 iframe 用法(开网页/视频),交给入口组件的虚拟浏览器
  if (options.onUI) {
    for (const ui of extractUiDirectives(raw).uis) {
      if (ui && typeof ui === 'object' && (ui as { type?: unknown }).type) options.onUI(ui);
    }
  }
  if (calls.length > 0) {
    devLog.debug('[parseAvatarDirectives] found calls:', calls.map(c => c.name));
    options.onToolCalls?.(calls);
  }
}
