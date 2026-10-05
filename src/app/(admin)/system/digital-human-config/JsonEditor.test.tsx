import React from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { JsonEditor } from './JsonEditor';

type Cfg = { scale: number };

function Host() {
  // 和配置页一样:onChange 直接 setState,上方还有一个改同一对象的表单字段
  const [value, setValue] = React.useState<Cfg>({ scale: 1 });
  return (
    <>
      <button onClick={() => setValue({ scale: 2 })}>表单改成 2</button>
      <JsonEditor label="整模型 JSON" value={value} onChange={setValue} />
    </>
  );
}

const area = () => screen.getByLabelText(/整模型 JSON/) as HTMLTextAreaElement;

describe('JsonEditor', () => {
  it('自己输入成合法 JSON 时不重排文本(1.0 不会当场变成 1)', () => {
    render(<Host />);
    fireEvent.change(area(), { target: { value: '{"scale": 1.0' } });
    fireEvent.change(area(), { target: { value: '{"scale": 1.0}' } });
    expect(area().value).toBe('{"scale": 1.0}');
    fireEvent.change(area(), { target: { value: '{"scale": 1.05}' } });
    expect(area().value).toBe('{"scale": 1.05}');
  });

  it('外面改了对象时重新格式化文本', () => {
    render(<Host />);
    fireEvent.change(area(), { target: { value: '{"scale":3}' } });
    fireEvent.click(screen.getByText('表单改成 2'));
    expect(area().value).toBe(JSON.stringify({ scale: 2 }, null, 2));
  });
});
