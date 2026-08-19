import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const lintProfile = process.env.ESLINT_PROFILE || 'baseline';
const strictLint = lintProfile === 'strict' || lintProfile === 'audit';
const auditLint = lintProfile === 'audit';

const stagedRules = strictLint
  ? {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
      '@typescript-eslint/no-non-null-assertion': 'error',
      'react-hooks/exhaustive-deps': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      curly: ['error', 'all'],
    }
  : {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/consistent-type-imports': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      'react-hooks/exhaustive-deps': 'off',
      eqeqeq: 'off',
      curly: 'off',
    };

const auditRules = auditLint
  ? {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      complexity: ['warn', 20],
      'max-depth': ['warn', 4],
      'max-lines': ['warn', { max: 700, skipBlankLines: true, skipComments: true }],
    }
  : {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'no-console': 'off',
      complexity: 'off',
      'max-depth': 'off',
      'max-lines': 'off',
    };

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'public/uploads/**', 'coverage/**', 'server.js'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'no-useless-assignment': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
      ...stagedRules,
      ...auditRules,
    },
    plugins: {
      'react-hooks': reactHooks,
    },
  },
  ...(strictLint
    ? [
        {
          files: ['**/*.{ts,tsx}'],
          languageOptions: {
            parserOptions: {
              projectService: true,
              tsconfigRootDir: import.meta.dirname,
            },
          },
          rules: {
            '@typescript-eslint/await-thenable': 'error',
            '@typescript-eslint/no-floating-promises': 'error',
            '@typescript-eslint/no-misused-promises': [
              'error',
              { checksVoidReturn: { arguments: false, attributes: false } },
            ],
            ...(auditLint
              ? {
                  '@typescript-eslint/no-unsafe-argument': 'warn',
                  '@typescript-eslint/no-unsafe-assignment': 'warn',
                  '@typescript-eslint/no-unsafe-call': 'warn',
                  '@typescript-eslint/no-unsafe-member-access': 'warn',
                  '@typescript-eslint/no-unsafe-return': 'warn',
                }
              : {}),
          },
        },
      ]
    : []),
  eslintConfigPrettier,
);
