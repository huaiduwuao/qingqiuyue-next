'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import CircularProgress from '@mui/material/CircularProgress';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import PauseRoundedIcon from '@mui/icons-material/PauseRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import VerticalAlignBottomRoundedIcon from '@mui/icons-material/VerticalAlignBottomRounded';
import {
  getProjects,
  tailLogs,
  searchLogs,
  parseLine,
  LEVEL_COLOR,
  ALL_LEVELS,
  type LogLevel,
} from '@/apis/logtail';

const TAIL_N = 800;
const POLL_MS = 2000;

function todayStr() {
  // 客户端运行,直接用本地日期
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function SystemLogPage() {
  const [project, setProject] = useState('');
  const [mode, setMode] = useState<'live' | 'search'>('live');
  const [paused, setPaused] = useState(false);
  const [levelFilter, setLevelFilter] = useState<Set<LogLevel>>(new Set());
  const [kw, setKw] = useState('');
  const [start, setStart] = useState(todayStr());
  const [end, setEnd] = useState(todayStr());
  const [searchKey, setSearchKey] = useState(0); // 点击「检索」时自增以触发查询

  const projectsQ = useQuery({
    queryKey: ['logtail', 'projects'],
    queryFn: getProjects,
    refetchInterval: 30000,
  });

  // 未手动选择时默认用第一个项目(派生值,避免 effect 里 setState)
  const effProject = project || projectsQ.data?.[0] || '';

  const live = mode === 'live';
  const logsQ = useQuery({
    queryKey: ['logtail', 'logs', effProject, mode, live ? 'live' : searchKey],
    enabled: !!effProject,
    refetchInterval: live && !paused ? POLL_MS : false,
    queryFn: () => (live ? tailLogs(effProject, TAIL_N) : searchLogs(effProject, start, end, kw)),
    placeholderData: (prev) => prev,
  });

  const parsed = useMemo(
    () => (logsQ.data?.lines ?? []).map(parseLine),
    [logsQ.data],
  );

  const filtered = useMemo(
    () =>
      parsed.filter((p) => {
        if (levelFilter.size && !(p.level && levelFilter.has(p.level))) return false;
        // 实时模式下关键字是前端过滤;检索模式关键字已由服务端处理
        if (live && kw && !p.raw.toLowerCase().includes(kw.toLowerCase())) return false;
        return true;
      }),
    [parsed, levelFilter, kw, live],
  );

  // 自动滚底:仅当用户停在底部附近时跟随
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
  };
  const scrollToBottom = () => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  };
  useEffect(() => {
    if (live && stickRef.current) scrollToBottom();
  }, [filtered, live]);

  const toggleLevel = (lv: LogLevel) => {
    setLevelFilter((prev) => {
      const next = new Set(prev);
      if (next.has(lv)) next.delete(lv);
      else next.add(lv);
      return next;
    });
  };

  const runSearch = () => setSearchKey((k) => k + 1);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 60px - 48px)', minHeight: 480 }}>
      {/* 标题 */}
      <Box sx={{ mb: 1.5 }}>
        <Typography sx={{ fontSize: 18, fontWeight: 600, color: 'text.primary' }}>服务日志</Typography>
        <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.25 }}>
          聚合 core / content / realtime / spider 各服务日志 · 实时跟随与历史检索
        </Typography>
      </Box>

      {/* 工具栏 */}
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 1.25,
          p: 1.25,
          mb: 1,
          borderRadius: 2,
          bgcolor: 'var(--bg-sidebar, rgba(255,255,255,0.03))',
          border: '1px solid var(--border-color, rgba(255,255,255,0.06))',
        }}
      >
        {/* 项目选择 */}
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <Select
            value={effProject}
            displayEmpty
            onChange={(e) => setProject(e.target.value)}
            sx={{ fontSize: 13, '& .MuiSelect-select': { py: 0.75 } }}
          >
            {!projectsQ.data?.length && (
              <MenuItem value="" disabled>
                {projectsQ.isLoading ? '加载中…' : '无项目'}
              </MenuItem>
            )}
            {projectsQ.data?.map((p) => (
              <MenuItem key={p} value={p} sx={{ fontSize: 13 }}>
                {p}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* 模式 */}
        <ToggleButtonGroup
          size="small"
          exclusive
          value={mode}
          onChange={(_, v) => v && setMode(v)}
          sx={{ '& .MuiToggleButton-root': { px: 1.5, py: 0.5, fontSize: 12.5, textTransform: 'none' } }}
        >
          <ToggleButton value="live">实时</ToggleButton>
          <ToggleButton value="search">检索</ToggleButton>
        </ToggleButtonGroup>

        {live ? (
          <>
            <Tooltip title={paused ? '继续' : '暂停'}>
              <IconButton size="small" onClick={() => setPaused((p) => !p)} sx={{ color: 'text.secondary' }}>
                {paused ? <PlayArrowRoundedIcon fontSize="small" /> : <PauseRoundedIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
            <TextField
              size="small"
              placeholder="过滤关键字"
              value={kw}
              onChange={(e) => setKw(e.target.value)}
              sx={{ width: 200, '& .MuiInputBase-input': { fontSize: 13, py: 0.75 } }}
            />
          </>
        ) : (
          <>
            <TextField
              size="small"
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              sx={{ '& .MuiInputBase-input': { fontSize: 13, py: 0.75 } }}
            />
            <Typography sx={{ fontSize: 12, color: 'text.disabled' }}>至</Typography>
            <TextField
              size="small"
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              sx={{ '& .MuiInputBase-input': { fontSize: 13, py: 0.75 } }}
            />
            <TextField
              size="small"
              placeholder="搜索内容"
              value={kw}
              onChange={(e) => setKw(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runSearch()}
              sx={{ width: 200, '& .MuiInputBase-input': { fontSize: 13, py: 0.75 } }}
            />
            <Button
              size="small"
              variant="contained"
              startIcon={<SearchRoundedIcon />}
              onClick={runSearch}
              disabled={!effProject}
              sx={{ textTransform: 'none', fontSize: 13 }}
            >
              检索
            </Button>
          </>
        )}

        <Box sx={{ flex: 1 }} />

        {/* 级别过滤 */}
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {ALL_LEVELS.map((lv) => {
            const on = levelFilter.has(lv);
            return (
              <Box
                key={lv}
                onClick={() => toggleLevel(lv)}
                sx={{
                  px: 1,
                  py: 0.35,
                  fontSize: 11,
                  fontWeight: 600,
                  borderRadius: 1,
                  cursor: 'pointer',
                  userSelect: 'none',
                  color: on || !levelFilter.size ? LEVEL_COLOR[lv] : 'text.disabled',
                  border: '1px solid',
                  borderColor: on ? LEVEL_COLOR[lv] : 'transparent',
                  bgcolor: on ? `${LEVEL_COLOR[lv]}1a` : 'transparent',
                  transition: 'all .12s',
                  '&:hover': { borderColor: LEVEL_COLOR[lv] },
                }}
              >
                {lv}
              </Box>
            );
          })}
        </Box>

        <Tooltip title="刷新">
          <IconButton size="small" onClick={() => logsQ.refetch()} sx={{ color: 'text.secondary' }}>
            {logsQ.isFetching ? <CircularProgress size={16} /> : <RefreshRoundedIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
        <Tooltip title="滚到底部">
          <IconButton size="small" onClick={scrollToBottom} sx={{ color: 'text.secondary' }}>
            <VerticalAlignBottomRoundedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* 日志区 */}
      <Box
        ref={scrollRef}
        onScroll={onScroll}
        sx={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          borderRadius: 2,
          p: 1,
          bgcolor: 'var(--bg-elevated, #0d0f17)',
          border: '1px solid var(--border-color, rgba(255,255,255,0.06))',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
          fontSize: 12.5,
          lineHeight: 1.6,
        }}
      >
        {logsQ.isError && (
          <Box sx={{ p: 2, color: 'error.main', fontSize: 13 }}>
            日志加载失败:{(logsQ.error as Error)?.message || '未知错误'}
            <Typography sx={{ fontSize: 12, color: 'text.disabled', mt: 0.5 }}>
              请确认 logtail-server 已启动,且网关 /logs 路由可达。
            </Typography>
          </Box>
        )}
        {!logsQ.isError && filtered.length === 0 && (
          <Box sx={{ p: 2, color: 'text.disabled', fontSize: 13 }}>
            {logsQ.isLoading ? '加载中…' : '暂无日志'}
          </Box>
        )}
        {filtered.map((p, i) => {
          const color = p.level ? LEVEL_COLOR[p.level] : '#8a8f98';
          return (
            <Box
              key={i}
              sx={{
                display: 'flex',
                gap: 1,
                px: 0.5,
                py: '1px',
                borderRadius: 0.5,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' },
              }}
            >
              {p.ts && (
                <Box component="span" sx={{ color: 'text.disabled', flexShrink: 0 }}>
                  {p.ts}
                </Box>
              )}
              {p.level && (
                <Box
                  component="span"
                  sx={{ color, fontWeight: 700, flexShrink: 0, width: 46, display: 'inline-block' }}
                >
                  {p.level}
                </Box>
              )}
              {p.src && (
                <Box component="span" sx={{ color: 'text.secondary', flexShrink: 0 }}>
                  {p.src}
                </Box>
              )}
              <Box component="span" sx={{ color: p.level ? 'rgba(255,255,255,0.85)' : 'text.secondary' }}>
                {p.msg}
              </Box>
            </Box>
          );
        })}
      </Box>

      {/* 底部状态条 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 0.75, px: 0.5 }}>
        <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>
          {filtered.length} 行{logsQ.data?.truncated ? `(已截断,共 ${logsQ.data.total} 行)` : ''}
        </Typography>
        {live && (
          <Typography sx={{ fontSize: 11, color: paused ? 'warning.main' : 'success.main' }}>
            ● {paused ? '已暂停' : `实时(每 ${POLL_MS / 1000}s 刷新)`}
          </Typography>
        )}
      </Box>
    </Box>
  );
}
