import { describe, it, expect } from 'vitest';
import { cutSpeakable, stripAvatarDirectives } from '../useChatAvatarWS';

/** 模拟流式到达:每来一段就切一次,收集切出来的句子 */
function stream(parts: string[]): string[] {
  let raw = '';
  let at = 0;
  const out: string[] = [];
  parts.forEach((p, i) => {
    raw += p;
    const { chunk, next } = cutSpeakable(raw, at, i === parts.length - 1);
    if (chunk) out.push(chunk);
    at = next;
  });
  return out;
}

describe('cutSpeakable —— 形象指令跟着它所在的那句话走', () => {
  it('每句话带着自己句首的标签,不会提前跑到上一句', () => {
    const chunks = stream(['<emotion:happy/><action:wave/>嗨,我在呢。', '<emotion:sad/>不过这个我没找到。', '']);
    expect(chunks).toEqual(['<emotion:happy/><action:wave/>嗨,我在呢。', '<emotion:sad/>不过这个我没找到。']);
  });

  it('没凑成整句就先不切', () => {
    expect(cutSpeakable('<emotion:happy/>我想想', 0, false)).toEqual({ chunk: '', next: 0 });
  });

  it('标签被分片截断时整个留到下一轮,不会切出半个标签', () => {
    const chunks = stream(['好的。<emot', 'ion:happy/>找到了!', '']);
    expect(chunks).toEqual(['好的。', '<emotion:happy/>找到了!']);
    for (const c of chunks) expect(stripAvatarDirectives(c)).not.toContain('<');
  });

  it('<ui:{json}/> 里的句点、问号不算句子结尾', () => {
    const raw = '给你打开<ui:{"type":"iframe","url":"https://a.b/c?d=1"}/>看看';
    expect(cutSpeakable(raw, 0, false)).toEqual({ chunk: '', next: 0 });
    expect(cutSpeakable(raw, 0, true).chunk).toBe(raw);
  });

  it('正文里单独的 < 不会把后面的话一直扣住', () => {
    const { chunk } = cutSpeakable('如果 a < b 就选 a。然后', 0, false);
    expect(chunk).toBe('如果 a < b 就选 a。');
  });

  it('收尾时把剩下的(包括只有标签的尾巴)一次交出去', () => {
    const chunks = stream(['说完了。', '<action:bow/>']);
    expect(chunks).toEqual(['说完了。', '<action:bow/>']);
  });
});
