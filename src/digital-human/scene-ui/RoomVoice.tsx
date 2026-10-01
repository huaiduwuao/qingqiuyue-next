/**
 * scene-ui/RoomVoice.tsx — 创世四期:房间聊天面板里的语音条
 *
 *   没开声音:「开启声音」(浏览器要用户点一下才让放声音)
 *   开了:开麦 / 闭麦(带电平条)、按住说话(手机上按住按钮,电脑上也可以按住 V)、AI 念不念、关声音
 *   点某个人的名字:屏蔽他的声音(只影响自己);房主还能「禁言」(服务端不再转他的声音)
 */

import React from 'react';
import { Box, ButtonBase, Typography } from '@mui/material';
import type { PeerInfo } from '@/lib/world/roomSocket';
import type { RoomVoiceState } from './useRoomVoice';
import type { RoomSocketState } from './useRoomSocket';

const pill = (on: boolean, color = '#25F4EE') => ({
  px: 1, py: 0.4, borderRadius: 999, fontSize: 12, fontWeight: 700, gap: 0.5,
  bgcolor: on ? `${color}2e` : 'rgba(255,255,255,0.08)',
  color: on ? color : 'rgba(255,255,255,0.85)',
  border: `1px solid ${on ? `${color}88` : 'rgba(255,255,255,0.12)'}`,
});

export function VoiceStrip({ rs, voice, narrow }: { rs: RoomSocketState; voice: RoomVoiceState; narrow?: boolean }) {
  const s = voice.support;
  if (!s) return null;
  if (!rs.roomVoice) {
    return <Typography sx={{ fontSize: 11.5, color: 'rgba(255,255,255,0.45)', px: 1.25, pb: 0.5 }}>🔇 房主关了房间语音</Typography>;
  }
  if (!s.listen) {
    return <Typography sx={{ fontSize: 11.5, color: 'rgba(255,255,255,0.45)', px: 1.25, pb: 0.5 }}>🔇 {s.reason}</Typography>;
  }
  if (!voice.soundOn) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.25, pb: 0.75 }}>
        <ButtonBase onClick={() => void voice.enable()} sx={pill(false)} aria-label="开启声音">🔈 开启声音</ButtonBase>
        <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>听房里的人说话{s.talk ? ',也能开麦' : ''}</Typography>
      </Box>
    );
  }
  const anyAI = rs.peers.some((p) => p.ai);
  const live = voice.micOn || voice.ptt;
  return (
    <Box sx={{ px: 1.25, pb: 0.75 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
        {s.talk && (
          <ButtonBase onClick={() => void voice.toggleMic()} disabled={voice.busy || rs.selfMuted} sx={{ ...pill(voice.micOn, '#7dffb0'), position: 'relative', overflow: 'hidden' }} aria-label={voice.micOn ? '闭麦' : '开麦'}>
            {voice.micOn && <Box sx={{ position: 'absolute', left: 0, bottom: 0, height: 3, width: `${Math.round(voice.selfLevel * 100)}%`, bgcolor: voice.talking ? '#7dffb0' : 'rgba(125,255,176,0.35)', transition: 'width 90ms linear' }} />}
            {voice.micOn ? (voice.talking ? '🎙 说话中' : '🎙 开着麦') : '🎤 开麦'}
          </ButtonBase>
        )}
        {s.talk && !voice.micOn && (
          <ButtonBase
            disabled={rs.selfMuted}
            onPointerDown={(e) => { e.currentTarget.setPointerCapture?.(e.pointerId); void voice.setPtt(true); }}
            onPointerUp={() => void voice.setPtt(false)}
            onPointerCancel={() => void voice.setPtt(false)}
            onContextMenu={(e) => e.preventDefault()}
            sx={{ ...pill(voice.ptt, '#ffd27a'), touchAction: 'none', userSelect: 'none' }}
            aria-label="按住说话"
          >
            {voice.ptt ? '🎙 松开结束' : narrow ? '按住说话' : '按住说话 (V)'}
          </ButtonBase>
        )}
        {anyAI && voice.aiSpeechSupported && (
          <ButtonBase onClick={() => voice.setAiVoice(!voice.aiVoice)} sx={pill(voice.aiVoice, '#c7a6ff')} aria-label="AI 念出来">
            🤖 {voice.aiVoice ? '念' : '不念'}
          </ButtonBase>
        )}
        <Box sx={{ flex: 1 }} />
        <ButtonBase onClick={voice.disable} sx={{ ...pill(false), px: 0.75 }} aria-label="关掉声音">🔇</ButtonBase>
      </Box>
      {rs.selfMuted && <Typography sx={{ fontSize: 11, color: '#ffb0b0', mt: 0.5 }}>房主让你先别说话</Typography>}
      {!rs.selfMuted && s.talk && !live && !voice.micReady && (
        <Typography sx={{ fontSize: 10.5, color: 'rgba(255,255,255,0.42)', mt: 0.5 }}>戴耳机效果最好;开麦后只在你说话时才发声音</Typography>
      )}
      {!s.talk && s.reason && <Typography sx={{ fontSize: 10.5, color: 'rgba(255,255,255,0.42)', mt: 0.5 }}>{s.reason}</Typography>}
    </Box>
  );
}

/** 名字小标签:🎙 开着麦 / 🔇 被禁言 / 绿框 = 正在说话;点开能屏蔽、房主能禁言 */
export function PeerChip({ p, rs, voice, open, onToggle }: { p: PeerInfo; rs: RoomSocketState; voice: RoomVoiceState | null; open: boolean; onToggle: () => void }) {
  const talking = !!voice?.speaking.includes(p.id);
  const blocked = !!voice?.blocked[p.id];
  const color = p.owner ? '#9ff' : p.ai ? '#d9c6ff' : 'rgba(255,255,255,0.8)';
  const bg = p.owner ? 'rgba(37,244,238,0.18)' : p.ai ? 'rgba(199,166,255,0.16)' : 'rgba(255,255,255,0.08)';
  return (
    <Box sx={{ display: 'inline-flex', flexDirection: 'column' }}>
      <ButtonBase
        onClick={onToggle}
        sx={{ fontSize: 11, px: 0.75, py: 0.1, borderRadius: 999, bgcolor: bg, color, border: `1px solid ${talking ? '#7dffb0' : 'transparent'}`, boxShadow: talking ? '0 0 8px rgba(125,255,176,0.6)' : 'none', opacity: blocked ? 0.5 : 1, transition: 'box-shadow 120ms, border-color 120ms' }}
      >
        {p.muted ? '🔇 ' : p.voice === 2 ? '🎙 ' : ''}{p.owner ? '🏠 ' : p.ai ? '🤖 ' : ''}{p.nickname}
      </ButtonBase>
      {open && voice?.soundOn && (
        <Box sx={{ display: 'flex', gap: 0.5, mt: 0.4 }}>
          <ButtonBase onClick={() => voice.toggleBlock(p.id)} sx={{ fontSize: 10.5, px: 0.75, py: 0.2, borderRadius: 999, bgcolor: 'rgba(255,255,255,0.1)', color: '#fff' }}>
            {blocked ? '取消屏蔽' : '屏蔽声音'}
          </ButtonBase>
          {rs.isOwner && !p.ai && (
            <ButtonBase onClick={() => rs.vmute(p.id, !p.muted)} sx={{ fontSize: 10.5, px: 0.75, py: 0.2, borderRadius: 999, bgcolor: p.muted ? 'rgba(125,255,176,0.18)' : 'rgba(255,120,120,0.2)', color: p.muted ? '#7dffb0' : '#ffb0b0' }}>
              {p.muted ? '解除禁言' : '禁言'}
            </ButtonBase>
          )}
        </Box>
      )}
    </Box>
  );
}
