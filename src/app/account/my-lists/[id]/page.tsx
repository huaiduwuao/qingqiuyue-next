'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';

export function generateStaticParams() {
  return [];
}
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Skeleton from '@mui/material/Skeleton';
import MusicNoteRoundedIcon from '@mui/icons-material/MusicNoteRounded';
import PhotoAlbumRoundedIcon from '@mui/icons-material/PhotoAlbumRounded';
import TopicRoundedIcon from '@mui/icons-material/TopicRounded';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import RemoveCircleOutlineRoundedIcon from '@mui/icons-material/RemoveCircleOutlineRounded';
import PlaylistPlayRoundedIcon from '@mui/icons-material/PlaylistPlayRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import { getMyListContent, removeFromMyList, getMyLists, type MyListType, type MyListItem, type MyListContentItem } from '@/apis/my-list';

type ListMeta = {
  label: string;
  color: string;
  icon: React.ReactElement<{ sx?: object }>;
};

const LIST_TYPE_META: Record<MyListType, ListMeta> = {
  playlist: { label: '歌单', color: '#25F4EE', icon: <MusicNoteRoundedIcon /> },
  album: { label: '图集', color: '#FFB400', icon: <PhotoAlbumRoundedIcon /> },
  topic: { label: '专题', color: '#FE2C55', icon: <TopicRoundedIcon /> },
  bookshelf: { label: '书架', color: '#5DDB96', icon: <MenuBookRoundedIcon /> },
};

function formatNum(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}w`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toString();
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  } catch {
    return dateStr;
  }
}

// 渲染带样式的 icon
function ListIcon({ meta, size = 20 }: { meta: ListMeta; size?: number }) {
  return React.cloneElement(meta.icon, { sx: { fontSize: size } } as any);
}

interface ContentCardProps {
  item: MyListContentItem;
  onRemove: () => void;
  listType: MyListType;
}

function ContentCard({ item, onRemove, listType }: ContentCardProps) {
  const meta = LIST_TYPE_META[listType] || LIST_TYPE_META.topic;

  const handleClick = () => {
    const typeMap: Record<string, string> = {
      VIDEO: 'video',
      NOVEL: 'novel',
      COMICS: 'comics',
      MUSIC: 'music',
      ARTICLE: 'article',
      PICTURE: 'image',
      FILM: 'film',
      TELEPLAY: 'teleplay',
      ANIMATION: 'animation',
      VSHOW: 'vshow',
      NEWS: 'news',
      LIVE: 'live',
    };
    const detailPath = typeMap[item.type?.toUpperCase()] || 'video';
    window.location.href = `/detail/${detailPath}-detail?id=${item.contentId}`;
  };

  return (
    <Box
      sx={{
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1.5,
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'border-color 0.15s, transform 0.15s',
        '&:hover': {
          borderColor: meta.color,
          transform: 'translateY(-2px)',
          '& .remove-btn': { opacity: 1 },
        },
      }}
      onClick={handleClick}
    >
      {/* 封面 */}
      <Box
        sx={{
          position: 'relative',
          aspectRatio: '16/9',
          background: item.coverUrl
            ? `url(${item.coverUrl}) center/cover no-repeat`
            : `linear-gradient(135deg, ${meta.color}60 0%, ${meta.color}20 100%)`,
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(180deg, transparent 50%, rgba(0,0,0,0.6) 100%)',
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            top: 4,
            right: 4,
            opacity: 0,
            transition: 'opacity 0.15s',
          }}
          className="remove-btn"
        >
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            sx={{
              bgcolor: 'rgba(0,0,0,0.6)',
              color: '#fff',
              p: 0.5,
              '&:hover': { bgcolor: 'error.main' },
            }}
            aria-label="移除"
          >
            <RemoveCircleOutlineRoundedIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>
        <Box
          sx={{
            position: 'absolute',
            bottom: 4,
            right: 4,
            display: 'flex',
            alignItems: 'center',
            gap: 0.25,
            color: '#fff',
            fontSize: 10,
          }}
        >
          <VisibilityRoundedIcon sx={{ fontSize: 10 }} />
          {formatNum(item.views)}
        </Box>
      </Box>

      {/* 文本 */}
      <Box sx={{ p: 1 }}>
        <Typography
          sx={{
            fontSize: 12,
            fontWeight: 600,
            color: 'text.primary',
            mb: 0.5,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {item.title || '未命名'}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>
            {item.author || '未知作者'}
          </Typography>
          <Typography sx={{ fontSize: 10, color: 'text.disabled' }}>
            {formatDate(item.addTime)}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

export default function MyListDetailPage() {
  const params = useParams();
  const router = useRouter();
  const listId = Number(params.id);
  const queryClient = useQueryClient();
  const [snack, setSnack] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  // 获取收藏夹信息
  const { data: listsData, isLoading: listLoading } = useQuery({
    queryKey: ['my-lists', 'all'],
    queryFn: () => getMyLists(),
    staleTime: 30 * 1000,
  });

  const listInfo: MyListItem | undefined = (listsData?.list ?? []).find((l: any) => Number(l.id) === listId);
  const meta = listInfo ? (LIST_TYPE_META[listInfo.type] || LIST_TYPE_META.topic) : LIST_TYPE_META.topic;

  // 获取收藏夹内容
  const { data: contentData, isLoading: contentLoading } = useQuery({
    queryKey: ['my-list-content', listId],
    queryFn: () => getMyListContent(listId),
    staleTime: 30 * 1000,
    enabled: !!listId,
  });

  const contents: MyListContentItem[] = (contentData?.list ?? []).map((c: any) => ({
    ...c,
    id: Number(c.id),
    contentId: Number(c.contentId),
  }));

  const removeMutation = useMutation({
    mutationFn: (contentId: number) => removeFromMyList(listId, contentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-list-content', listId] });
      setSnack({ open: true, message: '已移除', severity: 'success' });
    },
    onError: () => {
      setSnack({ open: true, message: '移除失败，请重试', severity: 'error' });
    },
  });

  const handleRemove = (contentId: number) => {
    if (confirm('确定要从收藏夹移除这个内容吗？')) {
      removeMutation.mutate(contentId);
    }
  };

  if (listLoading) {
    return (
      <Box sx={{ height: 'calc(100dvh - var(--appbar-h, 66px))', overflow: 'auto' }}>
        <Box sx={{ maxWidth: 1200, mx: 'auto', p: { xs: 2, md: 3 } }}>
          <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 2, mb: 3 }} />
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 2 }}>
            {[1, 2, 3, 4].map((i) => (
              <Box key={i} sx={{ bgcolor: 'background.paper', borderRadius: 2, overflow: 'hidden' }}>
                <Skeleton variant="rectangular" height={120} />
                <Box sx={{ p: 1.5 }}>
                  <Skeleton width="70%" />
                  <Skeleton width="40%" />
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
    );
  }

  if (!listInfo) {
    return (
      <Box sx={{ height: 'calc(100dvh - var(--appbar-h, 66px))', overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Box sx={{ textAlign: 'center' }}>
          <Typography sx={{ fontSize: 16, color: 'text.secondary', mb: 2 }}>收藏夹不存在或已被删除</Typography>
          <Button variant="contained" onClick={() => router.push('/account/my-lists')} startIcon={<ArrowBackRoundedIcon />}>
            返回列表
          </Button>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ height: 'calc(100dvh - var(--appbar-h, 66px))', overflow: 'auto', overscrollBehavior: 'contain' }}>
      {/* 头部 */}
      <Box
        sx={{
          background: listInfo.coverUrl
            ? `url(${listInfo.coverUrl}) center/cover no-repeat`
            : `linear-gradient(135deg, ${meta.color}40 0%, ${meta.color}10 100%)`,
          position: 'relative',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(180deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.7) 100%)',
          }}
        />
        <Box sx={{ position: 'relative', p: { xs: 2, md: 3 }, maxWidth: 1200, mx: 'auto' }}>
          {/* 返回按钮 */}
          <IconButton
            onClick={() => router.push('/account/my-lists')}
            sx={{ color: '#fff', mb: 2, bgcolor: 'rgba(255,255,255,0.1)', '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' } }}
            aria-label="返回"
          >
            <ArrowBackRoundedIcon />
          </IconButton>

          {/* 标题区 */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
            <Box
              sx={{
                width: 80,
                height: 80,
                borderRadius: 2,
                bgcolor: `${meta.color}30`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: meta.color,
                flexShrink: 0,
              }}
            >
              <ListIcon meta={meta} size={36} />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <Typography sx={{ fontSize: 22, fontWeight: 800, color: '#fff' }}>{listInfo.name}</Typography>
                {!listInfo.isPublic && (
                  <Box
                    sx={{
                      px: 0.75,
                      py: 0.25,
                      borderRadius: 0.5,
                      bgcolor: 'rgba(255,255,255,0.2)',
                      color: '#fff',
                      fontSize: 10,
                      fontWeight: 600,
                    }}
                  >
                    私密
                  </Box>
                )}
              </Box>
              {listInfo.description && (
                <Typography sx={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', mb: 1 }}>
                  {listInfo.description}
                </Typography>
              )}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <PlaylistPlayRoundedIcon sx={{ fontSize: 14 }} />
                  {contents.length} 项内容
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <VisibilityRoundedIcon sx={{ fontSize: 14 }} />
                  {formatNum(listInfo.totalViews)} 浏览
                </Box>
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* 内容区 */}
      <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1200, mx: 'auto' }}>
        {contentLoading ? (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 2 }}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Box key={i} sx={{ bgcolor: 'background.paper', borderRadius: 1.5, overflow: 'hidden' }}>
                <Skeleton variant="rectangular" height={120} />
                <Box sx={{ p: 1 }}>
                  <Skeleton width="70%" />
                  <Skeleton width="40%" />
                </Box>
              </Box>
            ))}
          </Box>
        ) : contents.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography sx={{ fontSize: 14, color: 'text.secondary', mb: 2 }}>收藏夹是空的</Typography>
            <Typography sx={{ fontSize: 12, color: 'text.disabled' }}>
              去首页浏览内容，收藏后会出现在这里
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 2 }}>
            {contents.map((item) => (
              <ContentCard
                key={item.id}
                item={item}
                listType={listInfo.type}
                onRemove={() => handleRemove(item.contentId)}
              />
            ))}
          </Box>
        )}
      </Box>

      {/* Toast */}
      <Snackbar
        open={snack.open}
        autoHideDuration={2500}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity={snack.severity} variant="filled">
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
