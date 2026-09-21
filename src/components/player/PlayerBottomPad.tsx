'use client';

import { useEffect, useState } from 'react';

/**
 * 音乐底栏在页面底部留出的占位。
 *
 * 形式是 <body> 的最后一个孩子(height: var(--player-inset)),样式在 globals.css。
 * 之所以要 portal 到 body 而不是就地渲染:Providers 里的兄弟节点都包在
 * ClickSpark 的一层层 div 里,body 的 flex column 只作用于它的直接孩子,
 * 就地渲染得一路改那些包装层的布局。
 *
 * 必须是 body 的直接孩子 —— body 的 scrollHeight 决定 html 的滚动范围;
 * 曾经这层占位是 `body { padding-bottom }`,播放器一开一关就改了 body 的
 * scrollHeight,文档总高度跟着变,滚动中 WebView 会做边界校正(把用户往下拽)。
 * 见 globals.css 里 body > [data-player-pad] 的说明。
 */
export default function PlayerBottomPad() {
  const [el, setEl] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!el) return;
    document.body.appendChild(el);
    return () => el.remove();
  }, [el]);

  return <div ref={setEl} data-player-pad aria-hidden="true" />;
}
