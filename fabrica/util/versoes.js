// Versões das etapas: cada etapa grava o hash do que entrou (por partes) e do que saiu, em estado.json → versoes.
// Uma etapa está "em dia" quando a entrada recalculada é a mesma e as saídas continuam lá, iguais ao que ela gravou.
// Mudou a direção do roteiro → a entrada de "tempo" muda → tempo, quadros, crítico, render… ficam velhos; as vozes não.
import fs from "node:fs";
import path from "node:path";
import { hashJson, hashArquivo, posix } from "./hash.js";
import { lerJson, atualizarEstado } from "./arquivos.js";

/** Entrada de uma etapa: um hash por parte (para explicar o que mudou) e o hash do conjunto. */
export function entradaDe(partes) {
  const limpas = Object.fromEntries(Object.entries(partes).map(([k, v]) => [k, typeof v === "string" && v.startsWith("sha256:") ? v : hashJson(v ?? null)]));
  return { hash: hashJson(limpas), partes: limpas };
}

function listarArquivos(dir, base = dir, out = []) {
  for (const n of fs.readdirSync(dir).sort()) {
    if (n.startsWith(".") || n === "_orfas") continue;
    const p = path.join(dir, n);
    if (fs.statSync(p).isDirectory()) listarArquivos(p, base, out);
    else out.push(p);
  }
  return out;
}

/** Hash de uma pasta (conteúdo + caminho relativo de cada arquivo). */
export function hashPasta(dir, filtro = null) {
  if (!fs.existsSync(dir)) return null;
  const itens = listarArquivos(dir).filter((p) => !filtro || filtro.test(p)).map((p) => [posix(path.relative(dir, p)), hashArquivo(p)]);
  return hashJson(itens);
}

/** Hash de cada saída (arquivo ou pasta), relativa à pasta do episódio. null = não existe. */
export function hashSaidas(dir, lista) {
  const out = {};
  for (const rel of lista) {
    const p = path.join(dir, rel);
    if (!fs.existsSync(p)) { out[posix(rel)] = null; continue; }
    out[posix(rel)] = fs.statSync(p).isDirectory() ? hashPasta(p) : hashArquivo(p);
  }
  return out;
}

export function lerVersoes(dir) {
  return lerJson(path.join(dir, "estado.json"), {}).versoes ?? {};
}

export function gravarVersao(dir, etapa, { entrada, saidas, extra = {} }) {
  const versoes = { ...lerVersoes(dir), [etapa]: { entrada, saidas, em: new Date().toISOString(), ...extra } };
  atualizarEstado(dir, { versoes });
  return versoes[etapa];
}

export function apagarVersao(dir, etapa) {
  const versoes = { ...lerVersoes(dir) };
  delete versoes[etapa];
  atualizarEstado(dir, { versoes });
}

/**
 * Compara o registro com o estado atual.
 * → { valida, motivo, mudou: [partes da entrada], faltam: [saídas], alteradas: [saídas] }
 */
export function compararVersao(registro, entrada, saidasAtuais) {
  if (!registro) return { valida: false, motivo: "nunca rodou com versão registrada", mudou: [], faltam: [], alteradas: [] };
  const mudou = [];
  if (registro.entrada?.hash !== entrada.hash) {
    const a = registro.entrada?.partes ?? {}, b = entrada.partes ?? {};
    for (const k of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) if (a[k] !== b[k]) mudou.push(k);
    if (!mudou.length) mudou.push("entrada");
  }
  const faltam = [], alteradas = [];
  for (const [rel, h] of Object.entries(registro.saidas ?? {})) {
    if (h === null) continue; // a etapa rodou sem produzir esta saída (ex.: som sem vídeo): não é cobrada
    const atual = saidasAtuais[rel];
    if (atual === null || atual === undefined) faltam.push(rel);
    else if (h !== null && atual !== h) alteradas.push(rel);
  }
  const partes = [];
  if (mudou.length) partes.push(`mudou: ${mudou.join(", ")}`);
  if (faltam.length) partes.push(`falta: ${faltam.join(", ")}`);
  if (alteradas.length) partes.push(`saída alterada fora da etapa: ${alteradas.join(", ")}`);
  return { valida: !partes.length, motivo: partes.length ? partes.join("; ") : "em dia", mudou, faltam, alteradas };
}
