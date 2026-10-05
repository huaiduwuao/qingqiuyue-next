'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Avatar from '@mui/material/Avatar';
import { TYPE_LABEL as CONTENT_TYPE_LABEL } from '@/lib/contentRoute';
import { mediaUrl } from '@/lib/media';
import type { SearchPersonCard } from '@/apis/search';

/** 搜人名时结果最上面的人物卡片:头像、身份、简介,按类型的作品数(点一下只看这一类)。 */
export function PersonCard({
  person,
  activeType,
  onOpen,
  onPickType,
}: {
  person: SearchPersonCard;
  activeType: string;
  onOpen: () => void;
  onPickType: (type: string) => void;
}) {
  const roles = (person.roles?.length ? person.roles : person.occupations) ?? [];
  const kinds = Object.entries(person.kindCounts ?? {})
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);
  return (
    <Box
      sx={{
        display: 'flex',
        gap: 2,
        p: 2,
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      <Avatar
        src={mediaUrl(person.cover) || undefined}
        slotProps={{ img: { referrerPolicy: 'no-referrer' } }}
        onClick={onOpen}
        sx={{ width: 72, height: 72, fontSize: 28, cursor: 'pointer', flexShrink: 0 }}
      >
        {person.name.slice(0, 1)}
      </Avatar>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography
            component="button"
            type="button"
            onClick={onOpen}
            sx={{
              p: 0, border: 0, bgcolor: 'transparent', cursor: 'pointer', font: 'inherit',
              fontSize: 18, fontWeight: 800, color: 'text.primary',
              '&:hover': { color: 'primary.main' },
            }}
          >
            {person.name}
          </Typography>
          <Chip label="人物" size="small" sx={{ height: 20, fontSize: 11, bgcolor: 'rgba(254, 44, 85, 0.12)', color: 'primary.main', fontWeight: 600 }} />
          {roles.slice(0, 4).map((r) => (
            <Typography key={r} component="span" sx={{ fontSize: 12, color: 'text.secondary' }}>
              {r}
            </Typography>
          ))}
          {person.birth && (
            <Typography component="span" sx={{ fontSize: 12, color: 'text.secondary' }}>
              · {person.birth.slice(0, 4)} 年生
            </Typography>
          )}
        </Box>
        {person.intro && (
          <Typography
            sx={{
              mt: 0.5, fontSize: 13, lineHeight: 1.6, color: 'text.secondary',
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}
          >
            {person.intro}
          </Typography>
        )}
        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mt: 1, alignItems: 'center' }}>
          {kinds.map(([type, n]) => (
            <Chip
              key={type}
              label={`${CONTENT_TYPE_LABEL[type] || type} ${n}`}
              size="small"
              variant={activeType === type ? 'filled' : 'outlined'}
              color={activeType === type ? 'primary' : 'default'}
              onClick={() => onPickType(type)}
              sx={{ height: 24, fontSize: 12 }}
            />
          ))}
          <Button size="small" onClick={onOpen} sx={{ ml: 'auto', textTransform: 'none', fontSize: 12 }}>
            人物主页 ›
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
