import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', 'public/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-var': 'error',
      'prefer-const': 'error',
      // Letter content must never be written to the console.
      'no-console': ['error', { allow: ['warn', 'error'] }],
      // Guards against the XSS sinks called out in SECURITY.md.
      'no-restricted-properties': [
        'error',
        {
          object: 'document',
          property: 'write',
          message: 'document.write is unsafe. Build nodes and append them instead.',
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "AssignmentExpression > MemberExpression[property.name='innerHTML']",
          message:
            'Assigning innerHTML is forbidden. Use textContent, or the sanitiser in src/components/security/sanitise.ts.',
        },
        {
          selector: "CallExpression[callee.name='eval']",
          message: 'eval() is forbidden and blocked by the Content-Security-Policy.',
        },
      ],
    },
  },
  {
    // Build scripts run in Node.
    files: ['scripts/**/*.mjs', '*.config.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      'no-console': 'off',
    },
  },
  {
    // The service worker sources run in a worker scope.
    files: ['src/components/service-worker/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.serviceworker, ...globals.browser },
    },
    rules: {
      'no-console': 'off',
      'no-undef': ['error', { typeof: false }],
    },
  },
  {
    files: ['tests/**/*.ts'],
    rules: {
      'no-console': 'off',
      'no-restricted-syntax': 'off',
    },
  },
);
