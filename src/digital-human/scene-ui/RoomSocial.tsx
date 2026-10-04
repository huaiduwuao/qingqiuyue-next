/**
 * scene-ui/RoomSocial.tsx — 创世六期:房间的社交(活动、关注房主)
 *
 *   eventWhen          活动时间的说法:「进行中」「今天 20:00」「明天 20:00」「10月2日 20:00」
 *   RoomEventBadge     门牌 / 房间卡片上的活动标签(进行中发绿光)
 *   EventsList         串门面板「活动」栏:要开始的活动,报名 / 取消报名 / 去看看
 *   RoomEventsSection  房间设置里「办活动」:表单 + 我办过的(能取消)
 *   FollowOwnerButton  串门时关注房主(走站内的关注,关注栏里就能看到他的房间)
 */

import React from 'react';
import { Box, Button, ButtonBase, CircularProgress, MenuItem, TextField, Typography } from '@mui/material';
import { cancelRoomEvent, createRoomEvent, listRoomEvents, rsvpRoomEvent, type WorldRoom, type WorldRoomEvent } from '@/apis/world';
import { followUser, unfollowUser } from '@/apis/social';

const pad = (n: number) => String(n).padStart(2, '0');

/** 活动时间的说法(按本地时间) */
export function eventWhen(ev: Pick<WorldRoomEvent, 'startAt' | 'endAt' | 'live'>, now = new Date()): string {
  if (ev.live) return '进行中';
  const s = new Date(ev.startAt);
  const hm = `${pad(s.getHours())}:${pad(s.getMinutes())}`;
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((day(s) - day(now)) / 86400000);
  if (diff === 0) return `今天 ${hm}`;
  if (diff === 1) return `明天 ${hm}`;
  return `${s.getMonth() + 1}月${s.getDate()}日 ${hm}`;
}

export function RoomEventBadge({ ev }: { ev?: WorldRoomEvent | null }) {
  if (!ev) return null;
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, mt: 0.5, fontSize: 11, px: 0.75, py: 0.15, borderRadius: 1, color: ev.live ? '#7dffb0' : '#ffd27a', border: `1px solid ${ev.live ? 'rgba(125,255,176,0.6)' : 'rgba(255,210,122,0.45)'}`, boxShadow: ev.live ? '0 0 8px rgba(125,255,176,0.35)' : 'none', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
      {ev.live ? '🎉' : '📅'} {eventWhen(ev)}「{ev.title}」{ev.rsvps ? ` · ${ev.rsvps} 人报名` : ''}
    </Box>
  );
}

const errText = (e: unknown, d: string) => {
  const m = (e as { message?: string })?.message;
  return typeof m === 'string' && m && m.length < 60 ? m : d;
};

/** 串门面板「活动」栏 */
export function EventsList({ onVisit, toast }: { onVisit: (ownerId: string) => void; toast?: (icon: string, text: string) => void }) {
  const [list, setList] = React.useState<WorldRoomEvent[] | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  React.useEffect(() => {
    let alive = true;
    listRoomEvents('upcoming').then((l) => { if (alive) setList(l); }).catch(() => { if (alive) setList([]); });
    return () => { alive = false; };
  }, []);
  const toggle = async (ev: WorldRoomEvent) => {
    setBusy(ev.id);
    try {
      const next = await rsvpRoomEvent(ev.id, !ev.joined);
      setList((l) => (l ?? []).map((x) => (x.id === ev.id ? { ...x, ...next, room: x.room } : x)));
      toast?.('📅', next.joined ? '报好名了,开始前 10 分钟提醒你' : '取消报名了');
    } catch (e) {
      toast?.('⚠️', errText(e, '没成功'));
    } finally {
      setBusy(null);
    }
  };
  if (list === null) return <CircularProgress size={16} sx={{ color: '#9be8ff' }} />;
  if (list.length === 0) {
    return <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>最近没有活动。在自己房间的设置里可以办一场。</Typography>;
  }
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {list.map((ev) => (
        <Box key={ev.id} sx={{ p: 1.25, borderRadius: 3, bgcolor: ev.live ? 'rgba(125,255,176,0.08)' : 'rgba(255,255,255,0.05)', border: `1px solid ${ev.live ? 'rgba(125,255,176,0.4)' : 'transparent'}` }}>
          <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: '#fff' }}>{ev.live ? '🎉 ' : ''}{ev.title}</Typography>
          <Typography sx={{ fontSize: 11.5, color: ev.live ? '#7dffb0' : '#ffd27a' }}>
            {eventWhen(ev)} · {ev.room?.name || '某人的房间'}{ev.room?.ownerName ? `(${ev.room.ownerName})` : ''}{ev.room?.online ? ` · ${ev.room.online} 人在` : ''}
          </Typography>
          {ev.intro && <Typography sx={{ fontSize: 11.5, color: 'rgba(255,255,255,0.65)', mt: 0.25 }}>{ev.intro}</Typography>}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.75 }}>
            <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', flex: 1 }}>{ev.rsvps} 人报名</Typography>
            <Button size="small" disabled={busy === ev.id} onClick={() => void toggle(ev)} sx={{ minWidth: 0, fontSize: 12, color: ev.joined ? 'rgba(255,255,255,0.6)' : '#ffd27a' }}>
              {ev.joined ? '已报名 · 取消' : '报名'}
            </Button>
            <Button size="small" variant="contained" onClick={() => onVisit(ev.ownerId)} sx={{ minWidth: 0, fontSize: 12 }}>{ev.live ? '进去' : '去看看'}</Button>
          </Box>
        </Box>
      ))}
    </Box>
  );
}

/** 默认开始时间:下一个整点(本地),datetime-local 的格式 */
export function defaultStartLocal(now = new Date()): string {
  const d = new Date(now.getTime() + 60 * 60 * 1000);
  d.setMinutes(0, 0, 0);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`;
}

const fieldSx = { '& .MuiInputBase-root': { color: '#fff', fontSize: 13 }, '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.6)' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' } };

/** 房间设置里「办活动」 */
export function RoomEventsSection({ room, toast }: { room: WorldRoom; toast: (icon: string, text: string) => void }) {
  const [mine, setMine] = React.useState<WorldRoomEvent[] | null>(null);
  const [title, setTitle] = React.useState('');
  const [intro, setIntro] = React.useState('');
  const [start, setStart] = React.useState(defaultStartLocal);
  const [minutes, setMinutes] = React.useState(60);
  const [busy, setBusy] = React.useState(false);
  const refresh = React.useCallback(async () => {
    try { setMine(await listRoomEvents('mine')); } catch { setMine([]); }
  }, []);
  React.useEffect(() => { void refresh(); }, [refresh]);

  const create = async () => {
    setBusy(true);
    try {
      await createRoomEvent({ title: title.trim(), intro: intro.trim(), startAt: new Date(start).toISOString(), minutes });
      toast('📅', '活动办好了,关注你的人会收到通知');
      setTitle('');
      setIntro('');
      await refresh();
    } catch (e) {
      toast('⚠️', errText(e, '没办成'));
    } finally {
      setBusy(false);
    }
  };
  const cancel = async (ev: WorldRoomEvent) => {
    setBusy(true);
    try {
      await cancelRoomEvent(ev.id);
      toast('📅', `「${ev.title}」取消了,报了名的人会收到通知`);
      await refresh();
    } catch (e) {
      toast('⚠️', errText(e, '没取消成'));
    } finally {
      setBusy(false);
    }
  };
  const now = Date.now();
  const open = room.visibility === 'public';

  return (
    <Box>
      {!open && <Typography sx={{ fontSize: 11.5, color: '#ffd27a', mb: 0.75 }}>先打开上面的「开放串门」,别人才进得来</Typography>}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <TextField size="small" label="活动名字(比如:周五茶会)" value={title} onChange={(e) => setTitle(e.target.value.slice(0, 40))} sx={fieldSx} />
        <TextField size="small" label="说两句(可不填)" value={intro} multiline minRows={1} maxRows={3} onChange={(e) => setIntro(e.target.value.slice(0, 300))} sx={fieldSx} />
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField size="small" type="datetime-local" label="开始" value={start} onChange={(e) => setStart(e.target.value)} sx={{ ...fieldSx, flex: 1 }} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField size="small" select label="多久" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} sx={{ ...fieldSx, width: 110 }}>
            {[30, 60, 90, 120, 180, 240].map((m) => <MenuItem key={m} value={m}>{m < 60 ? `${m} 分钟` : `${m / 60} 小时`}</MenuItem>)}
          </TextField>
        </Box>
        <Button size="small" variant="contained" disabled={busy || !open || !title.trim()} onClick={() => void create()} sx={{ alignSelf: 'flex-end' }}>办一场</Button>
      </Box>
      {mine === null && <CircularProgress size={14} sx={{ mt: 1 }} />}
      {!!mine?.length && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mt: 1.25 }}>
          {mine.map((ev) => {
            const over = new Date(ev.endAt).getTime() <= now;
            return (
              <Box key={ev.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1, py: 0.5, borderRadius: 1.5, bgcolor: 'rgba(255,255,255,0.05)', opacity: ev.status === 'cancelled' || over ? 0.5 : 1 }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: 12.5, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.title}</Typography>
                  <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>
                    {ev.status === 'cancelled' ? '已取消' : over ? '已结束' : eventWhen(ev)} · {ev.rsvps} 人报名
                  </Typography>
                </Box>
                {ev.status === 'scheduled' && !over && (
                  <Button size="small" disabled={busy} onClick={() => void cancel(ev)} sx={{ minWidth: 0, color: '#ffb0b0', fontSize: 11 }}>取消</Button>
                )}
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}

/** 串门时关注房主 */
export function FollowOwnerButton({ room, toast }: { room: WorldRoom; toast: (icon: string, text: string) => void }) {
  const [followed, setFollowed] = React.useState(!!room.followed);
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => setFollowed(!!room.followed), [room.ownerId, room.followed]);
  const toggle = async () => {
    setBusy(true);
    const next = !followed;
    try {
      if (next) await followUser(room.ownerId); else await unfollowUser(room.ownerId);
      setFollowed(next);
      toast('🏠', next ? `关注了${room.owner?.nickname || '房主'},串门面板的「关注」里能找到这间房` : '取消关注了');
    } catch (e) {
      toast('⚠️', errText(e, '没成功'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <ButtonBase disabled={busy} onClick={() => void toggle()} sx={{ px: 1, py: 0.3, borderRadius: 999, fontSize: 12, fontWeight: 700, color: followed ? 'rgba(255,255,255,0.6)' : '#25F4EE', border: `1px solid ${followed ? 'rgba(255,255,255,0.2)' : 'rgba(37,244,238,0.6)'}` }}>
      {followed ? '已关注' : '+ 关注房主'}
    </ButtonBase>
  );
}
