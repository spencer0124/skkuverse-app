/**
 * @mozilla/readability를 WebView 주입용 문자열 모듈로 벤더링한다.
 *
 * 왜: readability는 페이지의 JS 컨텍스트(WebView document) 안에서 돌아야 한다.
 * RN 번들에 import하면 앱 JS realm에 들어가 무용지물 — injectJavaScript로 페이지에
 * 흘려넣을 "소스 문자열"이 필요하다. 그래서 node_modules의 Readability.js 원본을
 * 그대로 문자열로 박제한 TS 모듈을 생성한다.
 *
 * 재생성: 의존성 bump 후
 *   node apps/mobile/scripts/vendor-readability.mjs
 * (결과 파일은 커밋한다. import하지 않으므로 런타임 devDependency여도 무방.)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');

const pkgJson = JSON.parse(
  readFileSync(resolve(repoRoot, 'node_modules/@mozilla/readability/package.json'), 'utf8'),
);
const src = readFileSync(
  resolve(repoRoot, 'node_modules/@mozilla/readability/Readability.js'),
  'utf8',
);

const out = `/**
 * ⚠️ 생성 파일 — 직접 수정하지 말 것.
 * @mozilla/readability v${pkgJson.version} 원본을 WebView 주입용 문자열로 박제.
 * 재생성: node apps/mobile/scripts/vendor-readability.mjs
 *
 * ⏰ 타임밤: @mozilla/readability 버전을 올리면 위 스크립트를 다시 돌려 동기화할 것.
 * (eslint.config.js의 ignores에 등록 — 이 파일은 린트 제외.)
 */
// prettier-ignore
export const READABILITY_VERSION = ${JSON.stringify(pkgJson.version)};
// prettier-ignore
export const READABILITY_SOURCE = ${JSON.stringify(src)};
`;

const dest = resolve(here, '../src/features/in-app-browser/readability.injected.ts');
writeFileSync(dest, out, 'utf8');
console.log(`vendored @mozilla/readability v${pkgJson.version} → ${dest} (${src.length} bytes)`);
