'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import IconButton from '@mui/material/IconButton';
import Skeleton from '@mui/material/Skeleton';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import { fetchTopic } from '@/apis/community';
import { updateTopicByOwner, type Topic } from '@/apis/topic';
import { useAuth } from '@/contexts/AuthContext';
import { topicHref } from '@/components/community/format';

export default function RealmManagePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = String(params?.id ?? '');
  const { user } = useAuth();
  const [form, setForm] = useState<{ title: string; subtitle: string; cover: string; description: string }>({
    title: '',
    subtitle: '',
    cover: '',
    description: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const q = useQuery({
    queryKey: ['realm-manage', id],
    queryFn: () => fetchTopic(id),
    enabled: !!id,
    retry: false,
  });

  useEffect(() => {
    const t = q.data;
    if (!t) return;
    setForm({
      title: t.title || '',
      subtitle: t.subtitle || '',
      cover: t.cover || '',
      description: t.description || '',
    });
  }, [q.data]);

  if (q.isLoading) {
    return (
      <Container maxWidth="sm" sx={{ py: 3 }}>
        <Skeleton variant="rounded" height={56} />
        <Skeleton variant="rounded" height={120} sx={{ mt: 2 }} />
      </Container>
    );
  }
  if (q.isError || !q.data) {
    return (
      <Container maxWidth="sm" sx={{ py: 6 }}>
        <Alert severity="error">{error || '加载意境失败'}</Alert>
      </Container>
    );
  }
  const topic = q.data;
  const isOwner = !!(user?.id && topic.owner && String(topic.owner.id) === String(user.id));
  if (!topic.official && !isOwner) {
    return (
      <Container maxWidth="sm" sx={{ py: 6 }}>
        <Alert severity="warning">你不是该意境的主理人,无法编辑。</Alert>
        <Button onClick={() => router.back()} sx={{ mt: 2 }}>返回</Button>
      </Container>
    );
  }

  const dirty =
    form.title !== (topic.title || '') ||
    form.subtitle !== (topic.subtitle || '') ||
    form.cover !== (topic.cover || '') ||
    form.description !== (topic.description || '');

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateTopicByOwner(Number(id), {
        title: form.title,
        subtitle: form.subtitle,
        cover: form.cover,
        description: form.description,
      });
      setSavedAt(Date.now());
      q.refetch();
    } catch (e: any) {
      setError(e?.message || '保存失败,请重试');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ py: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <IconButton onClick={() => router.back()} aria-label="返回">
          <ArrowBackRoundedIcon />
        </IconButton>
        <Typography sx={{ fontSize: 18, fontWeight: 700, flex: 1 }}>意境主理人控制台</Typography>
        <Button
          component={Link}
          href={topicHref(topic.id)}
          target="_blank"
          rel="noopener noreferrer"
          size="small"
          endIcon={<OpenInNewRoundedIcon fontSize="small" />}
        >
          查看意境
        </Button>
      </Box>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {savedAt && (
        <Alert severity="success" sx={{ mb: 2 }}>
          已保存 · {topic.official ? '官方权威专题' : `由 ${topic.owner?.name ?? '你'} 主理`}
        </Alert>
      )}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField
          label="标题"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          required
          fullWidth
          slotProps={{ htmlInput: { maxLength: 100 } }}
          helperText={`${form.title.length}/100`}
        />
        <TextField
          label="副标题"
          value={form.subtitle}
          onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
          fullWidth
        />
        <TextField
          label="封面图URL"
          value={form.cover}
          onChange={(e) => setForm({ ...form, cover: e.target.value })}
          fullWidth
          helperText="支持 http(s) 链接。预览由前台自动应用 coverBackground 兜底"
        />
        <TextField
          label="详细描述"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          fullWidth
          multiline
          rows={6}
          placeholder="介绍这个意境的定位、内容范围、收录规则..."
        />
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
          <Button onClick={() => router.back()} disabled={saving}>返回</Button>
          <Button variant="contained" onClick={handleSave} disabled={!dirty || !form.title || saving}>
            {saving ? '保存中…' : '保存'}
          </Button>
        </Box>
      </Box>
    </Container>
  );
}
