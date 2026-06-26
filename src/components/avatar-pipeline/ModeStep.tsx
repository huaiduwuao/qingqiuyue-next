'use client';

import { Box, Typography, Card, CardActionArea, CardContent } from '@mui/material';
import VideoCameraFrontRoundedIcon from '@mui/icons-material/VideoCameraFrontRounded';
import FaceRetouchingNaturalRoundedIcon from '@mui/icons-material/FaceRetouchingNaturalRounded';

export type AvatarMode = 'video' | 'library';

export interface ModeStepProps {
  onSelect: (mode: AvatarMode) => void;
}

const MODES: Array<{
  id: AvatarMode;
  title: string;
  desc: string;
  Icon: typeof VideoCameraFrontRoundedIcon;
  tag: string;
}> = [
  {
    id: 'library',
    title: '选个二次元角色',
    desc: '从平台预制的 10 个二次元角色里挑一个,改个名就能上线。几分钟搞定。',
    Icon: FaceRetouchingNaturalRoundedIcon,
    tag: '推荐 · 5 分钟',
  },
  {
    id: 'video',
    title: '上传视频自建真人数字人',
    desc: '手机拍 30 秒慢转 360°,过 COLMAP + 3DGS + Blender 绑骨。要 30~60 分钟。',
    Icon: VideoCameraFrontRoundedIcon,
    tag: '需要 NVIDIA GPU',
  },
];

export default function ModeStep({ onSelect }: ModeStepProps) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography sx={{ fontSize: 14, fontWeight: 600 }}>
        第 1 步:选个方式
      </Typography>
      <Box sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
        gap: 2,
      }}>
        {MODES.map((m) => {
          const Icon = m.Icon;
          return (
            <Card
              key={m.id}
              sx={{
                borderRadius: 2,
                border: m.id === 'library'
                  ? (t) => `2px solid ${t.palette.primary.main}`
                  : '1px solid',
                borderColor: m.id === 'library' ? 'primary.main' : 'divider',
                position: 'relative',
              }}
            >
              <CardActionArea onClick={() => onSelect(m.id)} sx={{ p: 2 }}>
                <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Icon sx={{
                      fontSize: 32,
                      color: m.id === 'library' ? 'primary.main' : 'text.secondary',
                    }} />
                    <Typography
                      sx={{
                        fontSize: 10,
                        color: m.id === 'library' ? 'primary.main' : 'text.disabled',
                        fontWeight: 600,
                        ml: 'auto',
                        border: '1px solid',
                        borderColor: 'currentColor',
                        borderRadius: 1,
                        px: 0.75,
                        py: 0.25,
                      }}
                    >
                      {m.tag}
                    </Typography>
                  </Box>
                  <Typography sx={{ fontSize: 15, fontWeight: 600 }}>
                    {m.title}
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                    {m.desc}
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          );
        })}
      </Box>
    </Box>
  );
}
