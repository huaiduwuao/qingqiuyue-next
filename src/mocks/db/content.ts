/**
 * Content module seed data — banner/category/module + 18 个内容端点 + module 子域。
 */

import { range, dateOffset, pick, cover, avatar } from '../utils/seed';

const TS = dateOffset(0);

export const BANNERS = [
  { id: 1, name: '首页Banner', imageUrl: 'https://picsum.photos/seed/banner1/1920/600', linkUrl: 'https://example.com', status: 'ACTIVE', sort: 1, updateTime: TS },
  { id: 2, name: '活动Banner', imageUrl: 'https://picsum.photos/seed/banner2/1920/600', linkUrl: 'https://example.com', status: 'ACTIVE', sort: 2, updateTime: TS },
  { id: 3, name: '推荐Banner', imageUrl: 'https://picsum.photos/seed/banner3/1920/600', linkUrl: 'https://example.com', status: 'ACTIVE', sort: 3, updateTime: TS },
];

export const CATEGORIES = [
  { id: 1, name: '小说', code: 'NOVEL', sort: 1, icon: 'book', updateTime: TS },
  { id: 2, name: '视频', code: 'VIDEO', sort: 2, icon: 'video', updateTime: TS },
  { id: 3, name: '音乐', code: 'MUSIC', sort: 3, icon: 'music', updateTime: TS },
  { id: 4, name: '电影', code: 'FILM', sort: 4, icon: 'film', updateTime: TS },
  { id: 5, name: '文章', code: 'ARTICLE', sort: 5, icon: 'article', updateTime: TS },
  { id: 6, name: '动画', code: 'ANIMATION', sort: 6, icon: 'animation', updateTime: TS },
  { id: 7, name: '电视剧', code: 'TELEPLAY', sort: 7, icon: 'teleplay', updateTime: TS },
  { id: 8, name: '漫画', code: 'COMICS', sort: 8, icon: 'comics', updateTime: TS },
  { id: 9, name: '综艺', code: 'VSHOW', sort: 9, icon: 'vshow', updateTime: TS },
];

export const MODULE_MENUS = [
  { id: 1, name: '首页', path: '/home', icon: 'home', sort: 1, updateTime: TS },
  { id: 2, name: '内容管理', path: '/account/content', icon: 'content', sort: 2, updateTime: TS },
  { id: 3, name: '模块列表', path: '/account/content/modules', icon: 'module', sort: 3, updateTime: TS },
  { id: 4, name: '数据统计', path: '/account/content/data', icon: 'data', sort: 4, updateTime: TS },
];

export const MODULE_LISTS = [
  { id: 1, name: '推荐列表', code: 'recommend', type: 'NOVEL', sort: 1, updateTime: TS },
  { id: 2, name: '热播榜', code: 'hot', type: 'VIDEO', sort: 2, updateTime: TS },
  { id: 3, name: '新书榜', code: 'newest', type: 'NOVEL', sort: 3, updateTime: TS },
];

export const MODULE_LIST = {
  list: range(20).map((i) => ({
    id: 1 + i,
    title: ['热门小说', '最新视频', '热播剧集', '热门音乐', '动漫推荐', '电影推荐', '漫画专区', '综艺精选', '图集鉴赏', '新闻速递', '网盘资源', '内容合集', '完结榜', '新书榜', '完结精品', '人气榜', '口碑榜', '收藏榜', '推荐榜', '编辑推荐'][i],
    subtitle: '推荐内容',
    type: pick(['NOVEL', 'VIDEO', 'TELEPLAY', 'MUSIC', 'ANIMATION', 'FILM', 'COMICS', 'VSHOW', 'PICTURE', 'NEWS', 'PAN'], i),
    cover: cover(400, 600, i + 462),
    status: i < 18 ? 'PUBLISH' : 'UN_PUBLISH',
    itemCount: 50 + i * 10,
    sort: i,
    updateTime: dateOffset(i, 12),
  })),
  total: 20,
};

export const MODULE_TAGS = range(12).map((i) => ({
  id: 1 + i,
  name: ['热门', '最新', '推荐', '完结', '连载', 'VIP', '免费', '独家', '经典', '新书', '轻小说', '原创'][i],
  code: ['hot', 'newest', 'recommend', 'finished', 'serial', 'vip', 'free', 'exclusive', 'classic', 'newbook', 'light', 'original'][i],
  type: pick(['NOVEL', 'VIDEO', 'NOVEL', 'NOVEL', 'NOVEL', 'NOVEL', 'NOVEL', 'VIDEO', 'NOVEL', 'NOVEL', 'NOVEL', 'NOVEL'], i),
  color: pick(['#FE2C55', '#FFB400', '#25F4EE', '#8B5CF6', '#5DDB96', '#F59E0B'], i),
  sort: i,
  updateTime: dateOffset(i),
}));

export const MODULE_SOURCES = range(8).map((i) => ({
  id: 1 + i,
  name: ['笔趣阁', '起点中文', '晋江文学', '哔哩哔哩', '腾讯视频', '爱奇艺', '豆瓣', '知乎'][i],
  domain: ['biquge.tw', 'qidian.com', 'jjwxc.net', 'bilibili.com', 'v.qq.com', 'iqiyi.com', 'douban.com', 'zhihu.com'][i],
  url: 'https://example.com',
  category: [['NOVEL'], ['NOVEL'], ['NOVEL'], ['VIDEO'], ['VIDEO'], ['VIDEO'], ['FILM'], ['ARTICLE']][i],
  type: pick(['novel', 'novel', 'novel', 'video', 'video', 'video', 'film', 'article'], i),
  status: i % 5 === 0 ? 'INACTIVE' : 'ACTIVE',
  sort: i,
  icon: cover(40, 40, i + 829),
  remark: '来源配置',
  updateTime: dateOffset(i),
}));

export const MODULE_TEMPLATES = range(10).map((i) => ({
  id: 1 + i,
  type: pick(['NOVEL', 'VIDEO', 'MUSIC', 'FILM', 'ARTICLE', 'ANIMATION', 'TELEPLAY', 'COMICS', 'VSHOW', 'PICTURE'], i),
  category: '小说',
  name: `${['通用', 'VIP', '独家', '完结', '新书', '经典', '轻小说', '原创', '图文', '多集'][i]}模板`,
  status: 'ENABLED',
  attrCount: 10 + i * 2,
  itemCount: 100 + i * 30,
  updateTime: dateOffset(i),
}));

export const MODULE_TEMPLATE_ATTRS = range(20).map((i) => ({
  id: 1 + i,
  templateId: 1 + (i % 10),
  name: ['标题', '副标题', '作者', '简介', '封面', '标签', '状态', '来源', '分类', '更新时间'][i % 10],
  type: pick(['STRING', 'TEXT', 'STRING', 'TEXT', 'IMAGE', 'ARRAY', 'ENUM', 'STRING', 'REF', 'DATE'], i),
  code: ['title', 'subtitle', 'author', 'intro', 'cover', 'tags', 'status', 'source', 'category', 'updateTime'][i % 10],
  required: i < 5,
  sort: i,
  remark: '字段配置',
  updateTime: dateOffset(i),
}));

export const MODULE_CONTENTS = {
  records: range(25).map((i) => ({
    id: 1 + i,
    moduleId: 1 + (i % 5),
    groupId: 1 + (i % 3),
    title: `${['测试', '示例', '推荐', '热门', '最新'][i % 5]}内容 ${i + 1}`,
    subtitle: '副标题内容',
    contentType: pick(['NOVEL', 'VIDEO', 'MUSIC', 'ARTICLE', 'FILM', 'TELEPLAY', 'ANIMATION', 'COMICS', 'VSHOW', 'PICTURE', 'NEWS', 'PAN'], i),
    status: i % 4 === 0 ? 'UN_PUBLISH' : 'PUBLISH',
    search: i % 2 === 0,
    agreeNum: 100 + i * 30,
    readNum: 1000 + i * 100,
    commentNum: 10 + i * 3,
    updateTime: dateOffset(i % 14),
  })),
  totalRow: 25,
};

export const MODULE_CONTENT_TOPLISTS = range(8).map((i) => ({
  id: 1 + i,
  name: ['热搜榜', '新书榜', '完结榜', '人气榜', '口碑榜', '推荐榜', '编辑精选', 'VIP 专享'][i],
  type: pick(['NOVEL', 'VIDEO', 'NOVEL', 'NOVEL', 'FILM', 'NOVEL', 'NOVEL', 'NOVEL'], i),
  itemCount: 10 + i * 2,
  status: 'PUBLISH',
  updateTime: dateOffset(i),
}));

export const MODULE_CONTENT_TOPLIST_ITEMS = range(20).map((i) => ({
  id: 1 + i,
  toplistId: 1 + (i % 8),
  contentId: 1 + (i % 25),
  title: `榜单内容 ${i + 1}`,
  subtitle: '副标题',
  sort: i % 10,
  cover: cover(120, 160, i + 234),
  updateTime: dateOffset(i),
}));

export const MODULE_DETAILS = range(10).map((i) => ({
  id: 1 + i,
  contentId: 1 + (i % 25),
  content: `这是详情内容 ${i + 1},包含完整的文本描述和元数据。`,
  updateTime: dateOffset(i),
}));

export const MODULE_CONTENT_ACTION_PAGE = { records: [], totalRow: 0 };

// ─── 小说章节(给 moduleContentItem/client/detail 用)───
const NOVEL_BODY_1 = `    秋日的清晨,推窗即见薄雾未散。我在书斋的竹椅上坐下,泡一壶明前龙井,将昨夜未读完的《浮生六记》翻到第三卷。

    沈复笔下的芸娘,是一位能在梅花雪夜里煮茶、在月下与夫君联句的雅趣女子。她以女性的细腻,构筑了一个充满诗意的家居空间。这种生活方式,在数字时代似乎越来越稀缺。

    一、为什么我们需要"书斋"

    书斋,在中国传统文化中,远不止一个物理空间。它是文人精神的栖息地,是与古往今来智者对话的场所。古人云:"书斋宜南,坐当明亮。"

    在今天这个信息过载的时代,我们更需要这样一个角落,让心静下来。一本书、一盏灯、一杯茶,这些朴素的元素,构筑起我们精神的防线。

    二、如何在数字时代重建仪式感

    1. 划定"无手机时间":每天至少 30 分钟,远离所有电子设备
    2. 选择一本纸质书:触感与书香无可替代
    3. 营造空间氛围:一盏暖色台灯,一缕檀香
    4. 写下读后感:让思考外化,让阅读有迹可循

    三、推荐书单

    这个秋天,我重读了以下几本书,推荐给同样爱好阅读的你:
    - 《浮生六记》沈复
    - 《我们仨》杨绛
    - 《生活的艺术家》李小龙
    - 《人间词话》王国维

    慢一点,深一度。这个秋日,愿你在书斋里,遇见更好的自己。`;

const NOVEL_BODY_2 = `    茶凉了半盏,窗外的桂花香却浓了起来。我合上《浮生六记》,起身推开东窗,远处传来寺院的晚钟。

    一、二三事

    想起去年冬天,我在苏州平江路的一家小书店,买到了民国版的《浮生六记》。老板是个留着山羊胡的老先生,说这本是他外婆年轻时常翻的,书页已经发黄,边角被翻得卷起来。

    "书与人有缘,旧书尤其。"他用一口苏白对我说,"您要善待它。"

    我当时只当是客套,直到这个秋夜,重新翻到芸娘"情之所钟,虽丑不嫌"那一段,才忽然懂了——书与人之间,确实存在一种跨越时间的联结。

    二、读与不读之间

    当代人读书,往往带上了功利的眼镜。"这本书能给我什么?""读完能升职加薪吗?"

    沈复不会问这样的问题。他写《浮生六记》,只是为了记录与芸娘一起走过的日子。哪怕清贫,哪怕颠沛,字里行间都是温柔。

    我想,读书最高的境界,或许就是不再问"能得到什么",而是沉浸在文字本身。

    三、夜深

    远处又有钟声传来。我起身,把茶具收拾干净,把书合好放回书架。

    明天,继续读下去。`;

const NOVEL_BODY_3 = `    霜降过后,院子里那棵老槐的叶子落了大半。清晨扫地时,沙沙作响,像是有人踩在旧信纸上。

    一、关于"慢"

    整个十月,我刻意把生活节奏放慢:不订外卖,自己做饭;不刷短视频,改听电台;周末不加班,去郊外走走。

    说起来容易,做起来难。第一周,我无数次想摸起手机,无数次想打开那些闪着红点的 APP。第二周,稍好一些。第三周,竟开始享受这份"空"。

    空,是慢的前提。

    二、书房改造

    十月中旬,我花了 3000 块,把书斋重新收拾了一遍:
    - 换了一张老榆木的条案,代替原本的电脑桌
    - 添了一盏铜制的台灯,光线柔和
    - 买了一个汝窑的小茶壶,只泡白茶
    - 墙上挂了一幅弘一法师的字:"悲欣交集"

    整个空间的气场都不一样了。坐在这里,人会不自觉地安静下来。

    三、写给明年的自己

    写下这篇文字时,已是深秋。窗外有风,屋内有茶。

    我想对明年的自己说:愿你仍能保持这份慢,愿你仍能在这间小书斋里,找到属于自己的清秋月。`;

export const NOVEL_CHAPTERS = [
  {
    id: 1,
    moduleContentId: 1,
    novelId: 1,
    novelName: '清秋月物语',
    name: '第一章 书斋',
    num: '1',
    content: { content: NOVEL_BODY_1, wordCount: 540 },
    collected: false,
    isLast: false,
  },
  {
    id: 2,
    moduleContentId: 1,
    novelId: 1,
    novelName: '清秋月物语',
    name: '第二章 旧书与故人',
    num: '2',
    content: { content: NOVEL_BODY_2, wordCount: 460 },
    collected: false,
    isLast: false,
  },
  {
    id: 3,
    moduleContentId: 1,
    novelId: 1,
    novelName: '清秋月物语',
    name: '第三章 慢',
    num: '3',
    content: { content: NOVEL_BODY_3, wordCount: 420 },
    collected: false,
    isLast: true,
  },
];

// ─── module 子域 ───
export const MODULE_BANNERS = range(8).map((i) => ({
  id: 1 + i,
  name: `Banner ${i + 1}`,
  imageUrl: cover(1920, 600, i + 98),
  linkUrl: 'https://example.com',
  type: pick(['home', 'category', 'detail', 'activity', 'recommend'], i),
  status: i < 7 ? 'ACTIVE' : 'INACTIVE',
  sort: i,
  startTime: dateOffset(7, 9),
  endTime: dateOffset(-7, 18),
  updateTime: dateOffset(i, 12),
}));

export const MODULE_CATEGORIES = range(15).map((i) => ({
  id: 1 + i,
  name: ['玄幻', '都市', '言情', '校园', '武侠', '科幻', '悬疑', '历史', '军事', '游戏', '体育', '娱乐', '动漫', '美食', '旅游'][i],
  code: ['xuanhuan', 'dushi', 'yanqing', 'xiaoyuan', 'wuxia', 'kehuan', 'xuanyi', 'lishi', 'junshi', 'youxi', 'tiyu', 'yule', 'dongman', 'meishi', 'lvyou'][i],
  parentId: 0,
  icon: cover(60, 60, i + 262),
  sort: i,
  itemCount: 100 + i * 30,
  status: 'ENABLED',
  updateTime: dateOffset(i),
}));

export const MODULE_TAGS_LIST = range(20).map((i) => ({
  id: 1 + i,
  name: ['热门', '最新', '完结', '连载', 'VIP', '免费', '独家', '经典', '新书', '轻小说', '原创', '同人', '日系', '韩漫', '国漫', '搞笑', '热血', '恋爱', '冒险', '校园'][i],
  code: `tag_${i + 1}`,
  type: pick(['NOVEL', 'VIDEO', 'NOVEL', 'NOVEL', 'NOVEL', 'NOVEL', 'NOVEL', 'NOVEL', 'NOVEL', 'NOVEL', 'NOVEL', 'COMICS', 'COMICS', 'COMICS', 'COMICS', 'COMICS', 'COMICS', 'NOVEL', 'NOVEL', 'NOVEL'], i),
  color: pick(['#FE2C55', '#FFB400', '#25F4EE', '#8B5CF6', '#5DDB96'], i),
  sort: i,
  itemCount: 50 + i * 10,
  status: 'ENABLED',
  updateTime: dateOffset(i),
}));

export const MODULE_TEMPLATES_LIST = range(12).map((i) => ({
  id: 1 + i,
  type: pick(['NOVEL', 'VIDEO', 'MUSIC', 'FILM', 'ARTICLE', 'ANIMATION', 'TELEPLAY', 'COMICS', 'VSHOW', 'PICTURE', 'NEWS', 'PAN'], i),
  name: `${['通用', 'VIP', '独家', '完结', '新书', '经典', '轻小说', '原创', '图文', '多集', '直播', '短剧'][i]}模板`,
  attrCount: 10 + i * 2,
  itemCount: 100 + i * 50,
  status: 'ENABLED',
  version: `v1.${i}.0`,
  updateTime: dateOffset(i),
}));

export const MODULE_TEMPLATE_ATTRS_LIST = range(20).map((i) => ({
  id: 1 + i,
  templateId: 1 + (i % 12),
  name: ['标题', '副标题', '作者', '简介', '封面', '标签', '状态', '来源', '分类', '更新时间'][i % 10],
  type: pick(['STRING', 'TEXT', 'STRING', 'TEXT', 'IMAGE', 'ARRAY', 'ENUM', 'STRING', 'REF', 'DATE'], i),
  code: ['title', 'subtitle', 'author', 'intro', 'cover', 'tags', 'status', 'source', 'category', 'updateTime'][i % 10],
  required: i < 5,
  sort: i,
  updateTime: dateOffset(i),
}));

export const MODULE_TOPLISTS = range(10).map((i) => ({
  id: 1 + i,
  name: ['热搜榜', '新书榜', '完结榜', '人气榜', '口碑榜', '推荐榜', '编辑精选', 'VIP 专享', '最新上架', '本周最佳'][i],
  type: pick(['NOVEL', 'VIDEO', 'NOVEL', 'NOVEL', 'FILM', 'NOVEL', 'NOVEL', 'NOVEL', 'NOVEL', 'NOVEL'], i),
  cover: cover(800, 400, i + 277),
  description: '榜单描述',
  itemCount: 10 + i * 2,
  status: 'PUBLISH',
  sort: i,
  updateTime: dateOffset(i),
}));

export const MODULE_TOPLIST_ITEMS = range(30).map((i) => ({
  id: 1 + i,
  toplistId: 1 + (i % 10),
  contentId: 1 + (i % 25),
  contentType: pick(['NOVEL', 'VIDEO', 'NOVEL', 'NOVEL', 'FILM'], i),
  title: `榜单内容 ${i + 1}`,
  subtitle: '副标题',
  cover: cover(120, 160, i + 520),
  sort: i % 10,
  hot: 1000 - i * 30,
  updateTime: dateOffset(i),
}));

// ─── 28 client-content 类型的种子数据生成器 ───
const CONTENT_TYPES: Array<{ type: string; prefix: string; count: number; titlePrefix: string; coverSeed: string }> = [
  { type: 'article', prefix: 'article', count: 15, titlePrefix: '文章', coverSeed: 'art' },
  { type: 'video', prefix: 'video', count: 18, titlePrefix: '视频', coverSeed: 'vid' },
  { type: 'music', prefix: 'music', count: 12, titlePrefix: '音乐', coverSeed: 'mus' },
  { type: 'music-playlist', prefix: 'musicPlaylist', count: 8, titlePrefix: '歌单', coverSeed: 'pl' },
  { type: 'novel', prefix: 'novel', count: 20, titlePrefix: '小说', coverSeed: 'nov' },
  { type: 'novel-chapter', prefix: 'novelChapter', count: 30, titlePrefix: '章节', coverSeed: 'ch' },
  { type: 'novel-bookshelf', prefix: 'novelBookshelf', count: 5, titlePrefix: '书架', coverSeed: 'bs' },
  { type: 'live', prefix: 'live', count: 10, titlePrefix: '直播', coverSeed: 'lv' },
  { type: 'news', prefix: 'news', count: 15, titlePrefix: '新闻', coverSeed: 'nw' },
  { type: 'pan', prefix: 'pan', count: 12, titlePrefix: '网盘', coverSeed: 'pn' },
  { type: 'picture-album', prefix: 'pictureAlbum', count: 10, titlePrefix: '图集', coverSeed: 'pa' },
  { type: 'picture-detail', prefix: 'pictureDetail', count: 25, titlePrefix: '图片', coverSeed: 'pd' },
  { type: 'teleplay', prefix: 'teleplay', count: 12, titlePrefix: '电视剧', coverSeed: 'tp' },
  { type: 'teleplay-item', prefix: 'teleplayItem', count: 30, titlePrefix: '剧集', coverSeed: 'tpi' },
  { type: 'film', prefix: 'film', count: 15, titlePrefix: '电影', coverSeed: 'fl' },
  { type: 'film-item', prefix: 'filmItem', count: 10, titlePrefix: '片源', coverSeed: 'fli' },
  { type: 'vshow', prefix: 'vshow', count: 8, titlePrefix: '综艺', coverSeed: 'vs' },
  { type: 'vshow-item', prefix: 'vshowItem', count: 20, titlePrefix: '节目', coverSeed: 'vsi' },
  { type: 'animation', prefix: 'animation', count: 12, titlePrefix: '动画', coverSeed: 'an' },
  { type: 'animation-item', prefix: 'animationItem', count: 25, titlePrefix: '集数', coverSeed: 'ani' },
  { type: 'comics', prefix: 'comics', count: 10, titlePrefix: '漫画', coverSeed: 'cm' },
  { type: 'comics-item', prefix: 'comicsItem', count: 25, titlePrefix: '话', coverSeed: 'cmi' },
  { type: 'spider-queue', prefix: 'spiderQueue', count: 6, titlePrefix: '爬虫任务', coverSeed: 'sq' },
  { type: 'todo-queue', prefix: 'todoQueue', count: 8, titlePrefix: '待办', coverSeed: 'tq' },
  { type: 'urls', prefix: 'urls', count: 15, titlePrefix: '链接', coverSeed: 'ur' },
  { type: 'website', prefix: 'website', count: 12, titlePrefix: '网站', coverSeed: 'wb' },
];

export const CLIENT_CONTENT_SEED: Record<string, { records: any[]; totalRow: number }> = {};
for (const t of CONTENT_TYPES) {
  CLIENT_CONTENT_SEED[t.type] = {
    records: range(t.count).map((i) => ({
      id: 1 + i,
      title: `${t.titlePrefix} ${i + 1}`,
      subtitle: `${t.titlePrefix}副标题 ${i + 1}`,
      author: `作者 ${pick(['张三', '李四', '王五', '赵六', '钱七'], i)}`,
      cover: cover(400, 600, i * 7 + 1),
      type: t.type,
      status: i % 5 === 0 ? 'UN_PUBLISH' : 'PUBLISH',
      source: '示例来源',
      tags: ['热门', '最新', '推荐'].slice(0, (i % 3) + 1),
      views: 1000 + i * 100,
      likes: 50 + i * 10,
      comments: 5 + i,
      favorites: 10 + i,
      shares: 2 + i,
      duration: t.type.includes('video') || t.type === 'live' || t.type === 'music' ? 1200 + i * 60 : null,
      chapters: t.type === 'novel' || t.type === 'teleplay' || t.type === 'comics' || t.type === 'animation' ? 1 + (i % 10) * 10 : null,
      publishTime: dateOffset(i, 12),
      updateTime: dateOffset(i, 14),
    })),
    totalRow: t.count,
  };
}

// live 类型额外补 Room 字段(hostName/hostAvatar/viewers/isLive/category/region/startedAt/hotRank/description)
const LIVE_CATEGORIES = ['颜值', '游戏', '音乐', '户外', '二次元', '知识', '生活', '美食'];
const LIVE_REGIONS = ['北京', '上海', '广州', '深圳', '杭州', '成都', '武汉', '西安', '南京', '苏州'];
const LIVE_DESCRIPTIONS = [
  '今晚继续连麦,聊聊最近书单里让我印象最深的几本。',
  '正在直播新副本首杀,大家弹幕加油!',
  'livehouse 排练花絮,顺便回答乐理问题~',
  '周末城市漫步,带大家看不一样的角落。',
  '深夜电台,点歌+聊天,留下你想听的歌。',
  '健身打卡 30 天挑战,今天练背+有氧。',
  '美食探店第三期,本地人才知道的小馆子。',
  '代码时间,搭一个迷你工具,顺便答疑。',
];
{
  const live = CLIENT_CONTENT_SEED.live;
  live.records = live.records.map((r, i) => ({
    ...r,
    title: r.title.replace('直播', '【直播中】'),
    hostId: 1000 + i,
    hostName: ['月下旅人', '光影捕手', '山城阿吉', '青衣', '南风', '小满', '鹿野', '晚安先生'][i % 8],
    hostAvatar: avatar(i + 100),
    isLive: i % 4 !== 0,
    viewers: 800 + i * 1370,
    category: LIVE_CATEGORIES[i % LIVE_CATEGORIES.length],
    region: LIVE_REGIONS[i % LIVE_REGIONS.length],
    startedAt: Date.now() - (i * 1800 + 600) * 1000,
    hotRank: i + 1,
    isTop: i < 3,
    description: LIVE_DESCRIPTIONS[i % LIVE_DESCRIPTIONS.length],
  }));
}

// 18 个内容类型端点(articles/videos/...) 格式相同
export const CONTENT_TYPE_ENDPOINTS: Record<string, { title: string; subtitle?: string; type: string; extra?: any }> = {
  '/articles': { title: '测试文章', subtitle: '副标题', type: 'ARTICLE' },
  '/videos': { title: '测试视频', subtitle: '副标题', type: 'VIDEO' },
  '/music': { title: '测试音乐', subtitle: '副标题', type: 'MUSIC' },
  '/novels': { title: '测试小说', subtitle: '副标题', type: 'NOVEL' },
  '/novel-chapters': { title: '第一章', type: 'NOVEL-CH', extra: { novelId: 1, sort: 1 } },
  '/films': { title: '测试电影', subtitle: '副标题', type: 'FILM' },
  '/teleplays': { title: '测试电视剧', subtitle: '副标题', type: 'TELEPLAY' },
  '/animations': { title: '测试动画', subtitle: '副标题', type: 'ANIMATION' },
  '/comics': { title: '测试漫画', subtitle: '副标题', type: 'COMICS' },
  '/vshows': { title: '测试微剧', subtitle: '副标题', type: 'VSHOW' },
  '/picture-albums': { title: '测试相册', subtitle: '副标题', type: 'PICTURE' },
  '/news': { title: '测试新闻', subtitle: '副标题', type: 'NEWS' },
  '/pan': { title: '测试网盘', subtitle: '副标题', type: 'PAN' },
  '/websites': { title: '测试网站', subtitle: '副标题', type: 'WEBSITE' },
  '/urls': { title: '测试链接', subtitle: 'https://example.com', type: 'URL' },
  '/spider-queues': { title: '爬虫队列1', subtitle: '处理中', type: 'SPIDER_QUEUE', extra: { status: 'PENDING', totalUrls: 100, processedUrls: 50 } },
  '/todo-queues': { title: '待办队列1', subtitle: '待处理', type: 'TODO_QUEUE', extra: { status: 'PENDING' } },
};

// question/qa
export const QUESTION_LIST = range(15).map((i) => ({
  id: 1 + i,
  title: `问题 ${i + 1}: 这是一个示例问题`,
  content: '问题的详细内容描述,用户可以在这里提问。',
  userId: 1000 + i,
  nickname: ['小桥流水', '海的尽头', '南风知我意'][i % 3],
  avatar: avatar(i + 500),
  answerCount: 1 + (i % 4),
  viewCount: 50 + i * 10,
  likeCount: 5 + i,
  tags: ['问题', '帮助', '讨论'],
  status: 'PUBLISH',
  createTime: dateOffset(i),
}));
