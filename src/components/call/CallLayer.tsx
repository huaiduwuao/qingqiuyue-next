'use client';

/**
 * 通话界面:来电 / 去电 / 通话中,全屏盖在最上层。挂在根 Providers 里,网站和 App 都在,
 * 换页面不断线。只在登录后订阅 call.* 事件(和全站推送共用那一条长连接,见 lib/realtime)。
 */

import { formatDurationPadded } from '@/lib/utils/format';
import React, { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Avatar from '@mui/material/Avatar';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import CallIcon from '@mui/icons-material/Call';
import CallEndIcon from '@mui/icons-material/CallEnd';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import VideocamIcon from '@mui/icons-material/Videocam';
import VideocamOffIcon from '@mui/icons-material/VideocamOff';
import CameraswitchIcon from '@mui/icons-material/Cameraswitch';
import { useAuth } from '@/contexts/AuthContext';
import { useRealtimeEvent } from '@/lib/realtime';
import { accept, flipCamera, hangup, onCallEvent, toggleCamera, toggleMute, useCall } from '@/lib/call/controller';


function Video({ stream, muted, mirror, sx }: { stream: MediaStream | null; muted?: boolean; mirror?: boolean; sx?: object }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (v.srcObject !== stream) v.srcObject = stream;
    if (stream) void v.play().catch(() => {});
  }, [stream]);
  return (
    <Box
      component="video"
      ref={ref}
      autoPlay
      playsInline
      muted={muted}
      sx={{ objectFit: 'cover', bgcolor: '#000', transform: mirror ? 'scaleX(-1)' : undefined, ...sx }}
    />
  );
}

/** 语音通话(或对方关了摄像头)时远端声音要有个元素放出来。 */
function RemoteAudio({ stream }: { stream: MediaStream | null }) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    const a = ref.current;
    if (!a) return;
    a.srcObject = stream;
    if (stream) void a.play().catch(() => {});
  }, [stream]);
  return <audio ref={ref} autoPlay />;
}

function RoundButton({
  label,
  color,
  onClick,
  children,
}: {
  label: string;
  color: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.75, width: 72 }}>
      <IconButton
        aria-label={label}
        onClick={onClick}
        sx={{ width: 60, height: 60, bgcolor: color, color: '#fff', '&:hover': { bgcolor: color, filter: 'brightness(1.1)' } }}
      >
        {children}
      </IconButton>
      <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.85)' }}>{label}</Typography>
    </Box>
  );
}

export default function CallLayer() {
  const { isAuthenticated } = useAuth();
  useRealtimeEvent((ev) => {
    if (ev.type.startsWith('call.')) void onCallEvent(ev);
  }, isAuthenticated);

  const st = useCall();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (st.phase !== 'active') return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [st.phase]);

  // 登出时如果还在通话里,挂掉
  useEffect(() => {
    if (!isAuthenticated && useCall.getState().phase !== 'idle') void hangup();
  }, [isAuthenticated]);

  // 关页面 / 刷新时尽量告诉对方(sendBeacon 带不了 Authorization,这里只能尽力而为:
  // 发不出去的话对方会看到 ICE 断开,10 秒后自己挂)
  useEffect(() => {
    const onUnload = () => {
      if (useCall.getState().phase !== 'idle') void hangup();
    };
    window.addEventListener('pagehide', onUnload);
    return () => window.removeEventListener('pagehide', onUnload);
  }, []);

  if (st.phase === 'idle' || !st.peer) return null;

  const video = st.media === 'video';
  const hasRemoteVideo = video && !!st.remoteStream?.getVideoTracks().length;
  const showRemoteVideo = hasRemoteVideo && (st.phase === 'active' || st.phase === 'connecting');
  const seconds = st.phase === 'active' && st.startedAt ? Math.max(0, Math.floor((now - st.startedAt) / 1000)) : 0;

  let status = '';
  switch (st.phase) {
    case 'outgoing':
      status = st.peerOffline ? '对方暂时不在线,正在呼叫…' : '正在等待对方接听…';
      break;
    case 'incoming':
      status = video ? '邀请你视频通话' : '邀请你语音通话';
      break;
    case 'connecting':
      status = '正在连接…';
      break;
    case 'active':
      status = formatDurationPadded(seconds);
      break;
    case 'ended':
      status = st.note;
      break;
  }

  return (
    <Box
      role="dialog"
      aria-label="通话"
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        bgcolor: '#111',
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* 远端画面铺满;没有画面时(语音 / 还没接通)用对方头像做模糊底 */}
      {showRemoteVideo ? (
        <Video stream={st.remoteStream} sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      ) : (
        <>
          {st.peer.avatar && (
            <Box
              sx={{
                position: 'absolute',
                inset: -40,
                backgroundImage: `url(${st.peer.avatar})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                filter: 'blur(40px) brightness(0.45)',
              }}
            />
          )}
          {/* 视频去电时先看到自己 */}
          {video && st.localStream && st.phase === 'outgoing' && !st.cameraOff && (
            <Video stream={st.localStream} muted mirror sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.55 }} />
          )}
        </>
      )}
      {!showRemoteVideo && <RemoteAudio stream={st.remoteStream} />}

      {/* 自己的小窗 */}
      {video && st.localStream && (st.phase === 'active' || st.phase === 'connecting') && (
        <Box
          sx={{
            position: 'absolute',
            top: 'calc(var(--sat, 0px) + 16px)',
            right: 16,
            width: { xs: 104, sm: 168 },
            aspectRatio: '3 / 4',
            borderRadius: 2,
            overflow: 'hidden',
            boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
            bgcolor: '#000',
            zIndex: 2,
          }}
        >
          {st.cameraOff ? (
            <Box sx={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
              摄像头已关
            </Box>
          ) : (
            <Video stream={st.localStream} muted mirror sx={{ width: '100%', height: '100%' }} />
          )}
        </Box>
      )}

      {/* 对方信息 */}
      <Box
        sx={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          pt: showRemoteVideo ? 'calc(var(--sat, 0px) + 20px)' : 'calc(var(--sat, 0px) + 14vh)',
          px: 2,
          textAlign: 'center',
          textShadow: '0 1px 4px rgba(0,0,0,0.6)',
        }}
      >
        {!showRemoteVideo && <Avatar src={st.peer.avatar} alt={st.peer.nickname} sx={{ width: 96, height: 96, mb: 2 }} />}
        <Typography sx={{ fontSize: showRemoteVideo ? 16 : 22, fontWeight: 600, color: '#fff' }}>{st.peer.nickname}</Typography>
        <Typography sx={{ fontSize: 14, mt: 0.75, color: 'rgba(255,255,255,0.85)' }} aria-live="polite">
          {status}
        </Typography>
      </Box>

      {/* 操作 */}
      <Box
        sx={{
          position: 'relative',
          zIndex: 1,
          mt: 'auto',
          pb: 'calc(var(--sab, 0px) + 40px)',
          px: 2,
          display: 'flex',
          justifyContent: 'center',
          gap: { xs: 2, sm: 4 },
          flexWrap: 'wrap',
        }}
      >
        {st.phase === 'incoming' && (
          <>
            <RoundButton label="拒绝" color="#e53935" onClick={() => void hangup('reject')}>
              <CallEndIcon />
            </RoundButton>
            <RoundButton label="接听" color="#43a047" onClick={() => void accept()}>
              {video ? <VideocamIcon /> : <CallIcon />}
            </RoundButton>
          </>
        )}
        {(st.phase === 'outgoing' || st.phase === 'connecting' || st.phase === 'active') && (
          <>
            <RoundButton label={st.muted ? '取消静音' : '静音'} color={st.muted ? '#fff3' : '#ffffff26'} onClick={toggleMute}>
              {st.muted ? <MicOffIcon /> : <MicIcon />}
            </RoundButton>
            {video && (
              <RoundButton label={st.cameraOff ? '开摄像头' : '关摄像头'} color="#ffffff26" onClick={toggleCamera}>
                {st.cameraOff ? <VideocamOffIcon /> : <VideocamIcon />}
              </RoundButton>
            )}
            {video && (
              <RoundButton label="翻转" color="#ffffff26" onClick={() => void flipCamera()}>
                <CameraswitchIcon />
              </RoundButton>
            )}
            <RoundButton label={st.phase === 'outgoing' ? '取消' : '挂断'} color="#e53935" onClick={() => void hangup()}>
              <CallEndIcon />
            </RoundButton>
          </>
        )}
      </Box>
    </Box>
  );
}
