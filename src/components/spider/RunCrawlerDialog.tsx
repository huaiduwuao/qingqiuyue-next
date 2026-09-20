'use client';

/**
 * 通用爬取触发对话框 —— 站点无关,任何 module_source 都能从这里启动。
 *
 * 输入:source_domain (必填或从下拉里选)、max_pages、max_items、notes
 * 动作:POST /api/spider/sites/full-site,创建 batch_job + batch_source 并启动 RuleEngine。
 * 结果:返回 batch_id,回调 onSuccess 让调用方跳转 /batch/[id]/stats 看实时进度。
 *
 * 反复使用点:
 *   - spider/run/page.tsx:完整页面(列表 + dialog)
 *   - spider-dashboard/page.tsx:顶栏 quick action
 *   - sources/[id]/page.tsx:某个源详情页的"运行"按钮
 */

import React, { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import Autocomplete from '@mui/material/Autocomplete';
import {
  startFullSite,
  listSources,
  type StartFullSiteParams,
  type StartFullSiteResult,
} from '@/apis/spider';

export interface RunCrawlerDialogProps {
  open: boolean;
  /** 默认 source_domain(其他页面"运行此源"按钮进来时预设) */
  defaultSourceDomain?: string;
  /** 任意 source_domain;提交时覆盖 defaultSourceDomain 优先生效 */
  fixedSourceDomain?: string;
  onClose: () => void;
  /** 启动成功后回调 batch_id + source_id,默认行为是跳 /batch/[batchId]/stats */
  onSuccess?: (batchId: number, sourceId: number) => void;
}

export function RunCrawlerDialog({
  open,
  defaultSourceDomain,
  fixedSourceDomain,
  onClose,
  onSuccess,
}: RunCrawlerDialogProps) {
  const [sourceDomain, setSourceDomain] = useState<string>(defaultSourceDomain ?? '');
  const [maxPages, setMaxPages] = useState<number>(0);
  const [maxItems, setMaxItems] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');

  useEffect(() => {
    if (open) {
      setSourceDomain(fixedSourceDomain ?? defaultSourceDomain ?? '');
      setMaxPages(0);
      setMaxItems(0);
      setNotes('');
    }
  }, [open, fixedSourceDomain, defaultSourceDomain]);

  const sourcesQuery = useQuery({
    queryKey: ['spider', 'run', 'sources'],
    queryFn: () => listSources({ page: 1, pageSize: 200 }),
    enabled: open && !fixedSourceDomain,
    staleTime: 30 * 1000,
  });

  const startMutation = useMutation({
    mutationFn: async (params: StartFullSiteParams) => startFullSite(params),
    onSuccess: (res: StartFullSiteResult) => {
      if (res.success) {
        onSuccess?.(res.batch_id, res.source_id);
      }
    },
  });

  const submit = () => {
    if (!sourceDomain.trim()) return;
    startMutation.mutate({
      source_domain: sourceDomain.trim(),
      max_pages: maxPages || 0,
      max_items: maxItems || 0,
      notes: notes.trim() || undefined,
    });
  };

  const sourceOptions = (sourcesQuery.data?.list ?? []) as Array<{ id: number; name: string; domain: string; category: string; status: number }>;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>运行通用爬虫</DialogTitle>
      <DialogContent dividers>
        <Stack sx={{ gap: 2 }}>
          <Alert severity="info">
            站点无关 — 任何在 module_source 里已注册的域名都能从这里启动,后端按域名自动找源,
            创建 batch_job 并走标准 RuleEngine 全站爬取流程。
          </Alert>

          {fixedSourceDomain ? (
            <TextField
              label="目标域名"
              value={fixedSourceDomain}
              disabled
              helperText="由调用方锁定"
            />
          ) : (
            <Autocomplete
              freeSolo
              options={sourceOptions.map((s) => s.domain)}
              value={sourceDomain}
              onChange={(_, v) => setSourceDomain(v ?? '')}
              onInputChange={(_, v) => setSourceDomain(v)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="选择已注册源 / 输入域名"
                  placeholder="例如 www.example.com"
                  helperText={
                    sourcesQuery.isLoading
                      ? '加载源列表…'
                      : `${sourceOptions.length} 个已注册源可选,或者直接输入新域名`
                  }
                  slotProps={{
                    input: {
                      endAdornment: sourcesQuery.isLoading ? (
                        <CircularProgress color="inherit" size={16} />
                      ) : null,
                    },
                  }}
                />
              )}
            />
          )}

          <TextField
            label="任务页数预算(max_pages)"
            type="number"
            value={maxPages}
            onChange={(e) => setMaxPages(parseInt(e.target.value || '0', 10))}
            helperText="0 = 走 module_template.crawl_policy.max_pages;非 0 时取较小者"
            slotProps={{ htmlInput: { min: 0, max: 10000 } }}
          />

          <TextField
            label="最大条目(max_items)"
            type="number"
            value={maxItems}
            onChange={(e) => setMaxItems(parseInt(e.target.value || '0', 10))}
            helperText="0 = 不限;Soft cap,实际可能略多(详情是异步落)"
            slotProps={{ htmlInput: { min: 0, max: 100000 } }}
          />

          <TextField
            label="备注"
            multiline
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="例如:首次入库 / 验证页面重构 / 营销活动预热"
          />

          {startMutation.isError && (
            <Alert severity="error">
              启动失败:{(startMutation.error as any)?.message ?? '未知错误'}
            </Alert>
          )}
          {startMutation.data && !startMutation.data.success && (
            <Alert severity="warning">
              batch 已创建,启动可能异常:{startMutation.data.message}
            </Alert>
          )}
          {startMutation.data?.success && (
            <Alert severity="success">
              启动成功 — batch_id = {startMutation.data.batch_id},source = {startMutation.data.source_name}
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={startMutation.isPending}>取消</Button>
        <Button
          variant="contained"
          onClick={submit}
          disabled={!sourceDomain.trim() || startMutation.isPending}
          startIcon={startMutation.isPending ? <CircularProgress size={16} /> : undefined}
        >
          {startMutation.isPending ? '提交中…' : '启动爬取'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
