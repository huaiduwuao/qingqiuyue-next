'use client';

import React, { useState } from 'react';
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

export default function ShareQaPage() {
  const [searchKey, setSearchKey] = useState('');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!searchKey.trim()) return;
    setLoading(true);
    try {
      const res = await qaDetail({ title: searchKey });
      setData(res.data || []);
    } catch (err) {
      console.error('Failed to search:', err);
    }
    setLoading(false);
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
      <Box sx={{ py: 4 }}>
        <Typography variant="h4" sx={{ mb: 3 }}>问答搜索</Typography>

        <Box sx={{ mb: 3, display: 'flex', gap: 1 }}>
          <TextField
            fullWidth
            placeholder="输入题目或选项的关键字,模糊查询"
            value={searchKey}
            onChange={(e) => setSearchKey(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <Button variant="contained" onClick={handleSearch} disabled={loading}>
            搜索
          </Button>
        </Box>

        {data.length === 0 && !loading && (
          <Typography align="center" color="text.secondary" sx={{ py: 4 }}>
            输入关键字搜索问答
          </Typography>
        )}

        <List>
          {data.map((item, index) => (
            <Paper key={index} sx={{ mb: 2, p: 2 }}>
              <Box sx={{ mb: 1 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>问题:</Typography>
                <Typography>{highlightText(item.title || '', searchKey)}</Typography>
              </Box>
              <Box sx={{ mb: 1 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>选项:</Typography>
                <Typography>{highlightText(item.content || '', searchKey)}</Typography>
              </Box>
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>答案:</Typography>
                <Typography color="primary">{item.answer}</Typography>
              </Box>
            </Paper>
          ))}
        </List>
      </Box>
    </Container>
  );
}
