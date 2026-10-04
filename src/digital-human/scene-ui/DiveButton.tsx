/**
 * scene-ui/DiveButton.tsx — 潜水按钮:泡在液体里时出现,按住往下潜(电脑上按住 C 也行),松开慢慢浮回去
 *
 * 潜下去头没进会憋气的液体里,服务端开始憋气倒数(屏幕上方的憋气条);憋不住了按规则处理(go worldapp/laws.go)。
 */

import React from 'react';
import { Box } from '@mui/material';
import type { VrmStageHandle } from '../VrmStage';

export function DiveButton({ handle }: { handle: VrmStageHandle | null }) {
  const [show, setShow] = React.useState(false);
  const [down, setDown] = React.useState(false);
  React.useEffect(() => {
    if (!handle) return;
    const t = window.setInterval(() => setShow(handle.inLiquid()), 400);
    return () => { window.clearInterval(t); handle.setDiving(false); };
  }, [handle]);
  const set = (on: boolean) => { setDown(on); handle?.setDiving(on); };
  if (!show) return null;
  return (
    <Box component="button" type="button" aria-label="按住下潜"
      onPointerDown={(e: React.PointerEvent) => { e.preventDefault(); set(true); }}
      onPointerUp={() => set(false)} onPointerLeave={() => set(false)} onPointerCancel={() => set(false)}
      sx={{
        position: 'absolute', right: 16, bottom: 132, zIndex: 40, width: 64, height: 64, borderRadius: '50%',
        border: '1px solid rgba(127,211,255,0.6)', bgcolor: down ? 'rgba(40,110,170,0.85)' : 'rgba(10,30,60,0.65)', color: '#fff',
        fontSize: 12, lineHeight: 1.2, cursor: 'pointer', touchAction: 'none', userSelect: 'none', backdropFilter: 'blur(8px)',
      }}>
      🤿<br />按住潜<br /><span style={{ opacity: 0.6 }}>C</span>
    </Box>
  );
}
