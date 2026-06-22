'use client';

import React, { useState, useMemo } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Snackbar from '@mui/material/Snackbar';
import AlternateEmailRoundedIcon from '@mui/icons-material/AlternateEmailRounded';
import ReplyRoundedIcon from '@mui/icons-material/ReplyRounded';
import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded';
import MarkEmailReadRoundedIcon from '@mui/icons-material/MarkEmailReadRounded';
import DoneAllRoundedIcon from '@mui/icons-material/DoneAllRounded';

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

type MentionType = 'comment' | 'reply' | 'work';

const MENTIONS = [
  { id: 1, user: '小星星', type: 'comment' as MentionType, content: '@博主 这个滤镜怎么调的?求教程!', work: '夏日海边vlog', time: '2 分钟前', read: false, snippet: '拍出来真的太好看了,有考虑出教程吗…' },
  { id: 2, user: '海绵宝宝', type: 'reply' as MentionType, content: '回复 @博主: 请问这里用的是哪款相机?', work: '小红书同款穿搭', time: '8 分钟前', read: false, snippet: '博主回复: 用的富士 X-T5' },
  { id: 3, user: '旅行的猫', type: 'comment' as MentionType, content: '请问 @博主 这里是哪里呀?好想去玩!', work: '夏日海边vlog', time: '23 分钟前', read: false, snippet: '风景太美了,尤其是日落那段…' },
  { id: 4, user: '美食家老王', type: 'comment' as MentionType, content: '@博主 这家店地址在哪里!我也要去打卡!', work: '挑战全网最辣螺蛳粉', time: '1 小时前', read: true, snippet: '看饿了,挑战成功那碗也太香了…' },
  { id: 5, user: '摄影师Leo', type: 'work' as MentionType, content: '@博主 在自己的新作中提到了你', work: '摄影师Leo的旅行随笔', time: '3 小时前', read: true, snippet: '感谢 @博主 的构图灵感,本期视频将参考…' },
  { id: 6, user: '设计小妹', type: 'reply' as MentionType, content: '回复 @博主: 字体链接能发一下吗?', work: '我的设计排版教程', time: '昨天', read: true, snippet: '这套字体真的好好看,博主可以分享下…' },
  { id: 7, user: '音乐控Yuki', type: 'comment' as MentionType, content: '@博主 求BGM歌名!!', work: '深夜独处歌单', time: '昨天', read: true, snippet: '歌单太上头了,求博主发完整歌单!' },
  { id: 8, user: '老粉阿吉', type: 'reply' as MentionType, content: '回复 @博主: 什么时候出周边?', work: '开箱VLOG', time: '2 天前', read: true, snippet: '周边设计太好看了,想买!' },
];

function tabProps(index: number) {
  return { id: `interaction-tab-${index}`, 'aria-controls': `interaction-tabpanel-${index}` };
}

export default function InteractionPage() {
  const [tab, setTab] = useState(0);
  const [mentions, setMentions] = useState(MENTIONS);
  const [mentionFilter, setMentionFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [mentionTypeFilter, setMentionTypeFilter] = useState<'all' | MentionType>('all');
  const [snack, setSnack] = useState<string | null>(null);

  const markRead = (id: number) => {
    setMentions((prev) => prev.map((m) => (m.id === id ? { ...m, read: true } : m)));
  };

  const markAllRead = () => {
    setMentions((prev) => prev.map((m) => ({ ...m, read: true })));
    setSnack('已全部标记为已读');
  };

  const filteredMentions = useMemo(() => {
    return mentions.filter((m) => {
      if (mentionFilter === 'unread' && m.read) return false;
      if (mentionFilter === 'read' && !m.read) return false;
      if (mentionTypeFilter !== 'all' && m.type !== mentionTypeFilter) return false;
      return true;
    });
  }, [mentions, mentionFilter, mentionTypeFilter]);

  const unreadCount = mentions.filter((m) => !m.read).length;

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
                bgcolor: (theme) => theme.palette.mode === 'dark' ? '#1E2030' : '#FFFFFF',
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
                bgcolor: (theme) => theme.palette.mode === 'dark' ? '#1E2030' : '#FFFFFF',
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
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {/* Filter bar */}
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <Stack direction="row" spacing={0.5}>
              {([
                { key: 'all', label: `全部 ${mentions.length}` },
                { key: 'unread', label: `未读 ${unreadCount}` },
                { key: 'read', label: `已读 ${mentions.length - unreadCount}` },
              ] as const).map((f) => (
                <Chip
                  key={f.key}
                  size="small"
                  label={f.label}
                  onClick={() => setMentionFilter(f.key)}
                  variant={mentionFilter === f.key ? 'filled' : 'outlined'}
                  color={mentionFilter === f.key ? 'primary' : 'default'}
                  sx={{ fontSize: 11, height: 24 }}
                />
              ))}
            </Stack>
            <Box sx={{ flex: 1 }} />
            <Stack direction="row" spacing={0.5}>
              {([
                { key: 'all', label: '全部类型' },
                { key: 'comment', label: '评论' },
                { key: 'reply', label: '回复' },
                { key: 'work', label: '作品提及' },
              ] as const).map((f) => (
                <Chip
                  key={f.key}
                  size="small"
                  label={f.label}
                  onClick={() => setMentionTypeFilter(f.key as any)}
                  variant={mentionTypeFilter === f.key ? 'filled' : 'outlined'}
                  sx={{ fontSize: 11, height: 24 }}
                />
              ))}
            </Stack>
            {unreadCount > 0 && (
              <Button
                size="small"
                startIcon={<DoneAllRoundedIcon sx={{ fontSize: 14 }} />}
                onClick={markAllRead}
                sx={{ textTransform: 'none', fontSize: 11, ml: 1 }}
              >
                全部已读
              </Button>
            )}
          </Stack>

          {filteredMentions.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6, color: 'text.disabled' }}>
              <AlternateEmailRoundedIcon sx={{ fontSize: 48, opacity: 0.3, mb: 1 }} />
              <Typography sx={{ fontSize: 13 }}>暂无相关提醒</Typography>
            </Box>
          ) : (
            filteredMentions.map((m) => {
              const typeMeta = m.type === 'comment'
                ? { label: '在评论中@了你', color: '#5B8DEF', icon: <ChatBubbleOutlineRoundedIcon sx={{ fontSize: 12 }} /> }
                : m.type === 'reply'
                ? { label: '回复了你', color: '#FE2C55', icon: <ReplyRoundedIcon sx={{ fontSize: 12 }} /> }
                : { label: '在作品中提到了你', color: '#8B5CF6', icon: <AlternateEmailRoundedIcon sx={{ fontSize: 12 }} /> };
              return (
                <Box
                  key={m.id}
                  sx={{
                    p: 2,
                    borderRadius: 1.5,
                    bgcolor: m.read
                      ? (theme) => theme.palette.mode === 'dark' ? '#1E2030' : '#FFFFFF'
                      : 'rgba(254, 44, 85, 0.06)',
                    border: '1px solid',
                    borderColor: m.read ? 'divider' : 'rgba(254, 44, 85, 0.25)',
                    position: 'relative',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    '&:hover': { borderColor: m.read ? 'primary.main' : 'rgba(254, 44, 85, 0.5)' },
                  }}
                  onClick={() => !m.read && markRead(m.id)}
                >
                  {!m.read && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 12,
                        right: 12,
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        bgcolor: 'primary.main',
                      }}
                    />
                  )}
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                    <Avatar
                      sx={{
                        width: 36,
                        height: 36,
                        bgcolor: `hsl(${(m.id * 60) % 360}, 60%, 50%)`,
                        fontSize: 14,
                        fontWeight: 700,
                      }}
                    >
                      {m.user.charAt(0)}
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5, flexWrap: 'wrap' }}>
                        <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'text.primary' }}>
                          {m.user}
                        </Typography>
                        <Box
                          sx={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 0.25,
                            px: 0.75,
                            py: 0.125,
                            borderRadius: 0.5,
                            bgcolor: `${typeMeta.color}22`,
                            color: typeMeta.color,
                            fontSize: 10,
                            fontWeight: 600,
                          }}
                        >
                          {typeMeta.icon}
                          {typeMeta.label}
                        </Box>
                        <Box sx={{ flex: 1 }} />
                        <Typography sx={{ fontSize: 10, color: 'text.disabled' }}>{m.time}</Typography>
                      </Box>
                      <Typography
                        sx={{
                          fontSize: 13,
                          color: 'text.primary',
                          mb: 0.5,
                          lineHeight: 1.5,
                          fontWeight: m.read ? 400 : 500,
                        }}
                      >
                        {m.content}
                      </Typography>
                      {m.snippet && (
                        <Typography
                          sx={{
                            fontSize: 11,
                            color: 'text.secondary',
                            mb: 1,
                            lineHeight: 1.5,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          《{m.work}》: {m.snippet}
                        </Typography>
                      )}
                      <Stack direction="row" spacing={1}>
                        <Button
                          size="small"
                          onClick={(e) => { e.stopPropagation(); setSnack(`已跳转到《${m.work}》`); }}
                          sx={{ minWidth: 'auto', px: 1, py: 0.25, fontSize: 10, color: 'primary.main' }}
                        >
                          查看上下文
                        </Button>
                        <Button
                          size="small"
                          onClick={(e) => { e.stopPropagation(); setSnack('回复已发送'); }}
                          sx={{ minWidth: 'auto', px: 1, py: 0.25, fontSize: 10, color: 'text.secondary' }}
                        >
                          回复
                        </Button>
                        {!m.read && (
                          <Button
                            size="small"
                            startIcon={<MarkEmailReadRoundedIcon sx={{ fontSize: 12 }} />}
                            onClick={(e) => { e.stopPropagation(); markRead(m.id); }}
                            sx={{ minWidth: 'auto', px: 1, py: 0.25, fontSize: 10, color: 'text.secondary' }}
                          >
                            标为已读
                          </Button>
                        )}
                      </Stack>
                    </Box>
                  </Box>
                </Box>
              );
            })
          )}
        </Box>
      )}

      <Snackbar
        open={!!snack}
        autoHideDuration={2000}
        onClose={() => setSnack(null)}
        message={snack}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  );
}
