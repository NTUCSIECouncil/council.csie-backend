import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'
import stylistic from '@stylistic/eslint-plugin'
import importx from 'eslint-plugin-import-x'
import { FlatCompat } from '@eslint/eslintrc';

// The eslint-import-plugin has been replaced with eslint-import-plugin-x
// Need to be reconsidered when appropriate


const compat = new FlatCompat();

export default tseslint.config(
  {
    files: ['src/**/*.ts', 'test/**/*.ts', 'scripts/**/*.ts'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'import-x': importx,
      '@stylistic': stylistic,
    },
    settings: {
      'import-x/parsers': {
        '@typescript-eslint/parser': ['.ts', '.tsx'],
      },
      'import-x/resolver': {
        // Load <rootdir>/tsconfig.json
        typescript: true,
        node: true,
      },
    },
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.strictTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
      ...compat.config(importx.configs.recommended),
      ...compat.config(importx.configs.typescript),
      stylistic.configs.customize({
        semi: true,
        braceStyle: '1tbs'
      }),
    ],
    rules: {
      'sort-imports': ['warn', { ignoreDeclarationSort: true }],

      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-empty-object-type': ['error', { allowInterfaces: 'with-single-extends' }],

      '@stylistic/max-statements-per-line': 'off',

      'import-x/order': ['warn', {
        groups: ["builtin", "external", "internal", "parent", "sibling", "index"],
        alphabetize: { order: 'asc' },
      }],
    },
  },
)
