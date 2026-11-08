import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { montarTextos } from "../etapas/09_capa_textos.js";
import { contarVotosHeuristico } from "../etapas/01_publico.js";
import { lerCanal, RAIZ } from "../config.js";

const canal = lerCanal();
const piloto = JSON.parse(fs.readFileSync(path.join(RAIZ, "episodios/ep01_uma_pra_das_tres/roteiro.json"), "utf8"));

test("textos seguem a fórmula do capítulo 71 e cabem nos limites", () => {
  const t = montarTextos({ canal, roteiro: piloto });
  assert.match(t.descricao, /Epi\. 01/);
  assert.ok(t.hashtags.length >= 2 && t.hashtags.length <= 4);
  assert.match(t.conferencia.tiktok.titulo, /#pov/);
  assert.ok(t.conferencia.youtube.titulo.length <= 100);
  assert.match(t.conferencia.youtube.titulo, /#Shorts/);
  assert.equal(t.comentario_fixado, piloto.comentario_fixado);
  assert.ok(!/parte 2/i.test(t.descricao));
});

test("contagem heurística de votos reconhece as opções", () => {
  const dilema = { opcao_a: "Vender a passagem", opcao_b: "Fechar o guichê" };
  const comentarios = [
    { texto: "eu venderia a passagem na hora" }, { texto: "VENDE" }, { texto: "fecha o guichê e corre" },
    { texto: "B com certeza" }, { texto: "A" }, { texto: "que medo desse senhor" },
  ];
  const r = contarVotosHeuristico(comentarios, dilema);
  assert.equal(r.votos_a, 2);
  assert.equal(r.votos_b, 2);
  assert.equal(r.sem_voto, 2);
});
