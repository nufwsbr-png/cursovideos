import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { validarRoteiro } from "../roteiro/validar.js";
import { lerCanal, RAIZ } from "../config.js";

const canal = lerCanal();
const piloto = JSON.parse(fs.readFileSync(path.join(RAIZ, "fabrica/testes/fixtures/roteiro_ep1_modelo.json"), "utf8"));
const clonar = (o) => JSON.parse(JSON.stringify(o));

test("o roteiro-modelo do Epi. 01 passa na validação", () => {
  const r = validarRoteiro(piloto, canal);
  assert.deepEqual(r.erros, []);
});

test("primeiro sinal depois de 7 s é erro", () => {
  const r = clonar(piloto);
  for (const l of r.linhas) if (l.ato === "sinal") l.t = 9;
  r.linhas.sort((a, b) => a.t - b.t);
  assert.ok(validarRoteiro(r, canal).erros.some((e) => /primeiro sinal/.test(e)));
});

test("fala sem linha e linha com fala inexistente são erros", () => {
  const r = clonar(piloto);
  r.falas.push({ id: "f99", quem: "dalva", voz: "Gacrux", texto: "Oi.", estilo: "flat", filtro: null, reaproveitar_de: null });
  r.linhas[1].fala = "f77";
  const { erros } = validarRoteiro(r, canal);
  assert.ok(erros.some((e) => /f99 não aparece/.test(e)));
  assert.ok(erros.some((e) => /f77/.test(e)));
});

test("personagem sem voz não pode falar e personagem invisível não entra em cena", () => {
  const r = clonar(piloto);
  r.falas[0].quem = "neusa";
  r.linhas[0].direcao.eventos.push("personagem.amaral.visivel=true");
  const { erros } = validarRoteiro(r, canal);
  assert.ok(erros.some((e) => /não tem voz/.test(e)));
  assert.ok(erros.some((e) => /nunca aparece em cena/.test(e)));
});

test("vocabulário de direção é conferido", () => {
  const r = clonar(piloto);
  r.linhas[2].direcao.acao = "pular";
  r.linhas[3].direcao.olhar = "janela_inexistente";
  r.linhas[4].direcao.eventos.push("prop.nada.estado=x");
  const { erros } = validarRoteiro(r, canal);
  assert.ok(erros.some((e) => /acao "pular"/.test(e)));
  assert.ok(erros.some((e) => /olhar "janela_inexistente"/.test(e)));
  assert.ok(erros.some((e) => /prop "nada"/.test(e)));
});

test("lugar-comum e palavras de risco são barrados", () => {
  const r = clonar(piloto);
  r.falas[0].texto = "Algo está errado aqui.";
  r.falas[1].texto = "Tem sangue no chão.";
  const { erros } = validarRoteiro(r, canal);
  assert.ok(erros.some((e) => /lugar-comum/.test(e)));
  assert.ok(erros.some((e) => /sangue/.test(e)));
});

test("ordem dos 8 atos é fixa e a última linha é a pergunta", () => {
  const r = clonar(piloto);
  r.linhas[r.linhas.length - 1].ato = "dilema";
  const { erros } = validarRoteiro(r, canal);
  assert.ok(erros.some((e) => /última linha/.test(e)));
});
