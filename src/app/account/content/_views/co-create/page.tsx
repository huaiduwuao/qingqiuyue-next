'use client';

import NotImplemented from '@/components/common/NotImplemented';

/**
 * 共创中心 —— 后端未实现。
 *
 * 这个页面此前有 770 行完整 UI(伙伴列表、邀请收发、分成滑块、进度条、收益汇总),
 * 全部由后端 internal/handler/co_create.go 的假数据驱动:
 *   - collabs 恒定返回 3 条编造的共创,partner 叫「示例创作者A/B/C」,
 *     totalEarnings=5800、jointViews=234567 都是写死的常量;
 *   - recommend 拿真实用户 ID 配上按数组下标编出来的 fans / matchScore / verified,
 *     所以它看起来最真 —— 名字是真人,数字全是假的;
 *   - accept / reject / cancel / finish / invite 五个写操作全是 no-op,
 *     返回 {"accepted":true,"message":"已接受共创邀请"} 但什么都没写库。
 *
 * 后端 handler 已删除。真正落地需要:
 *   co_create 表(共创关系 + 分成 + 进度 + 结算)、co_create_invite 表(邀请状态机),
 *   以及和钱包/分成的联动。
 *
 * 原来那 770 行 UI 没有丢:它在本次提交的父提交里,
 *   git show HEAD~1:src/app/account/content/_views/co-create/page.tsx
 * 表和接口就绪后可以取回来接真实数据 —— 它的交互逻辑是可用的,只是数据源是假的。
 */
export default function CoCreateView() {
  return (
    <NotImplemented
      feature="共创中心"
      missing="co_create / co_create_invite 表,以及与钱包的分成结算"
      detail="联合投稿、素材共享、话题合作的后端接口尚未落地。此前页面上显示的伙伴、分成比例和收益数字全部是后端写死的示例数据,已随假接口一并移除。"
    />
  );
}
