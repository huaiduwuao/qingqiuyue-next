'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Snackbar from '@mui/material/Snackbar';
import CircularProgress from '@mui/material/CircularProgress';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { useResponsive } from '@/hooks/useResponsive';
import { homeClient } from '@/lib/api/client';
import { useContentNavigate } from '@/lib/contentRoute';
import { MAIN_TABS } from './myHomeTabs';
import { GROUP_TABS, ME_FILTER_DEFAULTS, TAB_UNIT, isMyGroup, isMyItem, type MyCollectionGroup, type MyItem } from './myHomeModel';
import { MeLoggedOut } from './MeLoggedOut';
import { MyProfileHeader } from './MyProfileHeader';
import { MyAssetLinks } from './MyAssetLinks';
import { MyMainTabBar } from './MyMainTabBar';
import { MyWorksToolbar } from './MyWorksToolbar';
import {
  AINoteListView,
  AppointmentListView,
  CollectionGridView,
  EmptyState,
  HistoryListView,
  LaterGridView,
  WorkGridView,
} from './MyListViews';
import { EditProfileDrawer } from './EditProfileDrawer';
import { CancelAppointmentDialog, QrCodeDialog } from './MyHomeDialogs';
import { useMeList, useMyHomeMutations } from './useMyHomeData';
import { ME_DRAWER_TABS } from './meDrawer';

export { ME_DRAWER_TITLES, ME_DRAWER_TABS } from './meDrawer';

/**
 * 「我的」标签页。未登录时这里以前渲染的是一张占位资料卡(昵称 —、关注 —、作品 0),
 * 看上去像"你的主页空着",而不是"你还没登录" —— 头部那个 登录 按钮因此成了移动端
 * 唯一能看见的登录入口。现在未登录直接给登录引导,登录入口就在这一屏里。
 */
export function MyHomePage() {
  const { status } = useAuth();
  // 只在明确未登录时给引导:'loading' 阶段先按已登录渲染,避免刷新时闪一下登录页。
  if (status === 'anonymous') return <MeLoggedOut />;
  return <MyHomePageAuthed />;
}

function MyHomePageAuthed() {
  const { currentUser } = useApp();
  const qc = useQueryClient();
  const navigate = useContentNavigate();
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlMainTab = searchParams.get('mainTab') || 'works';
  const [mainTab, setMainTab] = useState(urlMainTab);
  const { isMobile } = useResponsive();
  const visibleTabs = useMemo(
    () => (isMobile ? MAIN_TABS.filter((t) => !ME_DRAWER_TABS.has(t.key)) : MAIN_TABS),
    [isMobile],
  );
  // 手机上从侧边栏进的子页(观看历史/稍后再看…):单独成页,只留列表
  const standalone = isMobile && ME_DRAWER_TABS.has(mainTab);
  // 页签切换的入场方向:往右边的页签切 → 内容从右边滑进来,反之从左边(书架 ⇄ 作品等)
  const tabIdx = MAIN_TABS.findIndex((t) => t.key === mainTab);
  const [prevTabIdx, setPrevTabIdx] = useState(tabIdx);
  const [tabDx, setTabDx] = useState(24);
  if (prevTabIdx !== tabIdx) {
    setPrevTabIdx(tabIdx);
    setTabDx(tabIdx > prevTabIdx ? 24 : -24);
  }
  // 子页签 / 关键词 / 日期筛选存 URL,点进作品再返回时还原
  const [meFilters, setMeFilters] = useUrlFilters(ME_FILTER_DEFAULTS);
  const subTab = meFilters.sub;
  const setSubTab = useCallback((v: string) => setMeFilters({ sub: v }), [setMeFilters]);
  const dateRange = meFilters.range;
  const setDateRange = useCallback((v: string) => setMeFilters({ range: v }), [setMeFilters]);

  // URL → state(从其它页面跳过来时,主 tab 跟着 URL 走)
  useEffect(() => {
    setMainTab(urlMainTab);
  }, [urlMainTab]);
  // 打字防抖后的关键词:它才是进 queryKey / 请求的那个;输入框的即时值在 MyWorksToolbar 里
  const [keywordQuery, setKeywordQuery] = useState(meFilters.kw);
  const commitKeyword = useCallback(
    (kw: string) => {
      setKeywordQuery(kw);
      setMeFilters({ kw });
    },
    [setMeFilters],
  );
  const [batchMode, setBatchMode] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [cancelDialog, setCancelDialog] = useState<MyItem | null>(null);

  const profileQuery = useQuery({
    queryKey: ['home', 'me', 'profile'],
    queryFn: () => homeClient.get<any>('/me/profile').then((r) => r),
  });
  const profile = profileQuery.data;

  const { listQuery, loadedList, scroll } = useMeList(mainTab, subTab, keywordQuery, dateRange);

  // 快捷入口徽标所需数据(QUICK_LINKS 渲染时实时消费)
  const walletQ = useQuery({
    queryKey: ['home', 'me', 'wallet'],
    queryFn: () => homeClient.get<any>('/me/wallet').then((r) => r),
    staleTime: 60_000,
  });
  const pointQ = useQuery({
    queryKey: ['home', 'me', 'point'],
    queryFn: () => homeClient.get<any>('/me/point').then((r) => r),
    staleTime: 60_000,
  });
  const orderQ = useQuery({
    queryKey: ['home', 'me', 'orders'],
    queryFn: () => homeClient.get<any>('/me/orders?size=1').then((r) => r),
    staleTime: 60_000,
  });
  const vipQ = useQuery({
    queryKey: ['home', 'me', 'vip'],
    queryFn: () => homeClient.get<any>('/me/vip').then((r) => r),
    staleTime: 5 * 60_000,
  });

  // 筛选在后端做(见 /me/list 的 keyword/range),这里拿到的已经是筛过的结果。
  // 以前这一层在前端筛,只能筛"已加载的那一页";日期那一档还是纯摆设 —— 响应里
  // 没有 postedAt,`now - undefined` 是 NaN,比较恒为 false,于是从不排除任何条目。
  const filteredList = loadedList;
  const filtering = !!keywordQuery || dateRange !== 'all';

  const totalCount = listQuery.data?.pages[0]?.total ?? 0;
  const showSubTabs = mainTab === 'works';
  // 「作品」下的计数按子页签说话:作品 / 私密作品 / 合集 / 短剧 各算各的,
  // 不再四个子页签都写「共 N 个作品」。
  const tabLabel = TAB_UNIT[showSubTabs ? subTab : mainTab]
    ?? ` 个${MAIN_TABS.find((t) => t.key === mainTab)?.label ?? ''}`;
  const isGroupView = GROUP_TABS.has(mainTab) || (showSubTabs && subTab === 'collection');

  const toggleSelect = useCallback((id: number) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const enterBatchMode = useCallback(() => {
    setBatchMode(true);
    setSelected(new Set());
  }, []);

  const exitBatchMode = useCallback(() => {
    setBatchMode(false);
    setSelected(new Set());
  }, []);

  const selectAll = useCallback(() => {
    if (selected.size === filteredList.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredList.map((it) => (it as any).id)));
    }
  }, [selected, filteredList]);

  const batchDelete = useCallback(async () => {
    if (selected.size === 0) return;
    await homeClient.post('/me/batch-delete', { ids: Array.from(selected), tab: mainTab });
    setToast(`已删除 ${selected.size} 项`);
    setSelected(new Set());
    qc.invalidateQueries({ queryKey: ['home', 'me', 'list'] });
  }, [selected, mainTab, qc]);

  const { saveProfileMutation, workPrivacyMutation, accountPrivateMutation, cancelAppointmentMutation } =
    useMyHomeMutations({ setToast, setEditOpen, setCancelDialog });

  // 下面这些列表视图是 memo 的:传进去的数组和回调要稳定,输入搜索词、开关弹窗、
  // 刷徽标数据时整页重渲染,列表本身才不跟着重渲染
  const itemList = useMemo(() => filteredList.filter(isMyItem), [filteredList]);
  const groupList = useMemo(() => filteredList.filter(isMyGroup), [filteredList]);
  const openItem = useCallback((it: MyItem) => navigate(it.contentType, it.id), [navigate]);
  const openGroup = useCallback((g: MyCollectionGroup) => router.push(`/account/my-lists/detail?id=${g.id}`), [router]);
  const { mutate: toggleWorkPrivacy } = workPrivacyMutation;

  const switchTab = useCallback(
    (key: string) => {
      setMainTab(key);
      setSelected(new Set());
      setBatchMode(false);
      // 同步到 URL,让头像弹窗等其它入口能 deep-link 回来;换主页签时子页签回到默认
      setMeFilters({ mainTab: key, sub: 'works' });
    },
    [setMeFilters],
  );

  return (
    <Box
      sx={{
        position: 'relative',
        minHeight: '100%',
        bgcolor: 'var(--bg-body, transparent)',
        overflow: 'hidden',
      }}
    >
      {/* Aurora gradient background */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse 60% 50% at 20% 10%, rgba(139, 92, 246, 0.18) 0%, transparent 60%), radial-gradient(ellipse 50% 40% at 80% 5%, rgba(91, 141, 239, 0.15) 0%, transparent 60%), radial-gradient(ellipse 80% 30% at 50% 0%, rgba(254, 44, 85, 0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <Box sx={{ position: 'relative', p: { xs: 1.5, md: 3 } }}>
        {!standalone && (<>
        {/* Profile header */}
        <MyProfileHeader profile={profile} currentUser={currentUser} setEditOpen={setEditOpen} setQrOpen={setQrOpen} />

        <MyAssetLinks wallet={walletQ.data} point={pointQ.data} order={orderQ.data} vip={vipQ.data} />

        {/* Main tabs —— 外层包一层 position:relative,右侧挂一条渐隐遮罩,
            提示"后面还有页签,可以横滑"。不遮的话 11 个页签看起来像只有前 5 个。 */}
        <MyMainTabBar
          visibleTabs={visibleTabs}
          mainTab={mainTab}
          onSwitchTab={switchTab}
          batchMode={batchMode}
          selected={selected}
          filteredList={filteredList}
          onSelectAll={selectAll}
          onBatchDelete={batchDelete}
          onEnterBatch={enterBatchMode}
          onExitBatch={exitBatchMode}
        />

        </>)}

        {/* Sub tabs + tools (only for 作品 tab) */}
        <MyWorksToolbar
          showSubTabs={showSubTabs}
          isMobile={isMobile}
          subTab={subTab}
          setSubTab={setSubTab}
          dateRange={dateRange}
          setDateRange={setDateRange}
          initialKeyword={meFilters.kw}
          onKeywordDebounced={commitKeyword}
        />

        {/* List header summary */}
        {filteredList.length > 0 && !batchMode && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, px: 0.5 }}>
            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
              {/* total 是后端筛完之后的数,所以筛选时它就是"筛出来一共多少" */}
              {filtering ? '筛出 ' : '共 '}{totalCount}{tabLabel}
              {loadedList.length < totalCount ? ` · 已加载 ${loadedList.length}` : ''}
            </Typography>
          </Box>
        )}

        {/* Content area:换页签时整块重挂,带方向地滑入 */}
        <Box key={mainTab} sx={{ '--qq-tab-dx': `${tabDx}px`, animation: 'qq-tab-in 0.26s cubic-bezier(0.2, 0.8, 0.2, 1) both' }}>
        {listQuery.isLoading ? (
          // 第一页还在路上时别写「还未发布过作品」——那是空态,不是加载中
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress size={22} />
          </Box>
        ) : filteredList.length === 0 ? (
          <EmptyState
            tab={mainTab}
            subTab={subTab}
            filtered={filtering}
            onPublish={() => router.push('/account/content')}
          />
        ) : isGroupView ? (
          <CollectionGridView
            list={groupList}
            batchMode={batchMode}
            selected={selected}
            onToggle={toggleSelect}
            onOpen={openGroup}
          />
        ) : mainTab === 'history' ? (
          <HistoryListView
            list={itemList}
            batchMode={batchMode}
            selected={selected}
            onToggle={toggleSelect}
            onClick={openItem}
          />
        ) : mainTab === 'later' ? (
          <LaterGridView
            list={itemList}
            batchMode={batchMode}
            selected={selected}
            onToggle={toggleSelect}
            onClick={openItem}
          />
        ) : mainTab === 'order' ? (
          <AppointmentListView
            list={itemList}
            onClick={openItem}
            onCancel={setCancelDialog}
          />
        ) : mainTab === 'ai' ? (
          <AINoteListView
            list={itemList}
            batchMode={batchMode}
            selected={selected}
            onToggle={toggleSelect}
          />
        ) : (
          <WorkGridView
            list={itemList}
            batchMode={batchMode}
            selected={selected}
            onToggle={toggleSelect}
            onClick={openItem}
            onTogglePrivate={toggleWorkPrivacy}
            showPrivacy={mainTab === 'works'}
          />
        )}
        </Box>

        {/* 无限滚动:哨兵 + 加载态 + 到底提示 */}
        {!listQuery.isLoading && loadedList.length > 0 && (
          <>
            <Box ref={scroll.sentinelRef} sx={{ height: '1px' }} />
            {listQuery.isFetchingNextPage || listQuery.hasNextPage ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                {listQuery.isFetchingNextPage && <CircularProgress size={18} />}
              </Box>
            ) : (
              <Typography sx={{ textAlign: 'center', py: 3, color: 'text.disabled', fontSize: 12 }}>
                - 没有更多了 -
              </Typography>
            )}
          </>
        )}
      </Box>

      {/* 免责声明 / 采集说明 / 备案号:桌面在左侧栏底部,手机在首页左上角侧边栏底部 */}

      <Snackbar
        open={!!toast}
        autoHideDuration={2200}
        onClose={() => setToast(null)}
        message={toast}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />

      <EditProfileDrawer
        open={editOpen}
        onClose={() => setEditOpen(false)}
        profile={profile}
        onSave={(payload) => saveProfileMutation.mutate(payload)}
        saving={saveProfileMutation.isPending}
        onAccountPrivateChange={(next) => accountPrivateMutation.mutate(next)}
        accountPrivateSaving={accountPrivateMutation.isPending}
      />

      <QrCodeDialog
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        profile={profile}
        currentUser={currentUser}
        onMessage={setToast}
      />

      <CancelAppointmentDialog
        cancelDialog={cancelDialog}
        setCancelDialog={setCancelDialog}
        onConfirm={cancelAppointmentMutation.mutate}
        pending={cancelAppointmentMutation.isPending}
      />
    </Box>
  );
}