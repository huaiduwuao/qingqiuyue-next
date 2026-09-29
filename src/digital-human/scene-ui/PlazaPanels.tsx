'use client';

/**
 * scene-ui/PlazaPanels.tsx — 广场和平台功能的联动面板
 *
 *   ZonePanel      走进地标时的内容面板:放映亭的片单、点唱机的热歌、书亭的今日一悟……点了直接开/播
 *   WishWall       许愿池:许愿、给别人的愿望送祝福、正在悬赏的需求
 *   PlatformTasks  平台每日任务(签到、广场许愿、送祝福……)和积分,嵌在任务清单里
 *   AuraShop       广场光环:积分兑换 / 佩戴 / 摘下
 */

import React from 'react';
import { Box, ButtonBase, CircularProgress, IconButton, InputBase, Typography } from '@mui/material';
import { keyframes } from '@mui/material/styles';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded';
import FavoriteBorderRoundedIcon from '@mui/icons-material/FavoriteBorderRounded';
import { ZONE_BY_ID, type ZoneId } from '../vrm/world/worldLayout';
import { loadZoneFeed, openBounties, type FeedAction, type FeedCard, type ZoneFeed } from './plazaFeeds';
import type { PlazaOnline } from './usePlazaOnline';
import { completeDailyTask, getDailyTaskList, type DailyTask } from '@/apis/reward-center';
import { equipCosmetic, getGrowthSummary, getMyCosmetics, signIn, type GrowthSummary, type UserCosmetic } from '@/apis/growth';
import { getPointMallItems, redeemPointMallItem, type PointMallItem } from '@/apis/dashboard';

const CYAN = '#25F4EE';
const glass = {
  bgcolor: 'rgba(8,10,20,0.72)',
  backdropFilter: 'blur(14px)',
  border: '1px solid rgba(255,255,255,0.1)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
} as const;
const slideIn = keyframes`from { opacity: 0; transform: translateX(-10px); } to { opacity: 1; transform: translateX(0); }`;
const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

function errMsg(e: unknown, fallback: string) {
  const m = (e as { message?: string })?.message;
  return typeof m === 'string' && m && m.length < 60 ? m : fallback;
}

// ==================== 卡片 ====================

function CardRow({ c, onAction, accent }: { c: FeedCard; onAction: (a: FeedAction) => void; accent: string }) {
  const disabled = !c.action;
  return (
    <ButtonBase
      disabled={disabled}
      onClick={() => c.action && onAction(c.action)}
      sx={{
        display: 'flex', alignItems: 'center', gap: 1.25, width: '100%', textAlign: 'left', p: 0.75, borderRadius: 2,
        '&:hover': { bgcolor: 'rgba(255,255,255,0.07)' }, opacity: disabled ? 0.5 : 1,
      }}
    >
      <Box sx={{
        width: 44, height: 44, borderRadius: 1.5, flexShrink: 0, overflow: 'hidden', bgcolor: 'rgba(255,255,255,0.06)',
        backgroundImage: c.cover ? `url("${c.cover}")` : undefined, backgroundSize: 'cover', backgroundPosition: 'center',
        display: 'grid', placeItems: 'center', position: 'relative',
      }}>
        {!c.cover && <Typography sx={{ fontSize: 18 }}>{c.action?.kind === 'play' ? '🎵' : '✨'}</Typography>}
        {c.action?.kind === 'play' && (
          <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', bgcolor: 'rgba(0,0,0,0.35)' }}>
            <PlayArrowRoundedIcon sx={{ fontSize: 22, color: '#fff' }} />
          </Box>
        )}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 600, color: '#fff' }} noWrap>{c.title}</Typography>
        {c.subtitle && <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }} noWrap>{c.subtitle}</Typography>}
      </Box>
      {c.badge && (
        <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: accent, flexShrink: 0, px: 0.75, py: 0.25, borderRadius: 1, bgcolor: `${accent}1f` }}>{c.badge}</Typography>
      )}
    </ButtonBase>
  );
}

function PanelShell({ zone, title, onClose, children, width }: { zone: ZoneId; title: string; onClose: () => void; children: React.ReactNode; width: number | string }) {
  const z = ZONE_BY_ID[zone];
  const accent = hex(z.color);
  return (
    <Box sx={{
      ...glass, borderRadius: 3, width, maxWidth: 'calc(100vw - 24px)', maxHeight: '100%', display: 'flex', flexDirection: 'column',
      overflow: 'hidden', borderTop: `2px solid ${accent}`, animation: `${slideIn} .2s ease-out`, pointerEvents: 'auto',
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, pt: 1.25, pb: 0.75 }}>
        <Box sx={{ fontSize: 20 }}>{z.emoji}</Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#fff' }} noWrap>{z.label}</Typography>
          <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }} noWrap>{title}</Typography>
        </Box>
        <IconButton size="small" aria-label="收起" onClick={onClose} sx={{ color: 'rgba(255,255,255,0.6)' }}><CloseRoundedIcon sx={{ fontSize: 18 }} /></IconButton>
      </Box>
      <Box sx={{ overflowY: 'auto', px: 0.75, pb: 1, minHeight: 0 }}>{children}</Box>
    </Box>
  );
}

// ==================== 地标内容 ====================

export interface ZonePanelProps {
  zone: ZoneId;
  width: number | string;
  onClose: () => void;
  onAction: (a: FeedAction, feed: ZoneFeed | null) => void;
  /** 「让她推荐」:走原来的对话互动 */
  onAsk: () => void;
  online: PlazaOnline;
}

export function ZonePanel({ zone, width, onClose, onAction, onAsk, online }: ZonePanelProps) {
  if (zone === 'wish') return <WishWall width={width} onClose={onClose} onAction={(a) => onAction(a, null)} online={online} />;
  return <FeedPanel zone={zone} width={width} onClose={onClose} onAction={onAction} onAsk={onAsk} />;
}

function FeedPanel({ zone, width, onClose, onAction, onAsk }: Omit<ZonePanelProps, 'online'>) {
  const [feed, setFeed] = React.useState<ZoneFeed | null>(null);
  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    setFeed(null);
    loadZoneFeed(zone).then((f) => { if (alive) setFeed(f); }).catch(() => {}).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [zone]);
  const z = ZONE_BY_ID[zone];
  const accent = hex(z.color);
  return (
    <PanelShell zone={zone} title={feed?.title ?? '加载中…'} onClose={onClose} width={width}>
      {feed?.lead && (
        <ButtonBase
          onClick={() => feed.lead?.action && onAction(feed.lead.action, feed)}
          sx={{ display: 'block', width: '100%', textAlign: 'left', mx: 0.25, mb: 1, p: 1.25, borderRadius: 2, bgcolor: `${accent}14`, border: `1px solid ${accent}33` }}
        >
          <Typography sx={{ fontSize: 13.5, color: '#fff', lineHeight: 1.6, fontFamily: '"Noto Serif SC","Songti SC",serif' }}>「{feed.lead.text}」</Typography>
          {feed.lead.source && <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', mt: 0.5, textAlign: 'right' }}>—— {feed.lead.source}</Typography>}
        </ButtonBase>
      )}
      {loading && <Box sx={{ py: 3, display: 'grid', placeItems: 'center' }}><CircularProgress size={20} sx={{ color: accent }} /></Box>}
      {!loading && (feed?.cards.length ?? 0) === 0 && (
        <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', textAlign: 'center', py: 2 }}>暂时没有内容,让她推荐看看?</Typography>
      )}
      {feed?.cards.map((c) => <CardRow key={c.key} c={c} accent={accent} onAction={(a) => onAction(a, feed)} />)}
      <Box sx={{ display: 'flex', gap: 1, px: 0.5, pt: 1 }}>
        <ButtonBase onClick={onAsk} sx={{ flex: 1, py: 0.9, borderRadius: 2, fontSize: 12.5, fontWeight: 700, color: '#0b0e1a', background: `linear-gradient(135deg, ${accent}, #fff)` }}>
          ✨ {z.actionLabel}
        </ButtonBase>
        {feed?.more && (
          <ButtonBase onClick={() => onAction({ kind: 'open', href: feed.more!.href }, feed)} sx={{ px: 1.5, py: 0.9, borderRadius: 2, fontSize: 12.5, color: '#fff', bgcolor: 'rgba(255,255,255,0.08)' }}>
            {feed.more.label}
          </ButtonBase>
        )}
      </Box>
    </PanelShell>
  );
}

// ==================== 许愿墙 ====================

function timeAgo(iso: string) {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '';
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return '刚刚';
  if (s < 3600) return `${Math.floor(s / 60)} 分钟前`;
  if (s < 86400) return `${Math.floor(s / 3600)} 小时前`;
  return `${Math.floor(s / 86400)} 天前`;
}

function WishWall({ width, onClose, onAction, online }: { width: number | string; onClose: () => void; onAction: (a: FeedAction) => void; online: PlazaOnline }) {
  const [text, setText] = React.useState('');
  const [bounties, setBounties] = React.useState<FeedCard[]>([]);
  const accent = hex(ZONE_BY_ID.wish.color);
  React.useEffect(() => {
    let alive = true;
    openBounties().then((b) => { if (alive) setBounties(b); }).catch(() => {});
    void online.reloadWishes();
    return () => { alive = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const submit = async () => {
    const t = text.trim();
    if (t.length < 2 || online.wishBusy) return;
    if (await online.makeWish(t)) setText('');
  };
  return (
    <PanelShell zone="wish" title={`许愿墙 · 广场里现在 ${Math.max(1, online.online)} 人`} onClose={onClose} width={width}>
      <Box sx={{ mx: 0.5, mb: 1, p: 1, borderRadius: 2, bgcolor: `${accent}14`, border: `1px solid ${accent}33` }}>
        <InputBase
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 60))}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void submit(); } }}
          placeholder={online.wishError ? '许愿墙暂时连不上,稍后再来' : online.leftToday > 0 ? '写下一个愿望,挂到许愿墙上…' : '今天的 3 个愿望都许完了'}
          disabled={online.wishError || online.leftToday <= 0}
          fullWidth
          multiline
          maxRows={3}
          inputProps={{ 'aria-label': '愿望' }}
          sx={{ fontSize: 13, color: '#fff', '& textarea::placeholder': { color: 'rgba(255,255,255,0.45)', opacity: 1 } }}
        />
        <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.75 }}>
          <Typography sx={{ fontSize: 10.5, color: 'rgba(255,255,255,0.45)', flex: 1 }}>{online.wishError ? '许愿 +5 积分,祝福别人 +2' : `今天还能许 ${online.leftToday} 个 · 许愿 +5 积分,祝福别人 +2`}</Typography>
          <ButtonBase
            onClick={() => void submit()}
            disabled={online.wishError || text.trim().length < 2 || online.wishBusy || online.leftToday <= 0}
            sx={{ px: 1.5, py: 0.6, borderRadius: 1.5, fontSize: 12, fontWeight: 700, color: '#0b0e1a', background: `linear-gradient(135deg, ${accent}, #fff)`, '&.Mui-disabled': { opacity: 0.4 } }}
          >
            {online.wishBusy ? '投出中…' : '许愿 🌟'}
          </ButtonBase>
        </Box>
      </Box>
      {online.wishes.length === 0 && (
        <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', textAlign: 'center', py: 1.5 }}>{online.wishError ? '许愿墙暂时连不上' : '还没有人许愿,做第一个吧'}</Typography>
      )}
      {online.wishes.map((w) => (
        <Box key={w.id} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', p: 0.75, borderRadius: 2, '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } }}>
          <Box sx={{
            width: 30, height: 30, borderRadius: '50%', flexShrink: 0, bgcolor: 'rgba(255,255,255,0.1)',
            backgroundImage: w.user?.avatar ? `url("${w.user.avatar}")` : undefined, backgroundSize: 'cover',
            boxShadow: w.user?.aura ? `0 0 0 2px ${w.user.aura === 'rainbow' ? '#ff4fd8' : w.user.aura}` : undefined,
          }} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
              {w.mine ? '我' : w.user?.nickname || '访客'} · {timeAgo(w.createdAt)}
            </Typography>
            <Typography sx={{ fontSize: 13, color: '#fff', wordBreak: 'break-word' }}>{w.text}</Typography>
          </Box>
          <ButtonBase
            onClick={() => void online.bless(w)}
            disabled={w.blessed}
            aria-label="祝福"
            sx={{ display: 'flex', alignItems: 'center', gap: 0.3, px: 0.75, py: 0.4, borderRadius: 1.5, color: w.blessed ? '#ff7ac8' : 'rgba(255,255,255,0.6)', flexShrink: 0, '&.Mui-disabled': { color: '#ff7ac8' } }}
          >
            {w.blessed ? <FavoriteRoundedIcon sx={{ fontSize: 16 }} /> : <FavoriteBorderRoundedIcon sx={{ fontSize: 16 }} />}
            <Typography sx={{ fontSize: 11.5, fontVariantNumeric: 'tabular-nums' }}>{w.blessings}</Typography>
          </ButtonBase>
        </Box>
      ))}
      <Box sx={{ mt: 1.25, mx: 0.5, pt: 1, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#fff', flex: 1 }}>💰 正在悬赏</Typography>
          <ButtonBase onClick={() => onAction({ kind: 'open', href: '/account/reward?tab=demands' })} sx={{ fontSize: 11.5, color: CYAN, px: 0.75, py: 0.25, borderRadius: 1 }}>
            把愿望变成悬赏 →
          </ButtonBase>
        </Box>
        {bounties.length === 0 && <Typography sx={{ fontSize: 11.5, color: 'rgba(255,255,255,0.45)', py: 0.5 }}>暂时没有公开的悬赏</Typography>}
        {bounties.map((c) => <CardRow key={c.key} c={c} accent="#ffc93d" onAction={onAction} />)}
      </Box>
    </PanelShell>
  );
}

// ==================== 平台每日任务 ====================

export function PlatformTasks({ refreshKey, onPoints }: { refreshKey: number; onPoints?: (text: string) => void }) {
  const [tasks, setTasks] = React.useState<DailyTask[] | null>(null);
  const [growth, setGrowth] = React.useState<GrowthSummary | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const load = React.useCallback(async () => {
    try {
      const [t, g] = await Promise.all([getDailyTaskList(), getGrowthSummary()]);
      // 回包形状不对(服务没上线、网关回了 HTML)时当作没有数据,别让整页崩掉
      setTasks(Array.isArray(t) ? t.filter((x) => x && typeof x.taskType === 'string') : []);
      setGrowth(g && typeof g.point === 'number' ? g : null);
      setError(Array.isArray(t) && t.length > 0 ? null : '平台任务暂时连不上');
    } catch (e) {
      setError(errMsg(e, '平台任务加载失败'));
    }
  }, []);
  React.useEffect(() => { void load(); }, [load, refreshKey]);

  const doSign = async () => {
    setBusy('sign');
    try {
      const r = await signIn();
      onPoints?.(`签到 +${r.points} 积分${r.bonus ? `(连签奖励 +${r.bonus})` : ''}`);
      await load();
    } catch (e) {
      setError(errMsg(e, '签到失败'));
    } finally {
      setBusy(null);
    }
  };
  const claim = async (t: DailyTask) => {
    setBusy(t.taskType);
    try {
      await completeDailyTask(t.taskType);
      onPoints?.(`${t.name} +${t.rewardPoint} 积分`);
      await load();
    } catch (e) {
      setError(errMsg(e, '领取失败'));
    } finally {
      setBusy(null);
    }
  };

  // 签到单独做成按钮;分享发生在站外,这里不列。其余是服务端自动记的
  const shown = (tasks ?? []).filter((t) => t.taskType !== 'sign' && t.taskType !== 'share');
  return (
    <Box sx={{ mt: 1.5, pt: 1.25, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#fff', flex: 1 }}>平台每日任务</Typography>
        {growth && <Typography sx={{ fontSize: 11, color: '#ffc93d', fontWeight: 700 }}>🪙 {growth.point.toLocaleString()} 积分</Typography>}
      </Box>
      {error && <Typography sx={{ fontSize: 11, color: '#ff8a80', mb: 0.75 }}>{error}</Typography>}
      {growth && (
        <ButtonBase
          onClick={() => void doSign()}
          disabled={growth.signed || busy === 'sign'}
          sx={{
            width: '100%', mb: 1, py: 0.8, borderRadius: 2, fontSize: 12.5, fontWeight: 700,
            color: growth.signed ? 'rgba(255,255,255,0.5)' : '#0b0e1a',
            background: growth.signed ? 'rgba(255,255,255,0.06)' : 'linear-gradient(135deg, #ffc93d, #ffe29a)',
          }}
        >
          {growth.signed ? `今日已签到 · 连续 ${growth.seriesDays} 天` : busy === 'sign' ? '签到中…' : '📅 签到领积分'}
        </ButtonBase>
      )}
      {tasks === null && !error && <Box sx={{ py: 1, display: 'grid', placeItems: 'center' }}><CircularProgress size={16} sx={{ color: CYAN }} /></Box>}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        {shown.map((t) => {
          const done = t.doneCount ?? (t.completed ? t.maxCount : 0);
          return (
            <Box key={t.taskType} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: 12, color: t.completed ? 'rgba(255,255,255,0.5)' : '#fff' }} noWrap>{t.name}</Typography>
                <Typography sx={{ fontSize: 10.5, color: 'rgba(255,255,255,0.4)' }} noWrap>{t.description}</Typography>
              </Box>
              <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', fontVariantNumeric: 'tabular-nums' }}>{Math.min(done, t.maxCount)}/{t.maxCount}</Typography>
              {t.canClaim && !t.auto ? (
                <ButtonBase onClick={() => void claim(t)} disabled={busy === t.taskType} sx={{ px: 1, py: 0.3, borderRadius: 1, fontSize: 11, fontWeight: 700, color: '#0b0e1a', bgcolor: CYAN }}>领取</ButtonBase>
              ) : (
                <Typography sx={{ fontSize: 11, color: t.completed ? '#9dffcb' : '#ffc93d', minWidth: 42, textAlign: 'right' }}>{t.completed ? '已完成' : `+${t.rewardPoint}`}</Typography>
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

// ==================== 光环商店 ====================

export function AuraShop({ onClose, onChanged }: { onClose: () => void; onChanged: (msg: string) => void }) {
  const [items, setItems] = React.useState<PointMallItem[] | null>(null);
  const [owned, setOwned] = React.useState<UserCosmetic[]>([]);
  const [points, setPoints] = React.useState<number | null>(null);
  const [busy, setBusy] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const load = React.useCallback(async () => {
    try {
      const [mall, mine, g] = await Promise.all([getPointMallItems(), getMyCosmetics(), getGrowthSummary().catch(() => null)]);
      setItems((Array.isArray(mall?.list) ? mall.list : []).filter((i) => i?.deliverType === 'plaza_aura'));
      setOwned((Array.isArray(mine) ? mine : []).filter((c) => c?.kind === 'plaza_aura'));
      setPoints(typeof g?.point === 'number' ? g.point : null);
    } catch (e) {
      setError(errMsg(e, '商店加载失败'));
      setItems([]);
    }
  }, []);
  React.useEffect(() => { void load(); }, [load]);

  const act = async (item: PointMallItem) => {
    const mine = owned.find((c) => c.itemId === item.id || c.value === item.cosmeticValue);
    setBusy(item.id);
    setError(null);
    try {
      if (!mine) {
        await redeemPointMallItem(item.id);
        onChanged(`兑换了「${item.name}」`);
      } else if (mine.equipped) {
        await equipCosmetic({ kind: 'plaza_aura' });
        onChanged('摘下了光环');
      } else {
        await equipCosmetic({ id: mine.id });
        onChanged(`戴上了「${item.name}」`);
      }
      await load();
    } catch (e) {
      setError(errMsg(e, '操作失败'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Box sx={{ ...glass, borderRadius: 3, p: 1.5, width: 300, maxWidth: 'calc(100vw - 24px)', pointerEvents: 'auto', animation: `${slideIn} .18s ease-out` }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#fff', flex: 1 }}>广场光环</Typography>
        {points !== null && <Typography sx={{ fontSize: 11, color: '#ffc93d', fontWeight: 700, mr: 0.5 }}>🪙 {points.toLocaleString()}</Typography>}
        <IconButton size="small" aria-label="关闭" onClick={onClose} sx={{ color: 'rgba(255,255,255,0.6)' }}><CloseRoundedIcon sx={{ fontSize: 18 }} /></IconButton>
      </Box>
      <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', mb: 1 }}>戴在她脚下,广场里其他人也看得见。用积分兑换,在「我的装扮」里也能换。</Typography>
      {error && <Typography sx={{ fontSize: 11, color: '#ff8a80', mb: 0.75 }}>{error}</Typography>}
      {items === null && <Box sx={{ py: 2, display: 'grid', placeItems: 'center' }}><CircularProgress size={18} sx={{ color: CYAN }} /></Box>}
      {items?.length === 0 && !error && <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', py: 1 }}>商城里还没有上架光环</Typography>}
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
        {items?.map((it) => {
          const mine = owned.find((c) => c.itemId === it.id || c.value === it.cosmeticValue);
          const label = !mine ? `${it.points} 积分` : mine.equipped ? '摘下' : '佩戴';
          return (
            <ButtonBase
              key={it.id}
              onClick={() => void act(it)}
              disabled={busy === it.id}
              sx={{
                display: 'flex', flexDirection: 'column', alignItems: 'stretch', p: 1, borderRadius: 2, textAlign: 'left',
                bgcolor: 'rgba(255,255,255,0.05)', border: mine?.equipped ? `1px solid ${CYAN}` : '1px solid transparent',
              }}
            >
              <Box sx={{ height: 44, borderRadius: 1.5, background: it.gradient, display: 'grid', placeItems: 'center', fontSize: 20 }}>{it.emoji}</Box>
              <Typography sx={{ fontSize: 12, color: '#fff', mt: 0.75 }} noWrap>{it.name.replace('广场光环 · ', '')}</Typography>
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: mine ? CYAN : '#ffc93d' }}>{busy === it.id ? '…' : label}</Typography>
            </ButtonBase>
          );
        })}
      </Box>
    </Box>
  );
}
