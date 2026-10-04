/**
 * 手机上不在页签栏里的「我的」子页:它们在首页左上角侧边栏的「我的内容」组里
 * (MobileSideMenu 链到 ?tab=me&mainTab=…)。手机上打开它们是一个单独的页面:
 * 顶上「← 标题」,只有这一个列表,没有头像卡和页签栏(首页 layout 按 ME_DRAWER_TITLES 出返回栏)。
 *
 * 单独成文件:首页 layout 只要这张表,不能为了它把整个 MyHomePage 静态打进首屏包。
 */
export const ME_DRAWER_TITLES: Record<string, string> = {
  recommend: '我的推荐',
  history: '观看历史',
  later: '稍后再看',
  order: '我的预约',
  ai: 'AI 笔记',
};
export const ME_DRAWER_TABS = new Set(Object.keys(ME_DRAWER_TITLES));
