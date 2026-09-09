/*
 * 골격 7 DOM 검증용 — 픽스처(JSON 플랫 파일맵)를 실제 디스크에 써서 vite로 빌드하고 정적
 * 서버로 띄운다. node_modules는 이 프로젝트 루트 것을 그대로 쓴다(픽스처가 실제 생성물과
 * 같은 의존성 — react/react-dom/lucide-react — 을 쓰므로 별도 설치 불필요, 이 디렉터리
 * 자체가 프로젝트 안에 있어 상위 탐색으로 자연히 resolve된다).
 */
import { spawn } from 'node:child_process';
import { createServer as createHttpServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TMP_ROOT = join(__dirname, '.tmp');
const VITE_JS = join(__dirname, '..', '..', 'node_modules', 'vite', 'bin', 'vite.js');

export type FixtureRecord = Record<string, string>; // '/home/project/...' -> content

function writeFixture(dir: string, files: FixtureRecord) {
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }

  mkdirSync(dir, { recursive: true });

  for (const [rawPath, content] of Object.entries(files)) {
    const rel = rawPath.replace(/^\/home\/project\//, '');
    const abs = join(dir, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content, 'utf8');
  }
}

function runVite(args: string[], cwd: string): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [VITE_JS, ...args], { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.stderr.on('data', (d) => (stderr += d.toString()));
    child.on('error', reject);
    child.on('close', (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

function serveStatic(rootDir: string, port: number) {
  const server = createHttpServer((req, res) => {
    let urlPath = (req.url ?? '/').split('?')[0];

    if (urlPath === '/') {
      urlPath = '/index.html';
    }

    const abs = join(rootDir, urlPath);

    if (!existsSync(abs)) {
      res.writeHead(404);
      res.end('not found');

      return;
    }

    const ext = extname(abs);
    res.writeHead(200, { 'Content-Type': MIME[ext] ?? 'application/octet-stream' });
    res.end(readFileSync(abs));
  });

  return new Promise<{ url: string; close: () => Promise<void> }>((resolve) => {
    server.listen(port, () => {
      resolve({
        url: `http://localhost:${port}/`,
        close: () => new Promise((res) => server.close(() => res())),
      });
    });
  });
}

let nextPort = 46173;

/** 픽스처를 빌드해 정적 서버로 띄운다. 실패 시 stderr를 포함해 throw. 반환된 close()로 서버를 내린다. */
export async function buildAndServeFixture(
  name: string,
  files: FixtureRecord,
): Promise<{ url: string; close: () => Promise<void> }> {
  const dir = join(TMP_ROOT, name);
  writeFixture(dir, files);

  const buildResult = await runVite(['build'], dir);

  if (buildResult.code !== 0) {
    throw new Error(`vite build 실패 (${name}):\n${buildResult.stderr}`);
  }

  const port = nextPort++;

  return serveStatic(join(dir, 'dist'), port);
}
