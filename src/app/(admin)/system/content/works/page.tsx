'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import { fetchAdminWorks, type AdminWork } from '@/apis/admin-works';
import { getDetailRoute } from '@/lib/contentRoute';
import { CoverImage } from '@/components/common/CoverImage';
import { MarkdownView } from '@/components/common/MarkdownView';

const PAGE_SIZE = 20;

const TYPE_LABEL: Record<string, string> = {
  NOVEL: '小说', VIDEO: '视频', ARTICLE: '文章', MUSIC: '音乐',
  FILM: '电影', TELEPLAY: '电视剧', ANIMATION: '动画', COMICS: '漫画',
  PICTURE: '图文', NEWS: '新闻', VSHOW: '短剧', LIVE: '直播',
};

const TYPE_OPTIONS = ['', 'VIDEO', 'ARTICLE', 'NOVEL', 'MUSIC', 'FILM', 'TELEPLAY', 'ANIMATION', 'COMICS', 'PICTURE', 'NEWS', 'VSHOW', 'LIVE'];
const STATUS_OPTIONS = [
  { value: '', label: '全部状态' },
  { value: 'PUBLISH', label: '已发布' },
  { value: 'UN_PUBLISH', label: '已下架' },
  { value: 'REVIEWING', label: '待审核' },
  { value: 'SCHEDULED', label: '已定时' },
];

/** 后台作品管理:跨创作者/跨类型全量列表,带预览/详情弹窗。 */
export default function AdminWorksPage() {
  const [page, setPage] = useState(1);
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [keyword, setKeyword] = useState('');
  const [preview, setPreview] = useState<AdminWork | null>(null);

  const list = useQuery({
    queryKey: ['admin', 'works', page, type, status, keyword],
    queryFn: () => fetchAdminWorks({ page, pageSize: PAGE_SIZE, contentType: type || undefined, status: status || undefined, title: keyword || undefined }),
  });

  const total = list.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const previewRoute = preview?.contentType ? getDetailRoute(preview.contentType, preview.id) : null;

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 0.5 }}>作品管理</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        全站作品列表(按你的数据权限),支持预览与跳转详情页。
      </Typography>

      <Box sx={{ display: 'flex', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
        <TextField select size="small" label="类型" value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} sx={{ width: 130 }}>
          {TYPE_OPTIONS.map((t) => <MenuItem key={t} value={t}>{t ? TYPE_LABEL[t] || t : '全部类型'}</MenuItem>)}
        </TextField>
        <TextField select size="small" label="状态" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} sx={{ width: 130 }}>
          {STATUS_OPTIONS.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
        </TextField>
        <TextField size="small" label="标题包含" value={keyword} onChange={(e) => { setKeyword(e.target.value); setPage(1); }} sx={{ width: 220 }} />
      </Box>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>封面</TableCell>
              <TableCell>标题</TableCell>
              <TableCell>类型</TableCell>
              <TableCell>作者</TableCell>
              <TableCell>状态</TableCell>
              <TableCell align="right">阅读/赞/评</TableCell>
              <TableCell>发布时间</TableCell>
              <TableCell>操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {list.isLoading ? (
              <TableRow><TableCell colSpan={8} align="center">加载中...</TableCell></TableRow>
            ) : (list.data?.list.length ?? 0) === 0 ? (
              <TableRow><TableCell colSpan={8} align="center">暂无作品</TableCell></TableRow>
            ) : (
              list.data!.list.map((w) => (
                <TableRow key={String(w.id)} hover>
                  <TableCell sx={{ width: 56 }}>
                    <CoverImage src={w.coverUrl} alt={w.title} sx={{ width: 44, height: 44, borderRadius: 0.5 }} />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ maxWidth: 260, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {w.title}
                    </Typography>
                  </TableCell>
                  <TableCell><Chip size="small" variant="outlined" label={TYPE_LABEL[w.contentType || ''] || w.contentType || '-'} /></TableCell>
                  <TableCell>{w.author || w.userId || '-'}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={w.status === 'PUBLISH' ? '已发布' : w.status === 'UN_PUBLISH' ? '已下架' : w.status === 'REVIEWING' ? '待审核' : w.status === 'SCHEDULED' ? '已定时' : w.status || '-'}
                      color={w.status === 'PUBLISH' ? 'success' : w.status === 'REVIEWING' ? 'warning' : w.status === 'SCHEDULED' ? 'info' : 'default'}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell align="right">{w.readNum ?? 0} / {w.agreeNum ?? 0} / {w.commentNum ?? 0}</TableCell>
                  <TableCell>
                    <Typography variant="caption">
                      {w.publishTime ? new Date(w.publishTime).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Tooltip title="预览">
                      <IconButton size="small" onClick={() => setPreview(w)}><VisibilityOutlinedIcon fontSize="small" /></IconButton>
                    </Tooltip>
                    <Tooltip title="打开详情页">
                      <span>
                        <IconButton
                          size="small"
                          disabled={!w.contentType || !getDetailRoute(w.contentType, w.id)}
                          onClick={() => {
                            const r = w.contentType ? getDetailRoute(w.contentType, w.id) : null;
                            if (r) window.open(r, '_blank', 'noopener');
                          }}
                        >
                          <OpenInNewIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3, gap: 2 }}>
        <Button variant="outlined" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>上一页</Button>
        <Typography sx={{ alignSelf: 'center' }}>{page} / {pages}</Typography>
        <Button variant="outlined" onClick={() => setPage((p) => p + 1)} disabled={page >= pages}>下一页</Button>
      </Box>

      {/* 预览/详情弹窗 */}
      <Dialog open={!!preview} onClose={() => setPreview(null)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pr: 6 }}>
          <Typography sx={{ fontWeight: 700, flex: 1, minWidth: 0 }} noWrap>{preview?.title}</Typography>
          {previewRoute && (
            <Button size="small" variant="outlined" endIcon={<OpenInNewIcon />} onClick={() => window.open(previewRoute, '_blank', 'noopener')} sx={{ textTransform: 'none' }}>
              打开详情页
            </Button>
          )}
          <IconButton onClick={() => setPreview(null)} sx={{ position: 'absolute', right: 8, top: 8 }}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {preview && (
            <Box>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                <Chip size="small" variant="outlined" label={TYPE_LABEL[preview.contentType || ''] || preview.contentType} />
                {preview.author && <Chip size="small" variant="outlined" label={`作者:${preview.author}`} />}
                {preview.sourceLabel && <Chip size="small" variant="outlined" label={preview.sourceLabel} />}
              </Box>
              {preview.coverUrl && (
                <CoverImage src={preview.coverUrl} alt={preview.title} sx={{ width: '100%', maxHeight: 320, borderRadius: 1, mb: 2, objectFit: 'cover' }} />
              )}
              {preview.subtitle && <Typography color="text.secondary" sx={{ mb: 2 }}>{preview.subtitle}</Typography>}
              {preview.content ? (
                <MarkdownView>{preview.content}</MarkdownView>
              ) : (
                <Typography color="text.secondary">该作品无正文(视频/音频类请打开详情页播放)。</Typography>
              )}
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
