'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import WorkspacePremiumRoundedIcon from '@mui/icons-material/WorkspacePremiumRounded';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import GroupRoundedIcon from '@mui/icons-material/GroupRounded';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded';
import RedeemRoundedIcon from '@mui/icons-material/RedeemRounded';
import CelebrationRoundedIcon from '@mui/icons-material/CelebrationRounded';
import VerifiedRoundedIcon from '@mui/icons-material/VerifiedRounded';
import { CATEGORY_META, STATUS_META, PART_META, formatBigNumber, type Activity } from './data';
import { getPrimaryAction } from './actionBuilders';
import { getCountdownLabel } from './helpers';

interface ActivityCardProps {
  activity: Activity;
  onOpen: () => void;
  onSignup: () => void;
  onSubmit: () => void;
  onCopyLink: () => void;
}

/**
 * ActivityCard — 活动网格里的单个卡片(头像 / 标题 / 状态 / 主操作)。
 * 用户点击卡片任意位置 → onOpen(打开详情 Drawer);点击主按钮 → onSignup/onSubmit。
 */
export function ActivityCard({
  activity,
  onOpen,
  onSignup,
  onSubmit,
  onCopyLink,
}: ActivityCardProps) {
  const a = activity;
  const cat = CATEGORY_META[a.category];
  const st = STATUS_META[a.status];
  const pm = PART_META[a.participation];
  const countdownLabel = getCountdownLabel(a);
  const primaryAction = getPrimaryAction(a);

  return (
    <Box
      sx={{
        borderRadius: 2,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: a.participation === 'won' ? 'rgba(255, 215, 0, 0.4)' : 'divider',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'all 0.2s',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        '&:hover': { transform: 'translateY(-2px)', borderColor: cat.color },
      }}
      onClick={onOpen}
    >
      {/* Won ribbon */}
      {a.participation === 'won' && (
        <Box
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            zIndex: 2,
            px: 0.75,
            py: 0.25,
            borderRadius: 0.75,
            bgcolor: 'rgba(255, 215, 0, 0.95)',
            color: '#1F1B00',
            fontSize: 10,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 0.4,
            boxShadow: '0 2px 8px rgba(255, 215, 0, 0.4)',
          }}
        >
          <WorkspacePremiumRoundedIcon sx={{ fontSize: 12 }} />
          {pm.label}
        </Box>
      )}

      {/* Hero gradient + title */}
      <Box
        sx={{
          height: 110,
          background: a.gradient,
          position: 'relative',
          display: 'flex',
          alignItems: 'flex-end',
          p: 1.5,
        }}
      >
        <Chip
          label={cat.label}
          size="small"
          sx={{
            position: 'absolute',
            top: 8,
            left: 8,
            height: 20,
            bgcolor: 'background.paper',
            color: cat.color,
            fontSize: 10,
            fontWeight: 700,
          }}
        />
        {a.participation !== 'won' && (
          <Box
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              px: 0.75,
              py: 0.25,
              borderRadius: 0.75,
              bgcolor: 'rgba(0, 0, 0, 0.5)',
              color: '#fff',
              fontSize: 10,
              fontWeight: 600,
            }}
          >
            <LocalFireDepartmentIcon sx={{ fontSize: 11, color: '#FFB400' }} />
            {formatBigNumber(a.heat)}
          </Box>
        )}
        <Box sx={{ position: 'relative' }}>
          <Typography
            sx={{
              fontSize: 15,
              fontWeight: 700,
              color: '#fff',
              lineHeight: 1.3,
              textShadow: '0 1px 4px rgba(0,0,0,0.4)',
            }}
          >
            {a.title}
          </Typography>
        </Box>
      </Box>

      {/* Body */}
      <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 0.75, flex: 1 }}>
        <Typography
          sx={{
            fontSize: 12,
            color: 'text.secondary',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            lineHeight: 1.4,
            minHeight: 34,
          }}
        >
          {a.subtitle}
        </Typography>

        {/* Status row */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
          <Box
            sx={{
              px: 0.6,
              py: 0.15,
              borderRadius: 0.5,
              bgcolor: st.bg,
              color: st.color,
              fontSize: 10,
              fontWeight: 700,
            }}
          >
            {st.label}
          </Box>
          {a.participation !== 'none' && a.participation !== 'won' && (
            <Box
              sx={{
                px: 0.6,
                py: 0.15,
                borderRadius: 0.5,
                bgcolor: pm.bg,
                color: pm.color,
                fontSize: 10,
                fontWeight: 700,
              }}
            >
              {pm.label}
            </Box>
          )}
          <Box sx={{ flex: 1 }} />
          <Tooltip title="复制活动链接">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onCopyLink();
              }}
              sx={{ p: 0.5, color: 'text.disabled', '&:hover': { color: 'text.secondary' } }}
            >
              <ContentCopyRoundedIcon sx={{ fontSize: 13 }} />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Stats line */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Tooltip title="报名人数">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
              <GroupRoundedIcon sx={{ fontSize: 11, color: 'text.disabled' }} />
              <Typography sx={{ fontSize: 10, color: 'text.disabled' }}>
                {formatBigNumber(a.signupCount)}
              </Typography>
            </Box>
          </Tooltip>
          <Tooltip title="投稿作品数">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
              <UploadFileRoundedIcon sx={{ fontSize: 11, color: 'text.disabled' }} />
              <Typography sx={{ fontSize: 10, color: 'text.disabled' }}>
                {formatBigNumber(a.submissionCount)}
              </Typography>
            </Box>
          </Tooltip>
          <Tooltip title="总曝光">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
              <VisibilityRoundedIcon sx={{ fontSize: 11, color: 'text.disabled' }} />
              <Typography sx={{ fontSize: 10, color: 'text.disabled' }}>
                {formatBigNumber(a.totalViews)}
              </Typography>
            </Box>
          </Tooltip>
          <Box sx={{ flex: 1 }} />
          <Tooltip title={`截止 ${a.endLabel}`}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
              <ScheduleRoundedIcon sx={{ fontSize: 11, color: countdownLabel.color }} />
              <Typography sx={{ fontSize: 10, fontWeight: 600, color: countdownLabel.color }}>
                {countdownLabel.text}
              </Typography>
            </Box>
          </Tooltip>
        </Box>

        {/* Reward */}
        <Box
          sx={{
            mt: 0.5,
            p: 1,
            borderRadius: 1,
            bgcolor: 'rgba(255, 180, 0, 0.08)',
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
          }}
        >
          <RedeemRoundedIcon sx={{ fontSize: 14, color: '#FFB400' }} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              sx={{
                fontSize: 11,
                fontWeight: 700,
                color: '#FFB400',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {a.totalReward}
            </Typography>
          </Box>
        </Box>

        {/* My submissions / won ribbon */}
        {a.submissions.length > 0 && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              fontSize: 10,
              color: a.participation === 'won' ? '#FFD700' : '#5DDB96',
            }}
          >
            {a.participation === 'won' ? (
              <CelebrationRoundedIcon sx={{ fontSize: 12 }} />
            ) : (
              <VerifiedRoundedIcon sx={{ fontSize: 12 }} />
            )}
            <Typography sx={{ fontSize: 10, fontWeight: 600 }}>
              {a.participation === 'won' && a.myWonReward
                ? `已获奖:${a.myWonReward}`
                : `已投稿 ${a.submissions.length} 部 ${
                    a.myRank ? `· 当前排名 #${a.myRank}` : ''
                  }`}
            </Typography>
          </Box>
        )}

        <Button
          fullWidth
          size="small"
          variant={primaryAction.variant}
          onClick={(e) => {
            e.stopPropagation();
            if (primaryAction.kind === 'signup') onSignup();
            else if (primaryAction.kind === 'submit') onSubmit();
            else onOpen();
          }}
          startIcon={primaryAction.icon}
          sx={{
            mt: 'auto',
            textTransform: 'none',
            fontSize: 12,
            py: 0.5,
            ...(primaryAction.variant === 'contained' && {
              bgcolor: primaryAction.color,
              color: '#fff',
              '&:hover': { bgcolor: primaryAction.color, filter: 'brightness(1.1)' },
            }),
          }}
        >
          {primaryAction.label}
        </Button>
      </Box>
    </Box>
  );
}
