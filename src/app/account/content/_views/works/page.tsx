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
import MovieOutlinedIcon from '@mui/icons-material/MovieOutlined';
import { GridColDef } from '@mui/x-data-grid';
import { DataGridTable } from '@/components/tables/DataGridTable';
import DataOverviewCard from '../../_components/DataOverviewCard';
import TopPerformingContent from '../../_components/TopPerformingContent';
import ContentDistributionChart from '../../_components/ContentDistributionChart';
import { getCreatorWorks, type WorksItem } from '@/apis/creator';

// 数据源选项:后端 `/api/core/module-content/sources` 就绪后接入,目前为空占位
const SOURCE_OPTIONS_LIST: { value: string; label: string }[] = [];

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

const CONTENT_TYPE_LABEL: Record<string, string> = {
  NOVEL: '小说', VIDEO: '视频', ARTICLE: '文章', MUSIC: '音乐',
  FILM: '电影', TELEPLAY: '电视剧', ANIMATION: '动画', COMICS: '漫画',
};

const SOURCE_OPTIONS = [
  { value: '', label: '全部来源' },
  ...SOURCE_OPTIONS_LIST,
];

const COLUMNS: GridColDef[] = [
  {
    field: 'coverUrl',
    headerName: '封面',
    width: 64,
    sortable: false,
    renderCell: (params) =>
      params.value ? (
        <Box
          component="img"
          src={params.value}
          sx={{ width: 40, height: 40, borderRadius: 0.5, objectFit: 'cover' }}
        />
      ) : (
        <Box sx={{ width: 40, height: 40, borderRadius: 0.5, bgcolor: 'action.hover' }} />
      ),
  },
  { field: 'title', headerName: '标题', flex: 1, minWidth: 160 },
  {
    field: 'contentType',
    headerName: '类型',
    width: 90,
    valueGetter: (value) => CONTENT_TYPE_LABEL[value as string] || value,
  },
  {
    field: 'status',
    headerName: '状态',
    width: 90,
    valueGetter: (value) => (value === 'PUBLISH' ? '已发布' : value === 'UN_PUBLISH' ? '已下架' : value),
  },
  { field: 'readNum', headerName: '阅读', width: 80, type: 'number' },
  { field: 'agreeNum', headerName: '点赞', width: 80, type: 'number' },
  { field: 'commentNum', headerName: '评论', width: 80, type: 'number' },
  { field: 'source', headerName: '来源', width: 100 },
  {
    field: 'publishTime',
    headerName: '发布时间',
    width: 150,
    valueGetter: (value) =>
      value ? new Date(value as string).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-',
  },
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

  const fetchWorks = async (params: { pageNumber: number; pageSize: number }) => {
    const res = await getCreatorWorks({
      contentType: type || undefined,
      status: status || undefined,
      source: source || undefined,
      page: params.pageNumber,
      pageSize: params.pageSize,
    });
    return {
      data: {
        records: (res.data?.records || []) as WorksItem[],
        totalRow: res.data?.totalRow ?? res.data?.total ?? 0,
      },
    };
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* 顶部统计区(已接真实 /data/overview) */}
      <DataOverviewCard />
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' } }}>
        <TopPerformingContent />
        <ContentDistributionChart />
      </Box>

      {/* 我的作品列表区 */}
      <Box
        sx={{
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: (theme) => theme.palette.mode === 'dark' ? '#252836' : '#E5E7EB',
          borderRadius: 2,
          p: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
          <MovieOutlinedIcon sx={{ fontSize: 18, color: 'primary.main' }} />
          <Box sx={{ flex: 1, minWidth: 160 }}>
            <Typography sx={{ fontSize: 15, fontWeight: 700, color: 'text.primary' }}>作品管理</Typography>
            <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.25 }}>
              当前筛选: {filterSummary} · 数据源 /api/core/account/works
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

        <DataGridTable
          key={refreshKey}
          columns={COLUMNS}
          fetchData={fetchWorks}
          extraParams={{ type, status, source, refreshKey }}
        />
      </Box>
    </Box>
  );
}
