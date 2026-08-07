/**
 * Dev-only seam for rewriting webview URLs.
 *
 * Currently a passthrough in production: returns the server-provided URL
 * unchanged, or `undefined` when the server says the bus has no info page
 * (`features: []`). The downstream render gate
 * (`headerRight: infoUrl ? ... : undefined`) consumes that `undefined`
 * to hide the info entry — keeping the gate server-driven via the
 * `screen.features[]` SSOT in skkuverse-server.
 *
 * Older versions substituted a hardcoded fallback URL (`#/bus/hssc/info`)
 * when the server returned no URL — that pre-dated the server populating
 * `features[]` correctly, and it caused the info button to show on every
 * bus and route to the HSSC info page regardless of which bus the user
 * was viewing. Removed deliberately; do not reintroduce.
 */

export function devRewriteInfoUrl(serverUrl: string | undefined): string | undefined {
  // TODO: 개발 모드에서 로컬 dev 서버로 리다이렉트 복원 예정. SPA는 이제
  // skkuverse-web에 있으므로, 그 레포를 체크아웃해 `pnpm dev`로 띄운 주소를
  // 가리키게 된다.
  return serverUrl;
}
