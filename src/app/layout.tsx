import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://qingqiuyue.com';

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: { default: '清秋月', template: '%s | 清秋月' },
  description: '清秋月内容社区，发现并分享优质短视频、图文、音乐、影视等精彩内容',
  keywords: ['内容社区', '短视频', '图文', '创作平台', '清秋月'],
  authors: [{ name: '清秋月' }],
  creator: '清秋月',
  openGraph: {
    type: 'website',
    locale: 'zh_CN',
    url: BASE_URL,
    siteName: '清秋月',
    title: '清秋月',
    description: '发现并分享优质短视频、图文、音乐、影视等精彩内容',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: '清秋月' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '清秋月',
    description: '发现并分享优质短视频、图文、音乐、影视等精彩内容',
    images: ['/og-image.png'],
  },
  robots: { index: true, follow: true },
  // 图标交给 Next 的文件约定(app/favicon.ico、app/icon.png、app/apple-icon.png),
  // 由 scripts/gen-icons.mjs 从品牌印章生成。这里再写 icons 会盖掉文件约定,所以不写。
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Ma+Shan+Zheng&family=Long+Cang&family=ZCOOL+XiaoWei&display=swap"
          rel="stylesheet"
        />
      </head>
      <body suppressHydrationWarning>
        <ErrorBoundary>
          <Providers>{children}</Providers>
        </ErrorBoundary>
      </body>
    </html>
  );
}
