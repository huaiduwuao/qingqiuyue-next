'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import InputBase from '@mui/material/InputBase';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import TagRoundedIcon from '@mui/icons-material/TagRounded';
import MovieFilterRoundedIcon from '@mui/icons-material/MovieFilterRounded';
import { useAuth } from '@/contexts/AuthContext';
import { formatApiError } from '@/lib/api/client';
import { moduleContentPage } from '@/apis/home';
import { CoverImage } from '@/components/common/CoverImage';
import { createPost, suggestTopics, type FeedItem, type Id, type TopicBrief } from '@/apis/community';
import { CONTENT_TYPE_LABEL } from './format';
import type { Notify } from './FeedCard';

const MAX_TEXT = 1000;
const MAX_TOPICS = 3;

type ContentPick = { id: Id; title: string; cover: string; contentType: string };

function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** 发帖框:正文 + 话题(最多 3 个,正文里的 #话题# 也会自动挂上) + 可选关联一部作品 */
export function PostComposer({ presetTopic, onPosted, notify }: { presetTopic?: TopicBrief; onPosted: (item: FeedItem) => void; notify: Notify }) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [text, setText] = useState('');
  const [topics, setTopics] = useState<TopicBrief[]>(presetTopic ? [presetTopic] : []);
  const [content, setContent] = useState<ContentPick | null>(null);
  const [topicOpen, setTopicOpen] = useState(false);
  const [pickOpen, setPickOpen] = useState(false);
  const [sending, setSending] = useState(false);

  if (!isAuthenticated) {
    return (
      <Box sx={{ ...boxSx, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Typography sx={{ flex: 1, fontSize: 13, color: 'var(--text-secondary, rgba(255,255,255,0.6))' }}>
          登录后,分享你正在看的、在读的、在听的
        </Typography>
        <Button size="small" variant="contained" onClick={() => router.push('/user/login')} sx={primaryBtnSx}>登录</Button>
      </Box>
    );
  }

  const submit = async () => {
    if (sending || (!text.trim() && !content)) return;
    setSending(true);
    try {
      const item = await createPost({ text: text.trim(), contentId: content?.id, topicIds: topics.map((t) => t.id) });
      onPosted(item);
      setText('');
      setContent(null);
      setTopics(presetTopic ? [presetTopic] : []);
      notify('发布成功');
    } catch (e) {
      notify(formatApiError(e), 'error');
    } finally {
      setSending(false);
    }
  };

  const addTopic = (t: TopicBrief) => {
    setTopicOpen(false);
    if (topics.some((x) => x.id === t.id) || topics.length >= MAX_TOPICS) return;
    setTopics((xs) => [...xs, t]);
  };
  // 新话题:写进正文,发布时服务端按 #话题名# 自动创建
  const addNewTopic = (name: string) => {
    setTopicOpen(false);
    setText((s) => `#${name}# ${s}`.slice(0, MAX_TEXT));
  };

  return (
    <Box sx={boxSx}>
      <InputBase
        multiline
        minRows={2}
        maxRows={10}
        fullWidth
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, MAX_TEXT))}
        placeholder={presetTopic ? `聊聊 #${presetTopic.title}#…` : '分享你正在看的、在读的、在听的…  写 #话题# 参与讨论'}
        sx={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text-primary, #fff)' }}
      />
      {(topics.length > 0 || content) && (
        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mt: 1 }}>
          {topics.map((t) => (
            <Chip
              key={String(t.id)}
              size="small"
              icon={<TagRoundedIcon sx={{ fontSize: 13 }} />}
              label={t.title}
              onDelete={presetTopic && t.id === presetTopic.id ? undefined : () => setTopics((xs) => xs.filter((x) => x.id !== t.id))}
              sx={{ bgcolor: 'rgba(254,44,85,0.1)', color: 'var(--brand-color, #FE2C55)', '& .MuiChip-icon': { color: 'inherit' } }}
            />
          ))}
          {content && (
            <Chip
              size="small"
              icon={<MovieFilterRoundedIcon sx={{ fontSize: 14 }} />}
              label={`《${content.title}》`}
              onDelete={() => setContent(null)}
              sx={{ maxWidth: 280 }}
            />
          )}
        </Box>
      )}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1, flexWrap: 'wrap' }}>
        <Button size="small" startIcon={<TagRoundedIcon sx={{ fontSize: 16 }} />} disabled={topics.length >= MAX_TOPICS} onClick={() => setTopicOpen(true)} sx={toolBtnSx}>
          话题
        </Button>
        <Button size="small" startIcon={<MovieFilterRoundedIcon sx={{ fontSize: 16 }} />} onClick={() => setPickOpen(true)} sx={toolBtnSx}>
          关联作品
        </Button>
        <Box sx={{ flex: 1 }} />
        <Typography sx={{ fontSize: 11, color: text.length > MAX_TEXT * 0.9 ? 'warning.main' : 'var(--text-muted, rgba(255,255,255,0.4))' }}>
          {text.length}/{MAX_TEXT}
        </Typography>
        <Button
          size="small"
          variant="contained"
          disabled={sending || (!text.trim() && !content)}
          onClick={submit}
          startIcon={sending ? <CircularProgress size={14} color="inherit" /> : undefined}
          sx={primaryBtnSx}
        >
          发布
        </Button>
      </Box>
      <TopicPicker open={topicOpen} onClose={() => setTopicOpen(false)} onPick={addTopic} onCreate={addNewTopic} />
      <ContentPicker open={pickOpen} onClose={() => setPickOpen(false)} onPick={(c) => { setContent(c); setPickOpen(false); }} />
    </Box>
  );
}

function TopicPicker({ open, onClose, onPick, onCreate }: { open: boolean; onClose: () => void; onPick: (t: TopicBrief) => void; onCreate: (name: string) => void }) {
  const [q, setQ] = useState('');
  const dq = useDebounced(q.trim().replace(/#/g, ''));
  const { data, isFetching } = useQuery({ queryKey: ['community', 'topic-suggest', dq], queryFn: () => suggestTopics(dq), enabled: open });
  const list = data ?? [];
  const exact = list.some((t) => t.title.toLowerCase() === dq.toLowerCase());
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ fontSize: 15 }}>选择话题</DialogTitle>
      <DialogContent>
        <TextField autoFocus fullWidth size="small" placeholder="搜索或创建话题" value={q} onChange={(e) => setQ(e.target.value.slice(0, 30))} sx={{ mt: 0.5 }} />
        <Box sx={{ mt: 1.5, display: 'flex', flexDirection: 'column' }}>
          {dq && !exact && (
            <Box onClick={() => onCreate(dq)} sx={rowSx}>
              <TagRoundedIcon sx={{ fontSize: 16, color: 'var(--brand-color, #FE2C55)' }} />
              <Typography sx={{ fontSize: 13 }}>新话题 #{dq}#</Typography>
            </Box>
          )}
          {isFetching && list.length === 0 ? (
            <CircularProgress size={18} sx={{ m: 2, alignSelf: 'center' }} />
          ) : (
            list.map((t) => (
              <Box key={String(t.id)} onClick={() => onPick(t)} sx={rowSx}>
                <TagRoundedIcon sx={{ fontSize: 16, color: 'var(--text-muted, rgba(255,255,255,0.5))' }} />
                <Typography sx={{ fontSize: 13, flex: 1 }}>{t.title}</Typography>
                <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{t.postCount ?? 0} 条讨论</Typography>
              </Box>
            ))
          )}
        </Box>
      </DialogContent>
    </Dialog>
  );
}

function ContentPicker({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (c: ContentPick) => void }) {
  const [q, setQ] = useState('');
  const dq = useDebounced(q.trim(), 400);
  const { data, isFetching } = useQuery({
    queryKey: ['community', 'content-pick', dq],
    enabled: open && dq.length > 0,
    queryFn: async () => {
      const res: any = await moduleContentPage({ page: 1, pageSize: 12, title: dq });
      const rows: any[] = res?.data?.list || res?.data?.records || [];
      return rows.map((r) => ({ id: r.id, title: r.title, cover: r.cover || r.coverUrl || '', contentType: String(r.contentType || '').toUpperCase() }));
    },
  });
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontSize: 15 }}>关联一部作品</DialogTitle>
      <DialogContent>
        <TextField autoFocus fullWidth size="small" placeholder="输入片名、书名、歌名" value={q} onChange={(e) => setQ(e.target.value)} sx={{ mt: 0.5 }} />
        <Box sx={{ mt: 1.5, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {!dq ? (
            <Typography sx={{ fontSize: 12, color: 'text.secondary', py: 2, textAlign: 'center' }}>搜一搜你想聊的作品</Typography>
          ) : isFetching ? (
            <CircularProgress size={18} sx={{ m: 2, alignSelf: 'center' }} />
          ) : (data ?? []).length === 0 ? (
            <Typography sx={{ fontSize: 12, color: 'text.secondary', py: 2, textAlign: 'center' }}>没有找到相关作品</Typography>
          ) : (
            (data ?? []).map((c) => (
              <Box key={String(c.id)} onClick={() => onPick(c)} sx={{ ...rowSx, py: 0.75 }}>
                <Box sx={{ width: 64, aspectRatio: '16/10', borderRadius: 0.75, overflow: 'hidden', flexShrink: 0 }}>
                  <CoverImage src={c.cover} alt={c.title} sx={{ width: '100%', height: '100%' }} />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.title}</Typography>
                  <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{CONTENT_TYPE_LABEL[c.contentType] || c.contentType}</Typography>
                </Box>
              </Box>
            ))
          )}
        </Box>
      </DialogContent>
    </Dialog>
  );
}

const boxSx = {
  p: 2,
  borderRadius: 2,
  bgcolor: 'var(--bg-card, rgba(20, 22, 32, 0.6))',
  border: '1px solid var(--border-color, rgba(255,255,255,0.06))',
};

const primaryBtnSx = {
  borderRadius: 999,
  px: 2,
  textTransform: 'none',
  fontWeight: 600,
  bgcolor: 'var(--brand-color, #FE2C55)',
  '&:hover': { bgcolor: '#E0274A' },
};

const toolBtnSx = { textTransform: 'none', fontSize: 12, color: 'var(--text-secondary, rgba(255,255,255,0.65))' };

const rowSx = {
  display: 'flex',
  alignItems: 'center',
  gap: 1,
  px: 1,
  py: 1,
  borderRadius: 1,
  cursor: 'pointer',
  '&:hover': { bgcolor: 'action.hover' },
};
