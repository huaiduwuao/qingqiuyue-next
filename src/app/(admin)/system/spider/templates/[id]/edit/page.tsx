'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { TemplateEditorDialog } from '@/components/spider/TemplateEditorDialog';

export default function TemplateEditPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const templateId = Number(params.id);
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
