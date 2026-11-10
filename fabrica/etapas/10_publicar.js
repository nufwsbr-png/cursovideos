// Etapa 10 — Publicar nas redes (capítulo 72), com etiqueta de IA e comentário fixado.
// Só publica uma entrega publicável (entrega.json) cujos arquivos não mudaram. --forcar é decisão humana e fica
// registrada. "Publicado" = todas as plataformas obrigatórias do canal; o resto fica como publicação parcial.
import fs from "node:fs";
import path from "node:path";
import { hojeNoFuso } from "../config.js";
import { atualizarEstado, listarEpisodios, anexarTexto } from "../util/arquivos.js";
import { log } from "../util/log.js";
import { publicarTudo } from "../publicar/index.js";
import { carregarEnv } from "../util/ambiente.js";
import { conferirEntrega } from "./09b_entrega.js";
import { PASTA_MEMORIA } from "../config.js";

export function jaPublicouHoje(canal) {
  const hoje = hojeNoFuso(canal);
  const fuso = canal.publicacao?.fuso || "America/Sao_Paulo";
  for (const e of listarEpisodios()) {
    const quando = e.publicacao?.publicado_em;
    if (!quando) continue;
    const dia = new Intl.DateTimeFormat("sv-SE", { timeZone: fuso, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(quando));
    const algumaOk = Object.values(e.publicacao?.plataformas ?? {}).some((p) => p?.ok);
    if (dia === hoje && algumaOk) return e;
  }
  return null;
}

export async function etapaPublicar({ canal, ep, simular = false, plataformas = null, forcar = false, republicar = false }) {
  log.passo(`Etapa 10 — Publicar episódio ${ep.roteiro.numero}${simular ? " (simulação)" : ""}`);
  carregarEnv();
  if (fs.existsSync(path.join(ep.dir, "APROVADO"))) atualizarEstado(ep.dir, { aprovado: true });
  if (!forcar) {
    const c = conferirEntrega({ canal, ep });
    if (!c.ok) {
      log.erro(`Não vou publicar: ${c.motivo}`);
      return { ok: false, motivo: c.motivo, bloqueado: true };
    }
  } else {
    // só um humano passa --forcar; a rotina diária nunca passa
    const nota = { em: new Date().toISOString(), motivo: "--forcar na linha de comando (decisão humana)", simulado: simular };
    atualizarEstado(ep.dir, { publicacao_forcada: nota });
    if (!simular) anexarTexto(path.join(PASTA_MEMORIA, "aprendizados.md"), `- [${nota.em.slice(0, 10)}] [DECISÃO HUMANA] ep${String(ep.roteiro.numero).padStart(2, "0")} publicado com --forcar (sem entrega publicável).\n`);
    log.aviso("--forcar: publicando sem conferir a entrega (fica registrado em estado.json).");
  }
  if (canal.publicacao?.um_por_dia && !simular && !forcar) {
    const outro = jaPublicouHoje(canal);
    if (outro && outro.dir !== ep.dir) {
      log.aviso(`Já publicamos hoje (${outro.nome}); o canal publica um por dia. Use --forcar para publicar mesmo assim.`);
      return { ok: false, motivo: "um por dia" };
    }
  }
  let resumo;
  try {
    resumo = await publicarTudo({ dirEpisodio: ep.dir, canal, env: process.env, simular, plataformas: plataformas ?? undefined, forcar, republicar, log: (m) => log.info(m) });
  } catch (e) {
    log.erro(`Publicação recusada: ${e.message}`);
    return { ok: false, motivo: e.message };
  }
  const linhas = (resumo.resultados ?? []).map((r) => ({ plataforma: r.plataforma, estado: r.ok ? "✔ publicado" : r.pendente_manual ? "… pendente manual" : "✖ falhou", id: r.id ?? "", url: r.url ?? "", erro: (r.erro ?? "").slice(0, 80) }));
  if (linhas.length) log.tabela(linhas);
  for (const p of resumo.pendencias_manuais ?? []) log.aviso(`pendência manual: ${typeof p === "string" ? p : JSON.stringify(p)}`);
  const algumaOk = (resumo.resultados ?? []).some((r) => r.ok) || Object.values(resumo.publicacao?.plataformas ?? {}).some((p) => p?.ok);
  if (!simular && algumaOk) atualizarEstado(ep.dir, { etapa: resumo.completo ? "publicado" : "publicacao_parcial", publicado_em: resumo.publicacao?.publicado_em ?? new Date().toISOString() });
  if (!resumo.completo && !simular) log.aviso("Publicação parcial: faltam plataformas obrigatórias; a próxima rotina tenta só as que faltam.");
  return { ok: resumo.ok, completo: resumo.completo, resumo };
}
