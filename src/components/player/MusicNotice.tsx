'use client';

import React, { useState } from 'react';
import Snackbar from '@mui/material/Snackbar';
import { useMusicPlayer } from '@/lib/player/musicPlayer';

/**
 * 音乐播放器的一次性提示(某首放不了已跳过 / 连续放不了已停止)。
 * 挂在 GlobalPlayers 里常驻:底栏收起成唱片、或正在看这首歌的详情页(底栏让位)时也要看得到。
 */
export default function MusicNotice() {
  const notice = useMusicPlayer((s) => s.notice);
  // 关掉的是哪一条;新提示 seq 变了就又会弹出来
  const [closedSeq, setClosedSeq] = useState(0);

  return (
    <Snackbar
      key={notice?.seq}
      open={!!notice && notice.seq !== closedSeq}
      autoHideDuration={3000}
      onClose={(_, reason) => reason !== 'clickaway' && setClosedSeq(notice?.seq ?? 0)}
      message={notice?.msg}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
    />
  );
}
