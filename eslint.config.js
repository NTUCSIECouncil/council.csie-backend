import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'
import importX from 'eslint-plugin-import-x'
import stylistic from '@stylistic/eslint-plugin'
import tsParser from '@typescript-eslint/parser'


export default tseslint.config(
  {
    files: ['src/**/*.ts', 'test/**/*.ts', 'scripts/**/*.ts'],
    languageOptions: {
      // For import-x support
      parser: tsParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
      // For typescript-eslint support
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      '@stylistic': stylistic,
    },
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.strictTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
      importX.flatConfigs.typescript,
      stylistic.configs.customize({
        semi: true,
        braceStyle: '1tbs'
      }),
    ],
    rules: {
      'sort-imports': ['warn', { ignoreDeclarationSort: true }],

      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-empty-object-type': ['error', { allowInterfaces: 'with-single-extends' }],
      '@typescript-eslint/use-unknown-in-catch-callback-variable': 'off',
      '@typescript-eslint/consistent-type-imports': ['warn', { fixStyle: 'inline-type-imports' }],

      'import-x/order': ['warn', {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
        alphabetize: { order: 'asc' },
      }],
      'import-x/export': 'error',
      'import-x/no-duplicates': 'warn',
      'import-x/consistent-type-specifier-style': ['warn', 'prefer-inline'],

      '@stylistic/max-statements-per-line': 'off',
    },
  },
  {
    files: ['test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-member-access': ['off'],
    },
  },
)
