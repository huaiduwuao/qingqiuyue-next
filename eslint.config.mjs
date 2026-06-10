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
  // Override default ignores of eslint-config-next.
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    'public/**',
  ]),
])

export default eslintConfig
