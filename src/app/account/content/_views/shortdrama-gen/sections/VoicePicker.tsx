'use client';

/**
 * 角色配音音色:下拉选 + 试听。音色列表来自后期能力(Kokoro 中文音色 zf_N 女声 / zm_N 男声),
 * 留空 = 配音时按性别自动分配一个不和其他角色重复的。试听由后端用该音色念一句、返回音频链接。
 */

import React, { useRef, useState } from 'react';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import FormControl from '@mui/material/FormControl';
import FormHelperText from '@mui/material/FormHelperText';
import IconButton from '@mui/material/IconButton';
import InputLabel from '@mui/material/InputLabel';
import ListSubheader from '@mui/material/ListSubheader';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Tooltip from '@mui/material/Tooltip';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import StopRoundedIcon from '@mui/icons-material/StopRounded';
import { dramaAPI } from '@/apis/shortdrama';
import { useCapabilities } from '../useProject';

/** zf_3 → 女声 3;zm_58 → 男声 58;其它(OpenAI 风格名)原样 */
export function voiceLabel(v: string): string {
  const m = /^z([fm])_(\d+)$/.exec(v);
  if (!m) return v;
  return `${m[1] === 'f' ? '女声' : '男声'} ${m[2]}`;
}

function genderOf(g: unknown): 'f' | 'm' | '' {
  const s = String(g ?? '').toLowerCase();
  if (s.includes('女') || s.startsWith('f')) return 'f';
  if (s.includes('男') || s.startsWith('m')) return 'm';
  return '';
}

export function VoicePicker({ value, gender, name, onChange }: { value: string; gender?: unknown; name?: string; onChange: (v: string) => void }) {
  const caps = useCapabilities();
  const voices = caps.data?.post?.voices ?? [];
  const g = genderOf(gender);
  const female = voices.filter((v) => v.startsWith('zf_'));
  const male = voices.filter((v) => v.startsWith('zm_'));
  const other = voices.filter((v) => !v.startsWith('zf_') && !v.startsWith('zm_'));
  // 按角色性别把同性别的音色排在前面
  const groups: [string, string[]][] = g === 'm'
    ? [['男声', male], ['女声', female], ['其它', other]]
    : [['女声', female], ['男声', male], ['其它', other]];

  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState('');
  const [loading, setLoading] = useState('');
  const [err, setErr] = useState('');

  const stop = () => {
    audio.current?.pause();
    setPlaying('');
  };
  const play = async (v: string) => {
    if (!v) return;
    if (playing === v) {
      stop();
      return;
    }
    stop();
    setErr('');
    setLoading(v);
    try {
      const r = await dramaAPI.voicePreview(v, name ? `我是${name}。这是我说话的声音。` : undefined);
      if (!r.url) throw new Error(r.error || '试听失败');
      const a = new Audio(r.url);
      audio.current = a;
      a.onended = () => setPlaying('');
      await a.play();
      setPlaying(v);
    } catch (e) {
      setErr((e as Error).message || '试听失败');
    } finally {
      setLoading('');
    }
  };
  React.useEffect(() => () => audio.current?.pause(), []);

  const playBtn = (v: string) => (
    <Tooltip title={playing === v ? '停止' : '试听'}>
      <span>
        <IconButton size="small" disabled={!!loading && loading !== v}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); play(v); }}>
          {loading === v ? <CircularProgress size={16} /> : playing === v ? <StopRoundedIcon fontSize="small" /> : <PlayArrowRoundedIcon fontSize="small" />}
        </IconButton>
      </span>
    </Tooltip>
  );

  const ttsOff = caps.data?.post && !caps.data.post.tts;
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
      <FormControl size="small" fullWidth>
        <InputLabel shrink>配音音色</InputLabel>
        <Select
          displayEmpty
          notched
          label="配音音色"
          value={value || ''}
          onChange={(e) => onChange(String(e.target.value))}
          renderValue={(v) => (v ? voiceLabel(String(v)) : '自动(按性别分配,不和其他角色重复)')}
          MenuProps={{ slotProps: { paper: { sx: { maxHeight: 420 } } } }}
        >
          <MenuItem value="">自动(按性别分配,不和其他角色重复)</MenuItem>
          {groups.flatMap(([title, list]) => list.length === 0 ? [] : [
            <ListSubheader key={`h-${title}`}>{title}</ListSubheader>,
            ...list.map((v) => (
              <MenuItem key={v} value={v} sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{voiceLabel(v)}</span>
                {playBtn(v)}
              </MenuItem>
            )),
          ])}
        </Select>
        <FormHelperText error={!!err || !!ttsOff}>
          {ttsOff ? '没有配置语音合成服务,不能配音' : err || '下拉里每个音色都能先试听;选定后这个角色的所有台词都用它'}
        </FormHelperText>
      </FormControl>
      {value && <Box sx={{ pt: 0.25 }}>{playBtn(value)}</Box>}
    </Box>
  );
}
