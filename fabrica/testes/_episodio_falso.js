// Episódio de teste numa pasta temporária (fora de episodios/) e etapas falsas que só escrevem as saídas.
// Serve aos testes do orquestrador, das versões e da entrega: nada de render, voz ou som de verdade.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { RAIZ } from "../config.js";
import { hashArquivo } from "../util/hash.js";

export const MODELO = JSON.parse(fs.readFileSync(path.join(RAIZ, "fabrica/testes/fixtures/roteiro_ep1_modelo.json"), "utf8"));

let n = 0;
export function criarEpisodioFalso({ provedor = "gemini" } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `ep_falso_${process.pid}_${n++}_`));
  fs.writeFileSync(path.join(dir, "roteiro.json"), JSON.stringify(MODELO, null, 2));
  const falas = path.join(dir, "audio", "falas");
  fs.mkdirSync(falas, { recursive: true });
  const origem = {};
  for (const f of MODELO.falas) {
    fs.writeFileSync(path.join(falas, `${f.id}.wav`), `wav ${f.id} ${f.texto}`);
    origem[f.id] = { provedor, texto: f.texto };
  }
  fs.writeFileSync(path.join(falas, "origem.json"), JSON.stringify(origem));
  return { dir, nome: path.basename(dir), numero: MODELO.numero };
}

export const editarRoteiro = (dir, fn) => {
  const p = path.join(dir, "roteiro.json");
  const r = JSON.parse(fs.readFileSync(p, "utf8"));
  fn(r);
  fs.writeFileSync(p, JSON.stringify(r, null, 2));
};

const escrever = (dir, rel, conteudo) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), conteudo); };
const conteudoDe = (dir) => fs.readFileSync(path.join(dir, "roteiro.json"), "utf8").length;

/** Etapas falsas: cada uma escreve as saídas do seu contrato e anota que rodou. */
export function etapasFalsas({ critico = { aprovado: true, fonte: "api" }, revisorGraves = 0 } = {}) {
  const rodou = [];
  const marca = (nome, fn) => async (ctx, E, refazer) => { rodou.push(nome); return fn(ctx, E, refazer); };
  const rodar = {
    roteiro: marca("roteiro", (ctx) => { escrever(ctx.dir, "validacao.json", JSON.stringify({ aprovado: true, nota: 100, nota_minima: 70, erros: [] })); return {}; }),
    vozes: marca("vozes", () => ({})),
    conferir: marca("conferir", (ctx) => { escrever(ctx.dir, "medidas.json", JSON.stringify({ conferido_por: "teste" })); return {}; }),
    tempo: marca("tempo", (ctx) => { escrever(ctx.dir, "linha_do_tempo.json", JSON.stringify({ duracao_total_s: 80, roteiro: conteudoDe(ctx.dir) })); return {}; }),
    quadros: marca("quadros", (ctx) => { escrever(ctx.dir, "revisao.json", JSON.stringify({ problemas: Array.from({ length: revisorGraves }, () => ({ tipo: "x" })), aprovado: !revisorGraves })); escrever(ctx.dir, "folha.png", "folha"); return {}; }),
    critico: marca("critico", (ctx) => { escrever(ctx.dir, "critico.json", JSON.stringify({ aprovado: critico.aprovado, status: critico.aprovado ? "aprovado" : "reprovado", motivo: critico.aprovado ? "ok" : "nota baixa", fonte: critico.fonte, rodadas: [{ n: 1, fonte: critico.fonte, notas: {} }] })); return {}; }),
    render: marca("render", (ctx) => { escrever(ctx.dir, "video_mudo.mp4", "video " + conteudoDe(ctx.dir)); escrever(ctx.dir, "render.json", JSON.stringify({ fontes: { ok: true } })); return {}; }),
    som: marca("som", (ctx) => { escrever(ctx.dir, "ep01.mp4", "mp4 " + fs.readFileSync(path.join(ctx.dir, "video_mudo.mp4"), "utf8")); escrever(ctx.dir, "mix.wav", "mix"); return {}; }),
    prova: marca("prova", (ctx) => { escrever(ctx.dir, "prova.json", JSON.stringify({ arquivo_hash: hashArquivo(path.join(ctx.dir, "ep01.mp4")), bloqueios: [] })); return {}; }),
    capa: marca("capa", (ctx) => { escrever(ctx.dir, "capa.png", "capa"); escrever(ctx.dir, "textos.json", JSON.stringify({ titulo: "t" })); return {}; }),
    entrega: marca("entrega", async (ctx) => {
      const { etapaEntrega } = await import("../etapas/09b_entrega.js");
      await etapaEntrega({ canal: ctx.canal, ep: ctx.ep });
      return {};
    }),
  };
  return { rodar, rodou };
}

export function limpar(dir) { fs.rmSync(dir, { recursive: true, force: true }); }
