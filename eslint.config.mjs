import blitzPlugin from '@blitz/eslint-plugin';
import { jsFileExtensions } from '@blitz/eslint-plugin/dist/configs/javascript.js';
import { getNamingConventionRule, tsFileExtensions } from '@blitz/eslint-plugin/dist/configs/typescript.js';

const recommendedConfigs = blitzPlugin.configs.recommended();

/*
 * Flat config requires a rule's plugin to be registered on the SAME config object that sets a
 * non-'off' value for it — reuse the exact @typescript-eslint plugin instance blitzPlugin already
 * resolved (rather than a separate import, which could pull a different version) instead of
 * re-declaring it.
 */
const typescriptEslintPlugin = recommendedConfigs.find((config) => config.plugins?.['@typescript-eslint'])?.plugins[
  '@typescript-eslint'
];

export default [
  {
    ignores: ['**/dist', '**/node_modules', '**/.wrangler', '**/bolt/build', '**/.history'],
  },
  ...recommendedConfigs,
  {
    rules: {
      '@blitz/catch-error-name': 'off',
      '@typescript-eslint/no-this-alias': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@blitz/comment-syntax': 'off',
      '@blitz/block-scope-case': 'off',
      'array-bracket-spacing': ['error', 'never'],
      'object-curly-newline': ['error', { consistent: true }],
      'keyword-spacing': ['error', { before: true, after: true }],
      'consistent-return': 'error',
      semi: ['error', 'always'],
      curly: ['error'],
      'no-eval': ['error'],
      'linebreak-style': ['error', 'unix'],
      'arrow-spacing': ['error', { before: true, after: true }],
    },
  },
  {
    files: ['**/*.tsx'],
    rules: {
      ...getNamingConventionRule({}, true),
    },
  },
  {
    files: ['**/*.d.ts'],
    rules: {
      '@typescript-eslint/no-empty-object-type': 'off',
    },
  },
  {
    files: [...tsFileExtensions, ...jsFileExtensions, '**/*.tsx'],
    ignores: ['functions/*', 'electron/**/*'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../'],
              message: "Relative imports are not allowed. Please use '~/' instead.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts'],
    plugins: { '@typescript-eslint': typescriptEslintPlugin },
    rules: {
      /*
       * The recurring "Unexpected empty ... function" warning (auth.ts's no-op cleanup when
       * Supabase isn't configured, QuotaBar.tsx's silent .catch(), Artifact.spec.ts's mock
       * abort()) is always this exact shape — an intentional no-op arrow function, not a
       * forgotten function body. Allowing it removes the false-positive noise without weakening
       * the rule for actual empty function declarations or methods, which still get flagged.
       */
      '@typescript-eslint/no-empty-function': ['warn', { allow: ['arrowFunctions'] }],
    },
  },
];
