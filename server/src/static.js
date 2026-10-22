import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Sirve el build del cliente (client/dist) para desplegar todo en un solo puerto.
// En desarrollo no se usa: el cliente corre con Vite en otro puerto.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, '../../client/dist');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

export function serveStatic(req, res) {
  if (!fs.existsSync(DIST)) {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Servidor WebSocket activo. Ejecuta el cliente con "npm run dev" en /client.');
    return;
  }

  const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = path.join(DIST, urlPath === '/' ? 'index.html' : urlPath);

  // Evitar path traversal (../../etc/passwd)
  if (!file.startsWith(DIST)) {
    res.writeHead(403);
    res.end();
    return;
  }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');

  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}
