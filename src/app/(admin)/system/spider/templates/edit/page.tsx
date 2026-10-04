'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import TemplateEditor from '@/components/spider/template-editor/TemplateEditor';

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
  const templateId = Number(useSearchParams().get('id'));

  if (!Number.isFinite(templateId) || templateId <= 0) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">无效模板 id。</Alert>
      </Box>
    );
  }

  // key:同页切换 ?id= 时整份编辑态重来
  return <TemplateEditor key={templateId} templateId={templateId} />;
}
