/*
 * 품질 감사 보조 — kits/cinematic/.render-tmp/dist를 고정 포트로 계속 띄운다(다른 측정 스크립트가 붙을 수
 * 있게). renderGenerated.mjs로 먼저 빌드해 둬야 한다.
 *   node tests/benchmark/cinematic/serveDist.mjs [port=4188]
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';

const DIST = join(process.cwd(), 'kits/cinematic/.render-tmp/dist');
const PORT = Number(process.argv[2] ?? 4188);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.mp4': 'video/mp4', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };

createServer((req, res) => {
  const p = decodeURIComponent((req.url ?? '/').split('?')[0]);
  let f = join(DIST, p === '/' ? 'index.html' : p);

  if (!existsSync(f)) {
    f = join(DIST, 'index.html');
  }

  res.writeHead(200, { 'Content-Type': MIME[extname(f)] ?? 'application/octet-stream' });
  res.end(readFileSync(f));
}).listen(PORT, '127.0.0.1', () => console.log(`serving ${DIST} at http://127.0.0.1:${PORT}/`));
