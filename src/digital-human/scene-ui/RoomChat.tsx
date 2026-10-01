/**
 * scene-ui/RoomChat.tsx — 创世二期:房间里的人和房间里说的话
 *
 * 在房间场景里常驻左下(手机是一颗可展开的小按钮):此刻几个人、谁在、最近几句话、输入框。
 * 这里说的话发给房里的人(过敏感词),和数字人对话是两回事;说话的人头顶会冒气泡。
 * 四期:标题下面是语音条(RoomVoice.tsx),名字标签上看得出谁开着麦、谁在说话,点名字能屏蔽 / 禁言。
 * 七期:广场等公共场景里也有(「这里 N 人」);开麦说的话转成字幕进聊天(🎙 标记)。
 */

import React from 'react';
import { Box, ButtonBase, IconButton, InputBase, Typography } from '@mui/material';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import type { RoomSocketState } from './useRoomSocket';
import type { RoomVoiceState } from './useRoomVoice';
import { PeerChip, VoiceStrip } from './RoomVoice';

const STATUS_TEXT: Record<string, { text: string; color: string }> = {
  open: { text: '', color: '#7dffb0' },
  connecting: { text: '连接中…', color: '#ffd27a' },
  reconnecting: { text: '重连中…', color: '#ffb07a' },
  idle: { text: '未连接', color: 'rgba(255,255,255,0.4)' },
};

export function RoomChat({ rs, narrow, voice }: { rs: RoomSocketState; narrow?: boolean; voice?: RoomVoiceState | null }) {
  const [text, setText] = React.useState('');
  const [open, setOpen] = React.useState(!narrow);
  const [picked, setPicked] = React.useState<string | null>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight }); }, [rs.chat.length, open]);
  if (!rs.inRoom) return null;
  const st = STATUS_TEXT[rs.status] ?? STATUS_TEXT.idle;
  const where = rs.space === 'scene' ? '这里' : '房间里';
  const send = () => {
    if (rs.say(text)) setText('');
  };

  const pos = narrow
    ? { left: 12, bottom: 'calc(min(46vh, 460px) + 14px)' }
    : { left: 16, bottom: 'calc(min(40vh, 400px) + 16px)' };

  if (!open) {
    return (
      <ButtonBase onClick={() => setOpen(true)} sx={{ position: 'absolute', zIndex: 3, ...pos, px: 1.25, py: 0.5, borderRadius: 999, bgcolor: 'rgba(8,10,20,0.66)', backdropFilter: 'blur(14px)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontSize: 12, fontWeight: 700, gap: 0.75 }}>
        <Box component="span" sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: st.color }} />
        💬 {where} {rs.online} 人{rs.aiCount ? ` · ${rs.aiCount} 位 AI` : ''}
        {voice?.soundOn && <Box component="span" sx={{ color: voice.talking ? '#7dffb0' : 'rgba(255,255,255,0.7)' }}>{voice.micOn || voice.ptt ? '🎙' : '🔈'}</Box>}
        {!!voice?.speaking.length && <Box component="span" sx={{ color: '#7dffb0' }}>· {voice.speaking.length} 人在说</Box>}
      </ButtonBase>
    );
  }
  return (
    <Box sx={{ position: 'absolute', zIndex: 3, ...pos, width: narrow ? 'calc(100vw - 24px)' : 300, maxWidth: 300, borderRadius: 3, bgcolor: 'rgba(8,10,20,0.66)', backdropFilter: 'blur(14px)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1.25, pt: 1, pb: 0.5 }}>
        <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: st.color, flexShrink: 0 }} />
        <Typography sx={{ fontSize: 13, fontWeight: 800, flex: 1 }}>{where} {rs.online} 人{rs.aiCount ? ` · ${rs.aiCount} 位 AI` : ''}{st.text ? ` · ${st.text}` : ''}</Typography>
        <IconButton size="small" aria-label="收起" onClick={() => setOpen(false)} sx={{ color: 'rgba(255,255,255,0.55)', p: 0.25 }}><ExpandMoreRoundedIcon fontSize="small" /></IconButton>
      </Box>
      {voice && <VoiceStrip rs={rs} voice={voice} narrow={narrow} />}
      {rs.peers.length > 0 && (
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', px: 1.25, pb: 0.5 }}>
          {rs.peers.slice(0, 12).map((p) => (
            <PeerChip key={p.id} p={p} rs={rs} voice={voice ?? null} open={picked === p.id} onToggle={() => setPicked((x) => (x === p.id ? null : p.id))} />
          ))}
          {rs.peers.length > 12 && <Box sx={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>…等 {rs.peers.length} 人</Box>}
        </Box>
      )}
      <Box ref={listRef} sx={{ maxHeight: narrow ? '18vh' : 160, overflowY: 'auto', px: 1.25, display: 'flex', flexDirection: 'column', gap: 0.4 }}>
        {rs.chat.length === 0 && (
          <Typography sx={{ fontSize: 11.5, color: 'rgba(255,255,255,0.45)', py: 0.5 }}>
            {rs.peers.some((p) => p.ai) ? '叫它的名字就能和 AI 聊(打字或开麦说都行),比如「小秋,带我看看书架」' : rs.online > 1 ? '打个招呼吧,开麦说的话会转成字幕' : rs.space === 'scene' ? '这里暂时只有你。别人进来就能看到你、和你说话。' : '房里只有你。开放串门后把链接发给朋友,他们进来就能看到你。'}
          </Typography>
        )}
        {rs.chat.map((c, i) => (
          <Typography key={`${c.ts}-${i}`} sx={{ fontSize: 12.5, lineHeight: 1.5, wordBreak: 'break-word' }}>
            <Box component="span" sx={{ color: c.mine ? '#9be8ff' : c.ai ? '#c7a6ff' : '#ffd27a', fontWeight: 700 }}>{c.voice ? '🎙 ' : ''}{c.mine ? '我' : c.ai ? `🤖 ${c.nickname}` : c.nickname}</Box>
            <Box component="span" sx={{ color: 'rgba(255,255,255,0.88)' }}>:{c.text}</Box>
          </Typography>
        ))}
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, m: 1, px: 1, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.08)' }}>
        <InputBase
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 120))}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } e.stopPropagation(); }}
          placeholder={rs.status === 'open' ? '对房间里的人说…' : '连上以后才能说话'}
          disabled={rs.status !== 'open'}
          sx={{ flex: 1, color: '#fff', fontSize: 13, py: 0.5 }}
          inputProps={{ 'aria-label': '房间聊天' }}
        />
        <IconButton size="small" aria-label="发送" disabled={!text.trim() || rs.status !== 'open'} onClick={send} sx={{ color: '#25F4EE' }}><SendRoundedIcon fontSize="small" /></IconButton>
      </Box>
    </Box>
  );
}
