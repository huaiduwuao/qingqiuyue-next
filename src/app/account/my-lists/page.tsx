'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** 自建歌单搬到了 /playlist(数据改存 PostgreSQL,见后端 my_list.go)。旧链接和书签转过去。 */
export default function MyListsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/playlist');
  }, [router]);
  return null;
}
