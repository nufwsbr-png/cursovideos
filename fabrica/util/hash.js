// Hash canônico (sha256) para versões de etapas: chaves em ordem, CRLF = LF, caminhos no estilo POSIX.
// O mesmo conteúdo dá o mesmo hash no Windows e no CI.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const posix = (p) => String(p).split(path.sep).join("/");

export function canonico(v) {
  if (Array.isArray(v)) return v.map(canonico);
  if (v && typeof v === "object") {
    const o = {};
    for (const k of Object.keys(v).sort()) if (v[k] !== undefined) o[k] = canonico(v[k]);
    return o;
  }
  return v;
}

const sha = (buf) => "sha256:" + crypto.createHash("sha256").update(buf).digest("hex");

export const hashTexto = (t) => sha(String(t).replace(/\r\n/g, "\n"));
export const hashJson = (obj) => hashTexto(JSON.stringify(canonico(obj ?? null)));

const TEXTO = new Set([".md", ".txt", ".js", ".mjs", ".py", ".csv", ".html", ".css", ".yml", ".yaml"]);

/** Hash de um arquivo: JSON é canônico, texto ignora CRLF, binário é byte a byte. null se não existe. */
export function hashArquivo(p) {
  if (!fs.existsSync(p)) return null;
  const ext = path.extname(p).toLowerCase();
  if (ext === ".json") {
    try { return hashJson(JSON.parse(fs.readFileSync(p, "utf8"))); } catch { /* cai no binário */ }
  }
  if (TEXTO.has(ext)) return hashTexto(fs.readFileSync(p, "utf8"));
  return sha(fs.readFileSync(p));
}

function listar(dir, filtro, base = dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const n of fs.readdirSync(dir).sort()) {
    if (n === "node_modules" || n.startsWith(".") || n === "__pycache__" || n === "testes") continue;
    const p = path.join(dir, n);
    const st = fs.statSync(p);
    if (st.isDirectory()) listar(p, filtro, base, out);
    else if (filtro.test(n)) out.push(p);
  }
  return out;
}

/** Hash de uma árvore de código (ex.: motor/), por conteúdo e caminho relativo. */
export function hashArvore(dir, filtro = /\.(js|py|html)$/) {
  const itens = listar(dir, filtro).map((p) => [posix(path.relative(dir, p)), hashArquivo(p)]);
  return hashJson(itens);
}

/** Hash de vários arquivos (alguns podem faltar). */
export function hashArquivos(caminhos) {
  return hashJson(caminhos.map((p) => [posix(path.basename(p)), hashArquivo(p)]));
}
