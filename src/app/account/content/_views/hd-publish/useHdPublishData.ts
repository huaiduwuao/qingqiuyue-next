'use client';

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getHdVideoList } from '@/apis/dashboard';
import { managePage, setContentCover, updateShare, type ModuleContentItem } from '@/apis/module-content';
import { accountClient, formatApiError } from '@/lib/api/client';
import { gradient3 } from '@/constants/gradients';
import type { SavedContent } from '../../_components/useContentForm';
import { REVIEW_CHECK_TEMPLATE, type AudioTrack, type HdResolution, type HdVideo, type SubtitleTrack } from './data';
import {
  applyHdOps,
  dedupeHdVideos,
  liveHdOps,
  mergeServerHdVideos,
  type HdPendingOp,
  type HdSyncMark,
  type SnackMsg,
  type UploadStatus,
} from './hdPublishModel';

type SetSnack = (s: string | SnackMsg) => void;

export const HD_VIDEOS_QUERY_KEY = ['creator-hd-videos'] as const;
export const HD_MANAGE_VIDEOS_QUERY_KEY = ['module-content', 'hd-publish', 'videos'] as const;

type NewHdOp =
  | { kind: 'remove'; videoId: string }
  | { kind: 'update'; videoId: string; apply: (v: HdVideo) => HdVideo };

/** 封面图片走现有的文件上传接口(与视频上传同一个),返回图片地址。 */
export async function uploadCoverImage(image: Blob, fileName: string): Promise<string | undefined> {
  const formData = new FormData();
  formData.append('file', image, fileName);
  const res = await accountClient.post('/file/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  // 拦截器已剥到业务层,返回值就是 {url}
  const url = (res as { url?: string } | undefined)?.url;
  return typeof url === 'string' && url.trim() ? url.trim() : undefined;
}

/**
 * 视频列表:HD 视频接口 + 管理列表里的 VIDEO 内容合并去重(mergeServerHdVideos),外加删除 /
 * 重新转码 / 立即发布 / 极速送审 / 重新送审这些乐观更新的操作(失败回滚)。
 *
 * 列表每次都由「服务端数据 + 未落定的本地改动」现算(见 HdPendingOp):服务端数据一变
 * (哪怕条数没变、只是审核状态变了)统计卡片和打开着的详情抽屉都跟着变;进行中的乐观改动
 * 叠在上面不会被重新拉到的旧数据冲掉;失败时撤掉改动就露出服务端的真实状态。
 * 此前本地 state 只在条数变化时才同步,状态变了界面一直停在旧值。
 */
export function useHdVideos(setSnack: SetSnack) {
  const queryClient = useQueryClient();
  // 真接口:HD 视频列表(uid 隔离)
  const hdQuery = useQuery({
    queryKey: HD_VIDEOS_QUERY_KEY,
    queryFn: () => getHdVideoList({ page: 1, pageSize: 50 }),
    staleTime: 30 * 1000,
    refetchOnMount: 'always',
  });
  // 管理列表:按数据权限过滤(默认只看自己的),含待审/驳回/已上线的视频
  const manageQuery = useQuery({
    queryKey: HD_MANAGE_VIDEOS_QUERY_KEY,
    queryFn: async () => {
      const res = await managePage({ contentType: 'VIDEO', pageSize: 100 });
      return (res.list || []) as ModuleContentItem[];
    },
    staleTime: 30_000,
    refetchOnMount: 'always',
  });
  const hdList = hdQuery.data?.list;
  const manageList = manageQuery.data;
  // 按 id 去重:后端 /creator/hd/videos 偶发返回两条同 id 的记录,会触发 React duplicate key
  // 警告,严重时 fiber 错位渲染(见 dedupeHdVideos)。
  const serverVideos = useMemo(
    () => mergeServerHdVideos(dedupeHdVideos(hdList), manageList),
    [hdList, manageList],
  );
  // 两路数据各自落定(拿到数据或失败)过几次;改动确认之后两路都再落定过,才算被服务端覆盖。
  const settleCount = useCallback(
    (key: readonly unknown[]) => {
      const st = queryClient.getQueryState(key);
      return st ? st.dataUpdateCount + st.errorUpdateCount : 0;
    },
    [queryClient],
  );
  const synced = useMemo<HdSyncMark>(
    () => ({ hd: settleCount(HD_VIDEOS_QUERY_KEY), manage: settleCount(HD_MANAGE_VIDEOS_QUERY_KEY) }),
    // 时间戳只当触发器:任一路落定一次(哪怕数据和上次一样、data 引用没变)它们就变,重新数一遍。
    // 读它们也让 useQuery 订阅这几个字段,重拉到相同数据时组件照样重渲染。
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [settleCount, hdQuery.dataUpdatedAt, hdQuery.errorUpdatedAt, manageQuery.dataUpdatedAt, manageQuery.errorUpdatedAt],
  );
  const markNow = useCallback(
    (): HdSyncMark => ({ hd: settleCount(HD_VIDEOS_QUERY_KEY), manage: settleCount(HD_MANAGE_VIDEOS_QUERY_KEY) }),
    [settleCount],
  );

  const [ops, setOps] = useState<HdPendingOp[]>([]);
  const opSeqRef = useRef(0);
  // 已被服务端覆盖的改动不再叠加(落定次数只增不减,排除后不会再回来);state 里的旧条目在下次加改动时顺手清掉
  const liveOps = useMemo(() => liveHdOps(ops, synced), [ops, synced]);
  const videos = useMemo(() => applyHdOps(serverVideos, liveOps), [serverVideos, liveOps]);

  const refetchServer = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: HD_VIDEOS_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: HD_MANAGE_VIDEOS_QUERY_KEY });
  }, [queryClient]);

  /** 先叠上乐观改动再发请求:成功则等服务端刷新后撤掉改动,失败立即撤掉(回滚)。返回是否成功。 */
  const runOptimistic = useCallback(
    async <T,>(op: NewHdOp, request: () => Promise<T>, okMsg: string | ((res: T) => string), failMsg: string) => {
      const opId = ++opSeqRef.current;
      setOps((p) => [...liveHdOps(p, markNow()), { ...op, opId } as HdPendingOp]);
      let res: T;
      try {
        res = await request();
      } catch (e) {
        setOps((p) => p.filter((o) => o.opId !== opId));
        setSnack(`${failMsg}:${formatApiError(e)}`);
        return false;
      }
      const confirmedAt = markNow();
      setOps((p) => p.map((o) => (o.opId === opId ? { ...o, confirmedAt } : o)));
      refetchServer();
      setSnack(typeof okMsg === 'function' ? okMsg(res) : okMsg);
      return true;
    },
    [markNow, refetchServer, setSnack],
  );

  /** 刚创建好的视频先放进列表,等服务端列表拉到它为止 */
  const addVideo = useCallback(
    (video: HdVideo) => {
      const opId = ++opSeqRef.current;
      const confirmedAt = markNow();
      setOps((p) => [...liveHdOps(p, confirmedAt), { opId, kind: 'add', videoId: video.id, video, confirmedAt }]);
      refetchServer();
    },
    [markNow, refetchServer],
  );

  const [fastChannelQuota, setFastChannelQuota] = useState(5); // 每月极速通道剩余

  const handleDelete = useCallback(
    (id: string) =>
      runOptimistic(
        { kind: 'remove', videoId: id },
        () => accountClient.delete(`/account/content/${id}`),
        '已删除',
        '删除失败',
      ),
    [runOptimistic],
  );
  const handleRetry = useCallback(
    (id: string) =>
      runOptimistic(
        {
          kind: 'update',
          videoId: id,
          apply: (v) => ({ ...v, status: 'transcoding', progress: 0, failedReason: undefined }),
        },
        () => accountClient.post(`/account/content/${id}/transcode`),
        '已重新提交转码',
        '重新转码失败',
      ),
    [runOptimistic],
  );
  const handlePublishNow = useCallback(
    (id: string) =>
      runOptimistic(
        { kind: 'remove', videoId: id },
        () => accountClient.post(`/account/content/${id}/publish`),
        '已立即发布',
        '发布失败',
      ),
    [runOptimistic],
  );

  const handleFastTrackReview = useCallback(
    async (id: string) => {
      if (fastChannelQuota <= 0) {
        setSnack('本月极速通道已用完,下月 1 日恢复');
        return false;
      }
      setFastChannelQuota((q) => q - 1);
      const ok = await runOptimistic(
        {
          kind: 'update',
          videoId: id,
          apply: (v) =>
            v.review
              ? { ...v, review: { ...v.review, useFastChannel: true, fastChannelChargedAt: Date.now() } }
              : v,
        },
        () => accountClient.post(`/account/content/${id}/fasttrack`),
        '已启用极速通道,审核将优先处理',
        '极速送审失败',
      );
      if (!ok) setFastChannelQuota((q) => q + 1);
      return ok;
    },
    [fastChannelQuota, runOptimistic, setSnack],
  );

  const handleResubmitReview = useCallback(
    (id: string) => {
      const startedAt = Date.now();
      return runOptimistic(
        {
          kind: 'update',
          videoId: id,
          apply: (v) => ({
            ...v,
            status: 'reviewing',
            failedStage: undefined,
            failedReason: undefined,
            review: {
              ...v.review,
              checks: REVIEW_CHECK_TEMPLATE.map((c) => ({ ...c, status: 'pending' as const })),
              startedAt,
            },
          }),
        },
        () => accountClient.post(`/account/content/${id}/review`),
        '已重新提交审核',
        '重新送审失败',
      );
    },
    [runOptimistic],
  );

  /** 换封面:先在界面上换掉,后端只改封面一列(setContentCover);失败换回原来的。 */
  const handleSetCover = useCallback(
    (id: string, coverUrl: string) =>
      runOptimistic(
        { kind: 'update', videoId: id, apply: (v) => ({ ...v, cover: coverUrl, hasCover: true }) },
        () => setContentCover(id, coverUrl),
        (res) =>
          String(res?.status ?? '').toUpperCase() === 'REVIEWING' &&
          videos.find((v) => v.id === id)?.status === 'published'
            ? '封面已保存,视频重新进入审核'
            : '封面已保存',
        '封面保存失败',
      ),
    [runOptimistic, videos],
  );

  /** 换封面弹窗的「保存」:先把图片(截帧或本地图)传到文件上传接口,再调后端保存封面。返回是否成功。 */
  const saveCover = useCallback(
    async (id: string, image: Blob, fileName: string) => {
      let url: string | undefined;
      try {
        url = await uploadCoverImage(image, fileName);
      } catch (e) {
        setSnack({ msg: `封面上传失败:${formatApiError(e)}`, severity: 'error' });
        return false;
      }
      if (!url) {
        setSnack({ msg: '封面上传成功但没有返回地址,请重试', severity: 'error' });
        return false;
      }
      return handleSetCover(id, url);
    },
    [handleSetCover, setSnack],
  );

  return {
    videos,
    addVideo,
    handleSetCover,
    saveCover,
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
  addVideo,
  onPublished: handlePublished,
}: {
  setSnack: SetSnack;
  /** 新建好的视频先放进列表(useHdVideos().addVideo) */
  addVideo: (video: HdVideo) => void;
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
    // 用服务端返回的作品 id,列表重新拉到这条时自然合并,不会出现一真一假两条
    const savedId = saved && typeof saved === 'object' && saved.id !== undefined && saved.id !== null ? String(saved.id) : '';
    const newItem: HdVideo = {
      id: /^[1-9]d*$/.test(savedId) ? savedId : `hd-${Date.now()}`,
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
    addVideo(newItem);
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
  }, [uploadTitle, uploadStatus, uploadFileUrl, createUpload, uploadResolution, uploadHdr, uploadFileSizeMB, uploadAutoCover, uploadSubtitles, uploadAudios, setSnack, addVideo, resetUpload, handlePublished]);

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
