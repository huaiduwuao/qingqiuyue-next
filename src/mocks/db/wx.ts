/**
 * WeChat (公众号) seed data — wxMenu / wxUser / wxMsg / wxAutoReply
 */

import { range, dateOffset, pick, cover } from '../utils/seed';

const NICKNAMES = ['小桥流水', '海的尽头', '南风知我意', '青衫客', '杏花微雨', '夜归人', '山间清月', '故园'];
const TAGS = ['活跃', '忠实', '新用户', '沉默', '高互动', '未关注', '已取关'];

export const WX_MENU = {
  records: range(8).map((i) => ({
    id: 5000 + i,
    name: ['首页入口', '产品介绍', '我的服务', '联系我们', '活动专区', '会员中心', '帮助中心', '关于我们'][i],
    type: ['view', 'click', 'miniprogram', 'view', 'view', 'click', 'view', 'view'][i],
    parentId: i < 2 ? 0 : [5000, 5001][i % 2],
    url: i % 3 === 0 ? `https://example.com/menu/${i}` : '',
    content: i % 3 === 1 ? `key_${i}` : '',
    appId: i % 3 === 2 ? 'wx1234567890' : '',
    pagePath: i % 3 === 2 ? `pages/index/index?id=${i}` : '',
    sort: i,
    status: i < 6 ? 'PUBLISH' : 'UN_PUBLISH',
    createTime: dateOffset(i),
    updateTime: dateOffset(i),
  })),
  totalRow: 8,
};

export const WX_USER = {
  records: range(25).map((i) => ({
    id: 7000 + i,
    openid: `o6_bmjrPTlm6_2sgVt7hMZOPfL${i.toString().padStart(2, '0')}`,
    unionid: `unionid_${i}`,
    nickname: NICKNAMES[i % NICKNAMES.length],
    avatar: cover(80, 80, i + 809),
    sex: i % 3,
    city: ['北京', '上海', '广州', '深圳', '杭州'][i % 5],
    province: ['北京', '上海', '广东', '广东', '浙江'][i % 5],
    country: '中国',
    language: 'zh_CN',
    tag: pick(TAGS, i),
    subscribe: i % 4 !== 0 ? 1 : 0,
    subscribeTime: dateOffset(i),
    remark: i % 5 === 0 ? 'VIP 用户' : '',
    groupId: i % 3,
    groupName: ['A 组', 'B 组', 'C 组'][i % 3],
    messageCount: 10 + i * 3,
    lastMessageAt: dateOffset(i % 7),
  })),
  totalRow: 25,
};

export const WX_MSG = {
  records: range(20).map((i) => ({
    id: 8000 + i,
    msgId: `msg_${i}_${Date.now()}`,
    openid: `o6_bmjrPTlm6_2sgVt7hMZOPfL${(i % 25).toString().padStart(2, '0')}`,
    nickname: NICKNAMES[i % NICKNAMES.length],
    avatar: cover(60, 60, i + 336),
    msgType: ['text', 'image', 'voice', 'video', 'location', 'link', 'event'][i % 7],
    content: ['你好,请问有什么可以帮助的?', '查看产品', '图文消息', '语音留言', '小程序卡片', '链接消息', '关注事件'][i % 7],
    direction: i % 2 === 0 ? 'in' : 'out',
    status: i < 15 ? 'READ' : 'UNREAD',
    replied: i % 3 === 0,
    replyContent: i % 3 === 0 ? '感谢您的留言!' : '',
    createTime: dateOffset(i % 14),
  })),
  totalRow: 20,
};

export const WX_AUTO_REPLY = {
  records: range(6).map((i) => ({
    id: 9000 + i,
    name: ['问候回复', '默认回复', '关键词-产品', '关键词-价格', '关注回复', '取消关注回复'][i],
    type: ['welcome', 'default', 'keyword', 'keyword', 'subscribe', 'unsubscribe'][i],
    keywords: i >= 2 && i <= 3 ? ['产品', '价格'] : [],
    matchType: i >= 2 && i <= 3 ? ['exact', 'fuzzy'][i - 2] : 'none',
    replyType: ['text', 'image', 'news', 'text', 'text', 'text'][i],
    replyContent: ['你好,欢迎光临!', '收到您的消息,我们会尽快回复。', '我们的产品包括:...', '价格表请见:...', '感谢您的关注!', '期待再次相见。'][i],
    replyMedia: i === 1 ? 'https://picsum.photos/seed/reply/200/200' : '',
    replyNews: i === 2 ? [{ title: '产品介绍', picUrl: 'https://picsum.photos/seed/news1/300/200', url: 'https://example.com/product' }] : [],
    status: i < 5 ? 'ENABLED' : 'DISABLED',
    priority: i,
    matchCount: 100 - i * 12,
    createTime: dateOffset(i),
  })),
  totalRow: 6,
};

export const WX_MSG_REPLY_PRESETS = range(8).map((i) => ({
  id: 6000 + i,
  title: ['问候模板', '产品介绍', '价格说明', '联系方式', '常见问题', '活动通知', '会员说明', '技术支持'][i],
  content: `这是 ${['问候模板', '产品介绍', '价格说明', '联系方式', '常见问题', '活动通知', '会员说明', '技术支持'][i]} 的回复内容...`,
  category: ['greeting', 'product', 'price', 'contact', 'faq', 'activity', 'member', 'support'][i],
}));
