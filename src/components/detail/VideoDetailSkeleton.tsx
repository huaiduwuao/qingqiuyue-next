'use client';

import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import CircularProgress from '@mui/material/CircularProgress';

/**
 * 视频类详情页(电影 / 电视剧、短剧 / 动漫 / 综艺 / 短视频)的骨架屏:
 * 详情接口没回来之前先把页面的形状摆出来 —— 黑色播放器位在转圈、标题、标签、简介、选集格。
 *
 * 之前这些页面等数据时是六条一样的灰条,和最后的页面长得不像,从列表点进来看着像卡住了;
 * 页面转场拍到的也是这一屏,所以它要和真实页面同一版式,动画结束后内容原地长出来。
 */
export default function VideoDetailSkeleton({
  episodes = 'grid',
}: {
  /** 选集区:grid 密集序号格(剧集 / 动漫)、list 带标题的行(综艺)、none 没有选集(电影 / 短视频) */
  episodes?: 'grid' | 'list' | 'none';
}) {
  const cells = episodes === 'grid' ? 10 : 3;
  return (
    <Box aria-busy="true" aria-label="正在加载">
      <Box sx={{ bgcolor: '#000' }}>
        <Container maxWidth="lg" sx={{ py: 0 }}>
          <Box
            sx={{
              width: '100%',
              aspectRatio: '16/9',
              maxHeight: { xs: '56vw', md: '70vh' },
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CircularProgress size={36} thickness={4} sx={{ color: 'rgba(255,255,255,0.7)' }} />
          </Box>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Skeleton variant="text" width="60%" sx={{ fontSize: { xs: 20, sm: 24, md: 32 }, bgcolor: 'action.hover' }} />
            <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
              {[64, 48, 56].map((w, i) => (
                <Skeleton key={i} variant="rounded" width={w} height={24} sx={{ borderRadius: 12, bgcolor: 'action.hover' }} />
              ))}
              <Skeleton variant="text" width={120} sx={{ fontSize: 12, bgcolor: 'action.hover' }} />
            </Box>
          </Box>
          <Skeleton variant="rounded" width={56} height={48} sx={{ flexShrink: 0, bgcolor: 'action.hover' }} />
        </Box>

        <Divider sx={{ borderColor: 'divider', my: 2 }} />

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, gap: 1.5, mb: 2 }}>
          {[0, 1].map((i) => (
            <Box key={i}>
              <Skeleton variant="text" width={40} sx={{ fontSize: 11, bgcolor: 'action.hover' }} />
              <Skeleton variant="text" width="70%" sx={{ fontSize: 14, bgcolor: 'action.hover' }} />
            </Box>
          ))}
        </Box>

        <Skeleton variant="text" width={96} sx={{ fontSize: 20, mb: 1, bgcolor: 'action.hover' }} />
        {['100%', '96%', '60%'].map((w, i) => (
          <Skeleton key={i} variant="text" width={w} sx={{ fontSize: 14, bgcolor: 'action.hover' }} />
        ))}

        {episodes !== 'none' && (
          <>
            <Divider sx={{ borderColor: 'divider', my: 3 }} />
            <Skeleton variant="text" width={96} sx={{ fontSize: 20, mb: 1.5, bgcolor: 'action.hover' }} />
            <Box
              sx={{
                display: 'grid',
                gap: 1,
                gridTemplateColumns:
                  episodes === 'grid'
                    ? { xs: 'repeat(5, 1fr)', sm: 'repeat(8, 1fr)', md: 'repeat(10, 1fr)' }
                    : { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
              }}
            >
              {Array.from({ length: cells }).map((_, i) => (
                <Skeleton key={i} variant="rounded" height={episodes === 'grid' ? 36 : 44} sx={{ borderRadius: 1.5, bgcolor: 'action.hover' }} />
              ))}
            </Box>
          </>
        )}
      </Container>
    </Box>
  );
}
