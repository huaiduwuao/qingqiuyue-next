/**
 * 工具注册表 —— 这就是"数字人能接入系统所有接口和路由"的落点。
 *
 * 两类工具:
 *   1) navigate(path)        → 跳转到任意前端路由(数字人"带你去某个页面")
 *   2) callApi(domain,path)  → 调用任意 /api/* 接口(数字人"帮你查/操作数据")
 *   外加若干高层语义工具(openReward / searchContent…),让 LLM 更易用。
 *
 * 之前审计出的「全部路由 + 全部 API」即可批量灌进这里(见 generated/ 占位)。
 */
import type { ToolDef } from '../types';
import { adminClient, contentClient, homeClient, rewardClient } from '@/lib/api/client';

type AnyClient = (url: string, config?: any) => Promise<any>;
const CLIENTS: Record<string, AnyClient> = {
  admin: adminClient as unknown as AnyClient,
  content: contentClient as unknown as AnyClient,
  home: homeClient as unknown as AnyClient,
  reward: rewardClient as unknown as AnyClient,
};

export interface ToolContext {
  navigate: (path: string) => void;
  pointAt?: (text: string) => boolean; // 让数字人移动过去并指向/高亮某处
}

// 在当前页面找到文字匹配的可交互元素
function findByText(text: string, roles: string[]): HTMLElement | null {
  const t = text.trim();
  const sel = roles.join(',');
  const els = Array.from(document.querySelectorAll<HTMLElement>(sel));
  // 完全匹配优先,其次包含
  return (
    els.find((e) => (e.textContent || '').trim() === t) ||
    els.find((e) => (e.textContent || '').includes(t)) ||
    null
  );
}

export function buildTools(ctx: ToolContext): ToolDef[] {
  return [
    // ─── 操作当前界面(点按钮 / 点菜单 / 填输入)───
    {
      name: 'clickButton',
      description: '点击当前页面上文字匹配的按钮或菜单项,例如"新建""保存""一键训练""用户列表"',
      params: [{ name: 'text', type: 'string', description: '按钮/菜单文字', required: true }],
      run: async ({ text }) => {
        const el = findByText(String(text), ['button', '[role=button]', '.MuiTab-root', '.MuiMenuItem-root', '.MuiChip-root', 'a']);
        if (!el) throw new Error(`没找到"${text}"`);
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        el.click();
        return { clicked: text };
      },
    },
    {
      name: 'fillInput',
      description: '在页面输入框里填入内容。near 为输入框的占位符/标签关键词',
      params: [
        { name: 'near', type: 'string', description: '输入框占位符或标签关键词' },
        { name: 'value', type: 'string', description: '要填的内容', required: true },
      ],
      run: async ({ near, value }) => {
        const inputs = Array.from(document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea'));
        const target = near
          ? inputs.find((i) => (i.placeholder || '').includes(String(near)) || (i.getAttribute('aria-label') || '').includes(String(near)))
          : inputs.find((i) => i.offsetParent !== null);
        if (!target) throw new Error(`没找到输入框(${near || ''})`);
        const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(target), 'value')?.set;
        setter?.call(target, String(value));
        target.dispatchEvent(new Event('input', { bubbles: true }));
        return { filled: value };
      },
    },
    {
      name: 'pointAt',
      description: '把数字人移动到某处并指向/高亮,用于"告诉用户某个数据/按钮在哪"',
      params: [{ name: 'text', type: 'string', description: '要指向的文字/数据', required: true }],
      run: async ({ text }) => {
        const ok = ctx.pointAt?.(String(text));
        if (!ok) throw new Error(`没找到"${text}"`);
        return { pointedAt: text };
      },
    },
    {
      name: 'navigate',
      description: '跳转到系统内任意页面路由,例如 /account/reward、/system/user、/home/recommend',
      params: [{ name: 'path', type: 'string', description: '前端路由路径', required: true }],
      run: async ({ path }) => {
        ctx.navigate(String(path));
        return { navigated: path };
      },
    },
    {
      name: 'callApi',
      description: '调用系统后端接口。domain 取值 admin|content|home|reward;path 为接口路径如 /user/list',
      params: [
        { name: 'domain', type: 'string', description: 'admin|content|home|reward', required: true },
        { name: 'path', type: 'string', description: '接口路径,如 /user/list', required: true },
        { name: 'method', type: 'string', description: 'GET|POST|PUT|DELETE,默认 GET' },
        { name: 'params', type: 'object', description: 'query 或 body 参数' },
      ],
      run: async ({ domain, path, method = 'GET', params }) => {
        const client = CLIENTS[String(domain)];
        if (!client) throw new Error(`未知 domain: ${domain}`);
        const m = String(method).toUpperCase();
        const cfg: any = { method: m };
        if (m === 'GET') cfg.params = params;
        else cfg.data = params;
        const res = await client(String(path).startsWith('/') ? String(path) : `/${path}`, cfg);
        return res?.data ?? res;
      },
    },
    // ─── 高层语义工具(映射到真实业务)───
    {
      name: 'openRewardCenter',
      description: '打开悬赏中心页面',
      params: [],
      run: async () => {
        ctx.navigate('/account/reward');
        return { ok: true };
      },
    },
    {
      name: 'listRewardTasks',
      description: '查询悬赏任务列表',
      params: [{ name: 'status', type: 'string', description: '任务状态,可选' }],
      run: async ({ status }) => {
        const res = await rewardClient('/task/page', { params: { pageNum: 1, pageSize: 10, status } });
        return (res as any)?.data ?? res;
      },
    },
    {
      name: 'searchContent',
      description: '在内容库里搜索作品',
      params: [{ name: 'keyword', type: 'string', description: '搜索词', required: true }],
      run: async ({ keyword }) => {
        ctx.navigate(`/search?q=${encodeURIComponent(String(keyword))}`);
        return { searched: keyword };
      },
    },
    {
      name: 'goHomeFeed',
      description: '回到首页推荐流',
      params: [],
      run: async () => {
        ctx.navigate('/home/recommend');
        return { ok: true };
      },
    },
  ];
}

// 给 LLM 的工具描述(function-calling schema 文本)
export function toolsAsPrompt(tools: ToolDef[]): string {
  return tools
    .map((t) => {
      const ps = t.params.map((p) => `${p.name}:${p.type}${p.required ? '(必填)' : ''}`).join(', ');
      return `- ${t.name}(${ps}) — ${t.description}`;
    })
    .join('\n');
}
