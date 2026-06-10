export function cns(classes: Array<string | object>): string {
  return classes.join(' ');
}

/* eslint no-useless-escape:0 import/prefer-default-export:0 */
const reg = /(((^https?:(?:\/\/)?)(?:[-;:&=\+\$,\w]+@)?[A-Za-z0-9.-]+(?::\d+)?|(?:www.|[-;:&=\+\$,\w]+@)[A-Za-z0-9.-]+)((?:\/[\+~%\/.\w-_]*)?\??(?:[-\+=&;%@.\w_]*)#?(?:[\w]*))?)$/;
export const isUrl = (path: string): boolean => reg.test(path);

export const getPageQuery = () => {
  if (typeof window === 'undefined') return {};
  const url = new URL(window.location.href);
  const params: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    params[key] = value;
  });
  if (params['id']?.includes('#')) {
    params['id'] = params['id'].split('#')[0];
  }
  return params;
};

export const os = function () {
  if (typeof navigator === 'undefined') {
    return { isTablet: false, isPhone: false, isAndroid: false, isPc: true };
  }
  const ua = navigator.userAgent;
  const isWindowsPhone = /(?:Windows Phone)/.test(ua);
  const isSymbian = /(?:SymbianOS)/.test(ua) || isWindowsPhone;
  const isAndroid = /(?:Android)/.test(ua);
  const isFireFox = /(?:Firefox)/.test(ua);
  const isTablet = /(?:iPad|PlayBook)/.test(ua) || (isAndroid && !/(?:Mobile)/.test(ua)) || (isFireFox && /(?:Tablet)/.test(ua));
  const isPhone = /(?:iPhone)/.test(ua) && !isTablet;
  const isPc = !isPhone && !isAndroid && !isSymbian;
  return {
    isTablet,
    isPhone,
    isAndroid,
    isPc,
  };
}();

export const isImg = /^http(s)?:\/\/([\w-]+\.)+[\w-]+(\/[\w-./?%&=]*)?/;

export const toTree = (data: any[]): any[] => {
  if (data == null) {
    return [];
  }

  function loop(pid: any): any[] {
    const res = [];
    for (let i = 0; i < data.length; i += 1) {
      const item = data[i];
      if (item.pid === pid) {
        item.children = loop(item.id);
        res.push({
          ...item,
          name: item.value,
        });
      }
    }
    return res;
  }

  return loop(null);
};

export const fallbackImg = 'https://gd-hbimg.huaban.com/1ea0aeffa1ac3f9440333cca9d9abb9c2570a50f5f80-7VubY8_fw658';

export const groupBy = (array: any[], f: (item: any) => string): Record<string, any[]> => {
  const map: Record<string, any[]> = {};

  array.forEach(function (obj) {
    const key = f(obj);
    const value = map[key] || [];
    value.push(obj);
    map[key] = value;
  });
  return map;
};
