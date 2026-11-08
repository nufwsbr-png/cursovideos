// Servidor HTTP estático mínimo: serve a raiz do repositório (motor/ e node_modules/).
// Uso como módulo: const { iniciarServidor } = await import('./servidor.js'); const s = await iniciarServidor(); s.url; s.fechar()
// Uso direto: node motor/servidor.js [porta]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
export const RAIZ = path.resolve(AQUI, '..');

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4',
  '.svg': 'image/svg+xml',
};

export function iniciarServidor(porta = 0, raiz = RAIZ) {
  return new Promise((resolver, rejeitar) => {
    const servidor = http.createServer((req, res) => {
      try {
        const url = new URL(req.url, 'http://localhost');
        let caminho = decodeURIComponent(url.pathname);
        if (caminho === '/') caminho = '/motor/index.html';
        if (caminho === '/favicon.ico') { res.writeHead(204); res.end(); return; }
        const arquivo = path.normalize(path.join(raiz, caminho));
        if (!arquivo.startsWith(raiz)) { res.writeHead(403); res.end('fora da raiz'); return; }
        if (!fs.existsSync(arquivo) || fs.statSync(arquivo).isDirectory()) { res.writeHead(404); res.end('não encontrado: ' + caminho); return; }
        const ext = path.extname(arquivo).toLowerCase();
        res.writeHead(200, { 'Content-Type': TIPOS[ext] || 'application/octet-stream', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' });
        fs.createReadStream(arquivo).pipe(res);
      } catch (e) {
        res.writeHead(500); res.end(String(e));
      }
    });
    servidor.on('error', rejeitar);
    servidor.listen(porta, '127.0.0.1', () => {
      const p = servidor.address().port;
      resolver({ url: `http://127.0.0.1:${p}`, porta: p, fechar: () => new Promise(r => servidor.close(r)) });
    });
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const s = await iniciarServidor(Number(process.argv[2] || 0));
  console.log('servidor do motor em', s.url, '(raiz:', RAIZ + ')');
}
