'use client';

import React, { Suspense } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import { useSearchParams } from 'next/navigation';
import { detail as contentDetailApi } from '@/apis/system-module-content';
import type { Paywall } from '@/apis/paywall';
import ModuleContentDetail from '@/components/ModuleContentDetail';
import { PaywallGate } from '@/components/detail/PaywallGate';
import { RelatedContent } from '@/components/detail/RelatedContent';

/** /module/content/client/detail 的响应:内容实体 + 付费状态。 */
type ShareContent = React.ComponentProps<typeof ModuleContentDetail>['detail'] & {
  paywall?: Paywall | null;
};

/**
 * 分享出去的单条内容。
 *
 * 付费内容由服务端控制:未解锁时接口只返回正文预览(paywall.unlocked=false),
 * 这里展示解锁卡片,解锁后重新拉取即得全文。此前这里是一个前端弹窗:
 * 二维码接口不存在、价格兜底写死 ¥9.9,关掉弹窗就能看全文。
 */
function ShareModuleContentDetailContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const queryClient = useQueryClient();
  const queryKey = ['detail', 'share-module-content', id];

  const contentQuery = useQuery({
    queryKey,
    queryFn: async () => (await contentDetailApi({ id: Number(id) })).data as ShareContent,
    enabled: !!id,
  });
  const content = contentQuery.data;

  if (!id) {
    return (
      <Container maxWidth="lg">
        <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
          缺少参数
        </Typography>
      </Container>
    );
  }

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh' }}>
      <Container maxWidth="lg" sx={{ py: { xs: 1, md: 2 } }}>
        {contentQuery.isLoading ? (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <CircularProgress size={32} />
            <Typography sx={{ mt: 2, color: 'text.secondary', fontSize: 13 }}>内容加载中...</Typography>
          </Box>
        ) : content?.id ? (
          <>
            <ModuleContentDetail detail={content} />
            <Box sx={{ maxWidth: 880, mx: 'auto' }}>
              <PaywallGate
                contentId={id}
                paywall={content.paywall}
                onUnlocked={() => queryClient.invalidateQueries({ queryKey })}
              />
              <RelatedContent contentId={id} contentType={content.contentType} />
            </Box>
          </>
        ) : (
          <Typography sx={{ py: 6, textAlign: 'center', color: 'text.secondary' }}>
            {contentQuery.isError ? '内容不存在或已下架' : '暂无内容'}
          </Typography>
        )}
      </Container>
    </Box>
  );
}

export default function ShareModuleContentDetailPage() {
  return (
    <Suspense fallback={<Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>}>
      <ShareModuleContentDetailContent />
    </Suspense>
  );
}
