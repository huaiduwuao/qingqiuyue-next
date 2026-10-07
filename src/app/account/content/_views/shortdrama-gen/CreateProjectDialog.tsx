'use client';

/**
 * 新建短剧:写故事 → 挑画风 → 定规格 → 看预估花多少钻 → 开拍。
 *
 * 画风来自管理员维护的风格库(/system/shortdrama):用户只看到名称、说明和示例图,
 * 背后的提示词、模型和参数由后端在建项目时拷进项目。出图按次扣钻(会员额度优先),
 * 这里按集数和时长给一个区间预估,失败的镜头会自动退钻。
 */

import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import Link from '@mui/material/Link';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import DiamondRoundedIcon from '@mui/icons-material/DiamondRounded';
import { dramaAPI, estimateCost, type DramaStyle, type Project } from '@/apis/shortdrama';
import { formatDiamonds, getWalletBalance } from '@/apis/wallet';
import { coverBackgroundImage } from '@/lib/media';
import { useCapabilities } from './useProject';

const GENRES = ['都市情感', '甜宠', '悬疑', '古装', '逆袭爽剧', '奇幻', '职场', '校园', '家庭伦理', '科幻'];
/** 旧后端没有风格库时的兜底:只传风格名给编剧和美术员工 */
const FALLBACK_STYLES = ['写实电影感', '国风水墨', '日系动漫', '3D 动画', '赛博朋克', '复古胶片', '高饱和漫画'];
const EP_SECONDS = [30, 60, 90, 120, 180];
/** 没有示例图的风格卡片用的底色 */
const SWATCHES = [
  'linear-gradient(135deg,#3a2a1f,#a0714f)',
  'linear-gradient(135deg,#1f3a35,#6fb3a0)',
  'linear-gradient(135deg,#2b2350,#e07bb4)',
  'linear-gradient(135deg,#102a43,#4fa3e0)',
  'linear-gradient(135deg,#402030,#f2a07b)',
  'linear-gradient(135deg,#222,#999)',
  'linear-gradient(135deg,#120c2e,#ff2bd6)',
  'linear-gradient(135deg,#1e3a1e,#f6d743)',
];

const range = ([a, b]: [number, number]) => (a === b ? `${a}` : `${a}~${b}`);

export default function CreateProjectDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (p: Project) => void }) {
  const [form, setForm] = useState<Partial<Project>>({ intent: '', genre: '都市情感', episodes: 3, ep_seconds: 60, aspect: '9:16' });
  const [styleKey, setStyleKey] = useState<string>('');
  const [autostart, setAutostart] = useState(true);
  const [err, setErr] = useState('');
  const set = (k: keyof Project, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const stylesQ = useQuery({ queryKey: ['drama', 'styles'], queryFn: dramaAPI.styles, enabled: open, staleTime: 5 * 60_000 });
  const caps = useCapabilities();
  const wallet = useQuery({ queryKey: ['wallet'], queryFn: getWalletBalance, enabled: open, retry: false });

  const styles: DramaStyle[] = stylesQ.data?.length ? stylesQ.data : stylesQ.isLoading ? [] : FALLBACK_STYLES.map((name) => ({ id: 0, name, description: '', cover_url: '' }));
  const keyOf = (s: DramaStyle) => (s.id ? `id:${s.id}` : `name:${s.name}`);
  const picked = styles.find((s) => keyOf(s) === styleKey) ?? styles[0];

  const est = estimateCost(caps.data, form.episodes ?? 3, form.ep_seconds ?? 60);
  const balance = wallet.data?.balance;
  const short = est && balance != null && balance < est.image[0];

  const m = useMutation({
    mutationFn: () => dramaAPI.createProject({ ...form, style: picked?.name, style_id: picked?.id || undefined }, autostart ? 'pipeline' : undefined),
    onSuccess: (res) => onCreated(res.project),
    onError: (e: Error) => setErr(e.message),
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>新建短剧</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          {err && <Alert severity="error">{err}</Alert>}

          <Stack spacing={1.5}>
            <TextField
              label="故事"
              placeholder="用一两句话说清楚你想讲什么故事、给谁看、什么感觉。例:落魄千金被退婚后摆摊卖煎饼,意外被首富认出是失散多年的女儿"
              multiline
              minRows={3}
              value={form.intent}
              onChange={(e) => set('intent', e.target.value)}
              autoFocus
            />
            <TextField size="small" label="标题(可留空,编剧会起)" value={form.title ?? ''} onChange={(e) => set('title', e.target.value)} />
          </Stack>

          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              画风
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' }, gap: 1.25 }}>
              {stylesQ.isLoading
                ? Array.from({ length: 8 }, (_, i) => <Skeleton key={i} variant="rounded" sx={{ aspectRatio: '3 / 4', height: 'auto' }} />)
                : styles.map((s, i) => {
                    const on = picked && keyOf(s) === keyOf(picked);
                    return (
                      <ButtonBase
                        key={keyOf(s)}
                        onClick={() => setStyleKey(keyOf(s))}
                        aria-pressed={!!on}
                        sx={{
                          position: 'relative',
                          aspectRatio: '3 / 4',
                          borderRadius: 2,
                          overflow: 'hidden',
                          alignItems: 'flex-end',
                          justifyContent: 'flex-start',
                          textAlign: 'left',
                          outline: on ? '3px solid' : '1px solid',
                          outlineColor: on ? 'primary.main' : 'divider',
                          outlineOffset: on ? -3 : -1,
                          backgroundImage: s.cover_url ? coverBackgroundImage(s.cover_url) : SWATCHES[i % SWATCHES.length],
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                        }}
                      >
                        {on && <CheckCircleRoundedIcon color="primary" sx={{ position: 'absolute', top: 6, right: 6, bgcolor: 'background.paper', borderRadius: '50%' }} />}
                        <Box sx={{ width: '100%', p: 1, pt: 3, background: 'linear-gradient(transparent, rgba(0,0,0,.75))', color: '#fff' }}>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {s.name}
                          </Typography>
                          {s.description && (
                            <Typography variant="caption" sx={{ opacity: 0.85, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                              {s.description}
                            </Typography>
                          )}
                        </Box>
                      </ButtonBase>
                    );
                  })}
            </Box>
          </Box>

          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              题材
            </Typography>
            <Stack direction="row" sx={{ flexWrap: 'wrap' }} spacing={1} useFlexGap>
              {GENRES.map((g) => (
                <Chip key={g} label={g} clickable color={form.genre === g ? 'primary' : 'default'} variant={form.genre === g ? 'filled' : 'outlined'} onClick={() => set('genre', g)} />
              ))}
            </Stack>
          </Box>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: { sm: 'center' } }}>
            <ToggleButtonGroup exclusive size="small" value={form.aspect} onChange={(_, v) => v && set('aspect', v)}>
              <ToggleButton value="9:16">竖屏 9:16</ToggleButton>
              <ToggleButton value="16:9">横屏 16:9</ToggleButton>
              <ToggleButton value="1:1">方形 1:1</ToggleButton>
            </ToggleButtonGroup>
            <TextField size="small" label="集数" type="number" sx={{ width: 100 }} value={form.episodes} onChange={(e) => set('episodes', Math.max(1, Math.min(30, Number(e.target.value) || 1)))} />
            <TextField size="small" select label="每集时长" sx={{ width: 130 }} value={form.ep_seconds} onChange={(e) => set('ep_seconds', Number(e.target.value))}>
              {EP_SECONDS.map((s) => (
                <MenuItem key={s} value={s}>
                  {s < 60 ? `${s} 秒` : `${s / 60} 分钟`}
                </MenuItem>
              ))}
            </TextField>
          </Stack>

          <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
              <DiamondRoundedIcon color="primary" fontSize="small" />
              <Typography variant="subtitle2">费用预估</Typography>
              <Box sx={{ flex: 1 }} />
              {balance != null && (
                <Typography variant="body2" color="text.secondary">
                  余额 {formatDiamonds(balance)} ·{' '}
                  <Link href="/recharge" underline="hover">
                    充值
                  </Link>
                </Typography>
              )}
            </Stack>
            {est ? (
              <>
                <Typography variant="body2">
                  一键生成约 <b>{range(est.image)} 钻</b>(约 {range(est.imageCount)} 张图:角色定妆、场景和每个镜头)
                </Typography>
                {est.video[1] > 0 && (
                  <Typography variant="body2" color="text.secondary">
                    之后把镜头做成动态视频,另需约 {range(est.video)} 钻(在分镜页按需点「出片」)
                  </Typography>
                )}
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                  按实际出图张数扣,会员每日额度优先;生成失败的自动退回。剧本、分镜等文字环节不另收钻石。
                </Typography>
                {short && (
                  <Alert severity="warning" sx={{ mt: 1 }}>
                    余额可能不够,生成到一半会停下。可以先充值,或减少集数 / 时长。
                  </Alert>
                )}
              </>
            ) : (
              <Typography variant="body2" color="text.secondary">
                {caps.isLoading ? '正在查询出图价格…' : '出图服务暂未开放:可以先生成剧本和分镜,出图环节自动跳过,不扣钻石。'}
              </Typography>
            )}
          </Paper>

          <FormControlLabel control={<Switch checked={autostart} onChange={(e) => setAutostart(e.target.checked)} />} label="创建后立即一键生成(剧本 → 角色与场景 → 每集分镜 → 出图 → 质检)" />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button variant="contained" disabled={!form.intent?.trim() || !picked || m.isPending} onClick={() => m.mutate()}>
          {autostart ? '创建并开始生成' : '创建'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
