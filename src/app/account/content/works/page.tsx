'use client';

import { useState, useMemo } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import RefreshIcon from '@mui/icons-material/Refresh';
import CloudOutlinedIcon from '@mui/icons-material/CloudOutlined';
import DataOverviewCard from '../components/DataOverviewCard';
import TopPerformingContent from '../components/TopPerformingContent';
import ContentDistributionChart from '../components/ContentDistributionChart';
import ModuleContentPage from '../components/module-content/page';
import { MODULE_CONTENT_SOURCES } from '@/mocks/db/module-content';

const TYPE_OPTIONS = [
  { value: '', label: '全部类型' },
  { value: 'NOVEL', label: '小说' },
  { value: 'VIDEO', label: '视频' },
  { value: 'ARTICLE', label: '文章' },
  { value: 'MUSIC', label: '音乐' },
  { value: 'FILM', label: '电影' },
  { value: 'TELEPLAY', label: '电视剧' },
  { value: 'ANIMATION', label: '动画' },
  { value: 'COMICS', label: '漫画' },
];

const STATUS_OPTIONS = [
  { value: '', label: '全部状态' },
  { value: 'PUBLISH', label: '已发布' },
  { value: 'UN_PUBLISH', label: '已下架' },
];

const SOURCE_OPTIONS = [
  { value: '', label: '全部来源' },
  ...MODULE_CONTENT_SOURCES,
];

export default function WorksPage() {
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [source, setSource] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const filterSummary = useMemo(() => {
    const parts: string[] = [];
    if (type) parts.push(TYPE_OPTIONS.find((o) => o.value === type)?.label || type);
    if (status) parts.push(STATUS_OPTIONS.find((o) => o.value === status)?.label || status);
    if (source) parts.push(SOURCE_OPTIONS.find((o) => o.value === source)?.label || source);
    return parts.length ? parts.join(' · ') : '全部';
  }, [type, status, source]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* 顶部统计区(只读,使用 mock 数据) */}
      <DataOverviewCard />
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' } }}>
        <TopPerformingContent />
        <ContentDistributionChart />
      </Box>

      {/* 爬取内容列表区 */}
      <Box
        sx={{
          bgcolor: 'background.paper',
          border: '1px solid #252836',
          borderRadius: 2,
          p: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
          <CloudOutlinedIcon sx={{ fontSize: 18, color: 'primary.main' }} />
          <Box sx={{ flex: 1, minWidth: 160 }}>
            <Typography sx={{ fontSize: 15, fontWeight: 700, color: 'text.primary' }}>爬取内容管理</Typography>
            <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.25 }}>
              当前筛选: {filterSummary} · 数据源 module_content
            </Typography>
          </Box>

          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>类型</InputLabel>
            <Select value={type} label="类型" onChange={(e) => setType(e.target.value)}>
              {TYPE_OPTIONS.map((o) => (
                <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 110 }}>
            <InputLabel>状态</InputLabel>
            <Select value={status} label="状态" onChange={(e) => setStatus(e.target.value)}>
              {STATUS_OPTIONS.map((o) => (
                <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 130 }}>
            <InputLabel>来源</InputLabel>
            <Select value={source} label="来源" onChange={(e) => setSource(e.target.value)}>
              {SOURCE_OPTIONS.map((o) => (
                <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <Button
            size="small"
            variant="outlined"
            startIcon={<RefreshIcon sx={{ fontSize: 14 }} />}
            onClick={() => setRefreshKey((k) => k + 1)}
            sx={{
              borderColor: 'divider',
              color: 'text.secondary',
              textTransform: 'none',
              fontSize: 12,
              '&:hover': { borderColor: 'primary.main', color: 'primary.main' },
            }}
          >
            刷新
          </Button>
        </Box>

        <ModuleContentPage
          key={refreshKey}
          contentType={type || undefined}
          status={status || undefined}
          source={source || undefined}
        />
      </Box>
    </Box>
  );
}
