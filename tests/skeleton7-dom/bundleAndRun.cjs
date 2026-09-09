/*
 * app/ 내부 소스(확장자 없는 상대 import 사용)를 import하는 스크립트를 node로 직접 실행할 수
 * 없어서(네이티브 ESM 로더는 확장자 필수) esbuild로 번들 후 실행한다. tests/benchmark와 동일한
 * 패턴 — 대상 스크립트 경로를 인자로 받는다: node bundleAndRun.cjs <entry.ts>
 */
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const esbuild = require('./../../node_modules/.pnpm/esbuild@0.23.1/node_modules/esbuild/lib/main.js');

const entry = process.argv[2];

if (!entry) {
  console.error('usage: node bundleAndRun.cjs <entry.ts>');
  process.exit(1);
}

const outfile = path.join(__dirname, '.bundled-' + path.basename(entry, '.ts') + '.mjs');

esbuild.buildSync({
  entryPoints: [entry],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile,
  external: ['playwright'],
  logLevel: 'warning',
});

execFileSync(process.execPath, [outfile, ...process.argv.slice(3)], { stdio: 'inherit' });
