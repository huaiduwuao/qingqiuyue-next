'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import { qaDetail } from '@/apis/home';
import { AsyncState, EmptyState } from '@/components/common/AsyncState';

const MOCK_QA: any[] = [
  {
    title: '清秋月品牌创立的初衷是什么?',
    content: '弘扬江南文化 / 提供原创内容 / 探索数字传承 / 推广国风美学',
    answer: '清秋月以"江南文化复兴"为初衷,致力于把传统美学通过数字方式重新带回日常生活。',
  },
  {
    title: '平台主要的内容形式有哪些?',
    content: '小说 / 漫画 / 短剧 / 综艺 / 资讯',
    answer: '小说、漫画、影视、综艺、音乐、二次元、资讯、公开课等八大类,覆盖图文与长短视频。',
  },
];

export default function ShareQaPage() {
  const [searchKey, setSearchKey] = useState('');
  const [submittedKey, setSubmittedKey] = useState('');

  const query = useQuery({
    queryKey: ['qa', submittedKey],
    queryFn: () => qaDetail({ title: submittedKey }).then((r) => (r.data && (r.data as any[]).length > 0 ? (r.data as any[]) : MOCK_QA)),
    enabled: !!submittedKey,
    placeholderData: MOCK_QA,
  });

  const handleSearch = () => {
    if (!searchKey.trim()) return;
    setSubmittedKey(searchKey.trim());
  };

  const highlightText = (text: string, highlight: string) => {
    if (!highlight) return text;
    const parts = text.split(new RegExp(`(${highlight})`, 'gi'));
    return parts.map((part, index) =>
      part.toLowerCase() === highlight.toLowerCase() ? (
        <Box component="span" key={index} sx={{ color: 'primary.main', fontWeight: 'bold' }}>
          {part}
        </Box>
      ) : (
        part
      )
    );
  };

  return (
    <Container maxWidth="md">
      <Box sx={{ py: { xs: 2, md: 4 } }}>
        <Typography variant="h4" sx={{ mb: 3 }}>问答搜索</Typography>

        <Box sx={{ mb: 3, display: 'flex', gap: 1 }}>
          <TextField
            fullWidth
            placeholder="输入题目或选项的关键字,模糊查询"
            value={searchKey}
            onChange={(e) => setSearchKey(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <Button variant="contained" onClick={handleSearch} disabled={query.isFetching}>
            搜索
          </Button>
        </Box>

        {!submittedKey ? (
          <EmptyState text="输入关键字搜索问答" hint="支持题目/选项模糊匹配" />
        ) : (
          <AsyncState query={query} isEmpty={(d) => d.length === 0} emptyText="未找到相关问答" emptyHint="试试更换关键词" emptyVariant="sad">
            {(data) => (
              <List>
                {data.map((item, index) => (
                  <Paper key={index} sx={{ mb: 2, p: 2 }}>
                    <Box sx={{ mb: 1 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>问题:</Typography>
                      <Typography>{highlightText(item.title || '', submittedKey)}</Typography>
                    </Box>
                    <Box sx={{ mb: 1 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>选项:</Typography>
                      <Typography>{highlightText(item.content || '', submittedKey)}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>答案:</Typography>
                      <Typography color="primary">{item.answer}</Typography>
                    </Box>
                  </Paper>
                ))}
              </List>
            )}
          </AsyncState>
        )}
      </Box>
    </Container>
  );
}
