/**
 * Minimal standalone preview server (runs parallel to WebContainer, dev-only).
 * Saves generated files to disk and serves them back over HTTP so a preview
 * can be viewed without going through WebContainer.
 *
 * Usage: node server/preview-server.mjs
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = process.env.PREVIEW_SERVER_PORT ? Number(process.env.PREVIEW_SERVER_PORT) : 5174;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_ROOT = path.join(__dirname, '..', 'preview-output');

// Ensure the output root exists so users never have to create it manually.
fs.mkdirSync(OUTPUT_ROOT, { recursive: true });

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// Resolve a sessionId + relative path safely inside OUTPUT_ROOT (blocks path traversal).
function resolveSafePath(sessionId, relativePath) {
  const sessionDir = path.join(OUTPUT_ROOT, sessionId);
  const resolved = path.join(sessionDir, relativePath);

  if (!resolved.startsWith(sessionDir + path.sep) && resolved !== sessionDir) {
    return null;
  }

  return resolved;
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  // POST /save/:sessionId  { path: "index.html", content: "..." }
  const saveMatch = url.pathname.match(/^\/save\/([^/]+)\/?$/);

  if (req.method === 'POST' && saveMatch) {
    const sessionId = saveMatch[1];

    try {
      const body = await readJsonBody(req);
      const relativePath = body.path || 'index.html';
      const targetPath = resolveSafePath(sessionId, relativePath);

      if (!targetPath) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid path' }));
        return;
      }

      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.writeFileSync(targetPath, body.content ?? '');

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: String(error) }));
    }

    return;
  }

  // GET /preview/:sessionId(/*)
  const previewMatch = url.pathname.match(/^\/preview\/([^/]+)(\/.*)?$/);

  if (req.method === 'GET' && previewMatch) {
    const sessionId = previewMatch[1];
    let subPath = previewMatch[2] || '/';

    if (subPath === '/') {
      subPath = '/index.html';
    }

    const targetPath = resolveSafePath(sessionId, subPath);

    if (!targetPath || !fs.existsSync(targetPath) || !fs.statSync(targetPath).isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found. Has anything been saved for this session yet?');
      return;
    }

    const ext = path.extname(targetPath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    fs.createReadStream(targetPath).pipe(res);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`[preview-server] listening on http://localhost:${PORT}`);
  console.log(`[preview-server] serving files from ${OUTPUT_ROOT}`);
});
