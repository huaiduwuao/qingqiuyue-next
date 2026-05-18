'use client';

import React, { useEffect, useState, useRef, Suspense } from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import Slider from '@mui/material/Slider';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import Divider from '@mui/material/Divider';
import CircularProgress from '@mui/material/CircularProgress';
import SettingsIcon from '@mui/icons-material/Settings';
import { useSearchParams } from 'next/navigation';
import { detail as chapterDetail } from '@/apis/system-module-content-item';
import { getNovel, addShelf } from '@/apis/content-novel-chapter';

interface PageStyle {
  color: string;
  bgColor: string;
  bodyImage: string;
  bodySettingImage: string;
  blackBodyImage: string;
  blackBodySettingImage: string;
  fontFamily: string;
  fontSize: number;
  loadStyle: string;
  black: boolean;
}

const DEFAULT_PAGE_STYLE: PageStyle = {
  color: '#2E8B57',
  bgColor: '#CCE8CF',
  bodyImage: '/novel_theme1_bg.png',
  bodySettingImage: '/novel_theme1_bg_setting.png',
  blackBodyImage: '/novel_theme7_bg.png',
  blackBodySettingImage: '/novel_theme7_bg_setting.png',
  fontFamily: '',
  fontSize: 16,
  loadStyle: 'pull',
  black: false,
};

function NovelDetailContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const novelId = searchParams.get('novelId');

  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [chapter, setChapter] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pageStyle, setPageStyle] = useState<PageStyle>(DEFAULT_PAGE_STYLE);
  const [collected, setCollected] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (id) {
      fetchChapter();
    }
  }, [id]);

  const fetchChapter = async () => {
    setLoading(true);
    try {
      const res = await chapterDetail({ id });
      setChapter(res.data);
      setData([res.data]);
      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch chapter:', err);
      setLoading(false);
    }
  };

  const loadNextChapter = async () => {
    if (!chapter || !novelId) return;
    try {
      const res = await getNovel({ id: chapter.id, novelId, to: 'next' });
      if (!res.data) {
        setHasMore(false);
        return;
      }
      setData((prev) => [...prev, res.data]);
      setChapter(res.data);
    } catch (err) {
      console.error('Failed to load next chapter:', err);
    }
  };

  const handleCollect = async () => {
    if (!novelId || !chapter) return;
    try {
      await addShelf({ id: novelId, chapterId: chapter.id });
      setCollected(true);
    } catch (err) {
      console.error('Failed to collect:', err);
    }
  };

  const updatePageStyle = (updates: Partial<PageStyle>) => {
    setPageStyle((prev) => ({ ...prev, ...updates }));
  };

  const renderContent = () => (
    <Box
      sx={{
        color: pageStyle.color,
        fontFamily: pageStyle.fontFamily,
        fontSize: pageStyle.fontSize,
        backgroundImage: `url(${pageStyle.black ? pageStyle.blackBodyImage : pageStyle.bodyImage})`,
        backgroundColor: pageStyle.bgColor,
        minHeight: '100vh',
        p: 2,
      }}
    >
      {data.map((item, idx) => (
        <Box key={item.id || idx} sx={{ mb: 4 }} id={item.id?.toString()}>
          <Typography
            variant="h6"
            sx={{
              color: pageStyle.color,
              fontFamily: pageStyle.fontFamily,
              fontSize: pageStyle.fontSize,
              fontWeight: 'bold',
              mb: 2,
            }}
          >
            {item.name}
          </Typography>
          <Typography
            component="div"
            sx={{
              color: pageStyle.color,
              fontFamily: pageStyle.fontFamily,
              fontSize: pageStyle.fontSize,
              whiteSpace: 'pre-wrap',
              overflowWrap: 'anywhere',
            }}
          >
            {item.content?.content || ''}
          </Typography>
        </Box>
      ))}

      {hasMore && pageStyle.loadStyle === 'pull' && (
        <Box sx={{ textAlign: 'center', py: 2 }}>
          <Button onClick={loadNextChapter} variant="outlined">
            加载下一章
          </Button>
        </Box>
      )}
    </Box>
  );

  const renderSettings = () => (
    <Box sx={{ width: 250, p: 2 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>设置</Typography>

      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>字体大小</Typography>
        <Slider
          value={pageStyle.fontSize}
          min={12}
          max={24}
          step={1}
          onChange={(_, value) => updatePageStyle({ fontSize: value as number })}
          marks={[{ value: 16, label: '16' }]}
        />
      </Box>

      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>主题颜色</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {['#2E8B57', '#0000FF', '#FF0000', '#800080'].map((color) => (
            <Box
              key={color}
              sx={{
                width: 32,
                height: 32,
                bgcolor: color,
                borderRadius: 1,
                cursor: 'pointer',
                border: pageStyle.color === color ? '2px solid black' : 'none',
              }}
              onClick={() => updatePageStyle({ color })}
            />
          ))}
        </Box>
      </Box>

      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>背景</Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {[
            { bodyImage: '/novel_theme1_bg.png', bodySettingImage: '/novel_theme1_bg_setting.png' },
            { bodyImage: '/novel_theme2_bg.png', bodySettingImage: '/novel_theme2_bg_setting.png' },
          ].map((theme, idx) => (
            <Box
              key={idx}
              sx={{
                width: '100%',
                height: 40,
                backgroundImage: `url(${theme.bodyImage})`,
                cursor: 'pointer',
                border: pageStyle.bodyImage === theme.bodyImage ? '2px solid primary.main' : '1px solid #ccc',
                borderRadius: 1,
              }}
              onClick={() => updatePageStyle(theme)}
            />
          ))}
        </Box>
      </Box>

      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>阅读模式</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            size="small"
            variant={pageStyle.loadStyle === 'pull' ? 'contained' : 'outlined'}
            onClick={() => updatePageStyle({ loadStyle: 'pull' })}
          >
            滚动
          </Button>
          <Button
            size="small"
            variant={pageStyle.loadStyle === 'click' ? 'contained' : 'outlined'}
            onClick={() => updatePageStyle({ loadStyle: 'click' })}
          >
            点击
          </Button>
        </Box>
      </Box>

      <Box sx={{ mb: 3 }}>
        <Button
          fullWidth
          variant={pageStyle.black ? 'contained' : 'outlined'}
          onClick={() => updatePageStyle({ black: !pageStyle.black })}
        >
          {pageStyle.black ? '日间模式' : '夜间模式'}
        </Button>
      </Box>

      <Button fullWidth variant="contained" onClick={handleCollect} disabled={collected}>
        {collected ? '已在书架' : '加入书架'}
      </Button>
    </Box>
  );

  if (!id) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ py: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">缺少参数</Typography>
        </Box>
      </Container>
    );
  }

  return (
    <Box>
      <Box
        sx={{
          position: 'fixed',
          top: 16,
          right: 16,
          zIndex: 1000,
        }}
      >
        <IconButton onClick={() => setSettingsOpen(true)} sx={{ bgcolor: 'background.paper', boxShadow: 2 }} aria-label="阅读设置">
          <SettingsIcon />
        </IconButton>
      </Box>

      <Drawer anchor="right" open={settingsOpen} onClose={() => setSettingsOpen(false)}>
        {renderSettings()}
      </Drawer>

      <Box ref={scrollRef} sx={{ pb: 8 }}>
        {renderContent()}
      </Box>

      {pageStyle.loadStyle === 'click' && (
        <Box
          sx={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            bgcolor: 'background.paper',
            borderTop: 1,
            borderColor: 'divider',
            p: 2,
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <Button onClick={() => {}}>上一章</Button>
          <Button onClick={loadNextChapter} disabled={!hasMore}>下一章</Button>
        </Box>
      )}
    </Box>
  );
}

export default function NovelDetailPage() {
  return (
    <Suspense fallback={<Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>}>
      <NovelDetailContent />
    </Suspense>
  );
}
