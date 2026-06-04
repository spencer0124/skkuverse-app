// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // 생성/벤더 파일 — @mozilla/readability 원본 박제(vendor-readability.mjs).
    ignores: ['dist/*', 'src/features/in-app-browser/readability.injected.ts'],
  },
  {
    rules: {
      'import/no-unresolved': 'off',
    },
  },
]);
