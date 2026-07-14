"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import Skeleton from "@mui/material/Skeleton";
import { CoverImage } from "@/components/common/CoverImage";
import { accountClient } from "@/lib/api/client";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import type {
  MePageItem,
  MePageResp,
} from "@/apis/dashboard";
import {
  getFavoritesPage,
  getHistoryPage,
  getLikesPage,
  getWatchlaterPage,
  getReservationsPage,
} from "@/apis/dashboard";

// 5 个分区配置:label / API / 渲染规则 / 空态文案
type MainTab = "likes" | "collect" | "history" | "later" | "order";

const SECTION_CONFIG: Record<MainTab, {
  label: string;
  fetcher: (page: number, pageSize: number) => Promise<MePageResp<MePageItem>>;
  emptyHint: string;
}> = {
  likes:       { label: "我的喜欢",     fetcher: (p, s) => accountClient.get(`/account/likes/page?page=${p}&pageSize=${s}`).then(r => r.data),        emptyHint: "后端真点赞机制尚未上线,暂无内容" },
  collect:     { label: "我的收藏",     fetcher: (p, s) => accountClient.get(`/account/favorites/page?page=${p}&pageSize=${s}`).then(r => r.data),    emptyHint: "还没有收藏任何内容,去推荐页看看吧" },
  history:     { label: "观看历史",     fetcher: (p, s) => accountClient.get(`/account/history/page?page=${p}&pageSize=${s}`).then(r => r.data),      emptyHint: "还没有观看记录,刷一刷推荐吧" },
  later:       { label: "稍后再看",     fetcher: (p, s) => accountClient.get(`/account/watchlater/page?page=${p}&pageSize=${s}`).then(r => r.data),   emptyHint: "稍后再看列表为空" },
  order:       { label: "我的预约",     fetcher: (p, s) => accountClient.get(`/account/reservations/page?page=${p}&pageSize=${s}`).then(r => r.data), emptyHint: "后端预约模块尚未上线,暂无内容" },
};

const PAGE_SIZE = 12;

function useSectionData(tab: MainTab, page: number) {
  const cfg = SECTION_CONFIG[tab];
  return useQuery({
    queryKey: ["me", tab, page],
    queryFn: () => cfg.fetcher(page, PAGE_SIZE),
    staleTime: 30 * 1000,
  });
}

function GridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1 }}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} variant="rectangular" sx={{ aspectRatio: "3/4", borderRadius: 1 }} />
      ))}
    </Box>
  );
}

function GridView({ items, tab }: { items: MePageItem[]; tab: MainTab }) {
  if (!items.length) return null;
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1 }}>
      {items.map((it, i) => (
        <Box
          key={String(it.id ?? it.contentId ?? i)}
          sx={{ position: "relative", aspectRatio: "3/4", borderRadius: 1, overflow: "hidden", bgcolor: "action.hover" }}
        >
          <CoverImage
            src={it.cover || it.coverUrl}
            alt={it.title || ""}
            sx={{ width: "100%", height: "100%" }}
          />
          {it.title && (
            <Box
              sx={{
                position: "absolute",
                inset: 0,
                background: "linear-gradient(180deg, transparent 60%, rgba(0,0,0,0.7) 100%)",
                display: "flex",
                alignItems: "flex-end",
                p: 0.75,
              }}
            >
              <Typography sx={{ fontSize: 11, color: "common.white", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "100%" }}>
                {it.title}
              </Typography>
            </Box>
          )}
        </Box>
      ))}
    </Box>
  );
}

function EmptyState({ hint }: { hint: string }) {
  return (
    <Box
      sx={{
        py: 6,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 1.5,
        bgcolor: "action.hover",
        borderRadius: 2,
      }}
    >
      <Box sx={{ fontSize: 48, opacity: 0.4 }}>📭</Box>
      <Typography sx={{ fontSize: 13, color: "text.secondary" }}>{hint}</Typography>
      <Button size="small" variant="outlined" href="/home/recommend">
        去推荐看看
      </Button>
    </Box>
  );
}

export function MeTabView() {
  const params = useSearchParams();
  const router = useRouter();
  const mainTabRaw = params.get("mainTab") || "collect";
  const mainTab = (["likes", "collect", "history", "later", "order"].includes(mainTabRaw)
    ? mainTabRaw
    : "collect") as MainTab;

  const cfg = SECTION_CONFIG[mainTab];

  // 分页状态
  const [mePage, setMePage] = useState(1);
  const [meList, setMeList] = useState<MePageItem[]>([]);
  const [meHasMore, setMeHasMore] = useState(true);

  // 切换 tab 时重置分页
  useEffect(() => {
    setMePage(1);
    setMeList([]);
    setMeHasMore(true);
  }, [mainTab]);

  const { data, isLoading, isFetching } = useSectionData(mainTab, mePage);

  // 合并数据
  useEffect(() => {
    if (data?.list) {
      setMeList(prev => mePage === 1 ? data.list! : [...prev, ...data.list!]);
      const total = data.total || data.totalRow || 0;
      setMeHasMore(data.list!.length === PAGE_SIZE && (mePage * PAGE_SIZE) < total);
    }
  }, [data, mePage]);

  // 无限滚动
  const scroll = useInfiniteScroll({
    enabled: !isLoading && meHasMore,
  });

  useEffect(() => {
    if (scroll.isNearBottom && meHasMore && !isLoading) {
      setMePage(p => p + 1);
    }
  }, [scroll.isNearBottom, meHasMore, isLoading]);

  // 5 个子 tab 切换条
  return (
    <Box sx={{ px: 3, py: 2 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2, pb: 1, borderBottom: 1, borderColor: "divider" }}>
        <Typography sx={{ fontSize: 18, fontWeight: 700, mr: 2 }}>{cfg.label}</Typography>
        <Box sx={{ display: "flex", gap: 0.5, flex: 1, overflowX: "auto" }}>
          {(Object.keys(SECTION_CONFIG) as MainTab[]).map((k) => (
            <Chip
              key={k}
              label={SECTION_CONFIG[k].label}
              size="small"
              color={mainTab === k ? "primary" : "default"}
              variant={mainTab === k ? "filled" : "outlined"}
              onClick={() => router.push(`/home/recommend?tab=me&mainTab=${k}`)}
              sx={{ cursor: "pointer" }}
            />
          ))}
        </Box>
      </Box>

      {isLoading ? (
        <GridSkeleton count={6} />
      ) : meList.length > 0 ? (
        <Box>
          <GridView items={meList} tab={mainTab} />

          {/* Loading more */}
          {isFetching && !isLoading && (
            <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
              <Typography sx={{ color: "text.secondary", fontSize: 12 }}>加载中...</Typography>
            </Box>
          )}

          {/* Infinite scroll sentinel */}
          <Box ref={scroll.sentinelRef} sx={{ height: 1 }} />

          {/* No more data */}
          {!isFetching && meList.length > 0 && !meHasMore && (
            <Typography sx={{ textAlign: "center", py: 3, color: "text.disabled", fontSize: 12 }}>
              - 没有更多了 -
            </Typography>
          )}
        </Box>
      ) : (
        <EmptyState hint={cfg.emptyHint} />
      )}
    </Box>
  );
}

export default MeTabView;
