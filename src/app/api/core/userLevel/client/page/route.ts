/**
 * GET /api/core/userLevel/client/page
 * 后端网关未实现此接口时, Next.js 路由优先于 rewrite 拦截, 返回 mock 数据。
 */

const USER_LEVELS = [
  { id: 1, level: 1, name: '青铜', minPoint: 0, maxPoint: 1000, userCount: 5000, color: '#CD7F32', privileges: ['签到'] },
  { id: 2, level: 2, name: '白银', minPoint: 1000, maxPoint: 2000, userCount: 4500, color: '#C0C0C0', privileges: ['签到', '评论'] },
  { id: 3, level: 3, name: '黄金', minPoint: 2000, maxPoint: 3000, userCount: 4000, color: '#FFD700', privileges: ['签到', '评论', '投稿'] },
  { id: 4, level: 4, name: '铂金', minPoint: 3000, maxPoint: 4000, userCount: 3500, color: '#E5E4E2', privileges: ['签到', '评论', '投稿', '审核'] },
  { id: 5, level: 5, name: '钻石', minPoint: 4000, maxPoint: 5000, userCount: 3000, color: '#B9F2FF', privileges: ['签到', '评论', '投稿', '审核', '管理'] },
  { id: 6, level: 6, name: '大师', minPoint: 5000, maxPoint: 6000, userCount: 2500, color: '#8B5CF6', privileges: ['签到', '评论', '投稿', '审核', '管理', '运营'] },
  { id: 7, level: 7, name: '宗师', minPoint: 6000, maxPoint: 7000, userCount: 2000, color: '#FE2C55', privileges: ['签到', '评论', '投稿', '审核', '管理', '运营', 'VIP客服'] },
  { id: 8, level: 8, name: '王者', minPoint: 7000, maxPoint: 8000, userCount: 1500, color: '#5DDB96', privileges: ['签到', '评论', '投稿', '审核', '管理', '运营', 'VIP客服', '专属经理'] },
];

export async function GET() {
  return Response.json({
    code: 200,
    msg: 'OK',
    data: {
      records: USER_LEVELS,
      totalRow: USER_LEVELS.length,
      list: USER_LEVELS,
      total: USER_LEVELS.length,
      page: 1,
      pageSize: 20,
    },
  });
}
