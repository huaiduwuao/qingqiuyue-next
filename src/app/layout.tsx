import type { Metadata } from 'next';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: '清秋月',
  description: '清秋月内容平台',
  icons: {
    icon: '/yue_icon.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
