This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## 数据来源:只连真实后端(2026-09-08)

前端不再自带任何假数据。原先的 MSW 影子 API(`src/mocks/*`,约 5200 行 / 360 个假端点)
和 `NEXT_PUBLIC_USE_MOCK` 开关已删除 —— 它让「功能做完了」和「功能没做、mock 顶着」
在界面上无法区分,没人说得清切到真后端会剩下什么。

现在只有两种连法:

| 场景 | `NEXT_PUBLIC_API_BASE_URL` | 数据来源 |
|---|---|---|
| **本地联调** | 留空(同源) | Next.js `rewrites` 把 `/api/*` 反代到 `API_PROXY_TARGET`(默认见 `next.config.ts`) |
| **指向具体网关** | `http://gateway.xxx` | axios 直连,不走 rewrites |

后端未实现的接口统一返回 **501**(body 里带 `msg` 说明缺什么),前端应据此渲染
「此功能尚未开放」而不是空列表。已知缺口清单见 `../qingqiuyue-go/docs/IMPLEMENTATION-GAPS.md`。

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
