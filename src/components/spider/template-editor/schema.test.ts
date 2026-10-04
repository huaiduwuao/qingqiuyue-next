import { describe, expect, it } from 'vitest';
import {
  SECTIONS,
  customRest,
  fieldValue,
  isSet,
  parseContent,
  replaceUnknownTopKeys,
  sectionStats,
  setField,
  setIn,
  unknownTopKeys,
  validateConfig,
} from './schema';

const field = (path: string) => SECTIONS.flatMap((s) => s.fields).find((f) => f.path.join('.') === path)!;

describe('template content helpers', () => {
  it('setIn creates missing parents and leaves siblings alone', () => {
    const cfg = { browser: { enabled: true }, list_item_selector: '.a' };
    const next = setIn(cfg, ['browser', 'wait_for'], '#app');
    expect(next).toEqual({ browser: { enabled: true, wait_for: '#app' }, list_item_selector: '.a' });
    expect(cfg.browser).toEqual({ enabled: true });
    expect(setIn({ pagination: null } as any, ['pagination', 'enabled'], true)).toEqual({ pagination: { enabled: true } });
  });

  it('keeps js_extract and the rest of custom in sync', () => {
    let cfg: any = { custom: { js_extract: 'x()', foo: 1 } };
    expect(customRest(cfg)).toEqual({ foo: 1 });
    cfg = setField(cfg, field('custom'), { bar: 2 });
    expect(cfg.custom).toEqual({ bar: 2, js_extract: 'x()' });
    cfg = setField(cfg, field('custom.js_extract'), '  ');
    expect(cfg.custom).toEqual({ bar: 2 });
    cfg = setField(cfg, field('custom'), {});
    expect(cfg.custom).toBeNull();
    expect(fieldValue({ custom: null }, field('custom'))).toEqual({});
  });

  it('counts configured fields like the page shows them', () => {
    expect(isSet('')).toBe(false);
    expect(isSet(0)).toBe(false);
    expect(isSet(false)).toBe(false);
    expect(isSet([])).toBe(false);
    expect(isSet({ a: 1 })).toBe(true);
    const meta = SECTIONS.find((s) => s.id === 'metadata')!;
    expect(sectionStats({ metadata_schema: { title: 'h1', cast: '' } }, meta)).toEqual({ set: 1, total: 11 });
  });

  it('preserves keys the schema does not know about', () => {
    const cfg = { list_item_selector: '.a', legacy_thing: { x: 1 } };
    expect(unknownTopKeys(cfg)).toEqual({ legacy_thing: { x: 1 } });
    expect(replaceUnknownTopKeys(cfg, { other: 2 })).toEqual({ list_item_selector: '.a', other: 2 });
  });

  it('parses stored content strings', () => {
    expect(parseContent('{"a":1}')).toEqual({ a: 1 });
    expect(parseContent('')).toEqual({});
    expect(parseContent('[1]')).toBeNull();
    expect(parseContent('{bad')).toBeNull();
  });

  it('mirrors the backend ValidateConfig rule', () => {
    expect(validateConfig({})).not.toBeNull();
    expect(validateConfig({ api_source: { name: 'bilibili_popular' } })).toBeNull();
    expect(validateConfig({ item_container_selector: 'ul li' })).toBeNull();
    expect(validateConfig({ css_selectors: { title: 'h1' } })).toBeNull();
  });
});
