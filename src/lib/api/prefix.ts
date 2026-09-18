/**
 * 接口地址前缀。网页里是空串(同源,/api/* 由 nginx / APISIX 或 dev rewrites 转发),
 * 打包客户端里是网关的绝对地址。
 *
 * 为什么非有不可:客户端的页面跑在 http://tauri.localhost(Windows/Android)或
 * tauri://localhost(macOS/iOS)上,src-tauri 没有注册任何 URI scheme 代理,所以裸写的
 * `fetch('/api/...')` 会落到应用自己的 asset 协议上,永远到不了网关 —— 请求不报错,
 * 只是拿回一份 index.html,页面表现成「没有数据」。首页「推荐」标签在三个客户端里
 * 常年 `暂无推荐内容`,就是这个原因(网站和 next dev 都正常,所以一直没被发现)。
 *
 * axios 那几个实例(src/lib/api/client.ts)本来就带这个前缀;裸 fetch 用 `API_PREFIX + '/api/...'`
 * 补上即可。网页构建里它是空串,拼出来的地址和以前一模一样。
 */
export const API_PREFIX = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';
