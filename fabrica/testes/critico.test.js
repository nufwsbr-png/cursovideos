// Crítico visual: escolha dos quadros, patch só de direção (história intocada) e o laço de rodadas com a IA falsa.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { escolherQuadros, escolherDetalhes, MAX_QUADROS } from "../critico/folha.js";
import { aplicarPatch, hashHistoria } from "../critico/patch.js";
import { rodarCritico, registrarRodada, lerCritico } from "../critico/critico.js";
import { conferirResposta, ESQUEMA_JULGAR, CRITERIOS } from "../critico/esquema.js";
import { configurarIA } from "../ia/claude.js";
import { configurarFalsa, chamadasFalsas } from "../ia/falso.js";
import { resolverEpisodio } from "../util/arquivos.js";
import { lerCanal } from "../config.js";
import { criarEpisodioFalso, MODELO, limpar } from "./_episodio_falso.js";

const canal = lerCanal();
const clonar = (o) => JSON.parse(JSON.stringify(o));

// linha do tempo mínima com o formato real (linhas, falas, celular, pergunta)
function linhaDoTempo() {
  const linhas = [];
  let t = 0;
  for (let i = 0; i < 28; i++) { linhas.push({ indice: i, inicio_s: t, fim_s: t + 3, ato: i < 2 ? "rotina" : "escalada", fala: i % 2 ? `f${String(i).padStart(2, "0")}` : null, direcao: { eventos: [] } }); t += 3; }
  linhas[14].movimento = { tipo: "andar", inicio_s: 42, duracao_s: 9, fim_s: 51 };
  linhas[16].transicao = { tipo: "preto", saida_s: 0.3, segurar_s: 0.8, entrada_s: 0.4, total_s: 1.5, inicio_s: 48 };
  const falas = linhas.filter((l) => l.fala).map((l) => ({ id: l.fala, inicio_s: l.inicio_s, fim_s: l.inicio_s + 2, texto: "fala de teste" }));
  return { duracao_total_s: t + 4, linhas, falas, celular: [{ evento: "notificacao", indice: 0, tipo: "alerta", inicio_s: 6.4 }, { evento: "notificacao", indice: 1, tipo: "mensagem", inicio_s: 54.6 }], pergunta: { inicio_s: t, fim_s: t + 4 } };
}

test("os quadros do crítico: determinísticos, no máximo 48, com gancho, cartões e pergunta", () => {
  const lt = linhaDoTempo();
  const a = escolherQuadros(lt), b = escolherQuadros(clonar(lt));
  assert.deepEqual(a, b);
  assert.ok(a.length <= MAX_QUADROS && a.length > 20);
  assert.equal(a[0].t, 0);
  assert.ok(a.some((q) => /cartão alerta/.test(q.motivo)) && a.some((q) => /cartão mensagem/.test(q.motivo)));
  assert.ok(a.some((q) => /^pergunta/.test(q.motivo)));
  assert.ok(a.some((q) => /andar \(1\/3\)/.test(q.motivo)));
  for (let i = 1; i < a.length; i++) assert.ok(a[i].t - a[i - 1].t >= 0.25 - 1e-9);
  const d = escolherDetalhes(lt);
  assert.ok(d.length <= 6 && d.length >= 4);
  assert.ok(d.some((x) => /pergunta/.test(x.motivo)));
});

test("patch de direção é aplicado e a história fica igual", () => {
  const r = clonar(MODELO);
  const p = aplicarPatch(r, { mudancas: [
    { alvo: "linha", indice: 4, campo: "olhar", valor: "dalva", motivo: "olhar para quem fala" },
    { alvo: "linha", indice: 5, campo: "eventos_adicionar", valor: "personagem.dalva.expressao=medo", motivo: "reação" },
    { alvo: "celular", indice: 1, campo: "duracao_s", valor: "4.5", motivo: "ler a mensagem" },
  ] }, canal);
  assert.equal(p.aplicado, true, p.motivo);
  assert.equal(p.roteiro.linhas[4].direcao.olhar, "dalva");
  assert.equal(p.roteiro.celular[1].duracao_s, 4.5);
  assert.equal(hashHistoria(p.roteiro), hashHistoria(MODELO));
  assert.deepEqual(r, MODELO, "o original não pode mudar");
});

test("patch recusa o que não é direção, tempo demais e cartão fora da faixa", () => {
  const p = aplicarPatch(clonar(MODELO), { mudancas: [
    { alvo: "linha", indice: 3, campo: "eventos_adicionar", valor: "celular.tela=2", motivo: "x" },
    { alvo: "linha", indice: 6, campo: "t", valor: String(MODELO.linhas[6].t + 2), motivo: "x" },
    { alvo: "linha", indice: 0, campo: "t", valor: "0.5", motivo: "x" },
    { alvo: "celular", indice: 0, campo: "duracao_s", valor: "12", motivo: "x" },
    { alvo: "celular", indice: 0, campo: "olhar", valor: "x", motivo: "x" },
  ] }, canal);
  assert.equal(p.aplicado, false);
  assert.equal(p.recusadas.length, 5);
  assert.equal(p.aplicadas.length, 0);
});

test("patch que derruba a nota do roteiro é revertido; a história mudar é detectada", () => {
  const ultima = MODELO.linhas.length - 1;
  const p = aplicarPatch(clonar(MODELO), { mudancas: [{ alvo: "linha", indice: ultima, campo: "clima", valor: "rotina", motivo: "x" }] }, canal);
  assert.equal(p.aplicado, false);
  assert.match(p.motivo, /revertido/);
  const outro = clonar(MODELO); outro.falas[0].texto = "outra coisa";
  assert.notEqual(hashHistoria(outro), hashHistoria(MODELO));
});

test("resposta do julgar fora do formato é apontada", () => {
  const ruim = { notas: Object.fromEntries(CRITERIOS.map((c) => [c, { nota: 11, evidencia: [], comentario: "" }])), defeitos: [], patch: { mudancas: [] }, veredito: "" };
  const erros = conferirResposta(ruim, ESQUEMA_JULGAR, "julgar");
  assert.ok(erros.some((e) => /fora de 0–10/.test(e)));
  assert.ok(erros.some((e) => /cite ao menos um quadro/.test(e)));
  assert.ok(conferirResposta({ notas: {} }, ESQUEMA_JULGAR).length > 0);
});

const prepFalsa = (ep) => async ({ n }) => ({ n, pasta: path.join(ep.dir, "critico", `rodada_${n}`), pastaRel: `critico/rodada_${n}`, quadros: [{ id: "Q01", t: 0, arquivo: "q.jpg", linha: 0, motivo: "gancho" }], detalhes: [], folhas: [], imagens: [], hash_quadros: `h${n}` });

test("laço do crítico com a IA falsa: reprova, aplica o patch, refaz e aprova na 2ª rodada", async () => {
  const ep = criarEpisodioFalso();
  fs.writeFileSync(path.join(ep.dir, "linha_do_tempo.json"), JSON.stringify(linhaDoTempo()));
  configurarIA({ provedor: "falsa", maxChamadas: 25 });
  configurarFalsa({ julgamentos: [
    { notas: { gancho: 8, legibilidade: 5, clareza_acao: 8, continuidade: 8, acabamento: 8, dilema_final: 8 }, defeitos: [{ quadro: "Q01", criterio: "legibilidade", gravidade: 2, descricao: "x", correcao: "y" }], patch: { mudancas: [{ alvo: "linha", indice: 4, campo: "olhar", valor: "dalva", motivo: "x" }] } },
    { notas: 8 },
  ] });
  let refeitos = 0;
  try {
    const r = await rodarCritico({ canal, ep: resolverEpisodio(ep.dir), refazer: async () => { refeitos++; }, preparar: prepFalsa(ep), resolver: resolverEpisodio });
    assert.equal(r.aprovado, true);
    const c = lerCritico(ep.dir);
    assert.equal(c.status, "aprovado");
    assert.equal(c.rodadas.length, 2);
    assert.equal(c.rodadas[0].patch.aplicado, true);
    assert.equal(c.fonte, "ia_falsa");
    assert.equal(refeitos, 1);
    assert.equal(chamadasFalsas().length, 4);
    assert.ok(fs.readFileSync(path.join(ep.dir, "revisoes.md"), "utf8").includes("## Rodada 2"));
    assert.equal(JSON.parse(fs.readFileSync(path.join(ep.dir, "roteiro.json"), "utf8")).linhas[4].direcao.olhar, "dalva");
  } finally { configurarIA({ provedor: "claude" }); limpar(ep.dir); }
});

test("três rodadas sem passar = reprovado, com bloqueio do crítico", async () => {
  const ep = criarEpisodioFalso();
  const prep = { n: 3, quadros: [{ id: "Q01", t: 0, arquivo: "q.jpg" }], detalhes: [], folhas: [], hash_quadros: "h" };
  const julgar = { notas: Object.fromEntries(CRITERIOS.map((c) => [c, { nota: 6, evidencia: ["Q01"], comentario: "x" }])), defeitos: [], patch: { mudancas: [] }, veredito: "x" };
  try {
    const r = registrarRodada({ canal, ep: resolverEpisodio(ep.dir), prep, olhar: { quadros: [], historia_entendida: "x", impressao_geral: "x" }, julgar, fonte: "api", cego: true });
    assert.equal(r.ok, true);
    assert.equal(r.fim, true);
    assert.equal(r.critico.status, "reprovado");
    const estado = JSON.parse(fs.readFileSync(path.join(ep.dir, "estado.json"), "utf8"));
    assert.ok(estado.bloqueios_por_etapa.critico[0].startsWith("crítico visual reprovou"));
  } finally { limpar(ep.dir); }
});
