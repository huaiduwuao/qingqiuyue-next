'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

/** 歌单详情搬到了 /playlist?id=(见 ../page.tsx)。旧链接带着 id 转过去。 */
function Redirect() {
  const router = useRouter();
  const id = useSearchParams().get('id');
  useEffect(() => {
    router.replace(id ? `/playlist?id=${encodeURIComponent(id)}` : '/playlist');
  }, [router, id]);
  return null;
}

export default function MyListDetailRedirect() {
  return (
    <Suspense fallback={null}>
      <Redirect />
    </Suspense>
  );
}
