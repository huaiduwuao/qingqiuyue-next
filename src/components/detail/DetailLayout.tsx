'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import DetailHeader from './DetailHeader';
import { DetailFooter } from './DetailFooter';
import { DetailComments } from './DetailComments';
import { AsyncState } from '@/components/common/AsyncState';

/**
 * DetailLayout —— 详情页骨架。所有新详情页都该用这个;现有 15 个 detail 页不动,
 * 只是推荐迁移。
 *
 * 设计原则:
 *   - 顶/底是稳定的:Header / Footer / Comments 全站在线,布局无歧义
 *   - 中部是灵活的:可以是单 main、双栏(timeline + detail)、三栏(sidebar + main + aside)
 *   - 任何 View 只管 main 区;骨架负责把 AsyncState、订阅入口、Comments 串起来
 *
 * 用法(参考历史专题):
 *   <DetailLayout
 *     title={data.title}
 *     contentId={id}
 *     query={useQuery(...)}
 *     rightActions={<SubscribeButton .../>}
 *     slots={(d) => ({
 *       left: <同期人物 />,
 *       right: <DetailRenderer data={d} sub={d.subcategory_code} />,
 *     })}
 *   />
 */

export interface DetailLayoutSlots {
  /** 单栏主区。优先于 left/right 使用 */
  main?: React.ReactNode;
  /** 双栏左侧(时间线、人物关系图) */
  left?: React.ReactNode;
  /** 双栏右侧(详情卡、订阅卡、相关推荐) */
  right?: React.ReactNode;
  /** Hero 区。提供则压 Header 之下,默认自动填 title+cover */
  hero?: React.ReactNode;
}

export interface DetailLayoutHeaderSlots {
  rightActions?: React.ReactNode;
  variant?: 'glass' | 'transparent';
  forceSolid?: boolean;
  onBack?: () => void;
}

export interface DetailLayoutProps extends DetailLayoutHeaderSlots {
  title: string;
  /** 详情接口的 useQuery 结果。骨架负责 loading/empty/error 切换 */
  query: { isLoading?: boolean; isFetching?: boolean; isError?: boolean; refetch: () => unknown; data: any; error?: unknown };
  /** 槽位(见 DetailLayoutSlots) */
  slots: (data: any) => DetailLayoutSlots;
  /** 详情 id,用于 Footer/Comments 公共组件 */
  contentId: string | number;
  /** Footer 类型(read=文字类 / watch=视频类),透传给 DetailFooter */
  kind?: 'read' | 'watch';
  /** detail 原始数据,透传给 DetailFooter(用于 paywall 等) */
  detail?: object | null;
}

export function DetailLayout(props: DetailLayoutProps) {
  const {
    title,
    rightActions,
    onBack,
    variant,
    forceSolid,
    query,
    slots,
    contentId,
    kind = 'read',
    detail,
  } = props;
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <DetailHeader
        title={title}
        rightActions={rightActions}
        onBack={onBack}
        variant={variant}
        forceSolid={forceSolid}
      />

      <AsyncState query={query}>
        {(data: any) => {
          const s = slots(data);
          const isTwoCol = !!(s.left || s.right);
          return (
            <>
              {s.hero}
              <Container maxWidth={isTwoCol ? 'lg' : 'md'} sx={{ py: 3 }}>
                {isTwoCol ? (
                  <Box
                    sx={{
                      display: 'grid',
                      gap: 3,
                      gridTemplateColumns: {
                        xs: '1fr',
                        md: 'minmax(0, 1fr) minmax(0, 1.4fr)',
                      },
                    }}
                  >
                    <Box>{s.left}</Box>
                    <Box>{s.right ?? s.main}</Box>
                  </Box>
                ) : (
                  s.main
                )}
                <DetailFooter contentId={contentId} detail={detail ?? data} kind={kind} />
                <DetailComments
                  contentId={contentId}
                  initialCount={data?.commentCount ?? data?.comment_num ?? 0}
                />
              </Container>
            </>
          );
        }}
      </AsyncState>
    </Box>
  );
}

export default DetailLayout;