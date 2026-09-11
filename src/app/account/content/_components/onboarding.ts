// 创作者新手指引:把"从注册到第一笔收入"拆成几步,每一步的完成状态都来自真实数据。

export type OnboardingStepId = 'profile' | 'publish' | 'monetize' | 'invite';

export interface OnboardingInput {
  hasAvatar: boolean;
  hasNickname: boolean;
  /** 作品总数(含审核中);未知时为 undefined */
  totalWorks?: number;
  /** 设置了定价的作品数 */
  paidWorks?: number;
  /** 已成功邀请的人数 */
  invited?: number;
}

export interface OnboardingAction {
  label: string;
  /** 创作者中心内的子页面 */
  tab?: string;
  /** 站内其它页面 */
  href?: string;
}

export interface OnboardingStep {
  id: OnboardingStepId;
  title: string;
  description: string;
  done: boolean;
  action: OnboardingAction;
}

export function buildOnboardingSteps(input: OnboardingInput): OnboardingStep[] {
  return [
    {
      id: 'profile',
      title: '完善创作者资料',
      description: '头像和昵称会展示在你的每个作品和评论上',
      done: input.hasAvatar && input.hasNickname,
      action: { label: '去完善', href: '/account/settings' },
    },
    {
      id: 'publish',
      title: '发布第一个作品',
      description: '审核通过后进入推荐流,并出现在相关内容的「相关推荐」里',
      done: (input.totalWorks ?? 0) > 0,
      action: { label: '去发布', tab: 'hd-publish' },
    },
    {
      id: 'monetize',
      title: '发布一个付费作品',
      description: '发布时把定价设为「付费」,读者购买后收入直接进入你的钱包',
      done: (input.paidWorks ?? 0) > 0,
      action: { label: '去设置', tab: 'hd-publish' },
    },
    {
      id: 'invite',
      title: '邀请一位好友',
      description: '好友通过你的邀请码注册,双方都能获得奖励',
      done: (input.invited ?? 0) > 0,
      action: { label: '去邀请', href: '/account/reward?tab=invite' },
    },
  ];
}

export function onboardingProgress(steps: OnboardingStep[]) {
  const done = steps.filter((s) => s.done).length;
  return { done, total: steps.length, complete: done === steps.length };
}
