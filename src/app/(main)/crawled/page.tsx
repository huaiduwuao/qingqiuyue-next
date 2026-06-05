'use client';

import React, { useState, useCallback, useMemo } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Paper from '@mui/material/Paper';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { DataGridTable } from '@/components/tables/DataGridTable';
import { myPage, ModuleContentItem } from '@/apis/module-content';
import type { GridColDef } from '@mui/x-data-grid';
import { TYPE_LABEL, useContentNavigate } from '@/lib/contentRoute';

const STATUS_LABELS: Record<string, { label: string; color: 'success' | 'default' }> = {
  PUBLISH: { label: '已发布', color: 'success' },
  UN_PUBLISH: { label: '已下架', color: 'default' },
};

export default function CrawledPage() {
  const navigate = useContentNavigate();
  const [sourceFilter, setSourceFilter] = useState('');
  const [titleQ, setTitleQ] = useState('');
  const [allSources, setAllSources] = useState<{ domain: string; label: string }[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [typeBreakdown, setTypeBreakdown] = useState<Record<string, number>>({});

  const fetchData = useCallback(async (params: any) => {
    try {
      // 拉一页大点的数据,前端按 sourceLabel/source 过滤
      const res = await myPage({ pageSize: 200, page: 1 });
      const all = res.data.records || [];
      // 取来源(去重)
      const sources: Record<string, string> = {};
      all.forEach((r: any) => {
        if (r.source && r.sourceLabel) sources[r.source] = r.sourceLabel;
      });
      const srcList = Object.entries(sources).map(([domain, label]) => ({ domain, label }));
      setAllSources((prev) => {
        if (prev.length === srcList.length) return prev;
        return srcList;
      });
      // 类型分布(只算爬取的)
      const crawledAll = all.filter((r: any) => r.sourceLabel);
      const tb: Record<string, number> = {};
      crawledAll.forEach((r: any) => { tb[r.contentType] = (tb[r.contentType] || 0) + 1; });
      setTypeBreakdown(tb);
      // 过滤
      let filtered = crawledAll;
      if (sourceFilter) filtered = filtered.filter((r: any) => r.source === sourceFilter);
      if (titleQ) {
        const q = titleQ.toLowerCase();
        filtered = filtered.filter((r: any) => (r.title || '').toLowerCase().includes(q));
      }
      setTotalCount(filtered.length);
      // 手动分页
      const pageSize = params.pageSize || 20;
      const pageNumber = (params.pageNumber || 0) + 1;
      const start = (pageNumber - 1) * pageSize;
      const records = filtered.slice(start, start + pageSize);
      return { data: { records, totalRow: filtered.length }, success: true };
    } catch (err: any) {
      return { data: { records: [], totalRow: 0 }, success: false };
    }
  }, [sourceFilter, titleQ]);

  const handleView = useCallback((row: ModuleContentItem) => {
    navigate(row.contentType, row.id, row.source);
  }, [navigate]);

  const columns: GridColDef[] = useMemo(() => [
    {
      field: 'coverUrl',
      headerName: '封面',
      width: 64,
      sortable: false,
      renderCell: (p) => p.value ? <Box component="img" src={p.value} sx={{ width: 40, height: 40, borderRadius: 0.5, objectFit: 'cover' }} /> : null,
    },
    { field: 'title', headerName: '标题', width: 240, renderCell: (p) => <Typography sx={{ fontSize: 12, fontWeight: 500 }}>{p.value}</Typography> },
    {
      field: 'contentType',
      headerName: '类型',
      width: 90,
      renderCell: (p) => <Chip label={TYPE_LABEL[p.value] || p.value} size="small" variant="outlined" />,
    },
    { field: 'author', headerName: '作者', width: 110 },
    {
      field: 'source',
      headerName: '来源',
      width: 200,
      renderCell: (p) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <CloudDownloadIcon sx={{ fontSize: 12, color: 'primary.main' }} />
          <Typography sx={{ fontSize: 11, fontWeight: 500, color: 'primary.main' }}>{p.row.sourceLabel}</Typography>
          <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>({p.value})</Typography>
        </Box>
      ),
    },
    {
      field: 'status',
      headerName: '状态',
      width: 90,
      renderCell: (p) => {
        const s = STATUS_LABELS[p.value];
        return s ? <Chip label={s.label} size="small" color={s.color} /> : <Chip label={p.value} size="small" />;
      },
    },
    { field: 'readNum', headerName: '阅读', width: 80, type: 'number' },
    { field: 'createTime', headerName: '抓取时间', width: 160, valueFormatter: (v) => v ? new Date(v).toLocaleString() : '-' },
    {
      field: 'actions',
      headerName: '操作',
      width: 80,
      sortable: false,
      renderCell: (p) => (
        <Tooltip title="查看详情">
          <IconButton size="small" onClick={() => handleView(p.row as ModuleContentItem)}>
            <VisibilityIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      ),
    },
  ], [handleView]);

  return (
    <Box sx={{ p: { xs: 1.5, md: 2 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <CloudDownloadIcon color="primary" />
        <Typography variant="h5">抓取内容</Typography>
        <Chip label={`共 ${totalCount} 条`} size="small" color="primary" />
      </Box>

      {/* 概览 + 过滤栏 */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', mb: 1.5 }}>
          <TextField
            select
            size="small"
            label="按来源过滤"
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            sx={{ minWidth: 200 }}
          >
            <MenuItem value="">全部来源</MenuItem>
            {allSources.map((s) => (
              <MenuItem key={s.domain} value={s.domain}>{s.label} ({s.domain})</MenuItem>
            ))}
          </TextField>
          <TextField
            size="small"
            label="标题搜索"
            value={titleQ}
            onChange={(e) => setTitleQ(e.target.value)}
            sx={{ minWidth: 200 }}
          />
          <Box sx={{ flex: 1 }} />
          {/* 类型分布 */}
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            {Object.entries(typeBreakdown).map(([type, n]) => (
              <Chip key={type} label={`${TYPE_LABEL[type] || type}: ${n}`} size="small" variant="outlined" />
            ))}
          </Box>
        </Box>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
          {[
            { l: '已抓取', v: totalCount, c: 'primary' },
            { l: '来源数', v: allSources.length, c: 'info' },
            { l: '类型数', v: Object.keys(typeBreakdown).length, c: 'success' },
            { l: '已发布', v: 0, c: 'warning' }, // 由具体 list 决定
          ].map((c) => (
            <Box key={c.l} sx={{ width: { xs: 'calc(50% - 6px)', sm: 130 } }}>
              <Card variant="outlined"><CardContent sx={{ textAlign: 'center', py: 1, '&:last-child': { pb: 1 } }}>
                <Typography sx={{ fontSize: 20, fontWeight: 700 }} color={`${c.c}.main`}>{c.v}</Typography>
                <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>{c.l}</Typography>
              </CardContent></Card>
            </Box>
          ))}
        </Box>
      </Paper>

      <DataGridTable
        columns={columns}
        fetchData={fetchData}
      />
    </Box>
  );
}
