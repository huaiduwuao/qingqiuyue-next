'use client';

import { useEffect } from 'react';

// 书法 / 标题字体(登录页、首页标题、品牌字标)走 Google Fonts。
//
// 之前在根 layout 的 <head> 里同步 <link rel="stylesheet">:样式表是渲染阻塞资源,
// 国内访问 fonts.googleapis.com 经常很慢或直接连不上,每个页面的首屏都要等它超时。
// 改为挂载后再插入:用到这些字体的地方都写了系统字体兜底,字体到了再替换(display=swap)。
const FONT_CSS =
  'https://fonts.googleapis.com/css2?family=Ma+Shan+Zheng&family=Long+Cang&family=ZCOOL+XiaoWei&display=swap';

export function DeferredFonts() {
  useEffect(() => {
    if (document.querySelector(`link[href="${FONT_CSS}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = FONT_CSS;
    document.head.appendChild(link);
  }, []);
  return null;
}
