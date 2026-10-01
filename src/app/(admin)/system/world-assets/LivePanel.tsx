'use client';

/**
 * 创世九期:集线器运行状况(GET /admin/world/live,5 秒刷新一次)
 *
 * 在线:连接 / 人 / 在房间或场景里的人 / 有人的房间 / AI;声音:在听 / 开麦 / 转字幕;
 * 最近 10 秒:收发帧数、出站流量(压缩前)、语音包、慢连接被断开、满了没进去、每帧耗时(等锁 + 干活)。
 * 单个 core-api 压测过:1000 人同时在走 ≈ 2.5 核、每帧 3ms;2500 人 ≈ 3.3 核、每帧 30ms(见 docs/GENESIS-WORLD.md 九期)。
 */

import React from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import { adminWorldLive, type WorldLiveStats } from '@/apis/world';

const SCENE_NAMES: Record<string, string> = { plaza: '星光广场' };

function Cell({ label, value, sub, warn }: { label: string; value: React.ReactNode; sub?: React.ReactNode; warn?: boolean }) {
  return (
    <Paper variant="outlined" sx={{ p: 1.25 }}>
      <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{label}</Typography>
      <Typography sx={{ fontSize: 20, fontWeight: 800, color: warn ? 'error.main' : undefined }}>{value}</Typography>
      {sub && <Typography sx={{ fontSize: 11.5, color: 'text.secondary' }}>{sub}</Typography>}
    </Paper>
  );
}

export function WorldLivePanel() {
  const [s, setS] = React.useState<WorldLiveStats | null>(null);
  const [err, setErr] = React.useState('');
  React.useEffect(() => {
    let alive = true;
    const load = () => adminWorldLive().then((v) => { if (alive) { setS(v); setErr(''); } }).catch((e) => { if (alive) setErr(e?.message || '读不到'); });
    void load();
    const t = window.setInterval(load, 5000);
    return () => { alive = false; window.clearInterval(t); };
  }, []);
  const w = s?.window;
  const slowTick = !!w && w.tickMaxMs > 100;
  return (
    <Box sx={{ mb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 800 }}>运行状况</Typography>
        <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{err ? `读不到:${err}` : w?.endedAt ? `最近 ${Math.round(w.seconds)} 秒 · 5 秒刷新` : '刚启动,10 秒后有速率'}</Typography>
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(6, 1fr)' }, gap: 1.25 }}>
        <Cell label="在线(人 / 连接)" value={s ? `${s.users} / ${s.sockets}` : '—'} sub={s ? `在房间或场景里 ${s.inRooms} 人` : undefined} />
        <Cell label="有人的房间 / AI" value={s ? `${s.rooms} / ${s.bots}` : '—'} sub={s?.busiestRoom ? `最热闹的房 ${s.busiestRoom.n} 人(房主 ${s.busiestRoom.ownerId})` : undefined} />
        <Cell label="声音(在听 / 开麦)" value={s ? `${s.listening} / ${s.speaking}` : '—'} sub={s ? `转字幕 ${s.captions}${s.asrDown ? ' · asr 连不上' : ''} · 合成中 ${s.ttsBusy}` : undefined} warn={!!s?.asrDown} />
        <Cell label="收 / 发(帧/秒)" value={w ? `${Math.round(w.msgsInPerSec)} / ${Math.round(w.framesOutPerSec)}` : '—'} sub={w ? `出站 ${w.kbOutPerSec >= 1024 ? `${(w.kbOutPerSec / 1024).toFixed(1)} MB/s` : `${Math.round(w.kbOutPerSec)} KB/s`}(压缩前)` : undefined} />
        <Cell label="语音包(收 / 转 每秒)" value={w ? `${Math.round(w.voiceInPerSec)} / ${Math.round(w.voiceOutPerSec)}` : '—'} sub={w ? `丢 ${w.voiceDrop} · 慢连接断开 ${w.slowDrops} · 满了没进 ${w.joinFull}` : undefined} warn={!!w && (w.slowDrops > 0 || w.joinFull > 0)} />
        <Cell label="每帧耗时(平均 / 最慢)" value={w ? `${w.tickAvgMs} / ${w.tickMaxMs} ms` : '—'} sub={w ? `其中等锁 ${w.tickWaitAvgMs} ms · 帧间隔 100 ms` : undefined} warn={slowTick} />
      </Box>
      {s && Object.keys(s.scenes).length > 0 && (
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1, alignItems: 'center' }}>
          {Object.entries(s.scenes).map(([name, lines]) => (
            <Box key={name} sx={{ display: 'flex', gap: 0.5, alignItems: 'center', flexWrap: 'wrap' }}>
              <Typography sx={{ fontSize: 12, fontWeight: 700 }}>{SCENE_NAMES[name] ?? name}</Typography>
              {lines.map((l) => <Chip key={l.line} size="small" label={`${l.line} 线 ${l.n} 人`} color={l.n >= 50 ? 'warning' : 'default'} />)}
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
