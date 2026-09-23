/**
 * 章节正文:取正文的协议、react-query 缓存键、正文 → 段落。
 * 滚动模式(ChapterBlock)和分页模式(usePaginatedReader / pagination.ts)共用这一份,
 * 两边拆段规则不一致的话,同一章在两种模式下显示的段落会对不上。
 */

/** 章正文 fetch 协议 */
export interface ChapterBody {
  content?: string;
  body?: string;
  locked?: boolean;
}
export type FetchChapterBody = (chapterId: string) => Promise<ChapterBody>;

/** 章正文在 react-query 里的缓存时长与键:滚动 / 分页两种模式共用同一份缓存 */
export const CHAPTER_STALE_MS = 10 * 60 * 1000;
export const chapterQueryKey = (chapterId: string) => ['novel-chapter', chapterId] as const;

/** 正文按换行拆段;去掉源站自带的段首空格(全角/半角),缩进统一交给 text-indent。 */
export function splitParagraphs(body: string): string[] {
  return body
    .replace(/\r\n?/g, '\n')
    .split(/\n+/)
    .map((line) => line.replace(/^[\s\u3000\u00a0]+|[\s\u3000\u00a0]+$/g, ''))
    .filter(Boolean);
}

/**
 * 从 chapter.content 提取段落数组。两种格式:
 *  1. JSON 字符串:`{"chapters":[{"body":"..."}, ...]}` —— legacy 整本存一行的书
 *  2. 普通正文:换行分段
 */
export function extractParagraphs(content: string): string[] {
  const s = content.trim();
  if (s.startsWith('{') && s.includes('"chapters"')) {
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed?.chapters)) {
        return parsed.chapters
          .map((c: { body?: string }) => (typeof c?.body === 'string' ? c.body : ''))
          .filter(Boolean)
          .flatMap(splitParagraphs);
      }
    } catch {
      // JSON 解析失败,降级为普通正文
    }
  }
  return splitParagraphs(content);
}

export function wordCount(body: string): number {
  return body.replace(/[\s\u3000\u00a0]/g, '').length;
}
