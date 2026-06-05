/**
 * Diamond (钻石) mock data — used by the /recharge page.
 * 真实后端就绪后,把这里替换为 `rechargeClient` 调用即可,字段保持同名。
 */

export type PayMethod = 'wechat' | 'alipay' | 'apple' | 'card';

export interface DiamondPackage {
  id: string;
  /** 钻石数量(主) */
  diamonds: number;
  /** 赠送钻石(可空) */
  bonus?: number;
  /** 售价(元) */
  price: number;
  /** 划线原价(可选,展示"限时优惠") */
  originalPrice?: number;
  /** 标签:推荐 / 热门 / 加赠 */
  badge?: 'recommend' | 'hot' | 'bonus' | 'first';
  /** 简短描述 */
  desc: string;
  /** 等价人民币单价(钻石/元) */
  perDiamond: string;
}

export interface DiamondRecord {
  id: number;
  type: 'recharge' | 'consume' | 'reward' | 'gift';
  amount: number; // 正为收入,负为支出
  balance: number; // 流水后余额
  description: string;
  payMethod?: PayMethod;
  createTime: string; // ISO
}

export interface DiamondBenefit {
  Icon: 'crown' | 'flash' | 'gift' | 'badge' | 'support' | 'theater';
  title: string;
  desc: string;
}

export interface DiamondActivity {
  title: string;
  subtitle: string;
  endsAt: string; // ISO
  rules: string[];
}

export const DIAMOND_BALANCE = 286;

export const DIAMOND_PACKAGES: DiamondPackage[] = [
  {
    id: 'p6',
    diamonds: 6,
    price: 6,
    desc: '尝鲜体验',
    perDiamond: '1.00',
  },
  {
    id: 'p30',
    diamonds: 30,
    price: 28,
    originalPrice: 30,
    badge: 'bonus',
    desc: '常规充值',
    perDiamond: '0.93',
  },
  {
    id: 'p68',
    diamonds: 68,
    bonus: 8,
    price: 60,
    originalPrice: 68,
    badge: 'hot',
    desc: '热卖档位',
    perDiamond: '0.79',
  },
  {
    id: 'p128',
    diamonds: 128,
    bonus: 20,
    price: 108,
    originalPrice: 128,
    badge: 'recommend',
    desc: '编辑推荐 · 性价比最高',
    perDiamond: '0.73',
  },
  {
    id: 'p328',
    diamonds: 328,
    bonus: 60,
    price: 268,
    originalPrice: 328,
    desc: '月度畅看',
    perDiamond: '0.69',
  },
  {
    id: 'p648',
    diamonds: 648,
    bonus: 150,
    price: 498,
    originalPrice: 648,
    badge: 'bonus',
    desc: '季度畅看 · 折合 0.62 / 钻',
    perDiamond: '0.62',
  },
];

export const DIAMOND_RECORDS: DiamondRecord[] = [
  {
    id: 1,
    type: 'recharge',
    amount: 148,
    balance: 286,
    description: '充值 128 钻 + 赠送 20 钻',
    payMethod: 'wechat',
    createTime: '2026-06-03T19:42:00+08:00',
  },
  {
    id: 2,
    type: 'consume',
    amount: -5,
    balance: 138,
    description: '解锁短剧《深海深水》第 12 集',
    createTime: '2026-06-03T21:18:00+08:00',
  },
  {
    id: 3,
    type: 'consume',
    amount: -2,
    balance: 143,
    description: '打赏创作者「青衫客」',
    createTime: '2026-06-04T08:55:00+08:00',
  },
  {
    id: 4,
    type: 'reward',
    amount: 50,
    balance: 145,
    description: '悬赏任务《AI 狼人杀第 52 局》结算',
    createTime: '2026-06-04T14:20:00+08:00',
  },
  {
    id: 5,
    type: 'consume',
    amount: -10,
    balance: 95,
    description: '购买 4K 画质会员加成(7 天)',
    payMethod: 'wechat',
    createTime: '2026-06-05T10:08:00+08:00',
  },
];

export const DIAMOND_BENEFITS: DiamondBenefit[] = [
  {
    Icon: 'crown',
    title: 'VIP 标识',
    desc: '用户名旁专属皇冠,彰显身份。',
  },
  {
    Icon: 'flash',
    title: '极速通道',
    desc: '抢票/抢首发 +5s 优先队列。',
  },
  {
    Icon: 'theater',
    title: '4K 影院',
    desc: '解锁 4K HDR + 杜比音效片源。',
  },
  {
    Icon: 'gift',
    title: '创作者打赏',
    desc: '直接支持喜爱的创作者。',
  },
  {
    Icon: 'badge',
    title: '专属弹幕',
    desc: '彩色高亮 + 自定义气泡皮肤。',
  },
  {
    Icon: 'support',
    title: '优先客服',
    desc: '工单 30 分钟极速响应。',
  },
];

export const DIAMOND_ACTIVITY: DiamondActivity = {
  title: '夏日充值嘉年华',
  subtitle: '充值满 128 钻立得额外 20 钻 · 老用户额外 +5%',
  endsAt: '2026-07-01T00:00:00+08:00',
  rules: [
    '活动期间所有档位自动应用赠送,无需领取。',
    '首充用户额外赠送 10% 钻石,自动到账。',
    '充值订单产生后 7 天内可申请发票。',
    '活动最终解释权归清秋月所有。',
  ],
};

export const PAY_METHODS: Array<{ key: PayMethod; label: string; sub: string; iconKey: 'wechat' | 'alipay' | 'apple' | 'card'; recommended?: boolean }> = [
  { key: 'wechat', label: '微信支付', sub: '免输入密码 · 极速到账', iconKey: 'wechat', recommended: true },
  { key: 'alipay', label: '支付宝', sub: '花呗/余额均可', iconKey: 'alipay' },
  { key: 'apple', label: 'Apple Pay', sub: 'iOS 设备专属', iconKey: 'apple' },
  { key: 'card', label: '银行卡', sub: '支持储蓄卡 / 信用卡', iconKey: 'card' },
];
