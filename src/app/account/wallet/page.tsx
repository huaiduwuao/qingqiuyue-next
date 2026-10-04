'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { WALLET_HREF } from '@/apis/wallet';

/**
 * 钱包已搬进个人中心(/account/center?tab=wallet)。这个地址留着给旧链接、收藏和老版本客户端,
 * 进来就跳过去。静态导出没有服务端重定向,只能在客户端 replace。
 */
export default function WalletRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace(WALLET_HREF);
  }, [router]);
  return null;
}
