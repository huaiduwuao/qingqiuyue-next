'use client';


// 该页依赖 client context + 后端实时数据,SSR/pre-render 时 TIERS/orders 等未就绪 →
// 报 "Cannot read properties of undefined"。强制 dynamic 跳过预渲染。

import { useState, useMemo, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import RefreshIcon from '@mui/icons-material/Refresh';
import MovieOutlinedIcon from '@mui/icons-material/MovieOutlined';
import Link from '@mui/material/Link';
import { useRouter } from 'next/navigation';
import { GridColDef } from '@mui/x-data-grid';
import { DataGridTable } from '@/components/tables/DataGridTable';
import { CoverImage } from '@/components/common/CoverImage';
import DataOverviewCard from '../../_components/DataOverviewCard';
import TopPerformingContent from '../../_components/TopPerformingContent';
import ContentDistributionChart from '../../_components/ContentDistributionChart';
import { getCreatorWorks } from '@/apis/creator';
import { useActiveTab } from '../../ActiveTabContext';
import { toWorksTableRows, type WorksTableRow } from './rows';
import { WorkActionsMenu } from '../../_components/WorkActions';
import { getDetailRoute } from '@/lib/contentRoute';
import { useResponsive } from '@/hooks/useResponsive';
import WorksMobile from './WorksMobile';
import { TYPE_LABEL as CONTENT_TYPE_LABEL } from '@/lib/contentType.gen'; // 类型名以后端契约为准,别再手写(VSHOW 是综艺不是短剧)

// 分布图/日历等组件切 tab 时透传的小写类型 → 本页大写枚举
const PARAM_TYPE_MAP: Record<string, string> = {
  video: 'VIDEO', image: 'PICTURE', 'image-mv': 'PICTURE', panorama: 'VIDEO',
  article: 'ARTICLE', live: 'LIVE',
  novel: 'NOVEL', music: 'MUSIC', film: 'FILM', teleplay: 'TELEPLAY',
  animation: 'ANIMATION', comics: 'COMICS',
};

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
  { value: 'LIVE', label: '直播' },
  { value: 'PICTURE', label: '图文' },
];

const STATUS_OPTIONS = [
  { value: '', label: '全部状态' },
  { value: 'PUBLISH', label: '已发布' },
  { value: 'UN_PUBLISH', label: '已下架' },
];


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
        <CoverImage
          src={params.value}
          sx={{ width: 40, height: 40, borderRadius: 0.5, objectFit: 'cover' }}
        />
      ) : (
        <Box sx={{ width: 40, height: 40, borderRadius: 0.5, bgcolor: 'action.hover' }} />
      ),
  },
  {
    field: 'title',
    headerName: '标题',
    flex: 1,
    minWidth: 160,
    renderCell: (params) => <TitleCell row={params.row as WorksTableRow} />,
  },
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
    // 老数据里有小写 active(等同已发布);其余状态也给中文,和手机列表一致
    valueGetter: (value) =>
      ({ PUBLISH: '已发布', active: '已发布', UN_PUBLISH: '已下架', REVIEWING: '审核中', REJECTED: '未通过', SCHEDULED: '定时发布', DRAFT: '草稿', PRIVATE: '私密' } as Record<string, string>)[value as string] ?? value,
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
  {
    field: '__actions',
    headerName: '',
    width: 56,
    sortable: false,
    filterable: false,
    disableColumnMenu: true,
    align: 'center',
    renderCell: (params) => {
      const r = params.row as WorksTableRow;
      return (
        <WorkActionsMenu
          work={{ contentId: r.contentId, contentType: r.contentType, title: r.title, cover: r.coverUrl, status: r.status }}
        />
      );
    },
  },
];

/** 标题做成链接样式,点开作品详情(id 原样传字符串,不 Number()) */
function TitleCell({ row }: { row: WorksTableRow }) {
  const router = useRouter();
  const id = row.contentId;
  const exact = typeof id === 'string' || Number.isSafeInteger(id);
  const route = exact ? getDetailRoute(row.contentType, String(id)) : null;
  const text = row.title || '未命名作品';
  if (!route) return <>{text}</>;
  return (
    <Link
      component="button"
      type="button"
      underline="hover"
      onClick={() => router.push(route)}
      sx={{ fontSize: 'inherit', textAlign: 'left', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'middle' }}
    >
      {text}
    </Link>
  );
}

export default function WorksPage() {
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [source, setSource] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  // 接收 setActiveTab('works', { type }) 透传的过滤条件(不读 URL query)
  const { tabParams } = useActiveTab();
  useEffect(() => {
    const t = tabParams.type;
    if (t == null) return;
    const mapped = PARAM_TYPE_MAP[t] ?? (TYPE_OPTIONS.some((o) => o.value === t) ? t : '');
    setType(mapped);
  }, [tabParams.type]);

  const filterSummary = useMemo(() => {
    const parts: string[] = [];
    if (type) parts.push(TYPE_OPTIONS.find((o) => o.value === type)?.label || type);
    if (status) parts.push(STATUS_OPTIONS.find((o) => o.value === status)?.label || status);
    if (source) parts.push(SOURCE_OPTIONS.find((o) => o.value === source)?.label || source);
    return parts.length ? parts.join(' · ') : '全部';
  }, [type, status, source]);

  const { isMobile } = useResponsive();

  const fetchWorks = async (params: { pageNumber: number; pageSize: number }) => {
    const res = await getCreatorWorks({
      contentType: type || undefined,
      status: status || undefined,
      source: source || undefined,
      page: params.pageNumber,
      pageSize: params.pageSize,
    });
    const records = res.list || [];
    return {
      records: toWorksTableRows(records, params.pageNumber),
      totalRow: res.total ?? 0,
    };
  };

  // 手机:只留作品列表(数据组件属于「数据中心」页),单独设计,见 WorksMobile
  if (isMobile) {
    return (
      <WorksMobile
        type={type}
        setType={setType}
        status={status}
        setStatus={setStatus}
        typeOptions={TYPE_OPTIONS}
        statusOptions={STATUS_OPTIONS}
      />
    );
  }

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
          borderColor: 'divider',
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
            <InputLabel shrink>类型</InputLabel>
            <Select displayEmpty notched value={type} label="类型" onChange={(e) => setType(e.target.value)}>
              {TYPE_OPTIONS.map((o) => (
                <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 110 }}>
            <InputLabel shrink>状态</InputLabel>
            <Select displayEmpty notched value={status} label="状态" onChange={(e) => setStatus(e.target.value)}>
              {STATUS_OPTIONS.map((o) => (
                <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* 来源过滤:后端 /api/core/module-content/sources 未就绪,先不渲染。
              SOURCE_OPTIONS_LIST 非空后再放开(SOURCE_OPTIONS 已用 ... 拼接好)。 */}
          {SOURCE_OPTIONS_LIST.length > 0 && (
            <FormControl size="small" sx={{ minWidth: 130 }}>
              <InputLabel shrink>来源</InputLabel>
              <Select displayEmpty notched value={source} label="来源" onChange={(e) => setSource(e.target.value)}>
                {SOURCE_OPTIONS.map((o) => (
                  <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

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
