// Nota do roteiro (fabrica/roteiro/nota.js): as regras medidas na referência viram descontos e erros.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { avaliarRoteiro } from "../roteiro/nota.js";
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
