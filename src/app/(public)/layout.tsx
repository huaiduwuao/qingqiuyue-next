// 服务端组件:(public) 组内多为依赖 URL search params 的客户端 SPA 页面,
// 强制动态渲染,避免 useSearchParams() 在静态预渲染时的 CSR bailout。
// (route segment config 仅在服务端组件中生效,故此 layout 不能带 'use client'。)

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}