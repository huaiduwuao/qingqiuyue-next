'use client';

import React, { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { TemplateEditorDialog } from '@/components/spider/TemplateEditorDialog';

// 路由 /system/spider/templates/edit?id=<module_template.id>。用 query 而不是路径参数:
// 生产是 output:'export' 静态导出,动态段必须有 generateStaticParams 才能导出,
// 而模板 id 是运行时数据,枚举不出来。全站其它详情页同样走 ?id=。
export default function TemplateEditPage() {
  return (
    <Suspense fallback={null}>
      <TemplateEdit />
    </Suspense>
  );
}

function TemplateEdit() {
  const router = useRouter();
  const templateId = Number(useSearchParams().get('id'));
  const [open, setOpen] = useState(true);

  if (!Number.isFinite(templateId) || templateId <= 0) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">无效模板 id。</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => router.push('/system/spider/templates')}
        >
          返回模板列表
        </Button>
        <Typography variant="h6">模板编辑(id={templateId})</Typography>
      </Box>
      <Typography variant="body2" color="text.secondary">
        此页面打开时立即弹出编辑对话框(后续需要嵌入 Table 复用);站点无关:
        任何 module_template 行都能进这里,改的是它的 content JSON。
      </Typography>
      <TemplateEditorDialog
        open={open}
        templateId={templateId}
        onClose={() => setOpen(false)}
        onSaved={() => router.push('/system/spider/templates')}
      />
    </Box>
  );
}
