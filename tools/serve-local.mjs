#!/usr/bin/env node
/**
 * ODIN dev tool — minimal static file server WITH CORS for the local
 * buildings/terrain tilesets produced by tools/.
 *
 * Cesium fetches `tileset.json` and `.b3dm`/`.terrain` tiles cross-origin
 * from ODIN's dev server, and a plain `python3 -m http.server` sends no
 * `Access-Control-Allow-Origin` header — the tileset then never loads.
 * This server adds the header and the right MIME types. Dev-only; no
 * authorization beyond static GETs.
 *
 * Usage:
 *   node tools/serve-local.mjs [directory] [port]
 *   # then set VITE_LOCAL_BUILDINGS_URL=http://localhost:8581/tileset.json
 *
 * Defaults: directory = <repo>/storage/buildings-974/tiles, port = 8581.
 */
import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.resolve(process.argv[2] ?? path.join(repoRoot, 'storage', 'buildings-974', 'tiles'));
const port = Number(process.argv[3] ?? 8581);

const MIME = {
  '.json': 'application/json; charset=utf-8',
  '.b3dm': 'application/octet-stream',
  '.terrain': 'application/octet-stream',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json; charset=utf-8',
};

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405);
    res.end('method not allowed');
    return;
  }
  const url = new URL(req.url ?? '/', 'http://localhost');
  let pathname = decodeURIComponent(url.pathname);
  if (pathname.endsWith('/')) pathname += 'tileset.json';
  const file = path.normalize(path.join(root, pathname));
  if (!file.startsWith(root)) {
    res.writeHead(403);
    res.end('forbidden');
    return;
  }
  try {
    const stat = await fs.stat(file);
    if (stat.isDirectory()) {
      const index = path.join(file, 'tileset.json');
      const indexStat = await fs.stat(index);
      res.writeHead(200, {
        'Content-Type': MIME['.json'],
        'Content-Length': indexStat.size,
      });
      res.end(req.method === 'HEAD' ? undefined : await fs.readFile(index));
      return;
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream',
      'Content-Length': stat.size,
    });
    res.end(req.method === 'HEAD' ? undefined : await fs.readFile(file));
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
});

server.listen(port, () => {
  console.log(`serving ${root} on http://localhost:${port} (CORS: *)`);
  console.log(`tileset: http://localhost:${port}/tileset.json`);
});
