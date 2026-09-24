'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import SystemUpdateAltRoundedIcon from '@mui/icons-material/SystemUpdateAltRounded';
import { requestUpdateCheck, updateMode, type UpdateMode } from '@/lib/appUpdate';

const noopSubscribe = () => () => {};

/** 运行环境不会变,预渲染 / 水合时取 null(和网页一致),水合后才读真实值,不会水合不一致。 */
export function useUpdateMode(): UpdateMode {
  return useSyncExternalStore(noopSubscribe, updateMode, () => null);
}

/** 客户端里才有的「当前版本 + 检查更新」,网页 / iOS 里不渲染。结果由常驻的 AppUpdater 弹出。 */
export default function ClientVersionCard() {
  const mode = useUpdateMode();
  const [version, setVersion] = useState('');

  useEffect(() => {
    if (!mode) return;
    let alive = true;
    import('@tauri-apps/api/app')
      .then(({ getVersion }) => getVersion())
      .then((v) => alive && setVersion(v))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [mode]);

  if (!mode) return null;

  return (
    <Card sx={{ mt: 3 }}>
      <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <Box sx={{ flex: 1, minWidth: 180 }}>
          <Typography variant="subtitle2">关于客户端</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            当前版本 {version || '—'}
          </Typography>
        </Box>
        <Button variant="outlined" startIcon={<SystemUpdateAltRoundedIcon />} onClick={requestUpdateCheck}>
          检查更新
        </Button>
      </CardContent>
    </Card>
  );
}
