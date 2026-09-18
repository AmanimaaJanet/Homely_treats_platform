import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

/**
 * ESLint, tuned for this codebase rather than the generic blog setup.
 *
 * The rules chosen are the ones that catch real bugs here:
 *   • undefined variables — the class of mistake that once deleted four admin routes.
 *   • unused variables — dead code that hides intent (warn, not error, on args).
 *   • no-const-assign / no-dupe-keys — the "Assignment to constant variable" bug that a
 *     PICKUP-with-time-slot order hit in testing.
 *   • eqeqeq, no-var, prefer-const — habits that keep future edits safe.
 *
 * Formatting is deliberately NOT linted: a bakery owner running `npm run lint` should
 * get real problems, not an opinion about semicolons.
 */
export default [
  { ignores: ['dist/**', 'node_modules/**', 'coverage/**', 'public/sw.js'] },

  js.configs.recommended,

  // Browser code (React app)
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      // The hooks rules earn their place here: a missing dependency in a data-loading
      // effect is how a screen silently shows stale orders. Three of the newest rules
      // are switched off deliberately, with reasons, rather than contorting working code:
      //  • set-state-in-effect — the app loads data in effects (the standard pattern for
      //    a plain fetch layer); the rule wants a query library this app doesn't use.
      //  • refs — writing a ref during render is how the tracking page keeps its latest
      //    loader and reference available to a WebSocket callback. It is intentional and
      //    cannot cause a stale render.
      //  • immutability — accumulator loops inside render (the donut chart) are fine.
      ...reactHooks.configs.recommended.rules,
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/immutability': 'off',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      'no-undef': 'error',
      'no-const-assign': 'error',
      'no-dupe-keys': 'error',
      'no-dupe-args': 'error',
      'no-unreachable': 'error',
      eqeqeq: ['warn', 'smart'],
      'prefer-const': 'warn',
      'no-var': 'error',
      // React 17+ JSX transform: React need not be in scope, so don't demand it, and
      // unused imports of components are worth flagging but not worth failing a build.
      'no-unused-vars': ['warn', { args: 'none', varsIgnorePattern: '^(React|[A-Z_])', caughtErrors: 'none' }],
    },
  },

  // Build scripts (Node): bundle checker run by `npm run check:bundle` and CI.
  {
    files: ['scripts/**/*.mjs', 'scripts/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      // Build tooling talks to whoever is running the build; that is its job.
      'no-console': 'off',
    },
  },

  // Service worker + test setup (browser + serviceworker globals)
  {
    files: ['public/**/*.js', 'vitest.setup.js', 'vite.config.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.serviceworker, ...globals.node },
    },
    rules: { 'no-unused-vars': 'off' },
  },

  // Tests
  {
    files: ['src/**/*.test.{js,jsx}', 'tests/**/*.{js,jsx}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node, ...globals.vitest },
    },
  },
];
