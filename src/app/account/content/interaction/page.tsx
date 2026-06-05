'use client';

import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';

const COMMENTS = [
  {
    id: 1,
    user: '小星星',
    avatar: '',
    content: '博主太会拍了！求更新求更新～',
    work: '夏日海边vlog',
    time: '5 分钟前',
    likes: 23,
    reply: '',
  },
  {
    id: 2,
    user: '海绵宝宝',
    avatar: '',
    content: '请问这个滤镜是怎么调出来的？',
    work: '小红书同款穿搭',
    time: '12 分钟前',
    likes: 8,
    reply: '已回复',
  },
  {
    id: 3,
    user: '旅行的猫',
    avatar: '',
    content: '风景好美，是哪里呀？想去！',
    work: '夏日海边vlog',
    time: '1 小时前',
    likes: 45,
    reply: '',
  },
  {
    id: 4,
    user: '美食家老王',
    avatar: '',
    content: '螺蛳粉这家店在哪！我要去！',
    work: '挑战全网最辣螺蛳粉',
    time: '3 小时前',
    likes: 67,
    reply: '已回复',
  },
];

const DMS = [
  { id: 1, user: '品牌合作-A', content: '您好，想咨询下商务合作', time: '10:23', unread: 2 },
  { id: 2, user: 'MCN 经纪人', content: '资料已收到，团队这周联系您', time: '昨天', unread: 0 },
  { id: 3, user: '粉丝小张', content: '博主加油！', time: '昨天', unread: 0 },
];

function tabProps(index: number) {
  return { id: `interaction-tab-${index}`, 'aria-controls': `interaction-tabpanel-${index}` };
}

export default function InteractionPage() {
  const [tab, setTab] = useState(0);

  return (
    <Box
      sx={{
        bgcolor: 'background.paper',
        borderRadius: 2,
        p: 3,
        border: '1px solid',
        borderColor: 'divider',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 600,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
        <Typography sx={{ fontSize: 16, fontWeight: 600, color: 'text.primary', flex: 1 }}>
          互动管理
        </Typography>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            color: 'success.main',
            fontSize: 11,
            fontWeight: 500,
          }}
        >
          <Box
            sx={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              bgcolor: 'success.main',
              animation: 'pulse 2s infinite',
              '@keyframes pulse': {
                '0%, 100%': { opacity: 1 },
                '50%': { opacity: 0.4 },
              },
            }}
          />
          实时同步
        </Box>
      </Box>
      <Typography sx={{ fontSize: 11, color: 'text.secondary', mb: 2 }}>
        统一管理评论与私信回复
      </Typography>

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          mb: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
          minHeight: 36,
          '& .MuiTab-root': { minHeight: 36, fontSize: 12, py: 0.5 },
        }}
      >
        <Tab label="作品评论 (99+)" {...tabProps(0)} />
        <Tab label="私信 (3)" {...tabProps(1)} />
        <Tab label="@我的" {...tabProps(2)} />
      </Tabs>

      {tab === 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {COMMENTS.map((c) => (
            <Box
              key={c.id}
              sx={{
                p: 2,
                borderRadius: 1.5,
                bgcolor: '#1E2030',
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                <Avatar
                  sx={{
                    width: 36,
                    height: 36,
                    bgcolor: `hsl(${(c.id * 60) % 360}, 60%, 50%)`,
                    fontSize: 14,
                    fontWeight: 700,
                  }}
                >
                  {c.user.charAt(0)}
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
                    <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'text.primary' }}>
                      {c.user}
                    </Typography>
                    <Typography sx={{ fontSize: 10, color: 'text.disabled' }}>·</Typography>
                    <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>
                      评论于《{c.work}》
                    </Typography>
                    <Box sx={{ flex: 1 }} />
                    <Typography sx={{ fontSize: 10, color: 'text.disabled' }}>{c.time}</Typography>
                  </Box>
                  <Typography sx={{ fontSize: 13, color: 'text.tertiary', mb: 1, lineHeight: 1.5 }}>
                    {c.content}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>👍 {c.likes}</Typography>
                    {c.reply ? (
                      <Box
                        sx={{
                          px: 1,
                          py: 0.25,
                          borderRadius: 0.5,
                          bgcolor: 'rgba(93, 219, 150, 0.15)',
                          color: 'success.main',
                          fontSize: 10,
                          fontWeight: 600,
                        }}
                      >
                        {c.reply}
                      </Box>
                    ) : (
                      <Button
                        size="small"
                        sx={{
                          minWidth: 'auto',
                          px: 1,
                          py: 0.25,
                          fontSize: 10,
                          color: 'text.secondary',
                          '&:hover': { color: 'primary.main', bgcolor: 'transparent' },
                        }}
                      >
                        回复
                      </Button>
                    )}
                  </Box>
                </Box>
              </Box>
            </Box>
          ))}
        </Box>
      )}

      {tab === 1 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {DMS.map((d) => (
            <Box
              key={d.id}
              sx={{
                p: 1.5,
                borderRadius: 1.5,
                bgcolor: '#1E2030',
                border: '1px solid',
                borderColor: 'divider',
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                cursor: 'pointer',
                '&:hover': { borderColor: 'primary.main' },
              }}
            >
              <Avatar sx={{ width: 40, height: 40, bgcolor: `hsl(${(d.id * 80) % 360}, 60%, 50%)` }}>
                {d.user.charAt(0)}
              </Avatar>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'text.primary', flex: 1 }} noWrap>
                    {d.user}
                  </Typography>
                  <Typography sx={{ fontSize: 10, color: 'text.disabled' }}>{d.time}</Typography>
                </Box>
                <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.25 }} noWrap>
                  {d.content}
                </Typography>
              </Box>
              {d.unread > 0 && (
                <Box
                  sx={{
                    minWidth: 20,
                    height: 20,
                    borderRadius: 10,
                    bgcolor: 'primary.main',
                    color: 'text.primary',
                    fontSize: 10,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    px: 0.75,
                  }}
                >
                  {d.unread}
                </Box>
              )}
            </Box>
          ))}
        </Box>
      )}

      {tab === 2 && (
        <Box sx={{ textAlign: 'center', py: 6, color: 'text.disabled' }}>
          <Typography sx={{ fontSize: 13 }}>@我的提醒功能开发中</Typography>
        </Box>
      )}
    </Box>
  );
}
