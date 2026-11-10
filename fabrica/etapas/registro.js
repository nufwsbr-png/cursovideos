// Contrato de versão de cada etapa de produção: o que entra (por partes) e o que sai.
// A entrada é sempre conteúdo (hash), nunca data de arquivo: o mesmo roteiro, as mesmas falas e o mesmo código dão a
// mesma versão no Windows e no CI. O orquestrador usa isto para pular o que está em dia e refazer só o que ficou velho.
import fs from "node:fs";
import path from "node:path";
import { RAIZ, PASTA_MOTOR, PASTA_AUDIO, canalDoEpisodio } from "../config.js";
import { lerJson } from "../util/arquivos.js";
import { hashArquivo, hashArvore, hashArquivos, hashJson } from "../util/hash.js";
import { entradaDe, hashPasta, hashSaidas, lerVersoes, gravarVersao, compararVersao } from "../util/versoes.js";
import { hashConteudoFala } from "./03_vozes.js";
import { VERSAO_REGRAS } from "../roteiro/nota.js";
import { temGemini } from "../ia/gemini_tts.js";
import { RUBRICA, configCritico } from "../critico/critico.js";

export const PRODUCAO = ["roteiro", "vozes", "conferir", "tempo", "quadros", "critico", "render", "som", "prova", "capa", "entrega"];

const no = (dir, rel) => path.join(dir, rel);
// o código não muda durante uma execução: o hash de cada conjunto de arquivos é calculado uma vez por processo
const memo = new Map();
const uma = (chave, fn) => { if (!memo.has(chave)) memo.set(chave, fn()); return memo.get(chave); };
export const esquecerHashesDeCodigo = () => memo.clear();
const codigo = (...rels) => uma("c:" + rels.join("|"), () => hashArquivos(rels.map((r) => path.join(RAIZ, r))));
const arvore = (dir, filtro) => uma(`a:${dir}:${filtro ?? ""}`, () => hashArvore(dir, filtro));
export const nomeMp4 = (numero) => `ep${String(numero).padStart(2, "0")}.mp4`;

// o que do canal muda a imagem, o tempo ou o som (publicação, plataformas e IA ficam de fora)
const memoCanal = new WeakMap();
// partes grandes do canal: o hash é o mesmo que entradaDe calcularia (hashJson), só que uma vez por objeto canal
const memoPartes = new WeakMap();
function hashCanal(canal, nome, escolher) {
  if (!memoPartes.has(canal)) memoPartes.set(canal, new Map());
  const m = memoPartes.get(canal);
  if (!m.has(nome)) m.set(nome, hashJson(escolher(canal)));
  return m.get(nome);
}
function canalProducao(canal) {
  if (!memoCanal.has(canal)) {
    const { formato, estilo, cenarios, mundos, protagonista, elenco, audio } = canal;
    memoCanal.set(canal, hashJson({ formato, estilo, cenarios, mundos, protagonista, elenco, audio, pps: canal.vozes?.palavras_por_segundo_estimadas ?? null, pergunta_s: canal.roteiro?.pergunta_duracao_s ?? null }));
  }
  return memoCanal.get(canal);
}

/** Provedor de voz que esta execução usaria. Se todas as falas já são de verdade, não há o que melhorar. */
function provedorVoz(ctx) {
  const origem = lerJson(no(ctx.dir, "audio/falas/origem.json"), {});
  const falas = ctx.roteiro?.falas ?? [];
  if (falas.length && falas.every((f) => origem[f.id]?.provedor === "gemini")) return "gemini";
  return ctx.opcoes?.provedorVoz || (temGemini() ? ctx.canal.vozes?.provedor ?? "gemini" : "falso");
}

// a imagem depende do roteiro, da linha do tempo, das medidas das falas (boca), do canal e do motor
function visual(ctx) {
  return {
    roteiro: hashArquivo(no(ctx.dir, "roteiro.json")),
    linha: hashArquivo(no(ctx.dir, "linha_do_tempo.json")),
    medidas: hashArquivo(no(ctx.dir, "medidas.json")),
    canal: canalProducao(ctx.canal),
    motor: arvore(PASTA_MOTOR),
  };
}

export const CONTRATOS = {
  roteiro: {
    saidas: () => ["validacao.json"],
    entrada: (ctx) => ({
      roteiro: hashArquivo(no(ctx.dir, "roteiro.json")),
      regras: VERSAO_REGRAS,
      canal_roteiro: hashCanal(ctx.canal, "roteiro", (c) => c.roteiro ?? null),
      mundo: hashCanal(ctx.canal, "mundo", (c) => ({ mundos: c.mundos, cenarios: c.cenarios, elenco: c.elenco, protagonista: c.protagonista, formato: c.formato, estilo: c.estilo })),
      codigo: codigo("fabrica/roteiro/nota.js", "fabrica/roteiro/validar.js", "fabrica/roteiro/regras.js", "motor/cena/linha_do_tempo.js", "motor/cena/plano_camera.js", "motor/cena/mundo.js"),
    }),
  },
  vozes: {
    saidas: () => ["audio/falas"],
    entrada: (ctx) => ({ falas: (ctx.roteiro?.falas ?? []).map((f) => [f.id, hashConteudoFala(ctx.canal, f)]), provedor: provedorVoz(ctx) }),
  },
  conferir: {
    saidas: () => ["medidas.json"],
    entrada: (ctx) => ({ falas_wav: hashPasta(no(ctx.dir, "audio/falas"), /\.wav$/), codigo: codigo("audio/medir_falas.py") }),
  },
  tempo: {
    saidas: () => ["linha_do_tempo.json"],
    entrada: (ctx) => ({
      roteiro: hashArquivo(no(ctx.dir, "roteiro.json")),
      medidas: hashArquivo(no(ctx.dir, "medidas.json")),
      canal: canalProducao(ctx.canal),
      codigo: codigo("motor/cena/linha_do_tempo.js", "motor/cena/plano_camera.js", "motor/cena/mundo.js", "motor/cena/linha_previa.js", "motor/montar_linha.js", "audio/_linha_previa.py", "audio/_comum.py"),
    }),
  },
  quadros: {
    saidas: () => ["revisao.json", "folha.png"],
    entrada: (ctx) => ({ ...visual(ctx), escala: Number(ctx.opcoes?.escala ?? 1), codigo: codigo("fabrica/etapas/05b_quadros.js") }),
  },
  critico: {
    saidas: () => ["critico.json"],
    entrada: (ctx) => ({ ...visual(ctx), rubrica: hashArquivo(RUBRICA), codigo: arvore(path.join(RAIZ, "fabrica", "critico")), limites: configCritico(ctx.canal) }),
  },
  render: {
    saidas: () => ["video_mudo.mp4"],
    entrada: (ctx) => ({ ...visual(ctx), escala: Number(ctx.opcoes?.escala ?? 1) }),
  },
  som: {
    saidas: (ctx) => [nomeMp4(ctx.roteiro.numero), "mix.wav"],
    entrada: (ctx) => ({
      linha: hashArquivo(no(ctx.dir, "linha_do_tempo.json")),
      falas: hashPasta(no(ctx.dir, "audio/falas"), /\.wav$/),
      video: hashArquivo(no(ctx.dir, "video_mudo.mp4")),
      audio: ctx.canal.audio ?? null,
      codigo: arvore(PASTA_AUDIO, /\.py$/),
    }),
  },
  prova: {
    saidas: () => ["prova.json"],
    entrada: (ctx) => ({
      mp4: hashArquivo(no(ctx.dir, nomeMp4(ctx.roteiro.numero))),
      revisao: hashArquivo(no(ctx.dir, "revisao.json")),
      origem: hashArquivo(no(ctx.dir, "audio/falas/origem.json")),
      fontes: lerJson(no(ctx.dir, "render.json"), {})?.fontes ?? null,
      formato: ctx.canal.formato,
      audio: ctx.canal.audio ?? null,
      codigo: codigo("fabrica/etapas/08_prova.js", "audio/medir.py", "audio/transcrever.py"),
    }),
  },
  capa: {
    saidas: () => ["capa.png", "textos.json"],
    entrada: (ctx) => ({
      roteiro: hashArquivo(no(ctx.dir, "roteiro.json")),
      linha: hashArquivo(no(ctx.dir, "linha_do_tempo.json")),
      canal: { estilo: ctx.canal.estilo, publicacao: ctx.canal.publicacao, nome: ctx.canal.nome_exibicao, serie: ctx.canal.serie?.nome ?? null, plataformas: ctx.canal.plataformas, cenarios: ctx.canal.cenarios, mundos: ctx.canal.mundos, protagonista: ctx.canal.protagonista, elenco: ctx.canal.elenco },
      motor: arvore(PASTA_MOTOR),
      codigo: codigo("fabrica/etapas/09_capa_textos.js", "fabrica/publicar/textos.js"),
    }),
  },
  // a entrega é o portão final: confere tudo de novo toda vez (é barata)
  entrega: { sempre: true, saidas: () => ["entrega.json"], entrada: () => ({}) },
};

/** Situação de uma etapa: { valida, motivo, mudou, faltam, alteradas, sempre? } */
// As versões usam sempre o canal da série do episódio, venha de onde vier a chamada (orquestrador, entrega, explicar).
const comCanalDaSerie = (ctx) => (ctx.canal ? { ...ctx, canal: canalDoEpisodio(ctx.canal, { dir: ctx.dir, roteiro: ctx.roteiro }) } : ctx);

export function situacao(etapa, ctx) {
  ctx = comCanalDaSerie(ctx);
  const c = CONTRATOS[etapa];
  if (!c) throw new Error(`etapa sem contrato de versão: ${etapa}`);
  if (c.sempre) return { valida: false, sempre: true, motivo: "confere toda vez", mudou: [], faltam: [], alteradas: [] };
  if (!ctx.roteiro) return { valida: false, motivo: "sem roteiro.json", mudou: [], faltam: [], alteradas: [] };
  const entrada = entradaDe(c.entrada(ctx));
  const saidas = hashSaidas(ctx.dir, c.saidas(ctx));
  return compararVersao(lerVersoes(ctx.dir)[etapa], entrada, saidas);
}

/** Grava a versão atual da etapa (entrada e saídas como estão agora). */
export function registrar(etapa, ctx, extra = {}) {
  ctx = comCanalDaSerie(ctx);
  const c = CONTRATOS[etapa];
  const entrada = entradaDe(c.entrada(ctx));
  const saidas = hashSaidas(ctx.dir, c.saidas(ctx));
  return gravarVersao(ctx.dir, etapa, { entrada, saidas, extra });
}

/** Alguma saída da etapa existe? (para adotar versões de episódios feitos antes do registro) */
export function temSaidas(etapa, ctx) {
  const c = CONTRATOS[etapa];
  return c.saidas(ctx).some((rel) => fs.existsSync(no(ctx.dir, rel)));
}
