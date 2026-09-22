// 沙盒抓取脚本模板库。
//
// 用途:运营要补一个新站时不用从零写脚本 —— 挑一个最接近的骨架,改改
// 选择器/URL 就能跑。跑通之后再把"取数逻辑"沉淀成框架的 js_extract,
// 或者长期挂沙盒。
//
// 约定(很重要):每个脚本都必须把结果写成 JSON 数组落到 /workspace/result.json,
// 元素形如 {chapterid, title, body}。这样「一键入库」按钮才能解析它:
//
//   import json
//   json.dump([{"chapterid": 1, "title": "第一章", "body": "正文..."}], open("/workspace/result.json", "w"))
//
// 输出到 stdout 的日志会实时回传到任务详情页,方便调试。

export interface SandboxScriptTemplate {
  /** 唯一 id,前端下拉的 value */
  id: string;
  /** 下拉里显示的名字 */
  name: string;
  /** 一句话说明适用场景 */
  description: string;
  /** 需要哪个镜像(按名字匹配,匹配不上就让运营自己挑) */
  imageHint: string;
  /** 代码骨架 */
  code: string;
}

// 占位符会在插入代码时被替换成运营填的值。
// 用 {{BOOK_URL}} 这种双花括号,避免和 Python 的 {} 冲突。
export const PLACEHOLDER_BOOK_URL = '{{BOOK_URL}}';
export const PLACEHOLDER_FROM = '{{FROM}}';
export const PLACEHOLDER_TO = '{{TO}}';

export const SANDBOX_SCRIPT_TEMPLATES: SandboxScriptTemplate[] = [
  {
    id: 'blank',
    name: '空白脚本',
    description: '什么都不预置,自己写',
    imageHint: 'python:3.13-slim',
    code: `#!/usr/bin/env python3
import json

# 结果必须落到这个文件,元素形如 {chapterid, title, body}
json.dump([], open("/workspace/result.json", "w"))
print("done")
`,
  },
  {
    id: 'static_html',
    name: '静态 HTML 抓正文',
    description: '页面直出 HTML 的站(笔趣阁系、大多数小说站)。requests + BeautifulSoup,最快。',
    imageHint: 'python:3.13-slim',
    code: `#!/usr/bin/env python3
"""静态 HTML 抓正文 —— 页面直出 HTML 的站用这个。

要点:
  1. 先 requests 拿 HTML,再 BeautifulSoup 按 CSS 选择器抽正文。
  2. 加 UA / Referer 头,有些站会拒空 UA。
  3. 结果落 /workspace/result.json,元素 {chapterid, title, body}。
"""
import json
import time
import requests
from bs4 import BeautifulSoup

BASE = "{{BOOK_URL}}"           # 书籍页,如 https://www.example.com/book/123/
FROM_CH = {{FROM}}              # 起始章
TO_CH = {{TO}}                  # 结束章

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/120.0 Safari/537.36",
    "Referer": BASE,
}

def fetch(url):
    r = requests.get(url, headers=HEADERS, timeout=20)
    r.encoding = r.apparent_encoding or "utf-8"
    r.raise_for_status()
    return r.text

def parse_chapter(html):
    """按站点结构改这里。"""
    soup = BeautifulSoup(html, "html.parser")
    node = soup.select_one("#content, .content, #chaptercontent, article")
    if not node:
        return ""
    return node.get_text("\\n", strip=True)

def main():
    out = []
    for ch in range(FROM_CH, TO_CH + 1):
        # 章节 URL 规律也要按站点改,常见形如 /book/123/456.html
        url = f"{BASE.rstrip('/')}/chapter/{ch}.html"
        try:
            body = parse_chapter(fetch(url))
        except Exception as e:
            print(f"[ch{ch}] ERR {e}")
            continue
        if len(body) < 200:
            print(f"[ch{ch}] body too short ({len(body)}), skip")
            continue
        out.append({"chapterid": ch, "title": f"第{ch}章", "body": body})
        print(f"[ch{ch}] ok {len(body)}B")
        time.sleep(0.5)   # 别把人家打疼

    json.dump(out, open("/workspace/result.json", "w"), ensure_ascii=False)
    print(f"saved {len(out)} chapters")

if __name__ == "__main__":
    main()
`,
  },
  {
    id: 'api_token',
    name: 'API + 一次性 token 抓正文',
    description: '正文不在 DOM 里、由前端 JS 拿 token 再调 API 的站(bqg616 这种 hash SPA)。用 Playwright 进页面执行站点自己的 JS。',
    imageHint: 'python:3.13-slim',
    code: `#!/usr/bin/env python3
"""API + 一次性 token 抓正文 —— 正文不在 DOM 里的站用这个。

原理:这类站的正文由前端 JS 生成 token 后调远端 API 拿,HTTP 直接抓页面
永远是空壳。所以用 Playwright 打开页面,在页面上下文里执行**站点自己的**
取数函数,直接拿结构化结果。

跑之前先手动确认:浏览器 F12 里能找到类似 window.get_api("chapter", {...})
的函数,返回一个带签名的 URL,curl 它能拿到 JSON。
"""
import json
from playwright.sync_api import sync_playwright

BOOK_URL = "{{BOOK_URL}}"        # 站点首页或书籍页(JS 全局函数在那儿才注册)
BOOK_ID = 0                      # TODO: 填站点的 book id
FROM_CH = {{FROM}}
TO_CH = {{TO}}

# 在页面里执行的 JS。必须 return 一个 JSON 字符串。
# {from} {to} {book_id} 会在 Python 侧先替换掉。
JS = """
(async () => {
  const out = [];
  for (let i = %d; i <= %d; i++) {
    try {
      const u = get_api("chapter", { id: %d, chapterid: i });   // TODO: 改成站点的取数函数
      const j = await (await fetch(u)).json();
      out.push({ chapterid: j.chapterid, title: j.chaptername, body: j.txt });
    } catch (e) {
      out.push({ chapterid: i, err: String(e.message || e) });
    }
  }
  return JSON.stringify(out);
})()
""" % (FROM_CH, TO_CH, BOOK_ID)

def main():
    with sync_playwright() as p:
        # 连沙盒外的无头浏览器(cloakserve),或本地起一个
        browser = p.chromium.launch(args=["--no-sandbox"])
        page = browser.new_page()
        page.goto(BOOK_URL, wait_until="networkidle", timeout=60000)
        page.wait_for_timeout(3000)      # 等站点 JS 注册好全局函数

        raw = page.evaluate(JS)
        chapters = json.loads(raw)
        browser.close()

    out = [c for c in chapters if c.get("body") and len(c["body"]) >= 200]
    for c in out:
        print(f"[ch{c['chapterid']}] ok {len(c['body'])}B")
    json.dump(out, open("/workspace/result.json", "w"), ensure_ascii=False)
    print(f"saved {len(out)} chapters")

if __name__ == "__main__":
    main()
`,
  },
  {
    id: 'playwright_render',
    name: 'Playwright 渲染后抓 DOM',
    description: '正文在 DOM 里、但需要 JS 渲染才能出来(常规 SPA)。等选择器出现再抽。',
    imageHint: 'python:3.13-slim',
    code: `#!/usr/bin/env python3
"""Playwright 渲染后抓 DOM —— 需要 JS 渲染的普通 SPA 用这个。

和「API + token」的区别:这个站的正文渲染完就在 DOM 里,不需要调额外接口。
和「静态 HTML」的区别:直接 requests 拿到的 HTML 是空壳。
"""
import json
from playwright.sync_api import sync_playwright

BASE = "{{BOOK_URL}}"
FROM_CH = {{FROM}}
TO_CH = {{TO}}

CHAPTER_URL = "%s#/chapter/123/%%d" % BASE   # TODO: 改成站点的章节 URL 规律
CONTENT_SEL = "#chaptercontent"              # TODO: 改成站点正文容器的选择器

def main():
    out = []
    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--no-sandbox"])
        page = browser.new_page()
        for ch in range(FROM_CH, TO_CH + 1):
            url = CHAPTER_URL % ch
            try:
                page.goto(url, wait_until="domcontentloaded", timeout=45000)
                page.wait_for_selector(CONTENT_SEL, timeout=20000)
                body = page.inner_text(CONTENT_SEL).strip()
            except Exception as e:
                print(f"[ch{ch}] ERR {e}")
                continue
            if len(body) < 200:
                print(f"[ch{ch}] too short ({len(body)}), skip")
                continue
            out.append({"chapterid": ch, "title": f"第{ch}章", "body": body})
            print(f"[ch{ch}] ok {len(body)}B")
        browser.close()

    json.dump(out, open("/workspace/result.json", "w"), ensure_ascii=False)
    print(f"saved {len(out)} chapters")

if __name__ == "__main__":
    main()
`,
  },
  {
    id: 'catalog_only',
    name: '只发现目录(不抓正文)',
    description: '先摸清一个站的章节列表长什么样、有多少章。用于探路阶段。',
    imageHint: 'python:3.13-slim',
    code: `#!/usr/bin/env python3
"""只发现目录 —— 探路用。

先跑这个摸清站点的章节目录长什么样、一共多少章,再去调正文脚本。
结果同样落 /workspace/result.json,但 body 为空。
"""
import json
import requests
from bs4 import BeautifulSoup

BOOK_URL = "{{BOOK_URL}}"
HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                         "(KHTML, like Gecko) Chrome/120.0 Safari/537.36"}

def main():
    r = requests.get(BOOK_URL, headers=HEADERS, timeout=20)
    r.encoding = r.apparent_encoding or "utf-8"
    soup = BeautifulSoup(r.text, "html.parser")

    # TODO: 改成站点的目录容器选择器
    links = soup.select("#list dd a, .chapter-list a, a[href*='/chapter/']")
    out = []
    for i, a in enumerate(links):
        href = a.get("href", "")
        if not href:
            continue
        out.append({
            "chapterid": i + 1,
            "title": a.get_text(strip=True),
            "url": href if href.startswith("http") else BOOK_URL.rstrip("/") + "/" + href.lstrip("/"),
            "body": "",
        })
    print(f"found {len(out)} chapters")
    for c in out[:10]:
        print("  ", c["title"], c["url"])

    json.dump(out, open("/workspace/result.json", "w"), ensure_ascii=False)

if __name__ == "__main__":
    main()
`,
  },
];

/** 按镜像名找最接近的模板建议(仅用于新建任务时预选镜像)。 */
export function suggestTemplateByImage(imageName: string): SandboxScriptTemplate | undefined {
  return SANDBOX_SCRIPT_TEMPLATES.find((t) => t.imageHint === imageName);
}
