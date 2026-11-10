// O orquestrador: roda as etapas de produção como um "make". Pula o que está em dia (versão igual), refaz a partir da
// primeira etapa velha, para nos portões (roteiro reprovado, duração, revisor, crítico visual) e registra a versão de
// cada etapa que rodou. A IA pensa (roteiro, crítico); o código executa (motor, som); os portões decidem.
import path from "node:path";
import { ETAPAS } from "./config.js";
import { log } from "./util/log.js";
import { resolverEpisodio, lerJson, gravarJson, definirBloqueios } from "./util/arquivos.js";
import { situacao, registrar, temSaidas, PRODUCAO, CONTRATOS } from "./etapas/registro.js";
import { configCritico, lerCritico } from "./critico/critico.js";

export async function carregarEtapas() {
  return {
    publico: (await import("./etapas/01_publico.js")).etapaPublico,
    roteiro: await import("./etapas/02_roteiro.js"),
    vozes: (await import("./etapas/03_vozes.js")).etapaVozes,
    conferir: (await import("./etapas/04_conferir.js")).etapaConferir,
    tempo: (await import("./etapas/05_tempo.js")).etapaTempo,
    quadros: (await import("./etapas/05b_quadros.js")).etapaQuadros,
    critico: (await import("./etapas/05c_critico.js")).etapaCritico,
    render: (await import("./etapas/06_render.js")).etapaRender,
    som: (await import("./etapas/07_som.js")).etapaSom,
    prova: (await import("./etapas/08_prova.js")).etapaProva,
    capa: (await import("./etapas/09_capa_textos.js")).etapaCapaTextos,
    entrega: (await import("./etapas/09b_entrega.js")).etapaEntrega,
    publicar: await import("./etapas/10_publicar.js"),
    memoria: (await import("./etapas/11_memoria.js")).etapaMemoria,
  };
}

const ctxDe = (canal, ep, opcoes) => {
  const e = resolverEpisodio(ep.dir);
  return { canal, ep: e, dir: e.dir, roteiro: e.roteiro, opcoes };
};

// o que precisa estar em dia antes de cada etapa rodar
const REQUER = { vozes: ["roteiro"], conferir: ["vozes"], tempo: ["conferir"], quadros: ["tempo"], critico: ["quadros"], render: ["tempo"], som: ["tempo"], prova: ["som"], capa: ["tempo"], entrega: [] };

const bloqueiosDe = (dir, etapa) => lerJson(path.join(dir, "estado.json"), {}).bloqueios_por_etapa?.[etapa] ?? [];

/** Portão: um motivo para NÃO rodar a etapa agora, ou null. */
export function portao(etapa, ctx) {
  for (const anterior of REQUER[etapa] ?? []) {
    const s = situacao(anterior, ctx);
    if (!s.valida) return `a etapa "${anterior}" está velha (${s.motivo}); rode a partir dela`;
  }
  const b = (e) => bloqueiosDe(ctx.dir, e);
  if (etapa === "vozes" && b("roteiro").length) return b("roteiro")[0];
  if (["quadros", "critico", "render"].includes(etapa) && b("tempo").length) return b("tempo")[0];
  if (["critico", "render"].includes(etapa) && b("quadros").length) return `o revisor achou problema grave: ${b("quadros")[0]}`;
  if (etapa === "render" && configCritico(ctx.canal).exigir) {
    const s = situacao("critico", ctx);
    if (!s.valida) return `o crítico visual não rodou para esta versão (${s.motivo})`;
    const c = lerCritico(ctx.dir);
    if (!c?.aprovado) return `o crítico visual não aprovou: ${c?.motivo ?? "sem critico.json"}`;
  }
  if (etapa === "som" && temSaidas("render", ctx) && !situacao("render", ctx).valida) return "o vídeo mudo é de uma versão velha: rode o render antes do som";
  if (etapa === "prova" && !lerJson(path.join(ctx.dir, "estado.json"), {}).versoes?.som?.saidas?.[`ep${String(ctx.roteiro.numero).padStart(2, "0")}.mp4`]) return "não há MP4 final (o som rodou sem vídeo)";
  return null;
}

const RODAR = {
  async roteiro(ctx, E) {
    // a validação reescreve validacao.json; o histórico de correções da escrita fica guardado
    const anterior = lerJson(path.join(ctx.dir, "validacao.json"), null);
    const r = E.roteiro.validarEpisodio({ canal: ctx.canal, dir: ctx.dir });
    if (anterior?.rodadas && !r.rodadas) gravarJson(path.join(ctx.dir, "validacao.json"), { ...lerJson(path.join(ctx.dir, "validacao.json")), rodadas: anterior.rodadas });
    const motivo = r.aprovado ? null : `roteiro reprovado: nota ${r.nota} (mínimo ${r.nota_minima}), ${r.erros.length} erro(s): ${r.erros.slice(0, 3).join(" | ")}`;
    definirBloqueios(ctx.dir, "roteiro", motivo ? [motivo] : []);
    if (motivo) { log.erro(motivo); return { parar: true, registrar: true, motivo }; }
    log.ok(`roteiro: nota ${r.nota}/100, 0 erros`);
    return {};
  },
  vozes: (ctx, E) => E.vozes({ canal: ctx.canal, ep: ctx.ep, provedor: ctx.opcoes.provedorVoz }),
  conferir: (ctx, E) => E.conferir({ canal: ctx.canal, ep: ctx.ep }),
  tempo: (ctx, E) => E.tempo({ canal: ctx.canal, ep: ctx.ep }),
  quadros: (ctx, E) => E.quadros({ canal: ctx.canal, ep: ctx.ep, escala: Number(ctx.opcoes.escala ?? 1) }),
  critico: (ctx, E, refazer) => E.critico({ canal: ctx.canal, ep: ctx.ep, refazer }),
  render: (ctx, E) => E.render({ canal: ctx.canal, ep: ctx.ep, escala: Number(ctx.opcoes.escala ?? 1), rapido: Boolean(ctx.opcoes.rapido) }),
  som: (ctx, E) => E.som({ canal: ctx.canal, ep: ctx.ep }),
  prova: (ctx, E) => E.prova({ canal: ctx.canal, ep: ctx.ep }),
  capa: (ctx, E) => E.capa({ canal: ctx.canal, ep: ctx.ep }),
  entrega: (ctx, E) => E.entrega({ canal: ctx.canal, ep: ctx.ep }),
};

/**
 * Produz um episódio de `de` até `ate` (padrão: roteiro → entrega), pulando o que está em dia.
 * opcoes: { refazer: [etapas] | true, provedorVoz, escala, rapido }
 * → { ep, relatorio: [{etapa, acao: pulou|rodou|parou, motivo}], parou_em, motivo }
 */
export async function produzir({ canal, ep, de = "roteiro", ate = "entrega", opcoes = {}, E = null, rodar = RODAR }) {
  E ??= await carregarEtapas();
  const i0 = ETAPAS.indexOf(de), i1 = ETAPAS.indexOf(ate);
  if (i0 < 0 || i1 < 0 || i0 > i1) throw new Error(`Etapas inválidas (${de} → ${ate}). Use: ${ETAPAS.join(", ")}`);
  const relatorio = [];
  // depois de um patch do crítico: valida o roteiro de novo e refaz tempo e quadros (as vozes não mudam)
  const refazer = () => produzir({ canal, ep, de: "roteiro", ate: "quadros", opcoes: { ...opcoes, refazer: [] }, E, rodar });
  for (const etapa of ETAPAS.slice(i0, i1 + 1).filter((e) => PRODUCAO.includes(e))) {
    let ctx = ctxDe(canal, ep, opcoes);
    const sit = situacao(etapa, ctx);
    const pedida = opcoes.refazer === true || (Array.isArray(opcoes.refazer) && opcoes.refazer.includes(etapa));
    if (sit.valida && !pedida) {
      log.info(`· ${etapa}: em dia (pulou)`);
      relatorio.push({ etapa, acao: "pulou" });
      continue;
    }
    const barrado = portao(etapa, ctx);
    if (barrado) {
      log.aviso(`■ ${etapa}: parou — ${barrado}`);
      relatorio.push({ etapa, acao: "parou", motivo: barrado });
      return { ep: resolverEpisodio(ep.dir), relatorio, parou_em: etapa, motivo: barrado };
    }
    const motivo = pedida ? "refazer pedido" : sit.motivo;
    log.info(`▶ ${etapa}: ${motivo}`);
    const r = await rodar[etapa](ctx, E, refazer);
    ctx = ctxDe(canal, ep, opcoes);
    if (r?.parar) {
      if (r.registrar) registrar(etapa, ctx);
      relatorio.push({ etapa, acao: "parou", motivo: r.motivo });
      return { ep: resolverEpisodio(ep.dir), relatorio, parou_em: etapa, motivo: r.motivo };
    }
    if (!CONTRATOS[etapa].sempre) registrar(etapa, ctx);
    if (etapa === "conferir") registrar("vozes", ctx); // a conferência pode ter regravado falas
    relatorio.push({ etapa, acao: "rodou", motivo });
  }
  return { ep: resolverEpisodio(ep.dir), relatorio, parou_em: null, motivo: null };
}

/** versoes --explicar: a situação de cada etapa e por quê. */
export function explicarVersoes({ canal, ep, opcoes = {} }) {
  const ctx = ctxDe(canal, ep, opcoes);
  return PRODUCAO.map((etapa) => {
    const s = situacao(etapa, ctx);
    return { etapa, em_dia: s.sempre ? "sempre roda" : s.valida ? "sim" : "não", motivo: s.motivo };
  });
}

/**
 * versoes --adotar: grava como "em dia" as saídas que já existem (episódios feitos antes do registro de versões),
 * da primeira etapa até `ate`, parando na primeira etapa sem saída. Não roda nada.
 */
export function adotarVersoes({ canal, ep, ate = "capa", opcoes = {} }) {
  const ctx = ctxDe(canal, ep, opcoes);
  const adotadas = [];
  for (const etapa of PRODUCAO.slice(0, PRODUCAO.indexOf(ate) + 1)) {
    if (CONTRATOS[etapa].sempre) continue;
    if (!temSaidas(etapa, ctx)) break;
    registrar(etapa, ctx, { adotada_em: new Date().toISOString() });
    adotadas.push(etapa);
  }
  return adotadas;
}
