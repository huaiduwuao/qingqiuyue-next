#!/usr/bin/env python3
"""
根据 ESLint `no-unused-vars` 输出批量移除未使用的 import。
仅处理 import 语句，不触碰业务变量（避免误删有副作用的解构）。

用法：
  python scripts/auto-remove-unused-imports.py unused-vars.txt
"""
import re
import sys
from pathlib import Path


def remove_unused_imports(file_path: Path, names: set[str]) -> bool:
    text = file_path.read_text(encoding='utf-8')
    original = text

    for name in sorted(names, key=len, reverse=True):
        # 1) default import: import X from '...'
        text = re.sub(
            rf"^import\s+{re.escape(name)}\s+from\s+(['\"])[^'\"]+\1;\n?",
            "",
            text,
            flags=re.MULTILINE,
        )

        # 2) namespace import: import * as X from '...'
        text = re.sub(
            rf"^import\s+\*\s+as\s+{re.escape(name)}\s+from\s+(['\"])[^'\"]+\1;\n?",
            "",
            text,
            flags=re.MULTILINE,
        )

        # 3) type-only import: import type { X, Y } from '...'
        #    Remove only the target name, keep the rest of the list.
        def repl_type(m: re.Match) -> str:
            inner = m.group(1)
            quote = m.group(2)
            path = m.group(3)
            new_inner = re.sub(
                rf"\b{re.escape(name)}\b\s*,?\s*",
                "",
                inner,
                count=1,
            )
            new_inner = new_inner.strip().rstrip(',')
            if not new_inner:
                return ""
            return f"import type {{ {new_inner} }} from {quote}{path}{quote};\n"

        text = re.sub(
            rf"^import\s+type\s+\{{([^}}]+)\}}\s+from\s+(['\"])([^'\"]+)\2;\n?",
            lambda m: repl_type(m) if name in m.group(1) else m.group(0),
            text,
            flags=re.MULTILINE,
        )

        # 4) named import in a list: { X } or { A, X, B }
        def repl_named(m: re.Match) -> str:
            inner = m.group(1)
            quote = m.group(2)
            path = m.group(3)
            # 去掉目标 name（可能带 type 前缀）
            new_inner = re.sub(
                rf"\b(?:type\s+)?{re.escape(name)}\b\s*,?\s*",
                "",
                inner,
                count=1,
            )
            new_inner = new_inner.strip().rstrip(',')
            if not new_inner:
                return ""
            return f"import {{ {new_inner} }} from {quote}{path}{quote};\n"

        text = re.sub(
            rf"import\s+\{{([^}}]+)\}}\s+from\s+(['\"])([^'\"]+)\2;\n?",
            lambda m: repl_named(m) if name in m.group(1) else m.group(0),
            text,
            flags=re.MULTILINE,
        )

    if text != original:
        file_path.write_text(text, encoding='utf-8')
        return True
    return False


def main():
    if len(sys.argv) < 2:
        print(f"usage: {sys.argv[0]} <unused-vars.txt>", file=sys.stderr)
        sys.exit(1)

    input_file = Path(sys.argv[1])
    if not input_file.exists():
        print(f"not found: {input_file}", file=sys.stderr)
        sys.exit(1)

    # file -> set of unused import names
    files: dict[str, set[str]] = {}
    for line in input_file.read_text(encoding='utf-8').splitlines():
        if not line.strip():
            continue
        # format: path:line:col: 'Name' is defined but never used
        m = re.match(r"^(.*):(\d+):(\d+):\s*'([^']+)'\s+is defined but never used", line)
        if not m:
            continue
        path, name = m.group(1), m.group(4)
        files.setdefault(path, set()).add(name)

    changed = 0
    for path_str, names in files.items():
        p = Path(path_str)
        if not p.exists():
            continue
        if remove_unused_imports(p, names):
            changed += 1
            print(f"cleaned {path_str}")

    print(f"\n{changed} file(s) changed")


if __name__ == '__main__':
    main()
