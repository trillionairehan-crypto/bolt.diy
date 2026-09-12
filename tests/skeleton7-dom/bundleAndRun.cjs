/*
 * app/ 내부 소스(확장자 없는 상대 import 사용)를 import하는 스크립트를 node로 직접 실행할 수
 * 없어서(네이티브 ESM 로더는 확장자 필수) esbuild로 번들 후 실행한다. tests/benchmark와 동일한
 * 패턴 — 대상 스크립트 경로를 인자로 받는다: node bundleAndRun.cjs <entry.ts>
 */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const esbuild = require('./../../node_modules/.pnpm/esbuild@0.23.1/node_modules/esbuild/lib/main.js');

const entry = process.argv[2];

if (!entry) {
  console.error('usage: node bundleAndRun.cjs <entry.ts>');
  process.exit(1);
}

const ROOT = path.resolve(__dirname, '..', '..');

// tsconfig.json paths + Vite의 ~/ 별칭. esbuild가 tsconfig paths는 읽지만 ?raw 쿼리는 모른다.
const ALIASES = {
  '~design-handoff/': 'design-handoff/',
  '~cinematic-kit/': 'kits/cinematic/src/',
  '~/': 'app/',
};

/**
 * Vite의 `?raw`(파일 원문을 문자열로) 처리. 이게 없으면 esbuild가 쿼리를 무시하고 대상 파일을 평범한
 * 모듈로 번들해서, CSS는 조용히 빈 객체({} → "[object Object]")가 되고 TS/TSX는
 * `No matching export ... for import "default"`로 빌드가 죽는다.
 */
const rawLoader = {
  name: 'vite-raw-query',
  setup(build) {
    build.onResolve({ filter: /\?raw$/ }, (args) => {
      const clean = args.path.replace(/\?raw$/, '');
      const aliased = Object.entries(ALIASES).find(([prefix]) => clean.startsWith(prefix));
      const resolved = aliased
        ? path.join(ROOT, aliased[1], clean.slice(aliased[0].length))
        : path.resolve(path.dirname(args.importer), clean);

      return { path: resolved, namespace: 'vite-raw' };
    });

    build.onLoad({ filter: /.*/, namespace: 'vite-raw' }, (args) => ({
      contents: JSON.stringify(fs.readFileSync(args.path, 'utf-8')),
      loader: 'json',
    }));
  },
};

const outfile = path.join(__dirname, '.bundled-' + path.basename(entry, '.ts') + '.mjs');

esbuild
  .build({
    entryPoints: [entry],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile,
    external: ['playwright'],
    plugins: [rawLoader],
    logLevel: 'warning',
  })
  .then(() => {
    execFileSync(process.execPath, [outfile, ...process.argv.slice(3)], { stdio: 'inherit' });
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
