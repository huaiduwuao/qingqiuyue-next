'use client';

/**
 * 在线客服。
 *
 * 之前这个页面挂的是私信组件 ContactTalk,而且 open 这个 state 一直是 false ——
 * 打开 /kf-chat 得到的是一片空白。就算把它打开,列出来的也是用户的全部私信会话,
 * 跟客服毫无关系;真正的客服后端(/api/core/kf/*,kf_session / kf_message)写好了
 * 却从来没人调用过。
 *
 * 现在这里直接对着客服后端:一条会话、一个人工坐席在另一端,新消息走长连接推过来。
 * 未登录也能打开(登录页的「忘记密码?联系客服」就指向这里),看到的是自助入口 +
 * 登录引导,而不是一个 401 到底的空壳。
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import Avatar from '@mui/material/Avatar';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Tooltip from '@mui/material/Tooltip';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import HeadsetMicIcon from '@mui/icons-material/HeadsetMic';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import { useAuth } from '@/contexts/AuthContext';
import { loginHref } from '@/lib/auth/redirect';
import { fileUpload } from '@/apis/global';
import { formatApiError } from '@/lib/api/client';
import {
  getKfMessages,
  markKfRead,
  sendKfMessage,
  type KfMessage,
} from '@/apis/kf';
import { usePollFallback, useRealtimeStatus } from '@/lib/realtime';

/** 自助入口。未登录时是页面主体,登录后折叠在对话上方 —— 大半问题在这里就解决了。 */
const SELF_SERVE: { q: string; a: string; href?: string; hrefLabel?: string }[] = [
  {
    q: '忘记密码 / 登录不上',
    a: '先用手机号验证码登录,进去之后在「账号与隐私设置」里重设密码。手机号也收不到验证码,再来找人工,并说明注册手机号后四位。',
    href: '/user/login',
    hrefLabel: '去登录',
  },
  {
    q: '充值了但钻石没到账',
    a: '先回充值页点一次「刷新余额」,支付渠道回调有几分钟延迟。超过 10 分钟仍未到账,把订单号发给人工。',
    href: '/recharge',
    hrefLabel: '去充值页',
  },
  {
    q: '内容侵权 / 希望停止采集',
    a: '把权利人身份与联系方式、涉嫌侵权内容的页面地址、权属证明和侵权说明一并发过来,我们核实后会删除、屏蔽或断开链接。',
    href: '/legal',
    hrefLabel: '查看条款',
  },
  {
    q: '作品审核不通过 / 被下架',
    a: '在创作中心能看到审核意见。对结果有异议,把作品链接发过来,人工复核。',
    href: '/account/content',
    hrefLabel: '创作中心',
  },
  {
    q: '被骚扰 / 想举报某个用户或内容',
    a: '在对方主页或内容详情页点「举报」,会进人工处理队列。紧急情况也可以在这里直接说。',
  },
];

function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  const now = new Date();
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return d.toDateString() === now.toDateString() ? hm : `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${hm}`;
}

export default function KfChatPage() {
  const { status: authStatus, isAuthenticated } = useAuth();

  return (
    <Box
      sx={{
        minHeight: 'calc(100dvh - var(--appbar-h, 56px))',
        display: 'flex',
        justifyContent: 'center',
        px: { xs: 0, sm: 2 },
        py: { xs: 0, sm: 2 },
      }}
    >
      <Box sx={{ width: '100%', maxWidth: 780, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {authStatus === 'loading' ? (
          <Skeleton variant="rounded" height={420} />
        ) : isAuthenticated ? (
          <KfConversation />
        ) : (
          <GuestPanel />
        )}
      </Box>
    </Box>
  );
}

/** 未登录:自助入口 + 登录引导。不发任何需要鉴权的请求。 */
function GuestPanel() {
  const router = useRouter();
  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: { xs: 0, sm: 2 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
        <Avatar sx={{ bgcolor: 'primary.main', width: 40, height: 40 }}>
          <HeadsetMicIcon fontSize="small" />
        </Avatar>
        <Box>
          <Typography sx={{ fontSize: 16, fontWeight: 700 }}>在线客服</Typography>
          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
            登录后可以直接和人工对话;常见问题下面就能自助解决
          </Typography>
        </Box>
      </Box>
      <Button variant="contained" onClick={() => router.push(loginHref())} sx={{ textTransform: 'none', mb: 2 }}>
        登录后联系人工
      </Button>
      <SelfServeList />
    </Paper>
  );
}

function SelfServeList() {
  return (
    <Box>
      <Typography sx={{ fontSize: 13, fontWeight: 700, mb: 1 }}>常见问题</Typography>
      {SELF_SERVE.map((item) => (
        <Accordion key={item.q} disableGutters elevation={0} sx={{ bgcolor: 'transparent', '&:before': { display: 'none' } }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ fontSize: 18 }} />} sx={{ px: 0, minHeight: 40 }}>
            <Typography sx={{ fontSize: 13 }}>{item.q}</Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ px: 0, pt: 0 }}>
            <Typography sx={{ fontSize: 12.5, color: 'text.secondary', lineHeight: 1.7 }}>{item.a}</Typography>
            {item.href && (
              <Button size="small" variant="text" href={item.href} sx={{ textTransform: 'none', mt: 0.5, px: 0 }}>
                {item.hrefLabel}
              </Button>
            )}
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );
}

/** 已登录:真正的客服对话。 */
function KfConversation() {
  const qc = useQueryClient();
  const [draft, setDraft] = useState('');
  const [snack, setSnack] = useState<{ open: boolean; msg: string; severity: 'success' | 'error' }>({
    open: false,
    msg: '',
    severity: 'success',
  });
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const rtStatus = useRealtimeStatus();
  // 新消息由长连接推(RealtimeProvider 收到 kf 事件就 invalidate);断线才轮询。
  const poll = usePollFallback(8_000);

  const { data, isLoading } = useQuery({
    queryKey: ['kf-messages'],
    queryFn: getKfMessages,
    refetchInterval: poll,
    staleTime: 5_000,
  });
  const messages: KfMessage[] = useMemo(() => data?.list ?? [], [data?.list]);
  const serviceHours = data?.serviceHours || '9:00 - 23:00';

  // 看到了就算已读(客服回复的未读数用在别处的角标上)
  useEffect(() => {
    if (!messages.length) return;
    markKfRead()
      .then(() => qc.invalidateQueries({ queryKey: ['kf-summary'] }))
      .catch(() => {});
  }, [messages.length, qc]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const send = useMutation({
    mutationFn: ({ content, type }: { content: string; type: 'text' | 'image' }) => sendKfMessage(content, type),
    onSuccess: () => {
      setDraft('');
      qc.invalidateQueries({ queryKey: ['kf-messages'] });
    },
    onError: (e) => setSnack({ open: true, msg: formatApiError(e) || '发送失败', severity: 'error' }),
  });

  const handleSend = useCallback(() => {
    const text = draft.trim();
    if (!text || send.isPending) return;
    send.mutate({ content: text, type: 'text' });
  }, [draft, send]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    try {
      const res = (await fileUpload(form as any)) as { data?: { url?: string } };
      const url = res?.data?.url;
      if (!url) throw new Error('上传失败,未返回图片地址');
      send.mutate({ content: url, type: 'image' });
    } catch (err) {
      setSnack({ open: true, msg: formatApiError(err) || '图片上传失败', severity: 'error' });
    }
  };

  return (
    <Paper
      variant="outlined"
      sx={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        height: { xs: 'calc(100dvh - var(--appbar-h, 56px))', sm: 'calc(100dvh - var(--appbar-h, 56px) - 32px)' },
        borderRadius: { xs: 0, sm: 2 },
        overflow: 'hidden',
      }}
    >
      {/* 头部 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.25, borderBottom: '1px solid', borderColor: 'divider', flexShrink: 0 }}>
        <Avatar sx={{ bgcolor: 'primary.main', width: 36, height: 36 }}>
          <HeadsetMicIcon sx={{ fontSize: 18 }} />
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 700, lineHeight: 1.3 }}>在线客服</Typography>
          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>人工在线时间 {serviceHours}</Typography>
        </Box>
        {rtStatus !== 'open' && (
          <Tooltip title="推送连接断开了,正在重连;这期间消息改为定时拉取">
            <Chip
              size="small"
              icon={<WifiOffIcon sx={{ fontSize: 14 }} />}
              label="重连中"
              sx={{ fontSize: 11, height: 22 }}
            />
          </Tooltip>
        )}
      </Box>

      {/* 消息区 */}
      <Box ref={scrollRef} sx={{ flex: 1, overflowY: 'auto', minHeight: 0, px: 2, py: 2 }}>
        {isLoading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} variant="rounded" height={40} width={`${50 + i * 10}%`} />
            ))}
          </Box>
        ) : messages.length === 0 ? (
          <Box>
            <Box sx={{ textAlign: 'center', py: 3 }}>
              <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
                说说遇到了什么问题,人工在线时间 {serviceHours}
              </Typography>
              <Typography sx={{ fontSize: 12, color: 'text.disabled', mt: 0.5 }}>
                带上账号 / 订单号 + 具体现象,能少一轮来回
              </Typography>
            </Box>
            <SelfServeList />
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            {messages.map((m) => (
              <KfBubble key={m.id} msg={m} />
            ))}
          </Box>
        )}
      </Box>

      {/* 输入区 */}
      <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1, px: 1.5, py: 1.25, borderTop: '1px solid', borderColor: 'divider', flexShrink: 0 }}>
        <Tooltip title="发图片">
          <IconButton size="small" sx={{ color: 'text.secondary' }} onClick={() => fileRef.current?.click()}>
            <ImageOutlinedIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </Tooltip>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
        <TextField
          fullWidth
          size="small"
          multiline
          maxRows={4}
          placeholder="描述你的问题…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        <IconButton
          onClick={handleSend}
          disabled={!draft.trim() || send.isPending}
          sx={{
            bgcolor: 'primary.main',
            color: '#fff',
            width: 36,
            height: 36,
            '&:hover': { bgcolor: 'primary.dark' },
            '&:disabled': { bgcolor: 'action.disabledBackground', color: 'action.disabled' },
          }}
        >
          <ArrowUpwardIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Box>

      <Snackbar
        open={snack.open}
        autoHideDuration={2500}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snack.severity} variant="filled" onClose={() => setSnack((s) => ({ ...s, open: false }))}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </Paper>
  );
}

function KfBubble({ msg }: { msg: KfMessage }) {
  // system 是服务端的自动回执,居中显示,不冒充人工
  if (msg.fromRole === 'system') {
    return (
      <Box sx={{ alignSelf: 'center', maxWidth: 520, px: 2, py: 1.25, bgcolor: 'action.hover', borderRadius: 1.5 }}>
        <Typography sx={{ fontSize: 12, color: 'text.secondary', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
          {msg.content}
        </Typography>
      </Box>
    );
  }
  const mine = msg.fromRole === 'user';
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start', gap: 0.25 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1, maxWidth: '82%' }}>
        {!mine && (
          <Avatar sx={{ width: 28, height: 28, bgcolor: 'primary.main', flexShrink: 0 }}>
            <HeadsetMicIcon sx={{ fontSize: 14 }} />
          </Avatar>
        )}
        {msg.type === 'image' ? (
          <Box sx={{ maxWidth: 240, borderRadius: 2, overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
            <img src={msg.content} alt="" style={{ width: '100%', display: 'block' }} />
          </Box>
        ) : (
          <Box
            sx={{
              px: 1.75,
              py: 1,
              borderRadius: 2,
              bgcolor: mine ? 'primary.main' : 'action.hover',
              color: mine ? '#fff' : 'text.primary',
              fontSize: 13,
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {msg.content}
          </Box>
        )}
      </Box>
      <Typography sx={{ fontSize: 10, color: 'text.disabled', px: mine ? 0 : 4.5 }}>
        {msg.fromRole === 'staff' ? '客服 · ' : ''}
        {fmtTime(msg.createTime)}
      </Typography>
    </Box>
  );
}
