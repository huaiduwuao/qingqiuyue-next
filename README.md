This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## 架构约定:MOCK 与真实后端切换(2026-06-17)

后端永不 mock。所有假数据都走前端 MSW(`src/mocks/*`),通过单一开关切换:

| 场景 | `NEXT_PUBLIC_USE_MOCK` | `NEXT_PUBLIC_API_BASE_URL` | 数据来源 |
|---|---|---|---|
| **纯前端开发** | `1` / `true` | 不设 | MSW Service Worker 拦截 `/api/*`(`src/mocks/handlers/*` + `src/mocks/db/*`) |
| **联调真实后端** | `0` / 不设 | 留空(同源) | Next.js `rewrites` 把 `/api/*` 反代到 `API_PROXY_TARGET`(默认 `http://apisix:9080`) |
| **指向具体网关** | `0` / 不设 | `http://gateway.xxx` | axios 直连,不走 rewrites |

切换**只改环境变量**,业务代码零改动。详见 `../qingqiuyue-go/docs/IMPLEMENTATION-GAPS.md`。

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
