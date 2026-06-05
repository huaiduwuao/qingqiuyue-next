/**
 * module_content seed data — 爬虫写入的内容管理表(对齐 Doris schema)。
 *
 * 字段来源:sql/doris/schema.sql `module_content` 表 + Go service.ModuleContentListReq。
 * 状态枚举与前端 components/module-content/page.tsx 的 CONTENT_STATUS/CONTENT_TYPE 对齐。
 */

import { range, dateOffset, cover, paged, pick } from '../utils/seed';

const T = (d: number) => dateOffset(d, 10);

const TYPES = ['NOVEL', 'VIDEO', 'ARTICLE', 'MUSIC', 'FILM', 'TELEPLAY', 'ANIMATION', 'COMICS'] as const;
const STATUSES = ['PUBLISH', 'PUBLISH', 'PUBLISH', 'PUBLISH', 'UN_PUBLISH'] as const;
const SOURCES = [
  { domain: 'biquge.tw', label: '笔趣阁' },
  { domain: 'bilibili.com', label: '哔哩哔哩' },
  { domain: 'douban.com', label: '豆瓣' },
  { domain: 'zhihu.com', label: '知乎' },
  { domain: 'douyin.com', label: '抖音' },
  { domain: 'kuaishou.com', label: '快手' },
];
const AUTHORS = ['青衫客', '墨羽', '小桥流水', '云深不知处', '月下独酌', '山间清风', '江南雨季', '北岭孤烟', '拾光者', '林深时见鹿'];

const TITLES: Record<string, string[]> = {
  NOVEL: ['剑破苍穹', '长生诀', '仙逆之苍穹', '九天神王', '斗破穹苍', '凡人修仙传'],
  VIDEO: ['乡村美食记 第12集', '手工匠人系列：竹编工艺', '城市夜跑 vlog', 'AI 编程入门实战'],
  ARTICLE: ['深夜随笔：关于孤独', '旅行的意义', '我们为什么会做梦', '互联网的下半场'],
  MUSIC: ['夜色钢琴曲', '古风纯音乐合集', '民谣吉他弹唱', '电子舞曲精选'],
  FILM: ['流浪地球 3', '消失的她 2', '满江红', '长安三万里'],
  TELEPLAY: ['庆余年 第 2 季', '长相思 第 2 季', '繁花', '狂飙'],
  ANIMATION: ['罗小黑战记 2', '雾山五行', '时光代理人', '灵笼'],
  COMICS: ['一人之下 第 580 话', '镖人 第 80 话', '刺客信条：王朝'],
};

const SUBTITLES: Record<string, string[]> = {
  NOVEL: ['玄幻 · 修真 · 热血', '东方玄幻 · 逆袭爽文', '凡人修仙 · 问道长生'],
  VIDEO: ['实拍 · 高清', 'Vlog · 治愈', '教程 · 入门'],
  ARTICLE: ['随笔 · 情感', '思考 · 哲思', '影评 · 杂谈'],
  MUSIC: ['纯音乐 · 助眠', '古风 · 治愈', '翻唱 · 民谣'],
  FILM: ['科幻 · 灾难', '悬疑 · 犯罪', '历史 · 古装'],
  TELEPLAY: ['古装 · 权谋', '都市 · 现实', '刑侦 · 扫黑'],
  ANIMATION: ['国漫 · 奇幻', '都市 · 治愈', '末日 · 生存'],
  COMICS: ['热血 · 冒险', '武侠 · 江湖', '科幻 · 史诗'],
};

function build(i: number) {
  const typeIdx = i % TYPES.length;
  const type = TYPES[typeIdx];
  const status = pick(STATUSES, i);
  const source = pick(SOURCES, i);
  const author = pick(AUTHORS, i);
  const title = pick(TITLES[type] || TITLES.NOVEL, i);
  const subtitle = pick(SUBTITLES[type] || SUBTITLES.NOVEL, i);
  const daysAgo = i % 7;
  return {
    id: 1000 + i,
    moduleId: 1 + (i % 3),
    groupId: 1 + (i % 2),
    categoryId: 1 + (i % 5),
    title,
    subtitle,
    content: `${title} — 爬取自 ${source.label}(${source.domain}) 的完整章节内容...\n\n` +
      '第一章 初入江湖\n\n主人公自幼父母双亡,被师父收养于深山之中,习武练剑十余载。' +
      '一日,师父将其叫至身前,告知身世真相:原来他是当年名震天下的"剑神"后人。\n\n' +
      '为寻根复仇,主人公踏上了漫漫江湖路。前方等待他的,是荣耀、是阴谋、还是无尽的试炼?...',
    contentType: type,
    coverUrl: cover(400, 600, 1000 + i),
    status,
    author,
    source: source.domain,
    sourceLabel: source.label,
    tags: ['热门', '推荐'],
    agreeNum: 120 + (i * 47) % 4800,
    collectNum: 30 + (i * 23) % 1200,
    shareNum: 10 + (i * 17) % 600,
    readNum: 1500 + (i * 137) % 28000,
    commentNum: 20 + (i * 13) % 480,
    search: i % 3 !== 0,
    moduleContentStatus: status,
    moduleContentSearch: i % 3 !== 0,
    createTime: T(daysAgo),
    updateTime: T(Math.max(0, daysAgo - 1)),
  };
}

const ALL = range(28).map(build);

export const MODULE_CONTENT_ALL = ALL;

export function getModuleContentPage(opts: {
  page?: number;
  pageSize?: number;
  moduleId?: number | string;
  groupId?: number | string;
  contentType?: string;
  status?: string;
  source?: string;
  title?: string;
} = {}) {
  let list = [...ALL];
  if (opts.moduleId) list = list.filter((r) => String(r.moduleId) === String(opts.moduleId));
  if (opts.groupId) list = list.filter((r) => String(r.groupId) === String(opts.groupId));
  if (opts.contentType) list = list.filter((r) => r.contentType === opts.contentType);
  if (opts.status) list = list.filter((r) => r.status === opts.status);
  if (opts.source) list = list.filter((r) => r.source === opts.source);
  if (opts.title) {
    const q = opts.title.toLowerCase();
    list = list.filter((r) => r.title.toLowerCase().includes(q));
  }
  const page = Math.max(1, Number(opts.page) || 1);
  const size = Math.max(1, Number(opts.pageSize) || 20);
  return {
    records: list.slice((page - 1) * size, page * size),
    totalRow: list.length,
    page,
    pageSize: size,
  };
}

export function getModuleContentById(id: number | string) {
  return ALL.find((r) => String(r.id) === String(id)) || null;
}

export const MODULE_CONTENT_SOURCES = SOURCES.map((s) => ({ value: s.domain, label: s.label }));
