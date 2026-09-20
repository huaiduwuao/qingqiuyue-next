'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import { updateShare } from '@/apis/module-content';
import { accountClient, formatApiError, isAuthError, isNetworkError } from '@/lib/api/client';
import { PricingFields } from './PricingFields';
import { ScheduleFields } from './ScheduleFields';

/**
 * useContentForm — 创作者中心发布表单的共享基础 hook。
 *
 * 背景:8+ 种发布类型(VIDEO/PICTURE/ARTICLE/NOVEL/NEWS/MUSIC/COMICS/
 * VSHOW/TELEPLAY)各有完全不同的"内容模板"——视频/图文/小说/新闻/音乐/
 * 漫画/短剧——字段差异极大(多图 vs 单封面 vs LRC 歌词 vs 章节列表 vs
 * 选集)。方案 C 选择"共享基础壳 + 各类型完全自定义表单":
 *
 *   1. 共享:title/desc(可选)/tags/snack Alert/submit mutation/后端
 *      调 updateShare 的 contentType + payload 构造 + 失败错误处理
 *      + 成功后跳回工作台 + 付费定价
 *   2. 各自管:PublishForms/ImageForm 管 images[]、ArticleForm 管 body +
 *      cover、NovelForm 管 chapters[]、MusicForm 管 audioFile +
 *      lrcLyrics、ComicsForm 管 pages[] 等
 *
 * 不抽 ContentForm 组件而抽 hook:各类型 view 完全控制 UI 布局,只
 * 复用逻辑。
 *
 * 用法:
 *   const f = useContentForm({
 *     contentType: 'PICTURE',
 *     maxTitle: 30, maxDesc: 200, maxTags: 8,
 *     validate: () => { if (!images.length) return '请先选图'; return null; },
 *     buildPayload: () => ({ title: f.title, contentType: 'PICTURE', ... }),
 *   });
 *   // f.title / f.setTitle / f.tags / f.snack / f.setSnack / f.submit
 *   // f.canSubmit / f.isPending / f.renderPricing() / f.renderSchedule() / f.renderSnackbar()
 */

export type SnackSeverity = 'success' | 'error' | 'info' | 'warning';
export interface SnackMsg { msg: string; severity: SnackSeverity; }

export interface UseContentFormOptions<TPayload> {
  /** 后端 contentType:VIDEO / PICTURE / ARTICLE / NOVEL / ... */
  contentType: string;
  /** 标题最大字数(默认 30) */
  maxTitle?: number;
  /** 简介最大字数(默认 200);不需要简介的类型可传 0 隐藏 desc 字段 */
  maxDesc?: number;
  /** 标签最大数(默认 8) */
  maxTags?: number;
  /** 同步校验:返回错误文案;返回 null 表示通过 */
  validate: () => string | null;
  /** 构造提交 payload(由 view 在 submit 时调用,可读取当前 state) */
  buildPayload: () => TPayload;
  /** 成功后是否自动跳回工作台(默认 true) */
  redirectOnSuccess?: boolean;
  /** 自定义跳转(默认 setActiveTab('content')) */
  onSuccess?: () => void;
  /** 标题是否必填(默认 true) */
  requireTitle?: boolean;
  /** 简介是否必填(默认 false) */
  requireDesc?: boolean;
}

export interface UseContentFormReturn<TPayload> {
  // 字段
  title: string;
  setTitle: (v: string) => void;
  desc: string;
  setDesc: (v: string) => void;
  tags: string;
  setTags: (v: string) => void;

  // 提交
  submit: () => Promise<{ ok: boolean; error?: string }>;
  isPending: boolean;
  canSubmit: boolean;

  /** 付费定价区块。serial=true 时额外提供"免费章节/分集数"。放在提交按钮之前。 */
  renderPricing: (opts?: { serial?: boolean }) => React.ReactElement;

  /** 定时发布区块(立即 / 定时 + 时间选择)。放在提交按钮之前。 */
  renderSchedule: () => React.ReactElement;

  // snack(Alert 风格,error 自动 5s,其他 2.4s)
  snack: SnackMsg | null;
  setSnack: (s: string | SnackMsg) => void;
  dismissSnack: () => void;
  /** 直接返回 <Snackbar> JSX,放在表单末尾 */
  renderSnackbar: () => React.ReactElement;
}

/** 后端保存后返回的状态 → 给创作者的结果提示。 */
function savedMessage(status: string | undefined): string {
  switch (status) {
    case 'PUBLISH':
      return '发布成功';
    case 'SCHEDULED':
      return '已定时,到点自动发布';
    case 'UN_PUBLISH':
      return '已保存为草稿';
    default:
      return '已提交审核,通过后自动发布';
  }
}

export function useContentForm<TPayload = Record<string, unknown>>(
  opts: UseContentFormOptions<TPayload>,
): UseContentFormReturn<TPayload> {
  const {
    maxTitle = 30,
    maxDesc = 200,
    validate,
    buildPayload,
    redirectOnSuccess = true,
    onSuccess,
    requireTitle = true,
    requireDesc = false,
  } = opts;

  const [title, setTitleRaw] = useState('');
  const [desc, setDescRaw] = useState('');
  const [tags, setTagsRaw] = useState('');
  // 定价(分):0 = 免费。freeItems 仅对章节/分集类内容有意义。
  const [price, setPrice] = useState(0);
  const [freeItems, setFreeItems] = useState(0);
  // 定时发布(毫秒时间戳):0 = 立即发布。
  const [publishAt, setPublishAt] = useState(0);

  const setTitle = useCallback(
    (v: string) => setTitleRaw(maxTitle > 0 ? v.slice(0, maxTitle) : v),
    [maxTitle],
  );
  const setDesc = useCallback(
    (v: string) => setDescRaw(maxDesc > 0 ? v.slice(0, maxDesc) : v),
    [maxDesc],
  );
  const setTags = useCallback((v: string) => setTagsRaw(v), []);

  const [snack, setSnackRaw] = useState<SnackMsg | null>(null);
  const dismissSnack = useCallback(() => setSnackRaw(null), []);
  const setSnack = useCallback((s: string | SnackMsg) => {
    setSnackRaw(typeof s === 'string' ? { msg: s, severity: 'info' } : s);
  }, []);

  const createMutation = useMutation({
    mutationFn: () =>
      updateShare({
        ...(buildPayload() as object),
        price,
        freeItems: price > 0 ? freeItems : 0,
        // 0 时不传:后端把 nil/0/过去的时刻一律当立即发布,少一个字段少一层歧义。
        ...(publishAt > 0 ? { publishAt } : {}),
      } as any),
  });

  // canSubmit 不包含 validate 校验结果(validate 由各 view 在 setState 后
  // 自己判断);只检查通用字段的硬性约束。
  const canSubmit = useMemo(() => {
    if (createMutation.isPending) return false;
    if (requireTitle && !title.trim()) return false;
    if (requireDesc && !desc.trim()) return false;
    return true;
  }, [createMutation.isPending, requireTitle, requireDesc, title, desc]);

  const submit = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    const validationError = validate();
    if (validationError) {
      setSnack({ msg: validationError, severity: 'warning' });
      return { ok: false, error: validationError };
    }
    let saved: { status?: string } | undefined;
    try {
      // 拦截器已经把 body.data 剥出来了,再取一层 .data 永远是 undefined ——
      // 在此之前不论发布成功还是定时成功,提示都落到「已提交审核」那个兜底分支。
      saved = (await createMutation.mutateAsync()) as { status?: string } | undefined;
    } catch (e: any) {
      if (isAuthError(e)) {
        setSnack({ msg: '请重新登录', severity: 'error' });
      } else if (isNetworkError(e)) {
        setSnack({ msg: '网络错误,请检查连接后重试', severity: 'error' });
      } else {
        setSnack({ msg: `发布失败:${formatApiError(e)}`, severity: 'error' });
      }
      return { ok: false, error: e?.message };
    }
    setSnack({ msg: savedMessage(saved?.status), severity: 'success' });
    if (onSuccess) {
      onSuccess();
    } else if (redirectOnSuccess) {
      // Fallback:view 没传 onSuccess 时,主动派发一个自定义事件让宿主跳回工作台。
      // PublishForms/ 的 ImageForm 等都传 onSuccess,这里兜底给忘记传的人。
      window.dispatchEvent(new CustomEvent('creator-content:form-success'));
    }
    return { ok: true };
  }, [validate, createMutation, setSnack, onSuccess, redirectOnSuccess]);

  const renderPricing = useCallback(
    (o?: { serial?: boolean }) => (
      <PricingFields
        price={price}
        onPriceChange={setPrice}
        freeItems={freeItems}
        onFreeItemsChange={setFreeItems}
        serial={o?.serial}
      />
    ),
    [price, freeItems],
  );

  const renderSchedule = useCallback(
    () => <ScheduleFields publishAt={publishAt} onChange={setPublishAt} />,
    [publishAt],
  );

  // 公开的 snack 渲染器(view 末尾放 {f.renderSnackbar()})
  const renderSnackbar = useCallback(
    () => (
      <Snackbar
        open={!!snack}
        autoHideDuration={snack?.severity === 'error' ? 5000 : 2400}
        onClose={dismissSnack}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {snack ? (
          <Alert
            severity={snack.severity}
            variant="filled"
            onClose={dismissSnack}
            sx={{ width: '100%' }}
          >
            {snack.msg}
          </Alert>
        ) : undefined}
      </Snackbar>
    ),
    [snack, dismissSnack],
  );

  return {
    title,
    setTitle,
    desc,
    setDesc,
    tags,
    setTags,
    submit,
    isPending: createMutation.isPending,
    canSubmit,
    renderPricing,
    renderSchedule,
    snack,
    setSnack,
    dismissSnack,
    renderSnackbar,
  };
}

// 辅助:tag 字符串标准化(逗号/空格分隔,去重,转小写逗号)
export function normalizeTags(raw: string, max = 8): string {
  return raw
    .split(/[,，\s]+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, max)
    .join(',');
}

// 辅助:单文件上传 /file/upload(返回 URL 或 null)
export async function uploadOneFile(file: File): Promise<string | null> {
  const formData = new FormData();
  formData.append('file', file);
  try {
    const res: any = await accountClient.post('/file/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res?.url ?? null;
  } catch {
    return null;
  }
}
