// Etapa 10 — Publicar nas 5 redes (capítulo 72), com etiqueta de IA e comentário fixado.
import fs from "node:fs";
import path from "node:path";
import { hojeNoFuso } from "../config.js";
import { lerJson, atualizarEstado, listarEpisodios } from "../util/arquivos.js";
import { log } from "../util/log.js";
import { publicarTudo } from "../publicar/index.js";
import { carregarEnv } from "../util/ambiente.js";

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

export async function etapaPublicar({ canal, ep, simular = false, plataformas = null, forcar = false }) {
  log.passo(`Etapa 10 — Publicar episódio ${ep.roteiro.numero}${simular ? " (simulação)" : ""}`);
  carregarEnv();
  const estado = lerJson(path.join(ep.dir, "estado.json"), { bloqueios: [] });
  if ((estado.bloqueios ?? []).length && !forcar) {
    log.erro("Episódio bloqueado; não vou publicar:");
    for (const b of estado.bloqueios) log.erro("  - " + b);
    return { ok: false, motivo: "bloqueios", bloqueios: estado.bloqueios };
  }
  if (fs.existsSync(path.join(ep.dir, "APROVADO")) && !estado.aprovado) atualizarEstado(ep.dir, { aprovado: true });
  if (canal.publicacao?.exigir_aprovacao_humana && !estado.aprovado && !fs.existsSync(path.join(ep.dir, "APROVADO")) && !forcar) {
    log.aviso("O canal exige aprovação humana: crie um arquivo APROVADO na pasta do episódio (ou marque aprovado em estado.json).");
    return { ok: false, motivo: "aguardando aprovação humana" };
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
    resumo = await publicarTudo({ dirEpisodio: ep.dir, canal, env: process.env, simular, plataformas: plataformas ?? undefined, forcar, log: (m) => log.info(m) });
  } catch (e) {
    log.erro(`Publicação recusada: ${e.message}`);
    return { ok: false, motivo: e.message };
  }
  const linhas = (resumo.resultados ?? []).map((r) => ({ plataforma: r.plataforma, ok: r.ok ? "✔" : "✖", id: r.id ?? "", url: r.url ?? "", erro: (r.erro ?? "").slice(0, 80) }));
  if (linhas.length) log.tabela(linhas);
  for (const p of resumo.pendencias_manuais ?? []) log.aviso(`pendência manual: ${typeof p === "string" ? p : JSON.stringify(p)}`);
  const algumaOk = linhas.some((l) => l.ok === "✔");
  if (!simular && algumaOk) atualizarEstado(ep.dir, { etapa: "publicado", publicado_em: new Date().toISOString() });
  return { ok: algumaOk, resumo };
}
