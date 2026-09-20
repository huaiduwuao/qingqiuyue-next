'use client';

/**
 * 通用模板编辑对话框 —— 站点无关。
 *
 * 思路:TemplateConfig 的所有可配字段都在这里;每个字段是一个分块,运营改的
 * 全部是数据,不写死任何站点的选择器 / 字段路径 / JS 脚本。"通用面板 + 自由
 * JSON" 两边都能改,保存后只对单行 module_template.content 做 PUT,不影响其他行。
 */

import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Alert from '@mui/material/Alert';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  getTemplateDetail,
  updateTemplate,
  type TemplateUpdate,
} from '@/apis/spider';
import type { TemplateDetail } from '@/beans/spider';

export interface TemplateEditorDialogProps {
  open: boolean;
  templateId: number | null;
  onClose: () => void;
  onSaved?: (id: number) => void;
}

interface TemplateFormState {
  name: string;
  type: string;
  contentType: string;
  browserEnabled: boolean;
  browserWaitFor: string;
  browserWaitTimeout: number;
  browserExtraWait: number;
  browserWaitNetworkIdle: boolean;
  listItemSelector: string;
  listTitleSelector: string;
  listUrlSelector: string;
  listCoverSelector: string;
  listDescSelector: string;
  listTagsSelector: string;
  detailTitleSelector: string;
  detailAuthorSelector: string;
  detailCoverSelector: string;
  detailDescSelector: string;
  detailCategorySelector: string;
  paginationEnabled: boolean;
  paginationMaxPages: number;
  paginationPageParam: string;
  paginationPageStart: number;
  paginationPageStep: number;
  crawlPolicyIntervalMs: number;
  crawlPolicyMaxPages: number;
  navSelectors: string;       // 逗号分隔
  categoryUrlPatterns: string; // 逗号分隔
  subCategorySelector: string;
  metadataSchema: string;       // JSON 字面量(对象)
  custom: string;               // JSON 字面量(对象)
  rawContent: string;            // 原始 JSON,任意字段
}

const EMPTY_FORM: TemplateFormState = {
  name: '',
  type: 'list',
  contentType: 'GENERIC',
  browserEnabled: false,
  browserWaitFor: '',
  browserWaitTimeout: 15,
  browserExtraWait: 2,
  browserWaitNetworkIdle: true,
  listItemSelector: '',
  listTitleSelector: '',
  listUrlSelector: '',
  listCoverSelector: '',
  listDescSelector: '',
  listTagsSelector: '',
  detailTitleSelector: '',
  detailAuthorSelector: '',
  detailCoverSelector: '',
  detailDescSelector: '',
  detailCategorySelector: '',
  paginationEnabled: false,
  paginationMaxPages: 20,
  paginationPageParam: 'page',
  paginationPageStart: 1,
  paginationPageStep: 1,
  crawlPolicyIntervalMs: 1000,
  crawlPolicyMaxPages: 200,
  navSelectors: '',
  categoryUrlPatterns: '',
  subCategorySelector: '',
  metadataSchema: '{}',
  custom: '{}',
  rawContent: '{}',
};

function formFromTemplate(t: TemplateDetail | any): TemplateFormState {
  const cfg = (t.content ?? {}) as any;
  const browser = cfg.browser ?? {};
  const list = cfg.list ?? cfg;
  const detail = cfg.detail ?? {};
  const meta = cfg.metadata_schema ?? {};
  const policy = cfg.crawl_policy ?? {};
  const pagination = cfg.pagination ?? {};
  const nav = cfg.nav_selectors ?? [];
  const patterns = cfg.category_url_patterns ?? [];
  const custom = cfg.custom ?? {};
  const form: TemplateFormState = {
    ...EMPTY_FORM,
    name: t.name ?? '',
    type: t.type ?? 'list',
    contentType: cfg.content_type ?? 'GENERIC',
    browserEnabled: !!browser.enabled,
    browserWaitFor: browser.wait_for ?? '',
    browserWaitTimeout: Number(browser.wait_timeout ?? 15),
    browserExtraWait: Number(browser.extra_wait ?? 2),
    browserWaitNetworkIdle: !!browser.wait_network_idle,
    listItemSelector: list.list_item_selector ?? '',
    listTitleSelector: list.list_title_selector ?? '',
    listUrlSelector: list.list_url_selector ?? '',
    listCoverSelector: list.list_cover_selector ?? '',
    listDescSelector: list.list_desc_selector ?? '',
    listTagsSelector: list.list_tags_selector ?? '',
    detailTitleSelector: detail.detail_title_selector ?? '',
    detailAuthorSelector: detail.detail_author_selector ?? '',
    detailCoverSelector: detail.detail_cover_selector ?? '',
    detailDescSelector: detail.detail_desc_selector ?? '',
    detailCategorySelector: detail.detail_category_selector ?? '',
    paginationEnabled: !!pagination.enabled,
    paginationMaxPages: Number(pagination.max_pages ?? 20),
    paginationPageParam: pagination.page_param ?? 'page',
    paginationPageStart: Number(pagination.page_start ?? 1),
    paginationPageStep: Number(pagination.page_step ?? 1),
    crawlPolicyIntervalMs: Number(policy.request_interval_ms ?? 1000),
    crawlPolicyMaxPages: Number(policy.max_pages ?? 200),
    navSelectors: Array.isArray(nav) ? nav.join(',') : '',
    categoryUrlPatterns: Array.isArray(patterns) ? patterns.join(',') : '',
    subCategorySelector: cfg.sub_category_selector ?? '',
    metadataSchema: JSON.stringify(meta, null, 2),
    custom: JSON.stringify(custom, null, 2),
    rawContent: JSON.stringify(cfg, null, 2),
  };
  return form;
}

function formToContent(form: TemplateFormState): string {
  const obj: any = JSON.parse(form.rawContent || '{}');
  obj.content_type = form.contentType;
  obj.browser = {
    enabled: form.browserEnabled,
    wait_for: form.browserWaitFor,
    wait_timeout: form.browserWaitTimeout,
    extra_wait: form.browserExtraWait,
    wait_network_idle: form.browserWaitNetworkIdle,
  };
  obj.list_item_selector = form.listItemSelector;
  obj.list_title_selector = form.listTitleSelector;
  obj.list_url_selector = form.listUrlSelector;
  obj.list_cover_selector = form.listCoverSelector;
  obj.list_desc_selector = form.listDescSelector;
  obj.list_tags_selector = form.listTagsSelector;
  obj.detail_title_selector = form.detailTitleSelector;
  obj.detail_author_selector = form.detailAuthorSelector;
  obj.detail_cover_selector = form.detailCoverSelector;
  obj.detail_desc_selector = form.detailDescSelector;
  obj.detail_category_selector = form.detailCategorySelector;
  obj.pagination = {
    enabled: form.paginationEnabled,
    max_pages: form.paginationMaxPages,
    page_param: form.paginationPageParam,
    page_start: form.paginationPageStart,
    page_step: form.paginationPageStep,
    url_patterns: obj.pagination?.url_patterns ?? ['?page=', '/page/'],
    next_page_text_patterns: obj.pagination?.next_page_text_patterns ?? ['下一页', '下页', 'Next'],
  };
  obj.nav_selectors = form.navSelectors.split(',').map((s) => s.trim()).filter(Boolean);
  obj.category_url_patterns = form.categoryUrlPatterns.split(',').map((s) => s.trim()).filter(Boolean);
  obj.sub_category_selector = form.subCategorySelector;
  obj.crawl_policy = {
    request_interval_ms: form.crawlPolicyIntervalMs,
    max_pages: form.crawlPolicyMaxPages,
  };
  try {
    obj.metadata_schema = JSON.parse(form.metadataSchema);
  } catch {
    /* fall back to rawContent value, validation UI 提前报了 */
  }
  try {
    obj.custom = JSON.parse(form.custom);
  } catch {
    /* fall back to rawContent value */
  }
  return JSON.stringify(obj, null, 2);
}

export function TemplateEditorDialog({ open, templateId, onClose, onSaved }: TemplateEditorDialogProps) {
  const qc = useQueryClient();
  const [form, setForm] = useState<TemplateFormState>(EMPTY_FORM);
  const [parsingError, setParsingError] = useState<string>('');

  const detailQuery = useQuery({
    queryKey: ['spider', 'template', templateId],
    queryFn: () => getTemplateDetail(templateId!),
    enabled: open && templateId !== null,
    staleTime: 60 * 1000,
  });

  useEffect(() => {
    if (detailQuery.data) {
      // TemplateDetail 在 beans/spider.d.ts 里只暴露元数据;
      // 后端 GET /templates/:id 实际也带 content(后端 toDTO),这里用 any 拿到。
      setForm(formFromTemplate(detailQuery.data as any));
      setParsingError('');
    }
  }, [detailQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async (body: TemplateUpdate) => updateTemplate(templateId!, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['spider', 'templates'] });
      qc.invalidateQueries({ queryKey: ['spider', 'template', templateId] });
      onSaved?.(templateId!);
    },
  });

  const onSave = () => {
    let rawContent: string;
    try {
      JSON.parse(form.metadataSchema);
    } catch (e: any) {
      setParsingError(`metadata_schema 不是合法 JSON:${e.message ?? e}`);
      return;
    }
    try {
      JSON.parse(form.custom);
    } catch (e: any) {
      setParsingError(`custom 不是合法 JSON:${e.message ?? e}`);
      return;
    }
    rawContent = formToContent(form);
    saveMutation.mutate({ name: form.name, type: form.type, source: String(templateId), content: rawContent });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>模板内容编辑 (id={templateId ?? '-'})</DialogTitle>
      <DialogContent dividers>
        {detailQuery.isLoading ? (
          <Typography variant="body2" color="text.secondary">加载中…</Typography>
        ) : detailQuery.isError ? (
          <Alert severity="error">模板加载失败:{(detailQuery.error as any)?.message}</Alert>
        ) : (
          <Stack sx={{ gap: 2 }}>
            {parsingError && <Alert severity="error">{parsingError}</Alert>}
            <Typography variant="caption" color="text.secondary">
              这里是站点无关的"通用面板 + 自由 JSON"双轨编辑。面板里改任何字段等同于改 rawContent;rawContent 里也能加任意字段(比如 custom 下的 list_extractor_script / detail_extractor_script)。
              保存只影响这一行 module_template.content,不会动其他源/模板。
            </Typography>

            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle2">基础</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Stack sx={{ gap: 2 }}>
                  <TextField label="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  <TextField label="type (list / detail / category)" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} />
                  <TextField
                    label="content_type"
                    helperText="模版负责的内容类型;按 contracts/content_type.yaml 规范大写"
                    value={form.contentType}
                    onChange={(e) => setForm({ ...form, contentType: e.target.value })}
                  />
                </Stack>
              </AccordionDetails>
            </Accordion>

            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle2">浏览器(browser.*)</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Stack sx={{ gap: 2 }}>
                  <FormControlLabel
                    control={<Switch checked={form.browserEnabled} onChange={(_, v) => setForm({ ...form, browserEnabled: v })} />}
                    label="启用(JS 渲染 / 反爬绕过)"
                  />
                  <TextField label="wait_for (CSS 选择器)" value={form.browserWaitFor} onChange={(e) => setForm({ ...form, browserWaitFor: e.target.value })} />
                  <TextField label="wait_timeout (秒)" type="number" value={form.browserWaitTimeout} onChange={(e) => setForm({ ...form, browserWaitTimeout: parseInt(e.target.value || '0', 10) })} />
                  <TextField label="extra_wait (秒)" type="number" value={form.browserExtraWait} onChange={(e) => setForm({ ...form, browserExtraWait: parseInt(e.target.value || '0', 10) })} />
                  <FormControlLabel
                    control={<Switch checked={form.browserWaitNetworkIdle} onChange={(_, v) => setForm({ ...form, browserWaitNetworkIdle: v })} />}
                    label="wait_network_idle"
                  />
                </Stack>
              </AccordionDetails>
            </Accordion>

            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle2">列表页选择器</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Stack sx={{ gap: 2 }}>
                  {[
                    ['listItemSelector', 'list_item_selector'],
                    ['listTitleSelector', 'list_title_selector'],
                    ['listUrlSelector', 'list_url_selector'],
                    ['listCoverSelector', 'list_cover_selector'],
                    ['listDescSelector', 'list_desc_selector'],
                    ['listTagsSelector', 'list_tags_selector'],
                  ].map(([k, label]) => (
                    <TextField
                      key={k}
                      label={label}
                      value={(form as any)[k]}
                      onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                    />
                  ))}
                  <TextField
                    label="nav_selectors (逗号分隔)"
                    multiline
                    rows={2}
                    value={form.navSelectors}
                    onChange={(e) => setForm({ ...form, navSelectors: e.target.value })}
                  />
                  <TextField
                    label="category_url_patterns (逗号分隔)"
                    multiline
                    rows={2}
                    value={form.categoryUrlPatterns}
                    onChange={(e) => setForm({ ...form, categoryUrlPatterns: e.target.value })}
                  />
                  <TextField label="sub_category_selector" value={form.subCategorySelector} onChange={(e) => setForm({ ...form, subCategorySelector: e.target.value })} />
                </Stack>
              </AccordionDetails>
            </Accordion>

            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle2">详情页选择器</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Stack sx={{ gap: 2 }}>
                  {[
                    ['detailTitleSelector', 'detail_title_selector'],
                    ['detailAuthorSelector', 'detail_author_selector'],
                    ['detailCoverSelector', 'detail_cover_selector'],
                    ['detailDescSelector', 'detail_desc_selector'],
                    ['detailCategorySelector', 'detail_category_selector'],
                  ].map(([k, label]) => (
                    <TextField
                      key={k}
                      label={label}
                      value={(form as any)[k]}
                      onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                    />
                  ))}
                </Stack>
              </AccordionDetails>
            </Accordion>

            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle2">翻页 / 礼貌策略</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Stack sx={{ gap: 2 }}>
                  <FormControlLabel
                    control={<Switch checked={form.paginationEnabled} onChange={(_, v) => setForm({ ...form, paginationEnabled: v })} />}
                    label="启用翻页"
                  />
                  <Stack direction="row" sx={{ gap: 2 }}>
                    <TextField label="pagination.max_pages" type="number" value={form.paginationMaxPages} onChange={(e) => setForm({ ...form, paginationMaxPages: parseInt(e.target.value || '0', 10) })} />
                    <TextField label="page_param" value={form.paginationPageParam} onChange={(e) => setForm({ ...form, paginationPageParam: e.target.value })} />
                    <TextField label="page_start" type="number" value={form.paginationPageStart} onChange={(e) => setForm({ ...form, paginationPageStart: parseInt(e.target.value || '0', 10) })} />
                    <TextField label="page_step" type="number" value={form.paginationPageStep} onChange={(e) => setForm({ ...form, paginationPageStep: parseInt(e.target.value || '0', 10) })} />
                  </Stack>
                  <Divider />
                  <Stack direction="row" sx={{ gap: 2 }}>
                    <TextField label="request_interval_ms" type="number" value={form.crawlPolicyIntervalMs} onChange={(e) => setForm({ ...form, crawlPolicyIntervalMs: parseInt(e.target.value || '0', 10) })} />
                    <TextField label="max_pages" type="number" value={form.crawlPolicyMaxPages} onChange={(e) => setForm({ ...form, crawlPolicyMaxPages: parseInt(e.target.value || '0', 10) })} />
                  </Stack>
                </Stack>
              </AccordionDetails>
            </Accordion>

            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle2">详情 metadata_schema 与 custom</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Stack sx={{ gap: 2 }}>
                  <TextField
                    label="metadata_schema (JSON object)"
                    helperText="title / author / cover / description / tags / duration / 等字段路径"
                    multiline
                    rows={6}
                    value={form.metadataSchema}
                    onChange={(e) => setForm({ ...form, metadataSchema: e.target.value })}
                  />
                  <TextField
                    label="custom (JSON object)"
                    helperText="任意扩展键,例如 list_extractor_script / detail_extractor_script"
                    multiline
                    rows={6}
                    value={form.custom}
                    onChange={(e) => setForm({ ...form, custom: e.target.value })}
                  />
                </Stack>
              </AccordionDetails>
            </Accordion>

            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle2">原始 JSON(content)</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <TextField
                  label="rawContent(JSON;同步面板与 rawContent)"
                  multiline
                  minRows={10}
                  maxRows={24}
                  value={form.rawContent}
                  onChange={(e) => setForm({ ...form, rawContent: e.target.value })}
                  helperText="面板修改会写回这里;这里加键能让 selector / custom / 等任意字段被覆盖"
                />
              </AccordionDetails>
            </Accordion>

            {saveMutation.isError && (
              <Alert severity="error">保存失败:{(saveMutation.error as any)?.message}</Alert>
            )}
            {saveMutation.isSuccess && <Alert severity="success">已保存</Alert>}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saveMutation.isPending}>关闭</Button>
        <Button variant="contained" onClick={onSave} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? '保存中…' : '保存'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
