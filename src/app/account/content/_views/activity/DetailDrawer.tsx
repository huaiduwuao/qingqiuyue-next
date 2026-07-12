'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Divider from '@mui/material/Divider';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded';
import VerifiedRoundedIcon from '@mui/icons-material/VerifiedRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import GroupRoundedIcon from '@mui/icons-material/GroupRounded';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import RedeemRoundedIcon from '@mui/icons-material/RedeemRounded';
import HowToRegRoundedIcon from '@mui/icons-material/HowToRegRounded';
import HowToVoteRoundedIcon from '@mui/icons-material/HowToVoteRounded';
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import RuleRoundedIcon from '@mui/icons-material/RuleRounded';
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded';
import LeaderboardRoundedIcon from '@mui/icons-material/LeaderboardRounded';
import CelebrationRoundedIcon from '@mui/icons-material/CelebrationRounded';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import { RelativeTime } from '@/components/common/RelativeTime';
import { CATEGORY_META, STATUS_META, PART_META, formatBigNumber, formatDuration, type Activity } from './data';
import { getPrimaryAction } from './actionBuilders';
import { getCountdownLabel } from './helpers';

export type DetailTabKey = 'detail' | 'prizes' | 'leaderboard' | 'mywork';

interface DetailDrawerProps {
  activity: Activity;
  tab: DetailTabKey;
  onTabChange: (t: DetailTabKey) => void;
  onClose: () => void;
  onSignup: () => void;
  onSubmit: () => void;
  onCopyLink: () => void;
}

/**
 * DetailDrawer — 活动详情右抽屉(720px 宽)。结构:
 *  1. Hero 渐变头部(标题 / 主办方 / 截止)
 *  2. KPI 4 列条(报名 / 投稿 / 总曝光 / 奖金池)
 *  3. 我的参与卡片(可选)
 *  4. 4-tab 内容区:detail / prizes / leaderboard / mywork
 *  5. Sticky 底部(复制链接 + 主操作按钮)
 */
export function DetailDrawer({
  activity,
  tab,
  onTabChange,
  onClose,
  onSignup,
  onSubmit,
  onCopyLink,
}: DetailDrawerProps) {
  const a = activity;
  const cat = CATEGORY_META[a.category];
  const st = STATUS_META[a.status];
  const pm = PART_META[a.participation];
  const primaryAction = getPrimaryAction(a);
  const countdown = getCountdownLabel(a);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Hero */}
      <Box
        sx={{
          background: a.gradient,
          p: 2.5,
          position: 'relative',
          color: '#fff',
        }}
      >
        <IconButton
          size="small"
          onClick={onClose}
          sx={{
            position: 'absolute',
            top: 12,
            right: 12,
            bgcolor: 'rgba(0,0,0,0.3)',
            color: '#fff',
            '&:hover': { bgcolor: 'rgba(0,0,0,0.5)' },
          }}
        >
          <CloseRoundedIcon sx={{ fontSize: 16 }} />
        </IconButton>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
          <Chip
            label={cat.label}
            size="small"
            sx={{ height: 20, fontSize: 10, fontWeight: 700, bgcolor: 'background.paper', color: cat.color }}
          />
          <Chip
            label={st.label}
            size="small"
            sx={{
              height: 20,
              fontSize: 10,
              fontWeight: 700,
              bgcolor: 'rgba(0,0,0,0.35)',
              color: '#fff',
            }}
          />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
            <LocalFireDepartmentIcon sx={{ fontSize: 12, color: '#FFB400' }} />
            <Typography sx={{ fontSize: 11, fontWeight: 600 }}>
              {formatBigNumber(a.heat)}
            </Typography>
          </Box>
        </Box>
        <Typography sx={{ fontSize: 22, fontWeight: 700, lineHeight: 1.2, mb: 0.5 }}>
          {a.title}
        </Typography>
        <Typography sx={{ fontSize: 13, opacity: 0.95, mb: 1.5 }}>
          {a.subtitle}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', fontSize: 11 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
            <VerifiedRoundedIcon sx={{ fontSize: 12 }} />
            <Typography sx={{ fontSize: 11 }}>{a.organizer}</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
            <ScheduleRoundedIcon sx={{ fontSize: 12 }} />
            <Typography sx={{ fontSize: 11 }}>截止 {a.endLabel}</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
            <ScheduleRoundedIcon sx={{ fontSize: 12 }} />
            <Typography sx={{ fontSize: 11, fontWeight: 700 }}>{countdown.text}</Typography>
          </Box>
        </Box>
      </Box>

      {/* KPI strip */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 0,
          bgcolor: 'background.paper',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        {[
          { label: '报名', value: formatBigNumber(a.signupCount), icon: <HowToRegRoundedIcon /> },
          { label: '投稿', value: formatBigNumber(a.submissionCount), icon: <UploadFileRoundedIcon /> },
          { label: '总曝光', value: formatBigNumber(a.totalViews), icon: <VisibilityRoundedIcon /> },
          { label: '奖金池', value: formatBigNumber(a.totalRewardValue) + '元', icon: <RedeemRoundedIcon /> },
        ].map((s, i) => (
          <Box
            key={i}
            sx={{
              p: 1.5,
              textAlign: 'center',
              borderRight: i < 3 ? '1px solid' : 'none',
              borderColor: 'divider',
            }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 0.4,
                mb: 0.25,
                color: 'text.disabled',
                '& .MuiSvgIcon-root': { fontSize: 12 },
              }}
            >
              {s.icon}
              <Typography sx={{ fontSize: 10 }}>{s.label}</Typography>
            </Box>
            <Typography sx={{ fontSize: 14, fontWeight: 700, color: 'text.primary' }}>
              {s.value}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* My participation card */}
      {a.participation !== 'none' && (
        <Box
          sx={{
            mx: 2.5,
            mt: 2,
            p: 1.5,
            borderRadius: 1.5,
            bgcolor:
              a.participation === 'won'
                ? 'rgba(255, 215, 0, 0.08)'
                : 'rgba(254, 44, 85, 0.08)',
            border: '1px solid',
            borderColor:
              a.participation === 'won'
                ? 'rgba(255, 215, 0, 0.3)'
                : 'rgba(254, 44, 85, 0.2)',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
            {a.participation === 'won' ? (
              <CelebrationRoundedIcon sx={{ fontSize: 18, color: '#FFD700' }} />
            ) : (
              <VerifiedRoundedIcon sx={{ fontSize: 18, color: 'primary.main' }} />
            )}
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: 'text.primary', flex: 1 }}>
              我的参与
            </Typography>
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
          </Box>
          {a.participation === 'won' && a.myWonReward && (
            <Typography sx={{ fontSize: 12, color: 'text.primary', fontWeight: 600, mb: 0.5 }}>
              🎉 恭喜!获得 <Box component="span" sx={{ color: '#FFD700' }}>{a.myWonReward}</Box>
              {a.myWonAt && (
                <Typography component="span" sx={{ fontSize: 11, color: 'text.disabled', ml: 0.5 }} suppressHydrationWarning>
                  · <RelativeTime ts={a.myWonAt} fallback="" />揭晓
                </Typography>
              )}
            </Typography>
          )}
          {a.submissions.length > 0 && (
            <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
              已投稿 <b>{a.submissions.length}</b> 部作品
              {a.myRank && (
                <>
                  ,当前最佳排名 <Box component="span" sx={{ color: 'primary.main', fontWeight: 700 }}>#{a.myRank}</Box>
                </>
              )}
            </Typography>
          )}
          {a.participation === 'signed' && a.submissions.length === 0 && (
            <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
              已报名,尚未投稿。投稿截止前完成即可参与评审。
            </Typography>
          )}
        </Box>
      )}

      {/* Tabs */}
      <Tabs
        value={tab}
        onChange={(_, v) => onTabChange(v)}
        sx={{
          mx: 2.5,
          mt: 2,
          minHeight: 36,
          borderBottom: '1px solid',
          borderColor: 'divider',
          '& .MuiTab-root': { minHeight: 36, fontSize: 13, textTransform: 'none', minWidth: 0, px: 1.5 },
          '& .MuiTabs-indicator': { bgcolor: 'primary.main', height: 2 },
        }}
      >
        <Tab value="detail" label="活动详情" icon={<RuleRoundedIcon sx={{ fontSize: 14 }} />} iconPosition="start" />
        <Tab value="prizes" label={`奖项 (${a.prizes.length})`} icon={<EmojiEventsRoundedIcon sx={{ fontSize: 14 }} />} iconPosition="start" />
        <Tab
          value="leaderboard"
          label={`排行榜 (${a.leaderboard.length})`}
          icon={<LeaderboardRoundedIcon sx={{ fontSize: 14 }} />}
          iconPosition="start"
        />
        <Tab
          value="mywork"
          label={`我的作品 (${a.submissions.length})`}
          icon={<UploadFileRoundedIcon sx={{ fontSize: 14 }} />}
          iconPosition="start"
        />
      </Tabs>

      {/* Tab content */}
      <Box sx={{ flex: 1, overflowY: 'auto', p: 2.5, pb: 10 }}>
        {tab === 'detail' && <DetailTabContent activity={a} />}
        {tab === 'prizes' && <PrizesTabContent activity={a} />}
        {tab === 'leaderboard' && <LeaderboardTabContent activity={a} />}
        {tab === 'mywork' && <MyWorkTabContent activity={a} />}
      </Box>

      {/* Sticky footer */}
      <Box
        sx={{
          position: 'sticky',
          bottom: 0,
          p: 2,
          bgcolor: 'background.paper',
          borderTop: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          gap: 1,
        }}
      >
        <Button
          variant="outlined"
          size="medium"
          onClick={onCopyLink}
          startIcon={<ContentCopyRoundedIcon sx={{ fontSize: 14 }} />}
          sx={{ textTransform: 'none', minWidth: 'auto', px: 1.5 }}
        >
          复制链接
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button
          variant={primaryAction.variant}
          size="medium"
          onClick={() => {
            if (primaryAction.kind === 'signup') onSignup();
            else if (primaryAction.kind === 'submit') onSubmit();
          }}
          startIcon={primaryAction.icon}
          disabled={primaryAction.disabled}
          sx={{
            textTransform: 'none',
            minWidth: 180,
            ...(primaryAction.variant === 'contained' && {
              bgcolor: primaryAction.color,
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

// ────────────────────────────────────────────────────────────
// Tab 子组件

function DetailTabContent({ activity }: { activity: Activity }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box>
        <SectionTitle icon={<RuleRoundedIcon />} title="活动介绍" />
        <Typography sx={{ fontSize: 13, color: 'text.secondary', lineHeight: 1.7 }}>
          {activity.desc}
        </Typography>
      </Box>
      <Box>
        <SectionTitle icon={<StarRoundedIcon />} title="投稿要求" />
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          {activity.requirements.map((r) => (
            <Chip
              key={r}
              label={r}
              size="small"
              sx={{
                height: 22,
                fontSize: 11,
                bgcolor: 'rgba(37, 244, 238, 0.12)',
                color: '#25F4EE',
                fontWeight: 600,
              }}
            />
          ))}
        </Box>
      </Box>
      <Box>
        <SectionTitle icon={<VerifiedRoundedIcon />} title="活动规则" />
        <Box component="ol" sx={{ pl: 2.5, m: 0 }}>
          {activity.rules.map((r, i) => (
            <Typography
              key={i}
              component="li"
              sx={{ fontSize: 12.5, color: 'text.secondary', mb: 0.75, lineHeight: 1.6 }}
            >
              {r}
            </Typography>
          ))}
        </Box>
      </Box>
    </Box>
  );
}

function PrizesTabContent({ activity }: { activity: Activity }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <SectionTitle icon={<EmojiEventsRoundedIcon />} title="奖项设置" />
      {activity.prizes.map((p, i) => (
        <Box
          key={i}
          sx={{
            p: 2,
            borderRadius: 2,
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            position: 'relative',
            overflow: 'hidden',
            '&::before': {
              content: '""',
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: 4,
              bgcolor: p.color,
            },
          }}
        >
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              bgcolor: `${p.color}22`,
              color: p.color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              fontSize: 20,
              fontWeight: 800,
            }}
          >
            {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '🎖'}
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 0.5 }}>
              <Typography sx={{ fontSize: 14, fontWeight: 700, color: p.color }}>
                {p.rank}
              </Typography>
              <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>
                {p.count} 名
              </Typography>
            </Box>
            <Typography sx={{ fontSize: 12.5, color: 'text.secondary' }}>
              {p.reward}
            </Typography>
          </Box>
          {activity.participation === 'won' &&
            activity.myWonReward?.includes(p.rank) && (
              <Box
                sx={{
                  px: 0.75,
                  py: 0.25,
                  borderRadius: 0.75,
                  bgcolor: 'rgba(255, 215, 0, 0.16)',
                  color: '#FFD700',
                  fontSize: 10,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.4,
                }}
              >
                <CelebrationRoundedIcon sx={{ fontSize: 12 }} />
                我获得
              </Box>
            )}
        </Box>
      ))}
    </Box>
  );
}

function LeaderboardTabContent({ activity }: { activity: Activity }) {
  const a = activity;
  if (a.leaderboard.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 6 }}>
        <LeaderboardRoundedIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
        <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
          {a.status === 'upcoming' || a.status === 'signup'
            ? '活动尚未开始,排行榜将在投稿期开放'
            : '暂无榜单数据'}
        </Typography>
      </Box>
    );
  }
  return (
    <Box>
      <SectionTitle icon={<LeaderboardRoundedIcon />} title="作品热度榜" />
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {a.leaderboard.map((e) => (
          <Box
            key={`${e.rank}-${e.creatorName}`}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              p: 1,
              borderRadius: 1,
              bgcolor: e.isMe ? 'rgba(254, 44, 85, 0.1)' : 'transparent',
              border: '1px solid',
              borderColor: e.isMe ? 'rgba(254, 44, 85, 0.3)' : 'transparent',
              '&:hover': {
                bgcolor: e.isMe
                  ? 'rgba(254, 44, 85, 0.14)'
                  : 'action.hover',
              },
            }}
          >
            <Box
              sx={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                bgcolor:
                  e.rank === 1
                    ? '#FFD700'
                    : e.rank === 2
                    ? '#C0C0C0'
                    : e.rank === 3
                    ? '#CD7F32'
                    : 'action.hover',
                color: e.rank <= 3 ? '#1F1B00' : 'text.secondary',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {e.rank}
            </Box>
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: e.avatarColor,
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {e.initials}
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                sx={{
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: e.isMe ? 'primary.main' : 'text.primary',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {e.creatorName} {e.isMe && <Box component="span" sx={{ fontSize: 9, color: 'primary.main' }}>(我)</Box>}
              </Typography>
              <Typography
                sx={{
                  fontSize: 11,
                  color: 'text.disabled',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {e.workTitle}
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, justifyContent: 'flex-end' }}>
                <VisibilityRoundedIcon sx={{ fontSize: 11, color: 'text.disabled' }} />
                <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                  {formatBigNumber(e.views)}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, justifyContent: 'flex-end' }}>
                <HowToVoteRoundedIcon sx={{ fontSize: 11, color: 'text.disabled' }} />
                <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                  {formatBigNumber(e.votes)}
                </Typography>
              </Box>
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function MyWorkTabContent({ activity }: { activity: Activity }) {
  const a = activity;
  if (a.submissions.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 6 }}>
        <UploadFileRoundedIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
        <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
          还没有作品参赛 — 点击下方"投稿作品"开始
        </Typography>
      </Box>
    );
  }
  return (
    <Box>
      <SectionTitle icon={<UploadFileRoundedIcon />} title={`我的投稿 (${a.submissions.length})`} />
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {a.submissions.map((s) => (
          <Box
            key={s.id}
            sx={{
              p: 1.25,
              borderRadius: 1.5,
              bgcolor: 'background.paper',
              border: '1px solid',
              borderColor: s.prize ? 'rgba(255, 215, 0, 0.4)' : 'divider',
              display: 'flex',
              gap: 1.5,
            }}
          >
            <Box
              sx={{
                width: 72,
                height: 72,
                borderRadius: 1,
                background: s.workCover,
                flexShrink: 0,
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <PlayArrowRoundedIcon sx={{ color: 'rgba(255,255,255,0.9)', fontSize: 24 }} />
              <Box
                sx={{
                  position: 'absolute',
                  bottom: 4,
                  right: 4,
                  px: 0.5,
                  borderRadius: 0.5,
                  fontSize: 10,
                  fontWeight: 600,
                  color: '#fff',
                  bgcolor: 'rgba(0,0,0,0.6)',
                }}
              >
                {formatDuration(s.workDuration)}
              </Box>
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                sx={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'text.primary',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  mb: 0.5,
                }}
              >
                {s.workTitle}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 0.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                  <VisibilityRoundedIcon sx={{ fontSize: 11, color: 'text.disabled' }} />
                  <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>
                    {formatBigNumber(s.views)}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                  <FavoriteRoundedIcon sx={{ fontSize: 11, color: 'text.disabled' }} />
                  <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>
                    {formatBigNumber(s.likes)}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                  <HowToVoteRoundedIcon sx={{ fontSize: 11, color: 'text.disabled' }} />
                  <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>
                    {formatBigNumber(s.votes)} 票
                  </Typography>
                </Box>
              </Box>
              {s.rank && (
                <Typography sx={{ fontSize: 11, color: 'primary.main', fontWeight: 700 }}>
                  当前排名 #{s.rank}
                </Typography>
              )}
              {s.prize && (
                <Box
                  sx={{
                    mt: 0.5,
                    px: 0.75,
                    py: 0.25,
                    borderRadius: 0.75,
                    bgcolor: 'rgba(255, 215, 0, 0.16)',
                    color: '#FFD700',
                    fontSize: 11,
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 0.4,
                  }}
                >
                  <CelebrationRoundedIcon sx={{ fontSize: 12 }} />
                  {s.prize}
                </Box>
              )}
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
      <Box sx={{ color: 'primary.main', display: 'flex', '& .MuiSvgIcon-root': { fontSize: 14 } }}>
        {icon}
      </Box>
      <Typography sx={{ fontSize: 13, fontWeight: 700, color: 'text.primary' }}>
        {title}
      </Typography>
      <Divider sx={{ flex: 1, ml: 1 }} />
    </Box>
  );
}
