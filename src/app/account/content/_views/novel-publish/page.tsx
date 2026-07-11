'use client';

import React from 'react';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import { useActiveTab } from '../../ActiveTabContext';
import { gradient2 } from '@/constants/gradients';
import PlaceholderShell from '../../_components/PlaceholderShell';

/**
 * 小说发布 (NOVEL) — 骨架页。
 *
 * 计划字段:书名 / 简介 / 封面 / 标签 / 章节列表(每章独立标题 + 正文),
 * 支持连载 / 完结状态、单本字数 100k+、目录大纲、VIP 章节等。
 *
 * 当前 placeholder — 显示开发中提示 + 回退入口。
 */
export default function NovelPublishPage() {
  const { setActiveTab } = useActiveTab();
  return (
    <PlaceholderShell
      title="发布小说"
      subtitle="NOVEL contentType"
      gradient={gradient2('#A78BFA', '#DDD6FE')}
      icon={<MenuBookRoundedIcon sx={{ fontSize: 44 }} />}
      desc={
        <>
          小说发布支持 100k+ 长文本连载、章节独立编辑、目录大纲、VIP
          付费章节、读者书签互动。
          <br />
          本入口暂未开放,先体验下方其他类型。
        </>
      }
      setActiveTab={setActiveTab}
    />
  );
}
