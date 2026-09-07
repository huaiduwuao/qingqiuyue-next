/**
 * 3D 场景面板的数据模型
 *
 * 这是后端 ui_show_list / ui_show_form / ui_show_grid 三个工具的参数形状
 * (见 qingqiuyue-go/internal/agentmanager/engine/tools_ui.go 的 InputSchema)。
 * 两边改动要同步。
 *
 * ⚠️ 与旧的 dynamic-ui/types.ts 的区别:那套是 <ui:{json}/> 文本标记时代的
 * 产物 —— LLM 要在散文里手写一整个嵌套 JSON,而前端拿正则去捞。正则 `[^}]*`
 * 跨不过嵌套花括号,凡是带 items 数组的列表/表单一律捞不出来,还因为剥离用的
 * 是另一条正则,原始 JSON 会直接漏进聊天气泡并被 TTS 念出来。
 * 现在改走工具调用:参数由 LLM 的结构化输出通道下发,schema 在服务端定义。
 */

export type ScenePanelKind = 'list' | 'grid' | 'form';

export interface ScenePanelListItem {
  id: string;
  title: string;
  subtitle?: string;
  image?: string;
  icon?: string;
  /** 点击后要回灌给数字人的自然语言指令 */
  action?: string;
}

export interface ScenePanelGridItem extends ScenePanelListItem {
  badge?: string;
}

export type ScenePanelFieldType =
  | 'text' | 'textarea' | 'number' | 'select' | 'checkbox' | 'radio' | 'date' | 'password';

export interface ScenePanelFieldOption {
  value: string;
  label: string;
}

export interface ScenePanelField {
  name: string;
  label: string;
  type: ScenePanelFieldType;
  placeholder?: string;
  required?: boolean;
  default?: unknown;
  options?: ScenePanelFieldOption[];
}

interface ScenePanelBase {
  /** 用于 React key + 去重:同一个工具调用只渲染一次 */
  id: string;
  title: string;
  subtitle?: string;
}

export interface ScenePanelList extends ScenePanelBase {
  kind: 'list';
  items: ScenePanelListItem[];
}

export interface ScenePanelGrid extends ScenePanelBase {
  kind: 'grid';
  columns: number;
  items: ScenePanelGridItem[];
}

export interface ScenePanelForm extends ScenePanelBase {
  kind: 'form';
  fields: ScenePanelField[];
  submitText?: string;
  /** 提交后拼给数字人的动作说明(来自 LLM,告诉它自己接下来该干嘛) */
  submitHint?: string;
}

export type ScenePanel = ScenePanelList | ScenePanelGrid | ScenePanelForm;

/** 后端工具名 → 面板类型 */
export const SCENE_PANEL_TOOLS: Record<string, ScenePanelKind> = {
  ui_show_list: 'list',
  ui_show_grid: 'grid',
  ui_show_form: 'form',
};

/** 关闭面板的工具名 */
export const SCENE_PANEL_DISMISS_TOOL = 'ui_dismiss';

function asString(v: unknown): string {
  return typeof v === 'string' ? v : v == null ? '' : String(v);
}

function normalizeItems(raw: unknown): ScenePanelListItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
    .map((x, i) => ({
      id: asString(x.id) || `item-${i}`,
      title: asString(x.title),
      subtitle: asString(x.subtitle) || undefined,
      image: asString(x.image) || undefined,
      icon: asString(x.icon) || undefined,
      badge: asString((x as Record<string, unknown>).badge) || undefined,
      action: asString(x.action) || undefined,
    }))
    .filter((x) => x.title);
}

function normalizeFields(raw: unknown): ScenePanelField[] {
  if (!Array.isArray(raw)) return [];
  const allowed: ScenePanelFieldType[] = [
    'text', 'textarea', 'number', 'select', 'checkbox', 'radio', 'date', 'password',
  ];
  return raw
    .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
    .map((x) => {
      const t = asString(x.type) as ScenePanelFieldType;
      return {
        name: asString(x.name),
        label: asString(x.label) || asString(x.name),
        // 模型偶尔会编出 schema 之外的类型,统一退化成单行文本而不是渲染不出来
        type: allowed.includes(t) ? t : 'text',
        placeholder: asString(x.placeholder) || undefined,
        required: x.required === true,
        default: x.default,
        options: Array.isArray(x.options)
          ? x.options
              .filter((o): o is Record<string, unknown> => !!o && typeof o === 'object')
              .map((o) => ({ value: asString(o.value), label: asString(o.label) || asString(o.value) }))
          : undefined,
      };
    })
    .filter((f) => f.name);
}

/**
 * 把一次 ui_show_* 工具调用的参数转成面板模型。
 * 参数不合法(比如空列表、没字段的表单)时返回 null —— 宁可不弹,也不弹个空板子。
 */
export function scenePanelFromToolCall(
  toolName: string,
  args: Record<string, unknown> | undefined,
  callId: string,
): ScenePanel | null {
  const kind = SCENE_PANEL_TOOLS[toolName];
  if (!kind || !args) return null;

  const title = asString(args.title) || '结果';
  const subtitle = asString(args.subtitle) || undefined;
  const id = callId || `${toolName}-${Date.now()}`;

  if (kind === 'form') {
    const fields = normalizeFields(args.fields);
    if (fields.length === 0) return null;
    return {
      kind: 'form',
      id, title, subtitle,
      fields,
      submitText: asString(args.submitText) || undefined,
      submitHint: asString(args.submitHint) || undefined,
    };
  }

  const items = normalizeItems(args.items);
  if (items.length === 0) return null;

  if (kind === 'grid') {
    const cols = Number(args.columns);
    return {
      kind: 'grid',
      id, title, subtitle,
      columns: Number.isFinite(cols) ? Math.min(4, Math.max(2, Math.round(cols))) : 3,
      items,
    };
  }
  return { kind: 'list', id, title, subtitle, items };
}
