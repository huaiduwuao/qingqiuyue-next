/**
 * scene-ui/RoomAI.tsx — 创世三期:房间里的 AI
 *
 *   RoomAISection    房间设置里的一块:AI 管家开关(房里有人时它在,替你招待访客)、请一位 AI 来做客
 *                    (后台上架的数字员工,最多 3 位,60 分钟)、此刻在房里的 AI 和「送走」
 *   DesignBar        布置助手出的方案正在半透明预览时,底部一条:主题、几件、缺了什么、「按这个布置」/「算了」
 */

import React from 'react';
import { Box, Button, ButtonBase, CircularProgress, Switch, Typography } from '@mui/material';
import { dismissAI, getMyRoomAI, inviteAI, listAIAgents, type AIAgentOption, type AIMember, type RoomPatch, type WorldRoom } from '@/apis/world';
import type { DesignPlan } from './useWorldObjects';
import { errMessage } from '@/lib/errMessage';

export function RoomAISection({ room, save, toast }: { room: WorldRoom; save: (p: RoomPatch) => Promise<WorldRoom>; toast: (icon: string, text: string) => void }) {
  const [agents, setAgents] = React.useState<AIAgentOption[] | null>(null);
  const [members, setMembers] = React.useState<AIMember[]>([]);
  const [busy, setBusy] = React.useState<string | null>(null);
  const refresh = React.useCallback(async () => {
    try { setMembers((await getMyRoomAI()).members); } catch { /* 接口没上线 */ }
  }, []);
  React.useEffect(() => {
    listAIAgents().then(setAgents).catch(() => setAgents([]));
    void refresh();
    const t = window.setInterval(() => void refresh(), 15_000);
    return () => window.clearInterval(t);
  }, [refresh]);

  const run = async (key: string, fn: () => Promise<unknown>, ok?: string) => {
    setBusy(key);
    try { await fn(); if (ok) toast('🤖', ok); await refresh(); } catch (e) { toast('⚠️', errMessage(e) || '没成功'); } finally { setBusy(null); }
  };
  const here = new Set(members.map((m) => m.key));

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Switch checked={!!room.butler} disabled={busy === 'butler'} onChange={(e) => void run('butler', () => save({ butler: e.target.checked }), e.target.checked ? '管家小秋上岗了' : '管家下班了')} />
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontSize: 12.5, fontWeight: 700 }}>AI 管家「小秋」</Typography>
          <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>房里有人时它在;你不在时替你招呼来串门的人,带他们看摆设</Typography>
        </Box>
      </Box>

      {members.length > 0 && (
        <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {members.map((m) => (
            <Box key={m.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1, py: 0.5, borderRadius: 1.5, bgcolor: 'rgba(199,166,255,0.12)' }}>
              <Typography sx={{ fontSize: 12.5, flex: 1 }}>🤖 {m.name}{m.butler ? ' · 管家' : ''}</Typography>
              {m.expiresAt && !m.butler && <Typography sx={{ fontSize: 10.5, color: 'rgba(255,255,255,0.5)' }}>{new Date(m.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} 走</Typography>}
              <Button size="small" disabled={busy === m.id} onClick={() => void run(m.id, () => dismissAI(m.id), `送走了${m.name}`)} sx={{ minWidth: 0, color: '#ffb0b0', fontSize: 11 }}>送走</Button>
            </Box>
          ))}
        </Box>
      )}

      <Typography sx={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.7)', mt: 1.25, mb: 0.5 }}>请一位 AI 来做客</Typography>
      <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', mb: 0.75 }}>你得在房间里;它按自己的人设和大家聊,叫它的名字就会接话,最多 3 位,待一小时</Typography>
      {agents === null && <CircularProgress size={14} />}
      {agents?.length === 0 && <Typography sx={{ fontSize: 11.5, color: 'rgba(255,255,255,0.45)' }}>暂时没有可以请的 AI</Typography>}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, maxHeight: 220, overflowY: 'auto' }}>
        {agents?.map((a) => {
          const isHere = here.has(`agent:${a.agentId}`);
          return (
            <ButtonBase key={a.agentId} disabled={isHere || busy === a.agentId}
              onClick={() => void run(a.agentId, () => inviteAI(a.agentId), `请${a.name}来了`)}
              sx={{ display: 'block', textAlign: 'left', px: 1, py: 0.6, borderRadius: 1.5, bgcolor: 'rgba(255,255,255,0.05)', opacity: isHere ? 0.55 : 1, '&:hover': { bgcolor: 'rgba(199,166,255,0.12)' } }}>
              <Typography sx={{ fontSize: 12.5, fontWeight: 700 }}>{a.name}{isHere ? ' · 在房里' : ''}{busy === a.agentId ? ' …' : ''}</Typography>
              {a.description && <Typography sx={{ fontSize: 10.5, color: 'rgba(255,255,255,0.5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.description}</Typography>}
            </ButtonBase>
          );
        })}
      </Box>
    </Box>
  );
}

export function DesignBar({ design, applying, onApply, onCancel, narrow }: { design: DesignPlan | null; applying: boolean; onApply: () => void; onCancel: () => void; narrow?: boolean }) {
  if (!design) return null;
  return (
    <Box sx={{
      position: 'absolute', zIndex: 6, left: '50%', transform: 'translateX(-50%)',
      bottom: narrow ? 'calc(min(46vh, 460px) + 64px)' : 'calc(min(40vh, 400px) + 24px)',
      width: narrow ? 'calc(100vw - 24px)' : 460, p: 1.5, borderRadius: 3,
      bgcolor: 'rgba(10,12,24,0.86)', backdropFilter: 'blur(16px)', border: '1px solid rgba(37,244,238,0.4)', color: '#fff',
    }}>
      <Typography sx={{ fontSize: 14, fontWeight: 800 }}>🏠 布置方案:{design.theme || '新布置'}</Typography>
      <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', mt: 0.25 }}>
        半透明的是预览,共 {design.items.length} 件{design.clearFirst ? ',会先收掉现在房里的东西' : ''}。
        {design.missing.length > 0 ? `素材库里没有:${design.missing.join('、')}。` : ''}
      </Typography>
      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.75, maxHeight: 60, overflowY: 'auto' }}>
        {design.items.map((it, i) => (
          <Box key={i} title={it.why || ''} sx={{ fontSize: 11, px: 0.75, py: 0.1, borderRadius: 999, bgcolor: 'rgba(255,255,255,0.08)' }}>
            {it.item}{it.asset.status !== 'ready' ? ' · 现做' : ''}
          </Box>
        ))}
      </Box>
      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', mt: 1 }}>
        <Button size="small" onClick={onCancel} disabled={applying} sx={{ color: 'rgba(255,255,255,0.6)' }}>算了</Button>
        <Button size="small" variant="contained" onClick={onApply} disabled={applying}>{applying ? '摆放中…' : '按这个布置'}</Button>
      </Box>
    </Box>
  );
}
