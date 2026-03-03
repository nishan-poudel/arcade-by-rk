/* eslint-env node */

module.exports = {
  root: true,
  extends: [
    'plugin:vue/vue3-recommended',
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  parser: 'vue-eslint-parser',
  parserOptions: {
    parser: '@typescript-eslint/parser',
    ecmaVersion: 'latest',
    sourceType: 'module',
    extraFileExtensions: ['.vue'],
  },
  env: {
    browser: true,
    node: true,
    es2021: true,
  },
  overrides: [
    {
      files: ['src/**/__tests__/**/*.spec.ts', 'src/**/__tests__/**/*.test.ts'],
      rules: {
        'no-unused-expressions': 'off',
      },
    },
  ],
  rules: {
    // Vue rules
    'vue/component-name-in-template-casing': ['error', 'PascalCase'],
    'vue/multi-word-component-names': 'off',
    'vue/singleline-html-element-content-newline': 'off',
    'vue/max-attributes-per-line': ['error', { singleline: 2, multiline: 2 }],
    'vue/first-attribute-newline': 'off',
    'vue/html-closing-bracket-newline': 'off',
    'vue/require-explicit-emits': 'warn',
    'vue/no-unused-components': 'warn',
    'vue/no-unused-vars': 'warn',
    'vue/attributes-order': 'warn',
    'vue/order-in-components': 'warn',

    // TypeScript rules
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/explicit-function-return-types': 'off',
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-non-null-assertion': 'warn',
    '@typescript-eslint/consistent-type-imports': 'warn',

    // Code Quality
    'no-console': process.env.NODE_ENV === 'production' ? 'error' : 'warn',
    'no-debugger': process.env.NODE_ENV === 'production' ? 'error' : 'warn',
    'no-var': 'error',
    'prefer-const': ['error', { destructuring: 'any', ignoreReadBeforeAssign: false }],
    'prefer-arrow-callback': 'error',
    'no-unused-expressions': 'error',
    'eqeqeq': ['error', 'always'],
    'no-eval': 'error',
    'no-implied-eval': 'error',

    // Best Practices
    'curly': ['error', 'all'],
    'dot-notation': 'warn',
    'no-duplicate-imports': 'error',
    'no-self-compare': 'error',
    'no-unmodified-loop-condition': 'error',
    'no-unreachable': 'error',
    'no-dupe-keys': 'error',
    'no-dupe-else-if': 'error',
    'no-constructor-return': 'error',
    'no-fallthrough': 'error',

    // Performance & Security
    'no-alert': 'warn',
    'no-empty-function': 'warn',
    'no-loops': 'off', // Allow loops, but prefer array methods
    'no-nested-ternary': 'warn',
    'complexity': ['warn', 15],

    // Formatting (let Prettier handle)
    'indent': 'off',
    'quotes': 'off',
    'semi': 'off',
    'comma-dangle': 'off',
    'object-curly-spacing': 'off',
    'arrow-spacing': 'off',
  },
}
