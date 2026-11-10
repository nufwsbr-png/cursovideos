// Etapa 5b — Quadros: stills nos instantes importantes → folha → revisor automático (capítulos 56 e 65).
// Roda antes do crítico visual e do render: problema grave do revisor bloqueia o resto.
import fs from "node:fs";
import path from "node:path";
import { PASTA_MOTOR } from "../config.js";
import { lerJson, atualizarEstado, definirBloqueios } from "../util/arquivos.js";
import { executar } from "../util/exec.js";
import { log } from "../util/log.js";

const RENDERIZAR = path.join(PASTA_MOTOR, "renderizar.js");
const REVISAR = path.join(PASTA_MOTOR, "revisar.js");

/** Problemas graves do revisor. O revisor grava `problemas` (+ `aprovado`); `graves` era um nome antigo que nunca existiu. */
export function problemasGraves(revisao) {
  if (!revisao) return [];
  const lista = revisao.problemas ?? revisao.graves ?? revisao.problemas_graves ?? [];
  if (!lista.length && revisao.aprovado === false) return [{ tipo: "reprovado", detalhe: "revisor marcou aprovado=false" }];
  return lista;
}

export function temposImportantes(lt) {
  const ts = new Set();
  for (const l of lt.linhas ?? []) ts.add(Math.round(l.inicio_s * 10) / 10 + 0.3);
  for (const f of lt.falas ?? []) ts.add(Math.round(((f.inicio_s + f.fim_s) / 2) * 10) / 10);
  ts.add(0); ts.add(Math.max(0, lt.duracao_total_s - 1));
  return [...ts].filter((t) => t >= 0 && t < lt.duracao_total_s).sort((a, b) => a - b).map((t) => t.toFixed(1));
}

export async function etapaQuadros({ canal, ep, escala = 1 }) {
  log.passo(`Etapa 5b — Quadros e revisor do episódio ${ep.roteiro.numero} (escala ${escala})`);
  const lt = lerJson(path.join(ep.dir, "linha_do_tempo.json"));
  const comuns = ["--episodio", ep.dir, "--escala", String(escala)];
  // stills de rodadas anteriores podem estar em outra escala e confundir o revisor
  fs.rmSync(path.join(ep.dir, "stills"), { recursive: true, force: true });
  const tempos = temposImportantes(lt);
  log.info(`stills em ${tempos.length} instantes...`);
  await executar("node", [RENDERIZAR, ...comuns, "--stills", tempos.join(",")]);
  await executar("node", [RENDERIZAR, ...comuns, "--folha"]);
  await executar("node", [REVISAR, "--episodio", ep.dir]);
  const revisao = lerJson(path.join(ep.dir, "revisao.json"), { problemas: [], avisos: [] });
  const graves = problemasGraves(revisao);
  definirBloqueios(ep.dir, "quadros", graves.length ? [`revisor: ${graves.length} problema(s) grave(s) nos quadros (veja revisao.json)`] : []);
  for (const g of graves.slice(0, 10)) log.aviso(typeof g === "string" ? g : `${g.tipo ?? "problema"} em ${g.t ?? "?"} s: ${g.detalhe ?? JSON.stringify(g)}`);
  atualizarEstado(ep.dir, { etapa: "quadros" });
  log.ok(graves.length ? `Revisor: ${graves.length} problema(s) grave(s).` : `Revisor sem problemas graves (${(revisao.avisos ?? []).length} aviso(s)).`);
  return { graves: graves.length, avisos: (revisao.avisos ?? []).length };
}
