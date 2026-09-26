// Build a bundled game into one self-contained HTML page and write it as a TS
// string where the app imports it (apps/mobile/src/features/games/<id>/html.generated.ts).
//
// Shared by every game package's `build:embed`. The output is committed, so
// Metro, CI and EAS never run this; CI runs it and fails on a diff.
//
// The page is loaded from a string and may not fetch anything, so everything
// it needs has to be inside it: images become data URLs, the bundle's CSS is
// inlined into <style>, and any other file the build emits fails the build
// rather than being silently left behind.
import { writeFileSync } from 'node:fs';

/**
 * @param {object} o
 * @param {(config: object) => Promise<unknown>} o.build  Vite's `build`, from the game package's own vite.
 * @param {string} o.root        The game package.
 * @param {string} o.entry       The page's entry module.
 * @param {string} o.out         The html.generated.ts to write.
 * @param {string} o.exportName  The constant the app imports.
 * @param {string} o.libName     The IIFE's global name.
 * @param {string[]} o.header    Comment lines at the top of the generated file.
 * @param {string} o.css         The page's own base CSS (html, body, root elements).
 * @param {string} o.body        Markup before the script.
 * @param {unknown[]} [o.plugins]
 * @param {Record<string, string>} [o.define]
 */
export async function embedGame({ build, root, entry, out, exportName, libName, header, css, body, plugins = [], define = {} }) {
  const result = await build({
    root,
    configFile: false,
    logLevel: 'warn',
    plugins,
    define,
    build: {
      write: false,
      target: 'es2019',
      // Every asset becomes a data URL inside the script.
      assetsInlineLimit: Number.MAX_SAFE_INTEGER,
      lib: { entry, formats: ['iife'], name: libName, fileName: () => 'game.js' },
    },
  });
  const outputs = (Array.isArray(result) ? result : [result]).flatMap((r) => r.output);
  const chunks = outputs.filter((o) => o.type === 'chunk');
  if (chunks.length !== 1) throw new Error(`expected one chunk, got ${chunks.length}`);
  const assets = outputs.filter((o) => o.type === 'asset');
  const stray = assets.filter((a) => !a.fileName.endsWith('.css'));
  if (stray.length > 0) throw new Error(`the page cannot load emitted files: ${stray.map((a) => a.fileName).join(', ')}`);
  const bundleCss = assets.map((a) => String(a.source).trim()).filter(Boolean);

  // A literal `</script` or `</style` would end its tag early.
  const js = chunks[0].code.replace(/<\/script/gi, '<\\/script');
  const style = [css, ...bundleCss].join('\n').replace(/<\/style/gi, '<\\/style');

  const html = `<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<style>
${style}
</style></head>
<body>${body}
<script>${js}</script></body></html>`;

  writeFileSync(out, `${header.map((l) => `// ${l}\n`).join('')}export const ${exportName} = ${JSON.stringify(html)};\n`);
  console.log(`wrote ${out} (${(html.length / 1024).toFixed(1)} KiB)`);
}
