import { contentClient } from '@/lib/api/client';
import {NovelChapterItem} from "@/beans/content";

// Mock enabled for development
const MOCK_ENABLED = true;
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const mockData = [
  { id: 1, title: "Novel Chapter 1", name: "Chapter 1", num: "1", url: "https://example.com/ch1", moduleContentId: "1", collected: false, content: "Chapter 1 content", novelName: "Test Novel", novelId: 1, fullContent: "Full content here", permission: "public" },
  { id: 2, title: "Novel Chapter 2", name: "Chapter 2", num: "2", url: "https://example.com/ch2", moduleContentId: "1", collected: true, content: "Chapter 2 content", novelName: "Test Novel", novelId: 1, fullContent: "Full content here", permission: "public" },
  { id: 3, title: "Novel Chapter 3", name: "Chapter 3", num: "3", url: "https://example.com/ch3", moduleContentId: "1", collected: false, content: "Chapter 3 content", novelName: "Test Novel", novelId: 1, fullContent: "Full content here", permission: "public" },
  { id: 4, title: "Novel Chapter 4", name: "Chapter 4", num: "4", url: "https://example.com/ch4", moduleContentId: "1", collected: false, content: "Chapter 4 content", novelName: "Test Novel", novelId: 1, fullContent: "Full content here", permission: "public" },
  { id: 5, title: "Novel Chapter 5", name: "Chapter 5", num: "5", url: "https://example.com/ch5", moduleContentId: "1", collected: true, content: "Chapter 5 content", novelName: "Test Novel", novelId: 1, fullContent: "Full content here", permission: "public" },
];


export async function page(params: any) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: { records: mockData, totalRow: mockData.length } };
  }
  return contentClient("client-content/novel-chapter/page", {
    params
  });
}

export async function remove(ids: number[]) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: null };
  }
  return contentClient("client-content/novel-chapter/removeByIds", {
    method: "DELETE",
    data: ids
  });
}

export async function sync(params: NovelChapterItem) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: { id: Date.now(), ...params } };
  }
  return contentClient("client-content/novel-chapter/sync", {
    method: "POST",
    data: params
  });
}

export async function save(params: NovelChapterItem) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: { id: Date.now(), ...params } };
  }
  return contentClient("client-content/novel-chapter/save", {
    method: "POST",
    data: params
  });
}

export async function update(params: NovelChapterItem) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: params };
  }
  return contentClient("client-content/novel-chapter/update", {
    method: "POST",
    data: params
  });
}

export async function correctLastRead(params: any) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: null };
  }
  return contentClient("client-content/novel-bookshelf/correctLastRead", {
    method: "POST",
    data: params
  });
}

export async function get(params: NovelChapterItem) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: mockData[0] };
  }
  return contentClient("client-content/novel-chapter/detail", {
    params
  });
}

export async function addShelf(params: any) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: null };
  }
  return contentClient('client-content/novel-bookshelf/add', {
    method: "POST",
    data: params
  });
}

export async function getNovel(params: any) {
  if (MOCK_ENABLED) {
    await delay(120);
    const chapters = [
      { id: 1, moduleContentId: 1, novelId: 1, novelName: '清秋月物语', name: '第一章 书斋', num: '1', content: { content: '    秋日的清晨,推窗即见薄雾未散。我在书斋的竹椅上坐下,泡一壶明前龙井,将昨夜未读完的《浮生六记》翻到第三卷。\n\n    沈复笔下的芸娘,是一位能在梅花雪夜里煮茶、在月下与夫君联句的雅趣女子。她以女性的细腻,构筑了一个充满诗意的家居空间。这种生活方式,在数字时代似乎越来越稀缺。', wordCount: 540 }, collected: false, isLast: false },
      { id: 2, moduleContentId: 1, novelId: 1, novelName: '清秋月物语', name: '第二章 旧书与故人', num: '2', content: { content: '    茶凉了半盏,窗外的桂花香却浓了起来。我合上《浮生六记》,起身推开东窗,远处传来寺院的晚钟。', wordCount: 460 }, collected: false, isLast: false },
      { id: 3, moduleContentId: 1, novelId: 1, novelName: '清秋月物语', name: '第三章 慢', num: '3', content: { content: '    霜降过后,院子里那棵老槐的叶子落了大半。清晨扫地时,沙沙作响,像是有人踩在旧信纸上。', wordCount: 420 }, collected: false, isLast: true },
    ];
    const currentId = Number(params.id);
    const next = chapters.find((c) => c.id === currentId + 1) || null;
    if (params.to === 'next') {
      return { code: 200, data: next };
    }
    return { code: 200, data: { id: 1, name: '清秋月物语', novelId: 1, info: '一部关于书斋与慢生活的小说', cover: 'https://picsum.photos/seed/novel0/400/550' } };
  }
  return contentClient(`client-content/novel/get`, {
    params
  });
}
