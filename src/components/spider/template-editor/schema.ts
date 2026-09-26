/**
 * 爬虫模板(module_template.content)的字段清单 —— 对齐 Go 的 crawler.TemplateConfig
 * (qingqiuyue-go/internal/crawler/template_service.go)。
 *
 * 编辑器只有一份真相:解析后的 content 对象。表单按这里的 path 读写它,JSON 视图
 * 直接编辑它的序列化文本;清单之外的键原样保留(见 unknownTopKeys),保存时不会丢。
 */

export type FieldKind =
  | 'text' // 普通文本
  | 'code' // 选择器 / 表达式,等宽显示
  | 'script' // 多行脚本(js_extract)
  | 'number'
  | 'bool'
  | 'list' // string[]
  | 'map' // Record<string, string>
  | 'json' // 任意 JSON 对象
  | 'contentType';

export interface FieldDef {
  path: string[];
  label: string;
  hint?: string;
  kind: FieldKind;
  placeholder?: string;
  /** 在两列网格里独占一整行 */
  wide?: boolean;
}

export interface SectionDef {
  id: string;
  title: string;
  desc: string;
  /** 模板类型为这些值时默认展开(配没配都展开) */
  types?: string[];
  fields: FieldDef[];
}

const sel = (key: string, label: string, hint?: string): FieldDef => ({ path: [key], label, hint, kind: 'code' });

export const SECTIONS: SectionDef[] = [
  {
    id: 'basic',
    title: '内容与可见性',
    desc: '抓回来的条目按什么类型入库、谁能看到',
    fields: [
      { path: ['content_type'], label: '内容类型', kind: 'contentType', hint: '按 contracts/content_type.yaml 大写;旧行里的小写值引擎也认' },
      { path: ['access_scope'], label: '访问范围', kind: 'text', placeholder: '留空 = 公开', hint: '非空(如 restricted)时只有持 CONTENT_SCOPE:<值> 数据权限的人可见' },
    ],
  },
  {
    id: 'api',
    title: 'API 数据源',
    desc: '配了 api_source.name 就走公开 API 取元数据,不再解析网页',
    fields: [
      { path: ['api_source', 'name'], label: '数据源名称', kind: 'code', placeholder: 'tmdb / jikan / json_api …' },
      { path: ['api_source', 'base_url'], label: '基础 URL', kind: 'code' },
      { path: ['api_source', 'search_endpoint'], label: '搜索端点', kind: 'code', hint: '{query} 为占位符' },
      { path: ['api_source', 'detail_endpoint'], label: '详情端点', kind: 'code', hint: '{id} 为占位符' },
      { path: ['api_source', 'api_key'], label: 'API Key', kind: 'text' },
      { path: ['api_source', 'language'], label: '语言参数', kind: 'text' },
      { path: ['api_source', 'rate_limit_per_second'], label: '每秒请求上限', kind: 'number' },
      { path: ['api_source', 'json_api'], label: 'json_api 配置', kind: 'json', wide: true, hint: 'name=json_api 时生效:list_url / items_path / fields … 见 api_source_json.go' },
    ],
  },
  {
    id: 'metadata',
    title: '元数据映射',
    desc: '详情字段从哪里取:CSS 选择器、XPath 或 JSON path,留空 = 不采集',
    types: ['detail'],
    fields: [
      { path: ['metadata_schema', 'title'], label: '标题', kind: 'code' },
      { path: ['metadata_schema', 'author'], label: '作者 / 导演 / 艺人', kind: 'code' },
      { path: ['metadata_schema', 'cover'], label: '封面', kind: 'code' },
      { path: ['metadata_schema', 'description'], label: '简介', kind: 'code' },
      { path: ['metadata_schema', 'tags'], label: '标签 / 类型', kind: 'code' },
      { path: ['metadata_schema', 'rating'], label: '评分', kind: 'code' },
      { path: ['metadata_schema', 'release_date'], label: '发布日期', kind: 'code' },
      { path: ['metadata_schema', 'cast'], label: '演员 / 声优', kind: 'code' },
      { path: ['metadata_schema', 'episodes'], label: '集数', kind: 'code' },
      { path: ['metadata_schema', 'duration'], label: '时长', kind: 'code' },
      { path: ['metadata_schema', 'platform'], label: '平台', kind: 'code' },
    ],
  },
  {
    id: 'list',
    title: '列表页',
    desc: '从列表 / 目录页里拆出一条条作品',
    types: ['list'],
    fields: [
      sel('list_item_selector', '列表项容器', '每个作品卡片的外层元素'),
      sel('list_title_selector', '标题'),
      sel('list_url_selector', '链接'),
      sel('list_cover_selector', '封面'),
      sel('list_desc_selector', '描述'),
      sel('list_tags_selector', '题材 / 标签', '命中的全部元素文本逗号拼接,归一成题材码'),
      { path: ['list_title_scripts'], label: '标题文字限定', kind: 'list', placeholder: 'han / latin / hangul …', hint: '标题至少含其中一种文字才收,留空不筛' },
      { path: ['list_urls'], label: '额外入口页', kind: 'list', wide: true, placeholder: '回车添加 URL', hint: '留空只抓源链接那一页;分类页列在这里一轮就能覆盖整站' },
    ],
  },
  {
    id: 'detail',
    title: '详情页',
    desc: '作品详情页上的基础信息',
    types: ['detail'],
    fields: [
      sel('detail_title_selector', '标题'),
      sel('detail_author_selector', '作者 / 上传者'),
      sel('detail_cover_selector', '封面'),
      sel('detail_desc_selector', '描述'),
      sel('detail_category_selector', '分类 / 标签'),
    ],
  },
  {
    id: 'items',
    title: '章节 / 分集',
    desc: '详情页里的章节、分集、曲目列表',
    types: ['detail', 'chapter'],
    fields: [
      sel('item_container_selector', '条目容器'),
      sel('item_title_selector', '条目标题'),
      sel('item_url_selector', '条目链接'),
      sel('item_index_selector', '条目序号'),
    ],
  },
  {
    id: 'content',
    title: '正文',
    desc: '章节 / 文章正文及其中的媒体',
    types: ['chapter'],
    fields: [
      sel('content_selector', '正文'),
      sel('content_image_selector', '正文图片'),
      sel('content_video_selector', '正文视频'),
      { path: ['content_noise_patterns'], label: '去噪正则', kind: 'list', wide: true, placeholder: '回车添加正则', hint: '命中的水印 / 广告行直接删掉' },
    ],
  },
  {
    id: 'browser',
    title: '浏览器渲染',
    desc: 'JS 渲染或有反爬的页面,用无头浏览器打开后再采',
    fields: [
      { path: ['browser', 'enabled'], label: '启用浏览器', kind: 'bool' },
      { path: ['browser', 'wait_network_idle'], label: '等待网络空闲', kind: 'bool', hint: '更稳,但更慢' },
      { path: ['browser', 'scroll_to_load'], label: '滚动触发懒加载', kind: 'bool' },
      { path: ['browser', 'screenshot'], label: '截图(调试)', kind: 'bool' },
      { path: ['browser', 'wait_for'], label: '等待元素', kind: 'code', placeholder: 'CSS 选择器' },
      { path: ['browser', 'wait_timeout'], label: '等待超时(秒)', kind: 'number' },
      { path: ['browser', 'extra_wait'], label: '额外等待(秒)', kind: 'number' },
      { path: ['browser', 'scroll_count'], label: '滚动次数', kind: 'number' },
      { path: ['browser', 'scroll_wait'], label: '滚动后等待(秒)', kind: 'number' },
      { path: ['browser', 'user_agent'], label: 'User-Agent', kind: 'text', placeholder: '默认用 CloakBrowser 的' },
      { path: ['browser', 'proxy_url'], label: '代理 URL', kind: 'code' },
    ],
  },
  {
    id: 'pagination',
    title: '翻页',
    desc: '列表跨页:下一页链接,或按参数递增页码',
    types: ['list'],
    fields: [
      { path: ['pagination', 'enabled'], label: '启用翻页', kind: 'bool', wide: true },
      { path: ['pagination', 'next_page_selector'], label: '下一页链接', kind: 'code' },
      { path: ['pagination', 'max_pages'], label: '最多页数', kind: 'number', hint: '0 = 不限' },
      { path: ['pagination', 'page_param'], label: '页码参数名', kind: 'code', placeholder: 'page / start' },
      { path: ['pagination', 'page_start'], label: '起始值', kind: 'number' },
      { path: ['pagination', 'page_step'], label: '步长', kind: 'number' },
      { path: ['pagination', 'next_page_text_patterns'], label: '下一页文字', kind: 'list', placeholder: '下一页 / Next' },
      { path: ['pagination', 'url_patterns'], label: 'URL 翻页模式', kind: 'list', placeholder: '?page= / /page/' },
    ],
  },
  {
    id: 'policy',
    title: '抓取策略',
    desc: '对站点的礼貌:同 host 限速、单次任务页数上限',
    fields: [
      { path: ['crawl_policy', 'request_interval_ms'], label: '请求间隔(毫秒)', kind: 'number', hint: '默认 1000,最低 200;同 host 全进程共享' },
      { path: ['crawl_policy', 'max_pages'], label: '单次最多页数', kind: 'number', hint: '0 = 只看任务参数' },
    ],
  },
  {
    id: 'category',
    title: '分类发现',
    desc: '从导航里找出分类入口',
    types: ['category'],
    fields: [
      { path: ['nav_selectors'], label: '导航选择器', kind: 'list', placeholder: 'nav a / .menu a' },
      { path: ['category_url_patterns'], label: '分类 URL 模式', kind: 'list', placeholder: '/sort/ /category/' },
      sel('sub_category_selector', '子分类容器'),
    ],
  },
  {
    id: 'rules',
    title: '正则与备选选择器',
    desc: 'regex_patterns(引擎读 chapter_url)与 css_selectors',
    fields: [
      { path: ['regex_patterns'], label: 'regex_patterns', kind: 'map', wide: true },
      { path: ['css_selectors'], label: 'css_selectors', kind: 'map', wide: true },
    ],
  },
  {
    id: 'custom',
    title: '自定义扩展',
    desc: 'custom 下的任意键;正文不在 DOM 里的站用 js_extract 取数',
    fields: [
      {
        path: ['custom', 'js_extract'],
        label: '站点取数 JS(js_extract)',
        kind: 'script',
        wide: true,
        hint: '在页面上下文执行,须 return JSON 字符串 [{chapterid,title,body}];可用 {book_id} {from} {to} 占位符。留空 = 不用',
      },
      { path: ['custom'], label: 'custom 其余键', kind: 'json', wide: true, hint: 'js_extract 在上面单独编辑,这里不显示它' },
    ],
  },
];

/** 清单覆盖到的顶层键(其余顶层键进「其他字段」) */
export const KNOWN_TOP_KEYS = new Set(SECTIONS.flatMap((s) => s.fields.map((f) => f.path[0])));

export type Config = Record<string, any>;

export function getIn(obj: any, path: string[]): any {
  let cur = obj;
  for (const k of path) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[k];
  }
  return cur;
}

/** 不可变写入;中间层不存在或不是对象时补成 {} */
export function setIn(obj: Config, path: string[], value: any): Config {
  const [k, ...rest] = path;
  const base = obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : {};
  if (!rest.length) return { ...base, [k]: value };
  return { ...base, [k]: setIn(base[k], rest, value) };
}

/** custom 的「其余键」= custom 去掉 js_extract(它有单独的输入框) */
export function customRest(cfg: Config): Record<string, any> {
  const c = cfg.custom;
  if (!c || typeof c !== 'object' || Array.isArray(c)) return {};
  const { js_extract: _js, ...rest } = c;
  return rest;
}

/** 字段当前值(custom 整体字段读的是去掉 js_extract 的部分) */
export function fieldValue(cfg: Config, f: FieldDef): any {
  if (f.path.length === 1 && f.path[0] === 'custom') return customRest(cfg);
  return getIn(cfg, f.path);
}

/** 写回字段;custom 整体字段写回时保留 js_extract,js_extract 清空时删键 */
export function setField(cfg: Config, f: FieldDef, value: any): Config {
  if (f.path.length === 1 && f.path[0] === 'custom') {
    const js = getIn(cfg, ['custom', 'js_extract']);
    const next = { ...(value || {}) };
    if (typeof js === 'string' && js) next.js_extract = js;
    return { ...cfg, custom: Object.keys(next).length ? next : null };
  }
  if (f.path[0] === 'custom' && f.path[1] === 'js_extract') {
    const rest = customRest(cfg);
    const js = typeof value === 'string' ? value : '';
    const next = js.trim() ? { ...rest, js_extract: js } : rest;
    return { ...cfg, custom: Object.keys(next).length ? next : null };
  }
  return setIn(cfg, f.path, value);
}

/** 「已配置」:非空字符串、非 0 数字、true、非空数组 / 对象 */
export function isSet(v: any): boolean {
  if (v == null) return false;
  if (typeof v === 'string') return v.trim() !== '';
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'boolean') return v;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.keys(v).length > 0;
  return true;
}

export function sectionStats(cfg: Config, s: SectionDef): { set: number; total: number } {
  const set = s.fields.filter((f) => isSet(fieldValue(cfg, f))).length;
  return { set, total: s.fields.length };
}

/** 清单外的顶层键(旧版字段、手工加的键),保存时原样带上 */
export function unknownTopKeys(cfg: Config): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(cfg || {})) if (!KNOWN_TOP_KEYS.has(k)) out[k] = v;
  return out;
}

export function replaceUnknownTopKeys(cfg: Config, next: Record<string, any>): Config {
  const out: Config = {};
  for (const [k, v] of Object.entries(cfg || {})) if (KNOWN_TOP_KEYS.has(k)) out[k] = v;
  return { ...out, ...next };
}

/** 解析 module_template.content;不是 JSON 对象时返回 null(页面退回纯 JSON 编辑) */
export function parseContent(raw: unknown): Config | null {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw as Config;
  if (typeof raw !== 'string' || !raw.trim()) return {};
  try {
    const v = JSON.parse(raw);
    return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

/** 与后端 ValidateConfig 同一条规则,保存前先在前端拦下来 */
export function validateConfig(cfg: Config): string | null {
  const css = cfg.css_selectors;
  const hasList = isSet(cfg.list_item_selector) || (css && typeof css === 'object' && Object.keys(css).length > 0);
  const hasDetail = isSet(cfg.detail_title_selector) || isSet(cfg.item_container_selector);
  const hasAPI = isSet(getIn(cfg, ['api_source', 'name']));
  if (!hasList && !hasDetail && !hasAPI) {
    return '至少要配一项:API 数据源名称、列表项容器,或详情标题 / 章节条目容器';
  }
  return null;
}

export const TEMPLATE_TYPES: { value: string; label: string }[] = [
  { value: 'list', label: '列表页' },
  { value: 'detail', label: '详情页' },
  { value: 'chapter', label: '章节 / 正文' },
  { value: 'category', label: '分类发现' },
  // 站点「书」维度:站内搜索 / 书页 / 目录 / 单章正文(后端 internal/crawler/sitebook.go)
  { value: 'book', label: '书(搜索 / 目录 / 正文)' },
];
