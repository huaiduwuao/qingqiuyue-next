'use client';

// 直播间详情 —— 目录条目,不是直播间。
//
// 平台不转播直播:站外直播间(虎牙/斗鱼/B站)只收录信息 —— 谁在播、在哪个平台、
// 播什么、现在开没开播 —— 想看就去原站。这里以前是一整套直播间界面(播放器区、
// 实时聊天、礼物面板、观看人数/已播时长),对站外房间全是空壳:没有流,聊天只是
// 本地回显,礼物会把钻石转进爬虫账号。
//
// 用户自己上传的直播回放(LiveForm)有视频地址,照常在站内播放。

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams, useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import ShareIcon from '@mui/icons-material/Share';
import ShareButtons from '@/components/share/ShareButtons';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import EventNoteRoundedIcon from '@mui/icons-material/EventNoteRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import { detail as contentDetail } from '@/apis/content-live';
import { getMarkStatus, setMark } from '@/apis/content-mark';
import { formatApiError } from '@/lib/api/client';
import DetailHeader from '@/components/detail/DetailHeader';
import { CollectButton } from '@/components/detail/CollectButton';
import { DetailFooter } from '@/components/detail/DetailFooter';
import { DetailComments } from '@/components/detail/DetailComments';
import { AsyncState } from '@/components/common/AsyncState';
import { track, recordHistory } from '@/lib/track';
import { toEntityId } from '@/lib/id';
import { getDetailRoute } from '@/lib/contentRoute';
import { mediaUrl } from '@/lib/media';

/** 后端 attachStreamer 挂的主播卡片(PERSON 条目)。 */
interface StreamerCard {
  id: number | string;
  name: string;
  avatar?: string;
  platform?: string;
}

interface LiveDetail {
  id: number | string;
  title: string;
  subtitle?: string;
  cover?: string;
  author?: string;
  content?: string;
  description?: string;
  tags?: string[];
  source?: string;
  sourceUrl?: string;
  sourceLabel?: string;
  videoUrl?: string;
  replayUrl?: string;
  isLive?: boolean;
  streamer?: StreamerCard;
  commentCount?: number;
  contentType?: string;
}

function httpLink(...urls: Array<string | undefined>): string {
  return urls.find((u) => !!u && /^https?:\/\//.test(u)) || '';
}

/** 「虎牙直播 [定时刷新] [爬取测试]」→「虎牙直播」:方括号里是爬虫任务标注。 */
function cleanLabel(s?: string): string {
  return (s || '').replace(/\s*\[[^\]]*\]/g, '').trim();
}

const badgeSx = {
  px: 1,
  py: 0.5,
  borderRadius: 0.75,
  fontSize: 11,
  fontWeight: 700,
  color: '#fff',
  lineHeight: 1.4,
} as const;

function LiveDetailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = searchParams.get('id');

  const query = useQuery({
    queryKey: ['detail', 'live', id],
    queryFn: () => contentDetail({ id: id! }).then((r) => r as LiveDetail),
    enabled: !!id,
  });

  // 进入详情:行为埋点(供榜单/推荐)+ 写观看历史。itemType 大写以匹配 Doris content_type。
  React.useEffect(() => {
    if (id) {
      track(id, 'view', 'LIVE');
      recordHistory(id);
    }
  }, [id]);

  // 开播预约:未开播的直播间可预约,开播后站内通知(后端按抓取新鲜度判定开播)。
  // 直播间 id 超 2^53,Number(id) 会截断成另一个直播间 —— 预约会记到别处
  const markId = toEntityId(id) ?? 0;
  const markQuery = useQuery({
    queryKey: ['mark', markId],
    queryFn: () => getMarkStatus(markId),
    enabled: !!id,
  });
  const [reserveOverride, setReserveOverride] = useState<boolean | null>(null);
  const reserved = reserveOverride ?? !!markQuery.data?.reserve;
  const [reserveBusy, setReserveBusy] = useState(false);
  const [snack, setSnack] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const notify = (message: string, severity: 'success' | 'error' | 'info' = 'success') => {
    setSnack({ open: true, message, severity });
  };

  const handleShare = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const title = query.data?.title || '直播间';
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        notify('链接已复制到剪贴板');
      } else {
        notify('当前环境不支持分享', 'info');
      }
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') {
        notify('分享失败', 'error');
      }
    }
  };

  const handleReserve = async () => {
    if (!id || reserveBusy) return;
    setReserveBusy(true);
    const next = !reserved;
    try {
      await setMark(markId, 'reserve', next);
      setReserveOverride(next);
      notify(next ? '已预约,开播时会通知你' : '已取消预约');
    } catch (err) {
      notify(formatApiError(err), 'error');
    } finally {
      setReserveBusy(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <DetailHeader
        title={query.data?.title?.replace(/【直播中】/, '') || '直播间'}
        rightActions={
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <CollectButton contentId={id!} contentType="live" />
            <ShareButtons contentType="live" contentId={Number(id)} title={query.data?.title || '直播间'} url={typeof window !== 'undefined' ? window.location.href : ''} />
            <IconButton onClick={handleShare} sx={{ color: 'text.tertiary' }} aria-label="分享">
              <ShareIcon />
            </IconButton>
          </Box>
        }
      />

      <AsyncState query={query} isEmpty={(d) => !d}>
        {(data) => {
          const replay = data.videoUrl || data.replayUrl;
          const roomUrl = httpLink(data.sourceUrl, data.source);
          const platform = data.streamer?.platform || cleanLabel(data.sourceLabel) || '原站';
          const streamerName = data.streamer?.name || data.author || '';
          const personRoute = data.streamer ? getDetailRoute('PERSON', data.streamer.id) : null;
          const tags = (data.tags || []).filter(Boolean);
          const intro = (data.description || data.content || '').trim();
          // 回放是已结束的直播,不看抓取新鲜度。
          const live = !replay && !!data.isLive;

          return (
            <>
              <Box sx={{ bgcolor: '#000' }}>
                <Container maxWidth="lg" sx={{ py: 0 }}>
                  {replay ? (
                    <Box
                      component="video"
                      controls
                      src={replay}
                      poster={data.cover}
                      sx={{ display: 'block', width: '100%', aspectRatio: '16 / 9', bgcolor: '#000' }}
                    />
                  ) : (
                    <Box
                      sx={{
                        position: 'relative',
                        width: '100%',
                        aspectRatio: '16 / 9',
                        backgroundImage: data.cover
                          ? `linear-gradient(180deg, rgba(0,0,0,0.2), rgba(0,0,0,0.7)), url("${mediaUrl(data.cover)}")`
                          : 'linear-gradient(135deg, #1f2937, #111827)',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 1.5,
                        px: 2,
                        textAlign: 'center',
                      }}
                    >
                      <Box sx={{ position: 'absolute', top: 12, left: 12, display: 'flex', gap: 1 }}>
                        <Box sx={{ ...badgeSx, bgcolor: live ? 'primary.main' : 'rgba(0,0,0,0.55)' }}>
                          {live ? '直播中' : '未开播'}
                        </Box>
                        <Box sx={{ ...badgeSx, bgcolor: 'rgba(0,0,0,0.55)' }}>{platform}</Box>
                      </Box>
                      {roomUrl && (
                        <Button
                          variant="contained"
                          href={roomUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          endIcon={<OpenInNewIcon sx={{ fontSize: 16 }} />}
                          sx={{ fontWeight: 700, textTransform: 'none' }}
                        >
                          {live ? `去${platform}观看` : `打开${platform}房间`}
                        </Button>
                      )}
                      <Typography sx={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>
                        本站只收录直播间信息,直播画面请到原平台观看
                      </Typography>
                    </Box>
                  )}
                </Container>
              </Box>

              <Container maxWidth="lg" sx={{ py: 3 }}>
                <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.primary', mb: 1, lineHeight: 1.4 }}>
                  {data.title}
                </Typography>
                {data.subtitle && (
                  <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 1.5, lineHeight: 1.5 }}>
                    {data.subtitle}
                  </Typography>
                )}
                {tags.length > 0 && (
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 2 }}>
                    {tags.map((t, i) => (
                      <Chip
                        key={t}
                        label={i === 0 ? t : `#${t}`}
                        size="small"
                        sx={
                          i === 0
                            ? { bgcolor: 'rgba(254, 44, 85, 0.12)', color: 'primary.main', fontWeight: 600 }
                            : { bgcolor: 'action.hover', color: 'text.tertiary' }
                        }
                      />
                    ))}
                  </Box>
                )}

                {streamerName && (
                  <Box
                    sx={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      gap: 1.5,
                      p: 1.5,
                      bgcolor: 'background.paper',
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 2,
                      mb: 2,
                    }}
                  >
                    <Avatar
                      src={mediaUrl(data.streamer?.avatar) || undefined}
                      slotProps={{ img: { referrerPolicy: 'no-referrer' } }}
                      sx={{ width: 48, height: 48 }}
                    >
                      {streamerName.slice(0, 1)}
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 120 }}>
                      <Typography sx={{ fontSize: 14, fontWeight: 700, color: 'text.primary' }}>{streamerName}</Typography>
                      <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                        {platform}主播{live ? ' · 直播中' : ''}
                      </Typography>
                    </Box>
                    {!live && !replay && (
                      <Chip
                        icon={<EventNoteRoundedIcon sx={{ fontSize: 14 }} />}
                        label={reserved ? '已预约' : '预约开播'}
                        onClick={handleReserve}
                        disabled={reserveBusy}
                        variant={reserved ? 'outlined' : 'filled'}
                        sx={{ fontWeight: 700 }}
                      />
                    )}
                    {personRoute && (
                      <Button
                        size="small"
                        endIcon={<ChevronRightRoundedIcon />}
                        onClick={() => router.push(personRoute)}
                        sx={{ textTransform: 'none' }}
                      >
                        主播主页
                      </Button>
                    )}
                  </Box>
                )}

                {intro && (
                  <>
                    <Typography variant="h6" sx={{ color: 'text.primary', mb: 1.5, fontWeight: 700 }}>
                      {replay ? '回放简介' : '直播间简介'}
                    </Typography>
                    <Typography sx={{ color: 'text.tertiary', fontSize: 14, lineHeight: 1.8, mb: 2, whiteSpace: 'pre-wrap' }}>
                      {intro}
                    </Typography>
                  </>
                )}

                <DetailFooter contentId={id!} detail={data} kind="watch" />
                <DetailComments contentId={id!} initialCount={data.commentCount || 0} />
              </Container>
            </>
          );
        }}
      </AsyncState>

      <Snackbar
        open={snack.open}
        autoHideDuration={2500}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity={snack.severity} variant="filled" sx={{ width: '100%' }}>
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default function LiveDetailPage() {
  return (
    <React.Suspense fallback={null}>
      <LiveDetailContent />
    </React.Suspense>
  );
}
