// /home -> /home/recommend 重定向页
// (main)/home 之前没 page.tsx,/home 路径会 404;这里用 Next.js redirect 解决。
import { redirect } from 'next/navigation';

export default function HomeIndexPage() {
  redirect('/home/recommend');
}
