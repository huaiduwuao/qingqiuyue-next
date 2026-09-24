'use client';

/**
 * 爬虫模板详情 / 编辑页(/system/spider/templates/edit?id=)。
 *
 * 以前这里是一个自动弹出的对话框,有两个要命的问题:
 *   · GET /templates/:id 返回 { template, attrs },对话框却在顶层读 name / content,
 *     表单永远是空的;content 又是 JSON 字符串,当对象读也读不出东西;
 *   · 于是点「保存」会把 type 改成 list、把整段配置换成一份几乎全空的 —— 等于清空模板。
 *
 * 现在只有一份真相:解析后的 content 对象(cfg)。表单按 schema.ts 的字段路径读写它,
 * JSON 视图直接编辑它的文本;清单之外的键原样保留。
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Switch from '@mui/material/Switch';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Tooltip from '@mui/material/Tooltip';
import Collapse from '@mui/material/Collapse';
import Snackbar from '@mui/material/Snackbar';
import Autocomplete from '@mui/material/Autocomplete';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import CircularProgress from '@mui/material/CircularProgress';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import UndoRoundedIcon from '@mui/icons-material/UndoRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import { getTemplateDetail, updateTemplate, testTemplate } from '@/apis/spider';
import type { TemplateAttr, TemplateRow } from '@/beans/spider';
import { CONTENT_TYPES } from '@/lib/contentType.gen';
import {
  SECTIONS,
  TEMPLATE_TYPES,
  fieldValue,
  isSet,
  parseContent,
  replaceUnknownTopKeys,
  sectionStats,
  setField,
  unknownTopKeys,
  validateConfig,
  type Config,
  type FieldDef,
  type SectionDef,
} from './schema';

const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

const cardSx = {
  borderRadius: 2,
  border: '1px solid var(--border-color, rgba(127,127,127,0.2))',
  bgcolor: 'var(--bg-elevated, transparent)',
} as const;

interface Meta {
  name: string;
  type: string;
  category: string;
  code: string;
  domain: string;
}

function metaOf(t: TemplateRow): Meta {
  return {
    name: t.name ?? '',
    type: t.type ?? '',
    category: t.category ?? '',
    code: t.code ?? '',
    domain: t.domain ?? '',
  };
}

function fmtTime(v?: string) {
  if (!v) return '-';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleString();
}

// ─── 字段输入 ───────────────────────────────────────────────────────────────

function JsonInput({ value, onChange, minRows = 4 }: { value: any; onChange: (v: Record<string, any>) => void; minRows?: number }) {
  const serialized = useMemo(() => JSON.stringify(value ?? {}, null, 2), [value]);
  const [text, setText] = useState(serialized);
  const [err, setErr] = useState('');
  const focused = useRef(false);
  // 外部改了(比如 JSON 视图 / 放弃修改),且没在打字时,同步进来
  useEffect(() => {
    if (!focused.current) {
      setText(serialized);
      setErr('');
    }
  }, [serialized]);
  return (
    <TextField
      multiline
      fullWidth
      size="small"
      minRows={minRows}
      maxRows={18}
      value={text}
      error={!!err}
      helperText={err || undefined}
      onFocus={() => (focused.current = true)}
      onBlur={() => {
        focused.current = false;
        if (!err) setText(serialized);
      }}
      onChange={(e) => {
        const t = e.target.value;
        setText(t);
        try {
          const v = t.trim() ? JSON.parse(t) : {};
          if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('需要一个 JSON 对象 {…}');
          setErr('');
          onChange(v);
        } catch (ex: any) {
          setErr(ex?.message || 'JSON 无效');
        }
      }}
      slotProps={{ input: { sx: { fontFamily: MONO, fontSize: 12 } } }}
    />
  );
}

function MapInput({ value, onChange }: { value: any; onChange: (v: Record<string, string> | null) => void }) {
  const entries: [string, string][] =
    value && typeof value === 'object' && !Array.isArray(value)
      ? Object.entries(value).map(([k, v]) => [k, String(v ?? '')])
      : [];
  const commit = (next: [string, string][]) => {
    const obj = Object.fromEntries(next);
    onChange(Object.keys(obj).length ? obj : null);
  };
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
      {entries.map(([k, v], i) => (
        <Box key={i} sx={{ display: 'flex', gap: 0.75, alignItems: 'center' }}>
          <TextField
            size="small"
            placeholder="键"
            value={k}
            onChange={(e) => commit(entries.map((en, j) => (j === i ? [e.target.value, en[1]] : en)))}
            sx={{ width: { xs: 110, sm: 180 }, flexShrink: 0 }}
            slotProps={{ input: { sx: { fontFamily: MONO, fontSize: 12.5 } } }}
          />
          <TextField
            size="small"
            fullWidth
            placeholder="值"
            value={v}
            onChange={(e) => commit(entries.map((en, j) => (j === i ? [en[0], e.target.value] : en)))}
            slotProps={{ input: { sx: { fontFamily: MONO, fontSize: 12.5 } } }}
          />
          <IconButton size="small" aria-label="删除" onClick={() => commit(entries.filter((_, j) => j !== i))}>
            <CloseRoundedIcon fontSize="small" />
          </IconButton>
        </Box>
      ))}
      <Box>
        <Button
          size="small"
          variant="text"
          startIcon={<AddRoundedIcon />}
          disabled={entries.some(([k]) => k === '')}
          onClick={() => commit([...entries, ['', '']])}
        >
          添加一项
        </Button>
      </Box>
    </Box>
  );
}

function FieldInput({ f, value, onChange }: { f: FieldDef; value: any; onChange: (v: any) => void }) {
  const monoInput = { input: { sx: { fontFamily: MONO, fontSize: 12.5 } } };
  switch (f.kind) {
    case 'bool':
      return <Switch size="small" checked={!!value} onChange={(_, v) => onChange(v)} />;
    case 'number':
      return (
        <TextField
          size="small"
          fullWidth
          type="number"
          value={value ?? ''}
          placeholder={f.placeholder ?? '0'}
          onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
        />
      );
    case 'list':
      return (
        <Autocomplete
          multiple
          freeSolo
          size="small"
          options={[] as string[]}
          value={Array.isArray(value) ? value.map(String) : []}
          onChange={(_, v) => onChange(v.map((s) => String(s).trim()).filter(Boolean))}
          renderValue={(vals, getItemProps) =>
            vals.map((opt, index) => {
              const { key, ...rest } = getItemProps({ index });
              return <Chip key={key} size="small" label={opt} sx={{ fontFamily: MONO, fontSize: 12 }} {...rest} />;
            })
          }
          renderInput={(params) => (
            <TextField {...params} placeholder={Array.isArray(value) && value.length ? '' : f.placeholder ?? '输入后回车添加'} />
          )}
        />
      );
    case 'map':
      return <MapInput value={value} onChange={onChange} />;
    case 'json':
      return <JsonInput value={value} onChange={onChange} />;
    case 'contentType':
      return (
        <Autocomplete
          freeSolo
          size="small"
          options={CONTENT_TYPES as readonly string[]}
          value={value ?? ''}
          onInputChange={(_, v) => onChange(v)}
          renderInput={(params) => (
            <TextField {...params} placeholder="VIDEO / NOVEL …" sx={{ '& input': { fontFamily: MONO, fontSize: 12.5 } }} />
          )}
        />
      );
    case 'script':
      return (
        <TextField
          multiline
          fullWidth
          size="small"
          minRows={5}
          maxRows={20}
          value={value ?? ''}
          placeholder="(async()=>{ … return JSON.stringify(out) })()"
          onChange={(e) => onChange(e.target.value)}
          slotProps={{ input: { sx: { fontFamily: MONO, fontSize: 12 } } }}
        />
      );
    default:
      return (
        <TextField
          size="small"
          fullWidth
          value={value ?? ''}
          placeholder={f.placeholder}
          onChange={(e) => onChange(e.target.value)}
          slotProps={f.kind === 'code' ? monoInput : undefined}
        />
      );
  }
}

function FieldRow({ f, cfg, onCfg }: { f: FieldDef; cfg: Config; onCfg: (next: Config) => void }) {
  const value = fieldValue(cfg, f);
  const set = isSet(value);
  const wide = f.wide || f.kind === 'json' || f.kind === 'script' || f.kind === 'map';
  const pathLabel = f.path.join('.');
  if (f.kind === 'bool') {
    return (
      <Box
        sx={{
          gridColumn: wide ? '1 / -1' : undefined,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 1.5,
          py: 0.75,
          borderRadius: 1.5,
          border: '1px solid var(--border-color, rgba(127,127,127,0.2))',
          minHeight: 40,
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 500 }}>{f.label}</Typography>
          {f.hint && <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{f.hint}</Typography>}
        </Box>
        <FieldInput f={f} value={value} onChange={(v) => onCfg(setField(cfg, f, v))} />
      </Box>
    );
  }
  return (
    <Box sx={{ gridColumn: wide ? '1 / -1' : undefined, minWidth: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, mb: 0.5, minWidth: 0 }}>
        <Box
          sx={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            flexShrink: 0,
            alignSelf: 'center',
            bgcolor: set ? 'success.main' : 'transparent',
            border: set ? 'none' : '1px solid var(--border-color, rgba(127,127,127,0.4))',
          }}
        />
        <Typography sx={{ fontSize: 12.5, fontWeight: 600 }}>{f.label}</Typography>
        <Typography noWrap sx={{ fontSize: 11, color: 'text.disabled', fontFamily: MONO, minWidth: 0 }}>
          {pathLabel}
        </Typography>
      </Box>
      <FieldInput f={f} value={value} onChange={(v) => onCfg(setField(cfg, f, v))} />
      {f.hint && <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.5 }}>{f.hint}</Typography>}
    </Box>
  );
}

// ─── 分区卡片 ───────────────────────────────────────────────────────────────

function SectionCard({
  id,
  title,
  desc,
  badge,
  open,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  desc?: string;
  badge?: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <Box id={`sec-${id}`} sx={{ ...cardSx, scrollMarginTop: 96 }}>
      <Box
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle();
          }
        }}
        sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.5, cursor: 'pointer', userSelect: 'none' }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: 14.5, fontWeight: 600 }}>{title}</Typography>
          {desc && <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.25 }}>{desc}</Typography>}
        </Box>
        {badge}
        <ExpandMoreRoundedIcon sx={{ color: 'text.secondary', transition: 'transform .18s', transform: open ? 'none' : 'rotate(-90deg)' }} />
      </Box>
      <Collapse in={open} timeout={160} unmountOnExit>
        <Box sx={{ px: 2, pb: 2, pt: 0.5 }}>{children}</Box>
      </Collapse>
    </Box>
  );
}

function StatBadge({ set, total }: { set: number; total: number }) {
  return (
    <Chip
      size="small"
      label={set ? `${set} / ${total}` : '未配置'}
      variant={set ? 'filled' : 'outlined'}
      color={set ? 'success' : 'default'}
      sx={{ height: 22, fontSize: 11.5, fontWeight: 600, ...(set ? {} : { color: 'text.secondary' }) }}
    />
  );
}

const fieldGrid = {
  display: 'grid',
  gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
  gap: 2,
} as const;

// ─── 页面 ──────────────────────────────────────────────────────────────────

export default function TemplateEditor({ templateId }: { templateId: number }) {
  const router = useRouter();
  const qc = useQueryClient();

  const detailQ = useQuery({
    queryKey: ['spider', 'template', templateId],
    queryFn: () => getTemplateDetail(templateId),
    staleTime: 0,
  });
  const row = detailQ.data?.template;
  const attrs: TemplateAttr[] = detailQ.data?.attrs ?? [];

  // 编辑态:meta(行字段)+ cfg(content 对象)。baseline 用来判断有没有未保存的修改。
  const [meta, setMeta] = useState<Meta | null>(null);
  const [cfg, setCfg] = useState<Config>({});
  const [baseline, setBaseline] = useState('');
  const [rawBroken, setRawBroken] = useState(false);
  const [mode, setMode] = useState<'form' | 'json'>('form');
  const [jsonText, setJsonText] = useState('');
  const [jsonErr, setJsonErr] = useState('');
  const [onlySet, setOnlySet] = useState(false);
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});
  const [saveErr, setSaveErr] = useState('');
  const [toast, setToast] = useState('');

  const snapshot = (m: Meta | null, c: Config, text?: string) => JSON.stringify([m, text ?? c]);

  const loadFrom = (t: TemplateRow) => {
    const m = metaOf(t);
    const parsed = parseContent(t.content);
    setMeta(m);
    if (parsed) {
      setCfg(parsed);
      setJsonText(JSON.stringify(parsed, null, 2));
      setRawBroken(false);
      setMode('form');
      setBaseline(snapshot(m, parsed));
    } else {
      // 存的不是 JSON 对象:只能在 JSON 视图里修
      setCfg({});
      setJsonText(String(t.content ?? ''));
      setRawBroken(true);
      setMode('json');
      setBaseline(snapshot(m, {}, String(t.content ?? '')));
    }
    setJsonErr('');
    setSaveErr('');
  };

  // 首次拿到数据时装载;之后后台 refetch 不覆盖正在编辑的内容
  const loadedId = useRef<number | null>(null);
  useEffect(() => {
    if (row && loadedId.current !== row.id) {
      loadedId.current = row.id;
      loadFrom(row);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row]);

  const dirty = meta !== null && snapshot(meta, cfg, rawBroken ? jsonText : undefined) !== baseline;

  // 有未保存修改时拦住关页 / 刷新
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  const onCfg = (next: Config) => {
    setCfg(next);
    setJsonText(JSON.stringify(next, null, 2));
  };

  const onJsonText = (t: string) => {
    setJsonText(t);
    try {
      const v = JSON.parse(t);
      if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('顶层必须是 JSON 对象 {…}');
      setJsonErr('');
      setCfg(v);
      setRawBroken(false);
    } catch (e: any) {
      setJsonErr(e?.message || 'JSON 无效');
    }
  };

  const switchMode = (m: 'form' | 'json') => {
    if (m === 'form' && (jsonErr || rawBroken)) return;
    if (m === 'json') setJsonText(JSON.stringify(cfg, null, 2));
    setMode(m);
  };

  const type = meta?.type ?? '';
  const sectionOpen = (s: SectionDef) => openMap[s.id] ?? (sectionStats(cfg, s).set > 0 || !!s.types?.includes(type));
  const toggleSection = (id: string, cur: boolean) => setOpenMap((m) => ({ ...m, [id]: !cur }));

  const extras = unknownTopKeys(cfg);
  const extraCount = Object.keys(extras).length;
  const totals = useMemo(() => {
    let set = 0;
    let total = 0;
    for (const s of SECTIONS) {
      const st = sectionStats(cfg, s);
      set += st.set;
      total += st.total;
    }
    return { set, total };
  }, [cfg]);

  const saveM = useMutation({
    mutationFn: () =>
      updateTemplate(templateId, {
        name: meta!.name.trim(),
        type: meta!.type,
        category: meta!.category.trim(),
        code: meta!.code.trim(),
        domain: meta!.domain.trim(),
        content: JSON.stringify(cfg),
      }),
    onSuccess: (saved: any) => {
      setBaseline(snapshot(meta, cfg));
      setSaveErr('');
      setToast('已保存');
      qc.invalidateQueries({ queryKey: ['spider', 'templates'] });
      qc.invalidateQueries({ queryKey: ['spider', 'template-detail', templateId] });
      if (saved && typeof saved === 'object' && 'content' in saved) {
        qc.setQueryData(['spider', 'template', templateId], (old: any) => (old ? { ...old, template: saved } : old));
      }
    },
    onError: (e: any) => setSaveErr(e?.message || '保存失败'),
  });

  const onSave = () => {
    if (jsonErr || rawBroken) {
      setSaveErr('JSON 还有错误,改好再保存');
      return;
    }
    if (!meta?.name.trim()) {
      setSaveErr('模板名称不能为空');
      return;
    }
    const v = validateConfig(cfg);
    if (v) {
      setSaveErr(v);
      return;
    }
    saveM.mutate();
  };

  const onDiscard = () => row && loadFrom(row);

  const goBack = () => {
    if (dirty && !window.confirm('有未保存的修改,确定离开?')) return;
    router.push('/system/spider/templates');
  };

  // 测试解析
  const [testUrl, setTestUrl] = useState('');
  const [testRes, setTestRes] = useState<any>(null);
  const testM = useMutation({
    mutationFn: () => {
      const sel =
        type === 'detail' || type === 'chapter'
          ? cfg.content_selector || cfg.item_container_selector || cfg.detail_title_selector || ''
          : cfg.item_container_selector || cfg.list_item_selector || '';
      const js = typeof cfg.custom?.js_extract === 'string' ? cfg.custom.js_extract.trim() : '';
      return testTemplate({
        url: testUrl.trim(),
        type,
        templateId,
        selector: sel || undefined,
        jsExtract: js || undefined,
        maxItems: 10,
      });
    },
    onSuccess: (r) => setTestRes(r),
    onError: (e: any) => setTestRes({ success: false, error: e?.message || '请求失败' }),
  });

  // ─── 渲染 ───

  if (detailQ.isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }
  if (detailQ.isError || !row || !meta) {
    return (
      <Box sx={{ maxWidth: 720 }}>
        <Button startIcon={<ArrowBackRoundedIcon />} variant="text" onClick={() => router.push('/system/spider/templates')} sx={{ mb: 2 }}>
          返回模板列表
        </Button>
        <Alert severity="error">模板 #{templateId} 加载失败:{(detailQ.error as Error)?.message || '不存在或已删除'}</Alert>
      </Box>
    );
  }

  const visibleSections = SECTIONS.filter((s) => !onlySet || sectionStats(cfg, s).set > 0);
  const hiddenCount = SECTIONS.length - visibleSections.length;
  const typeLabel = TEMPLATE_TYPES.find((t) => t.value === meta.type)?.label ?? meta.type;

  const navItems: { id: string; label: string; count?: string; on?: boolean }[] = [
    { id: 'info', label: '模板信息' },
    ...SECTIONS.map((s) => {
      const st = sectionStats(cfg, s);
      return { id: s.id, label: s.title, count: st.set ? String(st.set) : '', on: st.set > 0 };
    }),
    ...(extraCount ? [{ id: 'extra', label: '其他字段', count: String(extraCount), on: true }] : []),
    { id: 'attrs', label: '模板属性', count: attrs.length ? String(attrs.length) : '' },
    { id: 'test', label: '测试解析' },
  ];

  const jump = (id: string) => {
    if (mode !== 'form') switchMode('form');
    setOpenMap((m) => ({ ...m, [id]: true }));
    requestAnimationFrame(() => document.getElementById(`sec-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  return (
    <Box sx={{ maxWidth: 1280, mx: 'auto' }}>
      {/* 顶栏:名称 + 摘要 + 操作,滚动时吸顶 */}
      <Box
        sx={{
          position: 'sticky',
          top: { xs: -12, md: -24 },
          zIndex: 5,
          mx: { xs: -1.5, md: -3 },
          px: { xs: 1.5, md: 3 },
          pt: { xs: 1.5, md: 3 },
          pb: 1.5,
          mt: { xs: -1.5, md: -3 },
          mb: 2,
          bgcolor: 'var(--bg-body, background.default)',
          borderBottom: '1px solid var(--border-color, rgba(127,127,127,0.2))',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, flexWrap: 'wrap' }}>
          <Tooltip title="返回模板列表">
            <IconButton size="small" onClick={goBack} sx={{ mt: 0.25 }} aria-label="返回模板列表">
              <ArrowBackRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Box sx={{ flex: 1, minWidth: 220 }}>
            <TextField
              variant="standard"
              fullWidth
              value={meta.name}
              placeholder="模板名称"
              onChange={(e) => setMeta({ ...meta, name: e.target.value })}
              slotProps={{
                input: {
                  disableUnderline: true,
                  sx: {
                    fontSize: 20,
                    fontWeight: 600,
                    '& input': { py: 0.25 },
                    borderBottom: '1px dashed transparent',
                    '&:hover, &.Mui-focused': { borderBottomColor: 'var(--border-color, rgba(127,127,127,0.4))' },
                  },
                },
              }}
            />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap', mt: 0.75 }}>
              <Chip size="small" label={`#${row.id}`} sx={{ fontFamily: MONO, height: 22 }} />
              <Chip size="small" color="primary" variant="outlined" label={typeLabel || '未设类型'} sx={{ height: 22 }} />
              {isSet(cfg.content_type) && <Chip size="small" variant="outlined" label={String(cfg.content_type)} sx={{ height: 22, fontFamily: MONO }} />}
              {isSet(cfg.api_source?.name) && <Chip size="small" variant="outlined" label={`API · ${cfg.api_source.name}`} sx={{ height: 22 }} />}
              {cfg.browser?.enabled && <Chip size="small" variant="outlined" label="浏览器渲染" sx={{ height: 22 }} />}
              {meta.domain && (
                <Typography sx={{ fontSize: 12, color: 'text.secondary', fontFamily: MONO }}>{meta.domain}</Typography>
              )}
              <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                · 已配置 {totals.set} 项 · 更新于 {fmtTime(row.update_time)}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', ml: 'auto' }}>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={mode}
              onChange={(_, v) => v && switchMode(v)}
              sx={{ '& .MuiToggleButton-root': { px: 1.5, py: 0.4, fontSize: 12.5, textTransform: 'none' } }}
            >
              <ToggleButton value="form" disabled={!!jsonErr || rawBroken}>
                表单
              </ToggleButton>
              <ToggleButton value="json">JSON</ToggleButton>
            </ToggleButtonGroup>
            {dirty && (
              <Button size="small" variant="text" startIcon={<UndoRoundedIcon />} onClick={onDiscard} disabled={saveM.isPending}>
                放弃修改
              </Button>
            )}
            <Button
              size="small"
              variant={dirty ? 'contained' : 'outlined'}
              startIcon={saveM.isPending ? <CircularProgress size={14} color="inherit" /> : <SaveRoundedIcon />}
              onClick={onSave}
              disabled={!dirty || saveM.isPending}
            >
              {dirty ? '保存' : '已保存'}
            </Button>
          </Box>
        </Box>
        {saveErr && (
          <Alert severity="error" onClose={() => setSaveErr('')} sx={{ mt: 1.5, py: 0 }}>
            {saveErr}
          </Alert>
        )}
      </Box>

      {rawBroken && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          这条模板存的 content 不是合法的 JSON 对象,表单没法展示。在下面改成合法 JSON 后才能切回表单和保存。
        </Alert>
      )}

      {mode === 'json' ? (
        <Box sx={{ ...cardSx, p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, gap: 1 }}>
            <Typography sx={{ fontSize: 14.5, fontWeight: 600, flex: 1 }}>content(完整 JSON)</Typography>
            <Tooltip title="复制">
              <IconButton size="small" onClick={() => navigator.clipboard?.writeText(jsonText).then(() => setToast('已复制'))}>
                <ContentCopyRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
          <TextField
            multiline
            fullWidth
            minRows={24}
            value={jsonText}
            onChange={(e) => onJsonText(e.target.value)}
            error={!!jsonErr}
            helperText={jsonErr || '直接改整段配置;表单里没有的键也会原样保存'}
            slotProps={{ input: { sx: { fontFamily: MONO, fontSize: 12.5, lineHeight: 1.55 } } }}
          />
        </Box>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '188px minmax(0,1fr)' }, gap: 3, alignItems: 'start' }}>
          {/* 分区导航 */}
          <Box component="nav" sx={{ position: 'sticky', top: 128, display: { xs: 'none', md: 'block' } }}>
            {navItems.map((it) => (
              <Box
                key={it.id}
                onClick={() => jump(it.id)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  px: 1.25,
                  py: 0.6,
                  borderRadius: 1.5,
                  cursor: 'pointer',
                  fontSize: 13,
                  color: it.on ? 'text.primary' : 'text.secondary',
                  '&:hover': { bgcolor: 'var(--bg-hover, rgba(127,127,127,0.08))', color: 'text.primary' },
                }}
              >
                <Box component="span" sx={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {it.label}
                </Box>
                {it.count && (
                  <Box component="span" sx={{ fontSize: 11, fontWeight: 600, color: it.on ? 'success.main' : 'text.secondary' }}>
                    {it.count}
                  </Box>
                )}
              </Box>
            ))}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1.5, px: 0.5 }}>
              <Switch size="small" checked={onlySet} onChange={(_, v) => setOnlySet(v)} />
              <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>只看已配置</Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
            {/* 手机端没有左侧导航,开关放这里 */}
            <Box sx={{ display: { xs: 'flex', md: 'none' }, alignItems: 'center', gap: 0.5 }}>
              <Switch size="small" checked={onlySet} onChange={(_, v) => setOnlySet(v)} />
              <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>只看已配置</Typography>
            </Box>

            {/* 模板信息(module_template 行字段,不在 content 里) */}
            <SectionCard
              id="info"
              title="模板信息"
              desc="模板本身的字段;下面各分区编辑的是 content 配置"
              open={openMap.info ?? true}
              onToggle={() => toggleSection('info', openMap.info ?? true)}
            >
              <Box sx={fieldGrid}>
                <Box>
                  <Typography sx={{ fontSize: 12.5, fontWeight: 600, mb: 0.5 }}>模板类型</Typography>
                  <TextField select size="small" fullWidth value={meta.type} onChange={(e) => setMeta({ ...meta, type: e.target.value })}>
                    {TEMPLATE_TYPES.map((t) => (
                      <MenuItem key={t.value} value={t.value}>
                        {t.label}
                        <Box component="span" sx={{ ml: 1, color: 'text.disabled', fontFamily: MONO, fontSize: 12 }}>{t.value}</Box>
                      </MenuItem>
                    ))}
                    {meta.type && !TEMPLATE_TYPES.some((t) => t.value === meta.type) && <MenuItem value={meta.type}>{meta.type}</MenuItem>}
                  </TextField>
                </Box>
                <Box>
                  <Typography sx={{ fontSize: 12.5, fontWeight: 600, mb: 0.5 }}>分类</Typography>
                  <TextField size="small" fullWidth value={meta.category} onChange={(e) => setMeta({ ...meta, category: e.target.value })} />
                </Box>
                <Box>
                  <Typography sx={{ fontSize: 12.5, fontWeight: 600, mb: 0.5 }}>编码</Typography>
                  <TextField
                    size="small"
                    fullWidth
                    value={meta.code}
                    onChange={(e) => setMeta({ ...meta, code: e.target.value })}
                    slotProps={{ input: { sx: { fontFamily: MONO, fontSize: 12.5 } } }}
                  />
                </Box>
                <Box>
                  <Typography sx={{ fontSize: 12.5, fontWeight: 600, mb: 0.5 }}>域名</Typography>
                  <TextField
                    size="small"
                    fullWidth
                    value={meta.domain}
                    onChange={(e) => setMeta({ ...meta, domain: e.target.value })}
                    slotProps={{ input: { sx: { fontFamily: MONO, fontSize: 12.5 } } }}
                  />
                </Box>
              </Box>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' },
                  gap: 1.5,
                  mt: 2,
                  pt: 2,
                  borderTop: '1px solid var(--border-color, rgba(127,127,127,0.2))',
                }}
              >
                {[
                  ['关联源', row.source_id ? `#${row.source_id}` : '未关联'],
                  ['状态', row.status === 1 ? '启用' : `停用(${row.status})`],
                  ['创建时间', fmtTime(row.create_time)],
                  ['更新时间', fmtTime(row.update_time)],
                ].map(([k, v]) => (
                  <Box key={k}>
                    <Typography sx={{ fontSize: 11.5, color: 'text.secondary' }}>{k}</Typography>
                    <Typography sx={{ fontSize: 13, mt: 0.25 }}>{v}</Typography>
                  </Box>
                ))}
              </Box>
            </SectionCard>

            {visibleSections.map((s) => {
              const st = sectionStats(cfg, s);
              const open = sectionOpen(s);
              const fields = onlySet ? s.fields.filter((f) => isSet(fieldValue(cfg, f))) : s.fields;
              return (
                <SectionCard
                  key={s.id}
                  id={s.id}
                  title={s.title}
                  desc={s.desc}
                  badge={<StatBadge {...st} />}
                  open={open}
                  onToggle={() => toggleSection(s.id, open)}
                >
                  <Box sx={fieldGrid}>
                    {fields.map((f) => (
                      <FieldRow key={f.path.join('.')} f={f} cfg={cfg} onCfg={onCfg} />
                    ))}
                  </Box>
                </SectionCard>
              );
            })}
            {onlySet && hiddenCount > 0 && (
              <Typography sx={{ fontSize: 12, color: 'text.secondary', textAlign: 'center' }}>
                另有 {hiddenCount} 个分区未配置,已隐藏
              </Typography>
            )}

            {extraCount > 0 && (
              <SectionCard
                id="extra"
                title="其他字段"
                desc="表单清单之外的顶层键(旧版字段或手工加的),保存时原样保留"
                badge={<Chip size="small" label={extraCount} sx={{ height: 22 }} />}
                open={openMap.extra ?? false}
                onToggle={() => toggleSection('extra', openMap.extra ?? false)}
              >
                <JsonInput value={extras} minRows={3} onChange={(v) => onCfg(replaceUnknownTopKeys(cfg, v))} />
              </SectionCard>
            )}

            <SectionCard
              id="attrs"
              title="模板属性"
              desc="module_template_attr;在模板列表页的「编辑」里增删"
              badge={<Chip size="small" label={attrs.length} sx={{ height: 22 }} />}
              open={openMap.attrs ?? attrs.length > 0}
              onToggle={() => toggleSection('attrs', openMap.attrs ?? attrs.length > 0)}
            >
              {attrs.length === 0 ? (
                <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>没有属性</Typography>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {attrs.map((a) => (
                    <Box key={a.id} sx={{ p: 1.25, borderRadius: 1.5, border: '1px solid var(--border-color, rgba(127,127,127,0.2))' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{a.name}</Typography>
                        <Chip size="small" variant="outlined" label={a.type} sx={{ height: 20, fontSize: 11 }} />
                        <Typography sx={{ fontSize: 11.5, fontFamily: MONO, color: 'text.secondary' }}>{a.code}</Typography>
                        {a.remark && <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>· {a.remark}</Typography>}
                      </Box>
                      <Box
                        component="pre"
                        sx={{ m: 0, mt: 0.75, fontFamily: MONO, fontSize: 11.5, whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: 'text.secondary', maxHeight: 160, overflow: 'auto' }}
                      >
                        {(() => {
                          try {
                            return JSON.stringify(JSON.parse(a.content), null, 2);
                          } catch {
                            return a.content;
                          }
                        })()}
                      </Box>
                    </Box>
                  ))}
                </Box>
              )}
            </SectionCard>

            <SectionCard
              id="test"
              title="测试解析"
              desc="拿一个真实 URL 按这条模板跑一遍,只读不写库"
              open={openMap.test ?? true}
              onToggle={() => toggleSection('test', openMap.test ?? true)}
            >
              <Box sx={{ display: 'flex', gap: 1, flexDirection: { xs: 'column', sm: 'row' } }}>
                <TextField
                  size="small"
                  fullWidth
                  value={testUrl}
                  onChange={(e) => setTestUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && testUrl.trim() && !testM.isPending && testM.mutate()}
                  placeholder="https://www.example.com/book/123/"
                  slotProps={{ input: { sx: { fontFamily: MONO, fontSize: 12.5 } } }}
                />
                <Button
                  variant="outlined"
                  startIcon={testM.isPending ? <CircularProgress size={14} /> : <PlayArrowRoundedIcon />}
                  onClick={() => testM.mutate()}
                  disabled={!testUrl.trim() || testM.isPending}
                  sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                >
                  {testM.isPending ? '解析中…' : '测试解析'}
                </Button>
              </Box>
              <Typography sx={{ fontSize: 11.5, color: 'text.secondary', mt: 0.75 }}>
                按「{typeLabel || '未设类型'}」跑,用的是已保存的模板{dirty ? '(当前有未保存的修改,只有容器选择器会用表单里的值)' : ''};js_extract 跑在 BrowserWorker,这里测不了。
              </Typography>
              {testRes && (
                <Alert severity={testRes.success ? 'success' : 'error'} sx={{ mt: 1.5 }}>
                  {testRes.success
                    ? `成功:${testRes.count ?? testRes.body_len ?? 0} 条 · 耗时 ${testRes.duration ?? '-'}`
                    : `失败:${testRes.error || '未知原因'}`}
                  {testRes.warning ? ` · ${testRes.warning}` : ''}
                </Alert>
              )}
              {testRes?.items?.length > 0 && (
                <Box sx={{ mt: 1.5, display: 'flex', flexDirection: 'column', gap: 0.5, maxHeight: 320, overflow: 'auto' }}>
                  {testRes.items.map((it: any, i: number) => (
                    <Box key={i} sx={{ display: 'flex', gap: 1, fontSize: 12.5, py: 0.5, borderBottom: '1px solid var(--border-color, rgba(127,127,127,0.15))' }}>
                      <Box component="span" sx={{ color: 'text.disabled', width: 22, flexShrink: 0, textAlign: 'right' }}>{i + 1}</Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontSize: 13 }}>{it.title || '(无标题)'}</Typography>
                        <Typography noWrap sx={{ fontSize: 11.5, color: 'text.secondary', fontFamily: MONO }}>{it.url}</Typography>
                      </Box>
                    </Box>
                  ))}
                </Box>
              )}
              {testRes?.body_preview && (
                <Box
                  component="pre"
                  sx={{ mt: 1.5, mb: 0, p: 1.25, borderRadius: 1.5, bgcolor: 'action.hover', fontSize: 12, maxHeight: 280, overflow: 'auto', whiteSpace: 'pre-wrap' }}
                >
                  {testRes.body_preview}
                </Box>
              )}
            </SectionCard>
          </Box>
        </Box>
      )}

      <Snackbar
        open={!!toast}
        autoHideDuration={2200}
        onClose={() => setToast('')}
        message={toast}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  );
}
