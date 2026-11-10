// Mundo com lugares conectados e plano de câmera (motor/cena/mundo.js e plano_camera.js): funções puras.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { montarMundo, rota, validarMundo, linhaLivre, moduloDoPonto, visiveis } from "../../motor/cena/mundo.js";
import { planejar, planejarDuracoes, duracaoPercurso, perfilPercurso, aberturaPortas, avaliarCamera } from "../../motor/cena/plano_camera.js";
import { montarLinhaDoTempo } from "../../motor/cena/linha_do_tempo.js";

const RAIZ = path.resolve(import.meta.dirname, "..", "..");
const canal = JSON.parse(fs.readFileSync(path.join(RAIZ, "canal", "canal.json"), "utf8"));
const roteiroMundo = JSON.parse(fs.readFileSync(path.join(RAIZ, "motor", "testes", "ep_mundo", "roteiro.json"), "utf8"));

test("o mundo da rodoviária é coerente (ids, nós e arestas no piso, passagens, grafo conectado)", () => {
  assert.deepEqual(validarMundo(canal), []);
});

test("coordenadas locais viram coordenadas do mundo (origem de cada lugar)", () => {
  const m = montarMundo(canal, "saguao");
  assert.deepEqual(m.nos.gv_entrada.pos, [-3, 0, 3.52]);
  assert.deepEqual(m.nos.cs_porta_cabine.pos, [0.6, 0, 1.87]);
  assert.equal(m.nos.gv_entrada.modulo, "guarda_volumes");
  assert.equal(moduloDoPonto(m, [0.6, 0, 2.0]), "corredor_servico");
  assert.equal(moduloDoPonto(m, [0, 0, -5]), "saguao");
});

test("rotas pelo grafo passam pelas portas e não atravessam parede", () => {
  const m = montarMundo(canal, "saguao");
  const r1 = rota(m, "cab_assento", "gv_centro");
  assert.ok(Math.abs(r1.comprimento - 8.6) < 0.05, r1.comprimento);
  assert.deepEqual(r1.nos.slice(0, 4), ["cab_assento", "cab_centro", "cab_porta_dentro", "cs_porta_cabine"]);
  const r2 = rota(m, "cab_assento", "sg_frente_porta");
  assert.ok(Math.abs(r2.comprimento - 20.7) < 0.05, r2.comprimento);
  assert.ok(r2.nos.includes("sg_porta_func")); // sai da cabine pelo corredor e entra no saguão pela porta SÓ FUNCIONÁRIOS
  for (let i = 1; i < r2.nos.length; i++) assert.ok(linhaLivre(m, m.nos[r2.nos[i - 1]].pos, m.nos[r2.nos[i]].pos), `${r2.nos[i - 1]}→${r2.nos[i]}`);
  // sem linha reta da cabine para o saguão (o vidro e o balcão estão no meio)
  assert.equal(linhaLivre(m, [0, 0, 0], [0, 0, -1.6]), false);
});

test("perfil de velocidade: rampa, cruzeiro e freada; chega exatamente ao fim", () => {
  const L = 8.4, v = 1.3, ta = 0.35;
  const T = duracaoPercurso(L, v, ta);
  assert.ok(Math.abs(T - (L / v + ta)) < 1e-9);
  let antes = -1;
  for (let t = 0; t <= T + 0.01; t += 0.05) { const { s } = perfilPercurso(L, v, ta, t); assert.ok(s >= antes - 1e-9); antes = s; }
  assert.ok(Math.abs(perfilPercurso(L, v, ta, T).s - L) < 1e-9);
  const curto = duracaoPercurso(0.2, 1.3, 0.35); // triângulo
  assert.ok(Math.abs(perfilPercurso(0.2, 1.3, 0.35, curto).s - 0.2) < 1e-9);
});

test("plano do episódio-teste: levantar, andar por duas portas, transição com teleporte, correr", () => {
  const p = planejar(roteiroMundo, canal);
  assert.deepEqual(p.avisos, []);
  assert.equal(p.linhas[1].tipo, "levantar");
  assert.equal(p.linhas[2].tipo, "andar");
  assert.deepEqual(p.linhas[2].percurso.portas.map((x) => x.porta), ["porta_guiche", "porta_gv"]);
  assert.equal(p.linhas[2].fim.modulo, "guarda_volumes");
  assert.equal(p.linhas[7].tipo, "transicao");
  assert.equal(p.linhas[7].fim.no, "sg_frente_guiche");
  assert.equal(p.linhas[8].tipo, "correr");
});

test("a linha do tempo dá tempo ao corpo: a caminhada empurra a linha seguinte", () => {
  const dur = planejarDuracoes(roteiroMundo, canal);
  const lt = montarLinhaDoTempo(roteiroMundo, null, canal, dur);
  const andar = lt.linhas[2], depois = lt.linhas[3];
  assert.ok(depois.inicio_s >= andar.inicio_s + andar.movimento.duracao_s + 0.15 - 1e-6);
  const tr = lt.linhas[7];
  assert.ok(Math.abs(tr.t_eventos - (tr.inicio_s + 0.7)) < 1e-6);
  assert.ok(lt.pergunta.inicio_s >= Math.max(...lt.falas.map((f) => f.fim_s)) + 1 - 1e-6);
  assert.equal(lt.duracao_total_s, Math.round((lt.pergunta.inicio_s + 4) * 1000) / 1000);
});

test("portas abrem antes de a câmera chegar e o lugar vizinho passa a ser desenhado", () => {
  const dur = planejarDuracoes(roteiroMundo, canal);
  const lt = montarLinhaDoTempo(roteiroMundo, null, canal, dur);
  const p = planejar(roteiroMundo, canal);
  const andar = lt.linhas[2];
  const tPorta = andar.inicio_s + andar.movimento.portas[0].t_rel;
  const ab = aberturaPortas(p, lt, tPorta);
  assert.ok(ab.porta_guiche > 0.99, `porta da cabine ${ab.porta_guiche}`);
  assert.equal(aberturaPortas(p, lt, andar.inicio_s - 0.01).porta_guiche ?? 0, 0);
  const cam = avaliarCamera(p, lt, andar.inicio_s + 0.2);
  const vis = visiveis(p.mundo, cam.pos, (id) => aberturaPortas(p, lt, andar.inicio_s + 0.2)[id] || 0);
  assert.ok(vis.has("saguao"));
  // dentro do guarda-volumes no fim da caminhada
  const fim = avaliarCamera(p, lt, lt.linhas[3].inicio_s - 0.01);
  assert.equal(fim.modulo, "guarda_volumes");
  assert.equal(fim.postura, "em_pe");
});
