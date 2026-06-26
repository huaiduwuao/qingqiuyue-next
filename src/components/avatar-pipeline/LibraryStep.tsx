'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Box, Typography, Card, CardActionArea, CardMedia, CardContent,
  Button, Alert, CircularProgress, TextField,
} from '@mui/material';

export interface LibraryCharacter {
  id: string;
  name: string;
  name_zh: string;
  description: string;
  height: number;
  hair_style: string;
  hair_color: number[];
  eye_color: number[];
  outfit: string;
  thumbnail: string;
  model: string;
}

export interface LibraryStepProps {
  onSelected: (character: LibraryCharacter, customName: string) => void;
  onBack: () => void;
}

export default function LibraryStep({ onSelected, onBack }: LibraryStepProps) {
  const [chars, setChars] = useState<LibraryCharacter[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [picked, setPicked] = useState<LibraryCharacter | null>(null);
  const [name, setName] = useState('');

  useEffect(() => {
    axios.get<{ characters: LibraryCharacter[] }>('/api/avatar/pipeline/library')
      .then((r) => setChars(r.data.characters))
      .catch((e) => setErr(e?.response?.data?.msg || e?.message || '加载失败'));
  }, []);

  if (err) {
    return (
      <Box>
        <Alert severity="warning" sx={{ mb: 2 }}>
          角色库加载失败:{err}<br />
          需要先跑: <code>blender --background --python scripts/blender/build_anime_avatar.py -- --output public/avatars/library/</code>
        </Alert>
        <Button onClick={onBack}>返回</Button>
      </Box>
    );
  }

  if (!chars) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={28} /></Box>;
  }

  if (chars.length === 0) {
    return (
      <Box>
        <Alert severity="info" sx={{ mb: 2 }}>
          角色库为空。请运维跑 <code>build_anime_avatar.py</code> 生成预制角色。
        </Alert>
        <Button onClick={onBack}>返回</Button>
      </Box>
    );
  }

  // 已选角色:显示名字输入 + 确认
  if (picked) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 600 }}>第 3 步:命名</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
          <Box
            component="img"
            src={picked.thumbnail}
            alt={picked.name}
            sx={{ width: 80, height: 80, borderRadius: 1, objectFit: 'cover' }}
          />
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: 14, fontWeight: 600 }}>
              {picked.name}({picked.name_zh})
            </Typography>
            <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
              {picked.description} · 身高 {picked.height}m
            </Typography>
          </Box>
        </Box>
        <TextField
          fullWidth
          size="small"
          label="角色名(给 GLB 命名用)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={picked.id}
        />
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Button onClick={() => setPicked(null)}>← 换一个</Button>
          <Button
            variant="contained"
            disabled={!name}
            onClick={() => onSelected(picked, name)}
          >
            确认 →
          </Button>
        </Box>
      </Box>
    );
  }

  // 角色网格
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <Typography sx={{ fontSize: 14, fontWeight: 600 }}>
          第 2 步:选个角色
        </Typography>
        <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
          {chars.length} 个可选
        </Typography>
      </Box>

      <Box sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', md: 'repeat(4, 1fr)' },
        gap: 1.5,
      }}>
        {chars.map((c) => (
          <Card
            key={c.id}
            sx={{
              borderRadius: 2,
              transition: 'all 0.2s',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: (t) => `0 4px 16px ${t.palette.primary.main}40`,
              },
            }}
          >
            <CardActionArea onClick={() => setPicked(c)}>
              <Box sx={{
                width: '100%',
                aspectRatio: '1 / 1',
                background: `linear-gradient(135deg, rgba(${Math.round(c.hair_color[0] * 255)},${Math.round(c.hair_color[1] * 255)},${Math.round(c.hair_color[2] * 255)},0.3) 0%, rgba(${Math.round(c.eye_color[0] * 255)},${Math.round(c.eye_color[1] * 255)},${Math.round(c.eye_color[2] * 255)},0.3) 100%)`,
                position: 'relative',
              }}>
                <CardMedia
                  component="img"
                  image={c.thumbnail}
                  alt={c.name}
                  sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(e: any) => {
                    // 缩略图加载失败 → 显示首字母
                    e.target.style.display = 'none';
                  }}
                />
              </Box>
              <CardContent sx={{ p: 1.25 }}>
                <Typography sx={{ fontSize: 13, fontWeight: 600 }}>
                  {c.name}
                </Typography>
                <Typography sx={{ fontSize: 10, color: 'text.secondary' }} noWrap>
                  {c.description}
                </Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        ))}
      </Box>

      <Button onClick={onBack} sx={{ alignSelf: 'flex-start' }}>
        ← 返回选择方式
      </Button>
    </Box>
  );
}
