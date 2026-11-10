// Nota do roteiro (fabrica/roteiro/nota.js): as regras medidas na referência viram descontos e erros.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { avaliarRoteiro, medirRoteiro } from "../roteiro/nota.js";
import { lerCanal, RAIZ } from "../config.js";

const canal = lerCanal();
const modelo = JSON.parse(fs.readFileSync(path.join(RAIZ, "fabrica/testes/fixtures/roteiro_ep1_modelo.json"), "utf8"));
const clonar = (o) => JSON.parse(JSON.stringify(o));
const ids = (av) => av.itens.map((i) => i.id);

test("o roteiro-modelo tira 100 e passa", () => {
  const av = avaliarRoteiro(modelo, canal);
  assert.deepEqual(av.erros, []);
  assert.equal(av.nota, 100);
  assert.equal(av.aprovado, true);
  assert.equal(av.medidas.primeira_fala_s, 0);
  assert.ok(av.medidas.maior_trecho_sem_fala_s >= 8 && av.medidas.trecho_com_acao);
});

test("a nota é determinística", () => {
  assert.deepEqual(avaliarRoteiro(modelo, canal), avaliarRoteiro(clonar(modelo), canal));
});

test("primeira fala tardia desconta; muito tardia bloqueia", () => {
  const r = clonar(modelo);
  r.linhas[0].fala = null; r.falas = r.falas.filter((f) => f.id !== "f01");
  r.linhas[1].t = 1.6; // primeira fala em 1,6 s
  const av = avaliarRoteiro(r, canal);
  assert.ok(ids(av).includes("abertura.primeira_fala"));
  r.linhas[1].t = 2.6;
  assert.ok(avaliarRoteiro(r, canal).erros.some((e) => /primeira fala/.test(e)));
});

test("dilema sem emoji ou sem a opção arriscada bloqueia", () => {
  const r = clonar(modelo);
  delete r.dilema.emoji_a; delete r.dilema.arriscada;
  const av = avaliarRoteiro(r, canal);
  assert.ok(av.erros.some((e) => /emoji/.test(e)));
  assert.ok(av.erros.some((e) => /arriscada/.test(e)));
  assert.equal(av.aprovado, false);
});

test("sem trecho de ação sem fala, desconta", () => {
  const r = clonar(modelo);
  // falas no meio da caminhada e das mensagens da mãe quebram os dois trechos sem fala
  r.falas.push({ id: "f20", quem: "eu", voz: "Iapetus", texto: "Tô indo.", estilo: "low", filtro: null, reaproveitar_de: null });
  r.falas.push({ id: "f21", quem: "eu", voz: "Iapetus", texto: "Mãe?", estilo: "low", filtro: null, reaproveitar_de: null });
  // (uma linha não começa no meio de um movimento: para falar andando, a fala vai na própria linha da caminhada)
  r.linhas.find((l) => /^andar:/.test(l.direcao.acao)).fala = "f20";
  r.linhas.find((l) => (l.direcao.eventos || []).includes("celular.notificacao=2")).fala = "f21";
  const av = avaliarRoteiro(r, canal);
  assert.ok(ids(av).includes("silencio.trecho_acao") || ids(av).includes("silencio.sem_acao"), JSON.stringify(av.medidas));
});

test("fechamento: sem avanço antes do cartão desconta", () => {
  const r = clonar(modelo);
  const i = r.linhas.findIndex((l) => /^avancar:impressora/.test(l.direcao.acao));
  r.linhas[i].direcao.acao = "parar";
  assert.ok(ids(avaliarRoteiro(r, canal)).includes("fechamento.aproximacao"));
});

test("alerta longo e cartão fora do tempo", () => {
  const r = clonar(modelo);
  r.celular[0].texto = "Passagem emitida agora para o das três";
  r.celular[1].duracao_s = 12;
  const av = avaliarRoteiro(r, canal);
  assert.ok(ids(av).includes("celular.alerta"));
  assert.ok(av.erros.some((e) => /duracao_s 12/.test(e)));
});

test("continuação: começa no perigo e precisa do selo; episódio 1 não leva selo", () => {
  const r = clonar(modelo);
  r.linhas[0].direcao.eventos.push("tela.selo=PARTE 2");
  assert.ok(avaliarRoteiro(r, canal).erros.some((e) => /não leva selo/.test(e)));
  const c = clonar(modelo);
  c.linhas = c.linhas.filter((l) => !["rotina", "sinal", "negacao"].includes(l.ato));
  const t0 = c.linhas[0].t; for (const l of c.linhas) l.t = Math.round((l.t - t0) * 100) / 100;
  const usadas = new Set(c.linhas.map((l) => l.fala).filter(Boolean)); c.falas = c.falas.filter((f) => usadas.has(f.id));
  let av = avaliarRoteiro(c, canal, { continuacao: 1, numero: 2 });
  assert.ok(av.erros.some((e) => /tela\.selo=PARTE 2/.test(e)));
  assert.ok(!av.erros.some((e) => /falta o ato "rotina"/.test(e)));
  c.linhas[0].direcao.eventos.push("tela.selo=PARTE 2");
  av = avaliarRoteiro(c, canal, { continuacao: 1, numero: 2 });
  assert.ok(!av.erros.some((e) => /selo/.test(e)), av.erros.join(" | "));
});

// Regras de emoção (aprovadas pelo dono em 2026-11-10)
const comVilao = () => {
  const c = clonar(canal);
  c.elenco = c.elenco.map((p) => (p.id === "passageiro" ? { ...p, papel: "vilao" } : p));
  return c;
};
const marcarEmocoes = (r, c) => {
  const lt = medirRoteiro(r, c).linha;
  r.linhas[0].emocao = "riso";
  const meio = lt.linhas.filter((l) => l.inicio_s >= 16 && l.inicio_s <= 50).map((l) => l.indice).slice(0, 3);
  for (const i of meio) r.linhas[i].emocao = "raiva";
  r.linhas[r.linhas.length - 3].emocao = "compaixao";
  return r;
};

test("emoção: roteiro dispensado (regras_emocao: false) não perde ponto; sem a dispensa e sem vilão no elenco, é erro", () => {
  assert.ok(avaliarRoteiro(modelo, canal).avisos.some((a) => /emoção dispensadas/.test(a)));
  const r = clonar(modelo); delete r.regras_emocao;
  const av = avaliarRoteiro(r, canal);
  assert.ok(ids(av).includes("emocao.vilao"));
  assert.equal(av.aprovado, false);
});

test("emoção: vilão em cena, riso no começo, 3 golpes de raiva, compaixão e a primeira frase na boca dele = sem desconto", () => {
  const c = comVilao();
  const r = clonar(modelo); delete r.regras_emocao;
  r.falas = r.falas.map((f) => (f.id === "f19" ? { ...f, texto: "Ela ligou sozinha de novo, moço." } : f));
  marcarEmocoes(r, c);
  const av = avaliarRoteiro(r, c);
  assert.deepEqual(ids(av).filter((i) => i.startsWith("emocao.")), [], JSON.stringify(av.itens.filter((i) => i.id.startsWith("emocao."))));
  assert.equal(av.aprovado, true);
});

test("emoção: sem riso, sem raiva, sem compaixão e sem a primeira frase de volta, cada falta desconta", () => {
  const c = comVilao();
  const r = clonar(modelo); delete r.regras_emocao;
  const av = avaliarRoteiro(r, c);
  for (const id of ["emocao.humor", "emocao.raiva", "emocao.compaixao", "emocao.virada_vilao"]) assert.ok(ids(av).includes(id), id);
  assert.equal(av.itens.find((i) => i.id === "emocao.raiva").pontos, -9);
  // vilão que só fala no telefone (sem posicao) não conta como em cena
  const r2 = clonar(r);
  r2.linhas = r2.linhas.map((l) => ({ ...l, direcao: { ...l.direcao, eventos: (l.direcao?.eventos ?? []).filter((e) => !/^personagem\.passageiro\./.test(e)) } }));
  assert.ok(avaliarRoteiro(r2, c).erros.some((e) => /em cena: não/.test(e)));
});
