import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // 本库大量 mock/handlers 故意使用 any 与示例性未用导出,
    // 降为 warning:保留提示但不让 `npm run lint` 因存量代码失败。
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': 'warn',
      // React Compiler 实验性规则:对未启用 RC 的存量代码误报率高,降为提示
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/static-components': 'warn',
      'react-hooks/refs': 'warn',
      // 纯文案转义洁癖(JSX 里的引号/撇号),非 bug
      'react/no-unescaped-entities': 'warn',
    },
  },
  // 防止暗色硬编码回退:在 app/components 内禁止裸写暗色十六进制值,
  // 强制使用 theme.palette.* 或 CSS 变量(--bg-*/--text-*)。
  // styles/tokens 与强制暗色的沉浸式页面通过 ignores 排除。
  {
    files: ['src/app/**/*.{ts,tsx}', 'src/components/**/*.{ts,tsx}'],
    ignores: [
      'src/styles/**',
      'src/app/(public)/wallpaper/**',
      'src/app/(public)/recharge/**',
      'src/app/(public)/download/**',
      'src/app/(public)/search/**',
      'src/app/(public)/detail/comics-detail/**',
      'src/app/(admin)/system/log/**',
    ],
    rules: {
      'no-restricted-syntax': [
        'warn',
        {
          selector: 'Literal[value=/#252836|#0A0B14|#0a0a0f|#1E2030|#161821/]',
          message: '避免硬编码暗色值,请使用 theme.palette.* 或 CSS 变量(--bg-*/--text-*)。',
        },
      ],
    },
  },
  // MUI v9 破坏性变更:sx 里尺寸属性(width/height/min*/max*/size)的值 ≤ 1 时,
  // sizingTransform 会把它当"比例"输出成百分比 —— `height: 1` 是 `100%` 而不是 `1px`。
  // 无限滚动哨兵写成 `sx={{ height: 1 }}` 会撑满整个列表高度,IntersectionObserver
  // 永远判定"已到底",触发无限请求 + 大片空白。写 '1px' 才是本意。
  // 只在 sx={{…}} 里生效,免得误伤 dataGrid 列定义之类的普通对象。
  {
    files: ['src/app/**/*.{ts,tsx}', 'src/components/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "JSXAttribute[name.name='sx'] ObjectExpression Property[key.name=/^(width|height|minWidth|minHeight|maxWidth|maxHeight|size)$/][value.value=1]",
          message:
            "MUI v9 把 sx 里尺寸值 1 当成 100%(sizingTransform),不是 1px。要 1px 请写 '1px'。",
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    'public/**',
    'src-tauri/target/**',
    'node_modules/**',
  ]),
])

export default eslintConfig
