// ESLint flat config for the whole workspace (ESLint 9+).
// Every project is linted from here; projects do not carry their own config.
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import angular from 'angular-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';
import { defineConfig, globalIgnores } from 'eslint/config';

/** Projects written with Angular (components, modules, DI). */
const ANGULAR_PROJECTS = ['packages/angular-cli', 'apps/demo-angular', 'apps/docs'];

export default defineConfig([
    globalIgnores([
        '**/dist/**',
        '**/node_modules/**',
        '**/out/**',
        '**/.nx/**',
        '**/coverage/**',
        'packages/cli/wasm/pkg/**',
        'packages/cli/wasm/target/**',
        'tools/templates/**',
    ]),

    // ── TypeScript (all packages, plugins and apps) ──────────────────────
    {
        files: ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts'],
        extends: [js.configs.recommended, tseslint.configs.recommended],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: { ...globals.browser, ...globals.node },
        },
        rules: {
            quotes: ['error', 'single', { avoidEscape: true }],
            semi: ['error', 'always'],
            'no-unused-vars': 'off',
            '@typescript-eslint/no-unused-vars': 'off',
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-this-alias': 'off',
            'no-prototype-builtins': 'off',
            'no-case-declarations': 'off',
            // A terminal library matches ANSI escape sequences (\x1b) on purpose.
            'no-control-regex': 'off',
        },
    },

    // ── Jasmine specs ───────────────────────────────────────────────────
    {
        files: ['**/*.spec.ts'],
        languageOptions: { globals: { ...globals.jasmine } },
    },

    // ── Angular projects ────────────────────────────────────────────────
    {
        files: ANGULAR_PROJECTS.map((p) => `${p}/**/*.ts`),
        extends: [...angular.configs.tsRecommended],
        processor: angular.processInlineTemplates,
        rules: {
            '@angular-eslint/no-empty-lifecycle-method': 'off',
            '@angular-eslint/no-output-on-prefix': 'off',
            '@angular-eslint/prefer-inject': 'off',
            '@angular-eslint/prefer-standalone': 'off',
        },
    },
    {
        files: ANGULAR_PROJECTS.map((p) => `${p}/**/*.html`),
        extends: [...angular.configs.templateRecommended],
        rules: {
            '@angular-eslint/template/no-any': 'error',
        },
    },

    // ── React (react-cli package and React demos) ───────────────────────
    {
        files: ['**/*.tsx', 'packages/react-cli/**/*.ts', 'apps/demo-react/**/*.ts', 'apps/demo-minimal/**/*.ts'],
        extends: [reactHooks.configs.flat.recommended],
    },

    // ── Plain JS tooling (workspace scripts, karma config) ──────────────
    {
        files: ['tools/**/*.js', '**/karma.conf.js'],
        extends: [js.configs.recommended],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'commonjs',
            globals: { ...globals.node },
        },
    },
    {
        files: ['**/*.mjs', '**/*.config.js'],
        extends: [js.configs.recommended],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: { ...globals.node },
        },
    },

    // Prettier owns formatting; this must stay last.
    prettier,
]);
