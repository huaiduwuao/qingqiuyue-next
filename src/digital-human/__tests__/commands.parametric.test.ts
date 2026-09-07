import { describe, it, expect, vi } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { ALL_ACTIONS } from '../tools/actions';
import { ALL_EXPRESSION_TEMPLATE_NAMES } from '../tools/expressions';
import { ALL_VISEME_NAMES, VISEME_NAMES } from '../tools/visemes';
import { dispatchToolCall, dispatchToolCalls, isAvatarTool } from '../tools/dispatcher';
import { loadConfigBundle, safeEvalFormula } from '../vrm/config/loader';
import {
  faceSetExpression,
  mouthSetViseme,
  bodyPlayAction,
} from '../tools/tools';

function findRepoRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    if (
      fs.existsSync(path.join(dir, 'qingqiuyue-go')) &&
      fs.existsSync(path.join(dir, 'qingqiuyue-next'))
    ) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error('repo root not found from cwd: ' + process.cwd());
}

const repoRoot = findRepoRoot();

function readRepoFile(rel: string): string {
  return fs.readFileSync(path.join(repoRoot, rel), 'utf-8');
}

function parseGoStringSlice(source: string, varName: string): string[] {
  const re = new RegExp(`var\\s+${varName}\\s*=\\s*\\[]string\\{([^}]*)\\}`, 's');
  const m = source.match(re);
  if (!m) throw new Error(`cannot find ${varName} in Go source`);
  return [...m[1].matchAll(/"([^"]*)"/g)].map(x => x[1]);
}

function parseSqlNames(
  sql: string,
  table: 'actions' | 'expression_presets' | 'visemes',
): string[] {
  const re = new RegExp(
    `INSERT INTO vrm_${table}\\b[\\s\\S]*?VALUES\\s*([\\s\\S]*?)ON\\s+CONFLICT`,
    'i',
  );
  const m = sql.match(re);
  if (!m) throw new Error(`cannot find vrm_${table} insert`);
  const content = m[1];
  // name 紧跟在 model_id 列之后，统一用 model_id 后面的第一个字符串捕获 name。
  const nameRe = /'00000000-0000-0000-0000-000000000001'\s*,\s*'([^']+)'/g;
  return [...content.matchAll(nameRe)].map(x => x[1]);
}

function sorted<T>(arr: T[]): T[] {
  return [...arr].sort();
}

function makeMockSinks() {
  return {
    setEmotion: vi.fn(),
    setViseme: vi.fn(),
    setVisemeTimeline: vi.fn(),
    setJawOpen: vi.fn(),
    setAction: vi.fn(),
    speak: vi.fn(),
    move: vi.fn(),
    camera: vi.fn(),
  };
}

const goToolsSource = readRepoFile('qingqiuyue-go/internal/digitalhuman/tools.go');
// VRM 种子数据已从 internal/digitalhuman/migrations/001_vrm_seed.sql 并进统一 schema,
// 老路径已不存在(这个套件此前一直是 ENOENT 起不来的)。
const seedSQL = readRepoFile('qingqiuyue-go/sql/postgresql/schema.sql');

const actionsJson = JSON.parse(
  readRepoFile('qingqiuyue-next/src/data/seed/actions/character.json'),
) as any[];
const expressionsJson = JSON.parse(
  readRepoFile('qingqiuyue-next/src/data/seed/expressions/character.json'),
) as any[];
const visemesJson = JSON.parse(
  readRepoFile('qingqiuyue-next/src/data/seed/visemes/character.json'),
) as any[];

describe('数字人枚举一致性', () => {
  it('actions 在前端、seed JSON、Go、SQL 中一致', () => {
    const seed = actionsJson.map(a => a.name as string);
    const go = parseGoStringSlice(goToolsSource, 'actions');
    const sql = parseSqlNames(seedSQL, 'actions');
    expect(sorted(ALL_ACTIONS)).toEqual(sorted(seed));
    expect(sorted(ALL_ACTIONS)).toEqual(sorted(go));
    expect(sorted(ALL_ACTIONS)).toEqual(sorted(sql));
    expect(ALL_ACTIONS).toHaveLength(29);
  });

  it('expressions 在前端、seed JSON、Go、SQL 中一致', () => {
    const seed = expressionsJson.map(e => e.name as string);
    const go = parseGoStringSlice(goToolsSource, 'expressionTemplates');
    const sql = parseSqlNames(seedSQL, 'expression_presets');
    expect(sorted(ALL_EXPRESSION_TEMPLATE_NAMES)).toEqual(sorted(seed));
    expect(sorted(ALL_EXPRESSION_TEMPLATE_NAMES)).toEqual(sorted(go));
    expect(sorted(ALL_EXPRESSION_TEMPLATE_NAMES)).toEqual(sorted(sql));
    expect(ALL_EXPRESSION_TEMPLATE_NAMES).toHaveLength(20);
  });

  it('visemes 在前端、seed JSON、Go、SQL 中一致', () => {
    const seed = visemesJson.map(v => v.name as string);
    const go = parseGoStringSlice(goToolsSource, 'visemes');
    const sql = parseSqlNames(seedSQL, 'visemes');
    expect(sorted(ALL_VISEME_NAMES)).toEqual(sorted(seed));
    expect(sorted(ALL_VISEME_NAMES)).toEqual(sorted(go));
    expect(sorted(ALL_VISEME_NAMES)).toEqual(sorted(sql));
    expect(sorted(ALL_VISEME_NAMES)).toEqual(sorted(VISEME_NAMES));
    expect(ALL_VISEME_NAMES).toHaveLength(19);
  });
});

describe('dispatcher 参数化验证', () => {
  it.each(ALL_ACTIONS)('body.playAction("%s") 成功', (name) => {
    const sinks = makeMockSinks();
    const r = dispatchToolCall({ name: 'body.playAction', params: { name } }, sinks);
    expect(r.ok).toBe(true);
    expect(sinks.setAction).toHaveBeenCalledWith(name);
  });

  it.each(ALL_EXPRESSION_TEMPLATE_NAMES)('face.setExpression("%s") 成功', (template) => {
    const sinks = makeMockSinks();
    const r = dispatchToolCall(
      { name: 'face.setExpression', params: { template } },
      sinks,
    );
    expect(r.ok).toBe(true);
    expect(sinks.setEmotion).toHaveBeenCalled();
  });

  it.each(ALL_VISEME_NAMES)('mouth.setViseme("%s") 成功', (shape) => {
    const sinks = makeMockSinks();
    const r = dispatchToolCall({ name: 'mouth.setViseme', params: { shape } }, sinks);
    expect(r.ok).toBe(true);
    expect(sinks.setViseme).toHaveBeenCalledWith(shape, 1);
  });

  it('非法 action 失败', () => {
    const sinks = makeMockSinks();
    const r = dispatchToolCall(
      { name: 'body.playAction', params: { name: 'notAnAction' } },
      sinks,
    );
    expect(r.ok).toBe(false);
    expect(sinks.setAction).not.toHaveBeenCalled();
  });

  it('非法 expression 失败', () => {
    const sinks = makeMockSinks();
    const r = dispatchToolCall(
      { name: 'face.setExpression', params: { template: 'notAnExpression' } },
      sinks,
    );
    expect(r.ok).toBe(false);
    expect(sinks.setEmotion).not.toHaveBeenCalled();
  });

  it('非法 viseme 失败', () => {
    const sinks = makeMockSinks();
    const r = dispatchToolCall(
      { name: 'mouth.setViseme', params: { shape: 'notAViseme' } },
      sinks,
    );
    expect(r.ok).toBe(false);
    expect(sinks.setViseme).not.toHaveBeenCalled();
  });
});

// AG-UI / <emotion:x/> 指令走的是 `args` 字段,本地工具目录走 `params`。
// 之前 dispatcher 只认 params,两个运行时入口传的又都是 args,还被 as-unknown 强转
// 骗过了编译器 —— 结果动作全退化成 idle、表情全退化成 neutral,而且返回 ok:true。
// 这组用例锁住"两种字段名都要生效"。
describe('dispatcher 接受 args 与 params 两种字段名', () => {
  it.each(ALL_ACTIONS)('body.playAction args:{name:"%s"} 生效', (name) => {
    const sinks = makeMockSinks();
    const r = dispatchToolCall({ name: 'body.playAction', args: { name } }, sinks);
    expect(r.ok).toBe(true);
    expect(sinks.setAction).toHaveBeenCalledWith(name);
  });

  it.each(ALL_EXPRESSION_TEMPLATE_NAMES)('face.setExpression args:{template:"%s"} 生效', (template) => {
    const sinks = makeMockSinks();
    const r = dispatchToolCall({ name: 'face.setExpression', args: { template } }, sinks);
    expect(r.ok).toBe(true);
    expect(sinks.setEmotion).toHaveBeenCalled();
  });

  // <emotion:happy/> 解析出来的是 { name: 'happy' },不是 { template: 'happy' }
  it.each(ALL_EXPRESSION_TEMPLATE_NAMES)('face.setExpression args:{name:"%s"} 也生效', (name) => {
    const sinks = makeMockSinks();
    const r = dispatchToolCall({ name: 'face.setExpression', args: { name } }, sinks);
    expect(r.ok).toBe(true);
    expect(sinks.setEmotion).toHaveBeenCalled();
  });

  it('args 里的非法动作仍然要报错,不能静默退化成 idle', () => {
    const sinks = makeMockSinks();
    const r = dispatchToolCall({ name: 'body.playAction', args: { name: 'notAnAction' } }, sinks);
    expect(r.ok).toBe(false);
    expect(sinks.setAction).not.toHaveBeenCalled();
  });

  it('args 里的非法表情仍然要报错,不能静默退化成 neutral', () => {
    const sinks = makeMockSinks();
    const r = dispatchToolCall({ name: 'face.setExpression', args: { template: 'nope' } }, sinks);
    expect(r.ok).toBe(false);
    expect(sinks.setEmotion).not.toHaveBeenCalled();
  });

  it('params 优先于 args(两者都给时)', () => {
    const sinks = makeMockSinks();
    const r = dispatchToolCall(
      { name: 'body.playAction', params: { name: 'wave' }, args: { name: 'bow' } },
      sinks,
    );
    expect(r.ok).toBe(true);
    expect(sinks.setAction).toHaveBeenCalledWith('wave');
  });
});

// AG-UI 会把后端跑的每个工具都回显给前端。这些工具不归 dispatcher 管,
// 混进来会落到 default 分支变成一条 error,调用方再贴成
// 「⚠️ unknown tool: resource_search」—— 用户搜一次资源就看见一条报错。
describe('dispatchToolCalls 只处理形象类工具', () => {
  const backendOnly = [
    'resource_search', 'bounty_list', 'bounty_create',
    'ui_show_list', 'ui_show_form', 'ui_show_grid', 'ui_dismiss',
    'shell_exec', 'file_read', 'http_request', 'workflow_execute',
  ];

  it.each(backendOnly)('后端工具 "%s" 被静默跳过,不产生错误结果', (name) => {
    const sinks = makeMockSinks();
    const results = dispatchToolCalls([{ name, args: {} }], sinks);
    expect(results).toHaveLength(0);
    expect(sinks.setAction).not.toHaveBeenCalled();
    expect(sinks.setEmotion).not.toHaveBeenCalled();
  });

  it.each(backendOnly)('isAvatarTool("%s") 为 false', (name) => {
    expect(isAvatarTool(name)).toBe(false);
  });

  it('形象类工具仍然被识别', () => {
    for (const n of ['face.setExpression', 'body.playAction', 'mouth.setViseme', 'scene.change']) {
      expect(isAvatarTool(n)).toBe(true);
    }
  });

  it('混合列表里只派发形象类工具,后端工具不干扰', () => {
    const sinks = makeMockSinks();
    const results = dispatchToolCalls(
      [
        { name: 'resource_search', args: { keyword: '科幻' } },
        { name: 'body.playAction', args: { name: 'wave' } },
        { name: 'ui_show_list', args: { title: 'x' } },
      ],
      sinks,
    );
    expect(results).toHaveLength(1);
    expect(results[0].ok).toBe(true);
    expect(sinks.setAction).toHaveBeenCalledWith('wave');
  });
});

describe('formula 安全求值', () => {
  const bundle = loadConfigBundle();

  it.each(bundle.actions)('action "$name" formula 不抛异常', ({ name, formula }) => {
    expect(() => safeEvalFormula(formula as string | undefined, { t: 0 })).not.toThrow();
    expect(() => safeEvalFormula(formula as string | undefined, { t: 1, blend: 1 })).not.toThrow();
  });

  it.each(bundle.danceStyles)('dance style "$name" formula 不抛异常', ({ name, formula }) => {
    expect(() =>
      safeEvalFormula(formula as string, { t: 0, b: 0, A: 1, bass: 0, phase: 0 }),
    ).not.toThrow();
  });
});

describe('tool schema 枚举', () => {
  it('face.setExpression.template.enum 与前端表情一致', () => {
    expect(
      sorted(faceSetExpression.parameters.properties.template.enum as string[]),
    ).toEqual(sorted(ALL_EXPRESSION_TEMPLATE_NAMES));
  });

  it('mouth.setViseme.shape.enum 与前端口型一致', () => {
    expect(
      sorted(mouthSetViseme.parameters.properties.shape.enum as string[]),
    ).toEqual(sorted(ALL_VISEME_NAMES));
  });

  it('body.playAction.name.enum 与前端动作一致', () => {
    expect(
      sorted(bodyPlayAction.parameters.properties.name.enum as string[]),
    ).toEqual(sorted(ALL_ACTIONS));
  });
});
