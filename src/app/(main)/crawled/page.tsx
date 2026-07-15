'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';

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
import { listSources } from '@/apis/spider';
import type { GridColDef } from '@mui/x-data-grid';
import { TYPE_LABEL, useContentNavigate } from '@/lib/contentRoute';

const STATUS_LABELS: Record<string, { label: string; color: 'success' | 'default' }> = {
  PUBLISH: { label: '已发布', color: 'success' },
  UN_PUBLISH: { label: '已下架', color: 'default' },
  active: { label: '已发布', color: 'success' },
};

interface SourceOption {
  label: string;
  value: string;
}

export default function CrawledPage() {
  const navigate = useContentNavigate();
  const [sourceFilter, setSourceFilter] = useState('');
  const [titleQ, setTitleQ] = useState('');
  const [allSources, setAllSources] = useState<SourceOption[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [typeBreakdown, setTypeBreakdown] = useState<Record<string, number>>({});
  const [publishedCount, setPublishedCount] = useState(0);

  // 加载来源下拉框（从 spider-api 的 source 列表取可读名称）
  useEffect(() => {
    listSources({ page: 1, pageSize: 200 })
      .then((res) => {
        const list = res.list || [];
        const opts: SourceOption[] = list
          .filter((s: any) => s.name)
          .map((s: any) => ({ label: s.name, value: s.name }));
        setAllSources(opts);
      })
      .catch(() => {
        setAllSources([]);
      });
  }, []);

  const fetchData = useCallback(
    async (params: any) => {
      try {
        const pageNumber = (params.pageNumber || 0) + 1;
        const pageSize = params.pageSize || 20;
        const res = await myPage({
          page: pageNumber,
          pageSize,
          sourceLabel: sourceFilter || undefined,
          title: titleQ || undefined,
        });
        const records: ModuleContentItem[] = res.list || [];
        const total = res.total || 0;
        setTotalCount(total);

        // 类型分布与发布数基于当前页统计；数据量大时可改由后端聚合
        const tb: Record<string, number> = {};
        let pub = 0;
        records.forEach((r: ModuleContentItem) => {
          tb[r.contentType] = (tb[r.contentType] || 0) + 1;
          if (r.status === 'PUBLISH' || r.status === 'published' || r.status === 'active') {
            pub++;
          }
        });
        setTypeBreakdown(tb);
        setPublishedCount(pub);

        return { data: { records, totalRow: total }, success: true };
      } catch (err: any) {
        return { data: { records: [], totalRow: 0 }, success: false };
      }
    },
    [sourceFilter, titleQ]
  );

  const handleView = useCallback(
    (row: ModuleContentItem) => {
      navigate(row.contentType, row.id, row.source);
    },
    [navigate]
  );

  const columns: GridColDef[] = useMemo(
    () => [
      {
        field: 'coverUrl',
        headerName: '封面',
        width: 64,
        sortable: false,
        renderCell: (p) =>
          p.value ? (
            <Box
              component="img"
              src={p.value}
              sx={{ width: 40, height: 40, borderRadius: 0.5, objectFit: 'cover' }}
            />
          ) : null,
      },
      {
        field: 'title',
        headerName: '标题',
        width: 240,
        renderCell: (p) => (
          <Typography sx={{ fontSize: 12, fontWeight: 500 }}>{p.value}</Typography>
        ),
      },
      {
        field: 'contentType',
        headerName: '类型',
        width: 90,
        renderCell: (p) => (
          <Chip label={TYPE_LABEL[p.value] || p.value} size="small" variant="outlined" />
        ),
      },
      { field: 'author', headerName: '作者', width: 110 },
      {
        field: 'sourceLabel',
        headerName: '来源',
        width: 200,
        renderCell: (p) => (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <CloudDownloadIcon sx={{ fontSize: 12, color: 'primary.main' }} />
            <Typography sx={{ fontSize: 11, fontWeight: 500, color: 'primary.main' }}>
              {p.value || '未知来源'}
            </Typography>
          </Box>
        ),
      },
      {
        field: 'status',
        headerName: '状态',
        width: 90,
        renderCell: (p) => {
          const s = STATUS_LABELS[p.value];
          return s ? (
            <Chip label={s.label} size="small" color={s.color} />
          ) : (
            <Chip label={p.value} size="small" />
          );
        },
      },
      { field: 'readNum', headerName: '阅读', width: 80, type: 'number' },
      {
        field: 'createTime',
        headerName: '抓取时间',
        width: 160,
        valueFormatter: (v) => (v ? new Date(v).toLocaleString() : '-'),
      },
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
    ],
    [handleView]
  );

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
            sx={{ minWidth: 220 }}
          >
            <MenuItem value="">全部来源</MenuItem>
            {allSources.map((s) => (
              <MenuItem key={s.value} value={s.value}>
                {s.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            size="small"
            label="标题搜索"
            value={titleQ}
            onChange={(e) => setTitleQ(e.target.value)}
            sx={{ minWidth: 220 }}
          />
          <Box sx={{ flex: 1 }} />
          {/* 类型分布 */}
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            {Object.entries(typeBreakdown).map(([type, n]) => (
              <Chip
                key={type}
                label={`${TYPE_LABEL[type] || type}: ${n}`}
                size="small"
                variant="outlined"
              />
            ))}
          </Box>
        </Box>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
          {[
            { l: '已抓取', v: totalCount, c: 'primary' },
            { l: '来源数', v: allSources.length, c: 'info' },
            { l: '类型数', v: Object.keys(typeBreakdown).length, c: 'success' },
            { l: '已发布', v: publishedCount, c: 'warning' },
          ].map((c) => (
            <Box key={c.l} sx={{ width: { xs: 'calc(50% - 6px)', sm: 130 } }}>
              <Card variant="outlined">
                <CardContent sx={{ textAlign: 'center', py: 1, '&:last-child': { pb: 1 } }}>
                  <Typography sx={{ fontSize: 20, fontWeight: 700 }} color={`${c.c}.main`}>
                    {c.v}
                  </Typography>
                  <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>{c.l}</Typography>
                </CardContent>
              </Card>
            </Box>
          ))}
        </Box>
      </Paper>

      <DataGridTable
        columns={columns}
        fetchData={fetchData}
        extraParams={{ sourceLabel: sourceFilter, title: titleQ }}
      />
    </Box>
  );
}
