'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { getHdVideoList } from '@/apis/dashboard';
import { managePage, updateShare, type ModuleContentItem } from '@/apis/module-content';
import { accountClient, formatApiError } from '@/lib/api/client';
import { gradient3 } from '@/constants/gradients';
import type { SavedContent } from '../../_components/useContentForm';
import { REVIEW_CHECK_TEMPLATE, type AudioTrack, type HdResolution, type HdVideo, type SubtitleTrack } from './data';
import { dedupeHdVideos, moduleContentToHdVideo, type SnackMsg, type UploadStatus } from './hdPublishModel';

type SetSnack = (s: string | SnackMsg) => void;

/**
 * 视频列表:HD 视频接口 + 管理列表里的 VIDEO 内容合并去重,外加删除 / 重新转码 / 立即发布 /
 * 极速送审 / 重新送审这些乐观更新的操作(失败回滚)。
 */
export function useHdVideos(setSnack: SetSnack) {
  // 真接口:HD 视频列表(uid 隔离)
  const { data: hdResp } = useQuery({
    queryKey: ['creator-hd-videos'],
    queryFn: () => getHdVideoList({ page: 1, pageSize: 50 }),
    staleTime: 30 * 1000,
    refetchOnMount: 'always',
  });
  // 按 id 去重:后端 /creator/hd/videos 在 stale cache 命中或后端测试数据偶发会
  // 返回两条同 id 的记录(react-query staleTime 30s 内复用 cache + 后端 raw 数据
  // 重复),触发 React duplicate key 警告,严重时导致 fiber 错位渲染(用户反馈
  // 「界面下部分黑色遮罩 + 点哪都出现视频详情」)。Map 去重即可消除该现象。
  const apiVideos: HdVideo[] = dedupeHdVideos(hdResp?.list);
  const [videos, setVideos] = useState<HdVideo[]>(apiVideos);
  React.useEffect(() => {
    if (apiVideos.length) setVideos(apiVideos);
  }, [apiVideos.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const [fastChannelQuota, setFastChannelQuota] = useState(5); // 每月极速通道剩余

  // 拉取真实 VIDEO 内容并合并到本地列表(去重)
  const { data: realVideos } = useQuery({
    queryKey: ['module-content', 'hd-publish', 'videos'],
    queryFn: async () => {
      // 管理列表:按数据权限过滤(默认只看自己的),含待审/驳回的视频
      const res = await managePage({ contentType: 'VIDEO', pageSize: 100 });
      return (res.list || []) as ModuleContentItem[];
    },
    staleTime: 30_000,
    refetchOnMount: 'always',
  });

  useEffect(() => {
    if (!realVideos?.length) return;
    setVideos((prev) => {
      const existingIds = new Set(prev.map((v) => v.id));
      const mapped: HdVideo[] = realVideos
        .filter((item) => !existingIds.has(String(item.id)))
        .map(moduleContentToHdVideo);
      return [...mapped, ...prev];
    });
  }, [realVideos]);

  const handleDelete = useCallback(async (id: string) => {
    // 乐观更新:先从本地移除,失败时回滚
    const previous = videos.find((v) => v.id === id);
    setVideos((p) => p.filter((v) => v.id !== id));
    try {
      await accountClient.delete(`/account/content/${id}`);
      setSnack('已删除');
    } catch (e) {
      // 回滚本地 state
      if (previous) {
        setVideos((p) => (p.some((v) => v.id === id) ? p : [previous, ...p]));
      }
      setSnack(`删除失败:${formatApiError(e)}`);
    }
  }, [videos, setSnack]);
  const handleRetry = useCallback(async (id: string) => {
    // 乐观更新
    setVideos((p) =>
      p.map((v) => (v.id === id ? { ...v, status: 'transcoding', progress: 0, failedReason: undefined } : v)),
    );
    try {
      await accountClient.post(`/account/content/${id}/transcode`);
      setSnack('已重新提交转码');
    } catch (e) {
      // 转码任务 API 失败时回滚状态
      setVideos((p) =>
        p.map((v) => (v.id === id ? { ...v, status: 'failed' } : v)),
      );
      setSnack(`重新转码失败:${formatApiError(e)}`);
    }
  }, [setSnack]);
  const handlePublishNow = useCallback(async (id: string) => {
    // 乐观更新
    setVideos((p) => p.filter((v) => v.id !== id));
    try {
      await accountClient.post(`/account/content/${id}/publish`);
      setSnack('已立即发布');
    } catch (e) {
      // 回滚:刷新列表数据由后台 useQuery 重拉;此处提示失败
      setSnack(`发布失败:${formatApiError(e)}`);
    }
  }, [setSnack]);

  const handleFastTrackReview = useCallback(async (id: string) => {
    if (fastChannelQuota <= 0) {
      setSnack('本月极速通道已用完,下月 1 日恢复');
      return;
    }
    // 乐观更新
    setVideos((p) =>
      p.map((v) =>
        v.id === id && v.review
          ? {
              ...v,
              review: {
                ...v.review,
                useFastChannel: true,
                fastChannelChargedAt: Date.now(),
              },
            }
          : v,
      ),
    );
    setFastChannelQuota((q) => q - 1);
    try {
      await accountClient.post(`/account/content/${id}/fasttrack`);
      setSnack('已启用极速通道,审核将优先处理');
    } catch (e) {
      // 回滚
      setVideos((p) =>
        p.map((v) =>
          v.id === id && v.review
            ? {
                ...v,
                review: {
                  ...v.review,
                  useFastChannel: false,
                  fastChannelChargedAt: undefined,
                },
              }
            : v,
        ),
      );
      setFastChannelQuota((q) => q + 1);
      setSnack(`极速送审失败:${formatApiError(e)}`);
    }
  }, [fastChannelQuota, setSnack]);

  const handleResubmitReview = useCallback(async (id: string) => {
    // 乐观更新
    setVideos((p) =>
      p.map((v) =>
        v.id === id
          ? {
              ...v,
              status: 'reviewing',
              failedStage: undefined,
              failedReason: undefined,
              review: {
                ...v.review,
                checks: REVIEW_CHECK_TEMPLATE.map((c) => ({ ...c, status: 'pending' as const })),
                startedAt: Date.now(),
              },
            }
          : v,
      ),
    );
    try {
      await accountClient.post(`/account/content/${id}/review`);
      setSnack('已重新提交审核');
    } catch (e) {
      // 回滚
      setVideos((p) =>
        p.map((v) =>
          v.id === id
            ? { ...v, status: 'review_failed' }
            : v,
        ),
      );
      setSnack(`重新送审失败:${formatApiError(e)}`);
    }
  }, [setSnack]);

  return {
    videos,
    setVideos,
    fastChannelQuota,
    handleDelete,
    handleRetry,
    handlePublishNow,
    handleFastTrackReview,
    handleResubmitReview,
  };
}

/**
 * VIDEO 上传区 + 上传参数表单的全部状态和操作。状态放在页面级 hook 里(而不是表单组件里),
 * 切到别的类型再切回来时已选的文件和填好的参数还在,和拆分前一致。
 * 返回值整体 memo:页面上别的状态(提示条、申诉、详情抽屉)变化时上传表单不重渲染。
 */
export function useHdUpload({
  setSnack,
  setVideos,
  onPublished: handlePublished,
}: {
  setSnack: SetSnack;
  setVideos: React.Dispatch<React.SetStateAction<HdVideo[]>>;
  onPublished: (saved?: SavedContent) => void;
}) {
  // 上传文件状态机(用于提交按钮 disabled + 失败保护)。
  // 历史上 handleFileChange 直接调后端 /file/upload,文件未存到 state,
  // handleSubmitUpload 不知道用户有没有选过文件 → 没文件也能提交 → catch 后创建假 item。
  const [uploadFileName, setUploadFileName] = useState<string | null>(null);
  const [uploadFileSizeMB, setUploadFileSizeMB] = useState(0);
  const [uploadFileUrl, setUploadFileUrl] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle');
  // 上传代次:换文件 / 清空后,上一个文件的上传回包按代次丢弃
  const uploadSeqRef = useRef(0);
  const resetUpload = React.useCallback(() => {
    uploadSeqRef.current += 1;
    setUploadFileName(null);
    setUploadFileSizeMB(0);
    setUploadFileUrl(null);
    setUploadStatus('idle');
  }, []);

  // upload dialog state
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadResolution, setUploadResolution] = useState<HdResolution>('4K');
  const [uploadHdr, setUploadHdr] = useState(true);
  const [uploadAutoCover, setUploadAutoCover] = useState(true);
  const [uploadSubtitles, setUploadSubtitles] = useState<SubtitleTrack[]>([]);
  const [uploadAudios, setUploadAudios] = useState<AudioTrack[]>([
    { id: 'a1', label: '原声', codec: 'AAC 320kbps', isDefault: true },
  ]);
  const [newSubLang, setNewSubLang] = useState('');
  const [newSubLabel, setNewSubLabel] = useState('');

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    // 大文件上传途中又换了一个:先选的那个后回包会把它的地址填进来,
    // 页面显示的是新文件名,提交出去的却是旧视频。只认最后一次选择。
    const seq = ++uploadSeqRef.current;
    setUploadTitle((p) => p || file.name.replace(/\.[^.]+$/, ''));
    const sizeMB = (file.size / 1024 / 1024).toFixed(1);
    setUploadFileName(file.name);
    setUploadFileSizeMB(Number(sizeMB));
    setUploadStatus('uploading');
    setSnack({ msg: `已选择文件: ${sizeMB} MB,正在上传...`, severity: 'info' });
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await accountClient.post('/file/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      // 拦截器已把 {code,msg,data:{url}} 剥到业务层,返回值就是 {url}。以前读 res.data.url
      // 永远是 undefined,每个视频都上传成功却被判成「未返回文件地址」,根本提交不了。
      const url = (res as { url?: string })?.url;
      if (seq !== uploadSeqRef.current) return;
      if (url) {
        setUploadFileUrl(url);
        setUploadStatus('uploaded');
        setSnack({ msg: '文件上传成功,可以提交了', severity: 'success' });
      } else {
        // 后端 200 但没 url:视为失败,不让用户提交。
        setUploadStatus('failed');
        setSnack({ msg: '上传成功但未返回文件地址,请重试', severity: 'error' });
      }
    } catch (e) {
      if (seq !== uploadSeqRef.current) return;
      setUploadStatus('failed');
      setSnack({ msg: `文件上传失败:${formatApiError(e)}`, severity: 'error' });
    }
  }, [setSnack]);

  const handleAddSubtitle = useCallback(() => {
    if (!newSubLang || !newSubLabel) return;
    setUploadSubtitles((p) => [
      ...p,
      { id: `s${Date.now()}`, lang: newSubLang, label: newSubLabel, isDefault: p.length === 0 },
    ]);
    setNewSubLang('');
    setNewSubLabel('');
  }, [newSubLang, newSubLabel]);
  const handleRemoveSubtitle = useCallback((id: string) => {
    setUploadSubtitles((p) => p.filter((s) => s.id !== id));
  }, []);
  const handleAddAudio = useCallback(() => {
    setUploadAudios((p) => [
      ...p,
      { id: `a${Date.now()}`, label: `音轨 ${p.length + 1}`, codec: 'AAC 320kbps', isDefault: p.length === 0 },
    ]);
  }, []);
  const handleRemoveAudio = useCallback((id: string) => {
    setUploadAudios((p) => p.filter((a) => a.id !== id));
  }, []);
  const handleSetDefaultAudio = useCallback((id: string) => {
    setUploadAudios((p) => p.map((a) => ({ ...a, isDefault: a.id === id })));
  }, []);

  const createMutation = useMutation({
    mutationFn: (title: string) =>
      updateShare({
        title,
        contentType: 'VIDEO',
        status: 'reviewing',
        subtitle: `分辨率:${uploadResolution} · HDR:${uploadHdr ? '是' : '否'}`,
        content: JSON.stringify({
          videoUrl: uploadFileUrl,
          resolution: uploadResolution,
          hdr: uploadHdr,
          sizeMB: uploadFileSizeMB,
          subtitles: uploadSubtitles,
          audioTracks: uploadAudios,
        }),
      } as ModuleContentItem),
  });

  const createUpload = createMutation.mutateAsync;
  const createPending = createMutation.isPending;

  const handleSubmitUpload = useCallback(async () => {
    if (!uploadTitle.trim()) {
      setSnack({ msg: '请输入视频标题', severity: 'warning' });
      return;
    }
    // 文件上传状态机检查(历史上完全没检查过文件,导致没选文件也能提交)。
    if (uploadStatus === 'idle') {
      setSnack({ msg: '请先选择视频文件', severity: 'warning' });
      return;
    }
    if (uploadStatus === 'uploading') {
      setSnack({ msg: '文件正在上传,请稍候...', severity: 'info' });
      return;
    }
    if (uploadStatus === 'failed') {
      setSnack({ msg: '文件上传失败,请重新选择文件后重试', severity: 'error' });
      return;
    }
    if (!uploadFileUrl) {
      setSnack({ msg: '文件地址缺失,请重新选择', severity: 'error' });
      return;
    }
    let saved: SavedContent | undefined;
    try {
      // 与表单同一个 POST /module/content,返回 {id, status}(id 为十进制字符串)
      saved = (await createUpload(uploadTitle.trim())) as SavedContent | undefined;
    } catch (e: any) {
      // catch 后立即 return,不再继续往下走创建 progress:5% / sizeMB:0 的假 item —
      // 历史上假 item 加进列表但永远卡 5%,KPI 数字不变,用户感知为"界面死了"。
      setSnack({ msg: `内容创建失败:${e.message || '未知错误'}`, severity: 'error' });
      return;
    }
    const newItem: HdVideo = {
      id: `hd-${Date.now()}`,
      title: uploadTitle.trim(),
      cover: gradient3('#25F4EE', '#5DF7F2', '#8B5CF6'),
      resolution: uploadResolution,
      fps: uploadResolution === '4K' || uploadResolution === '1080P' ? 60 : 30,
      hdr: uploadHdr,
      duration: '00:00',
      sizeMB: uploadFileSizeMB,
      status: 'transcoding',
      // 进度以服务端为准,刚提交时未知
      progress: undefined,
      uploadedAt: Date.now(),
      hasCover: uploadAutoCover,
      subtitles: uploadSubtitles,
      audioTracks: uploadAudios,
    };
    setVideos((p) => [newItem, ...p]);
    setSnack({ msg: `《${newItem.title}》已加入转码队列`, severity: 'success' });
    // reset
    setUploadTitle('');
    setUploadResolution('4K');
    setUploadHdr(true);
    setUploadAutoCover(true);
    setUploadSubtitles([]);
    setUploadAudios([{ id: 'a1', label: '原声', codec: 'AAC 320kbps', isDefault: true }]);
    resetUpload();
    handlePublished(saved && typeof saved === 'object' ? saved : undefined);
  }, [uploadTitle, uploadStatus, uploadFileUrl, createUpload, uploadResolution, uploadHdr, uploadFileSizeMB, uploadAutoCover, uploadSubtitles, uploadAudios, setSnack, setVideos, resetUpload, handlePublished]);

  return useMemo(
    () => ({
      uploadFileName,
      uploadFileSizeMB,
      uploadStatus,
      resetUpload,
      uploadTitle,
      setUploadTitle,
      uploadResolution,
      setUploadResolution,
      uploadHdr,
      setUploadHdr,
      uploadAutoCover,
      setUploadAutoCover,
      uploadSubtitles,
      setUploadSubtitles,
      uploadAudios,
      setUploadAudios,
      newSubLang,
      setNewSubLang,
      newSubLabel,
      setNewSubLabel,
      handleFileChange,
      handleAddSubtitle,
      handleRemoveSubtitle,
      handleAddAudio,
      handleRemoveAudio,
      handleSetDefaultAudio,
      createPending,
      handleSubmitUpload,
    }),
    [
      uploadFileName,
      uploadFileSizeMB,
      uploadStatus,
      resetUpload,
      uploadTitle,
      uploadResolution,
      uploadHdr,
      uploadAutoCover,
      uploadSubtitles,
      uploadAudios,
      newSubLang,
      newSubLabel,
      handleFileChange,
      handleAddSubtitle,
      handleRemoveSubtitle,
      handleAddAudio,
      handleRemoveAudio,
      handleSetDefaultAudio,
      createPending,
      handleSubmitUpload,
    ],
  );
}
export type HdUploadState = ReturnType<typeof useHdUpload>;
