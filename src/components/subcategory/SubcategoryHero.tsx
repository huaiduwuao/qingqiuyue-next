'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useSubcategories } from './SubcategoryChip';
import { SubscribeButton } from '@/components/subscription/SubscribeButton';

interface Props {
  code: string;
  parent?: string;
  title?: string;
  description?: string;
  cover?: string;
}

/**
 * SubcategoryHero —— 详情页 Hero:顶图 + 标题 + 描述 + 订阅按钮。
 *
 * 作为 DetailLayout 的 hero 槽位;或独立放在专题聚合页顶部。
 */
export function SubcategoryHero({
  code,
  parent = 'NEWS',
  title,
  description,
  cover,
}: Props) {
  const { data } = useSubcategories(parent);
  const entry = data?.find((s) => s.code === code);
  const displayTitle = title ?? entry?.name ?? code;

  return (
    <Box
      sx={{
        position: 'relative',
        height: { xs: 180, md: 240 },
        background: cover
          ? `linear-gradient(180deg, rgba(0,0,0,0.0) 0%, rgba(0,0,0,0.5) 100%), url(${cover}) center/cover`
          : 'linear-gradient(135deg, #fe2c55 0%, #25f4ee 100%)',
        display: 'flex',
        alignItems: 'flex-end',
        px: { xs: 2, md: 4 },
        pb: 2,
        color: '#fff',
      }}
    >
      <Box>
        <Typography sx={{ fontSize: 12, opacity: 0.85, mb: 0.5 }}>{code}</Typography>
        <Typography sx={{ fontSize: { xs: 22, md: 30 }, fontWeight: 800, lineHeight: 1.2 }}>
          {displayTitle}
        </Typography>
        {description && (
          <Typography sx={{ fontSize: 13, opacity: 0.9, mt: 1, maxWidth: 600 }}>
            {description}
          </Typography>
        )}
        <Box sx={{ mt: 1.5 }}>
          <SubscribeButton
            targetType="subcategory"
            targetKey={code}
            variant="button"
          />
        </Box>
      </Box>
    </Box>
  );
}

export default SubcategoryHero;