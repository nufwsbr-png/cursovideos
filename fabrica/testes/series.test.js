// Canal com mais de uma série (desde 2026-11-10): o canal efetivo de cada episódio, a série pela pasta, o nome da pasta
// e o nome da série nos textos.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { canalDaSerie, serieDaPasta, infoSeries, mesclarSerie } from "../../motor/canal_serie.js";
import { nomePastaEpisodio } from "../util/arquivos.js";
import { numeroEpisodio, formulaTexto } from "../publicar/textos.js";

function raizTemp() {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), "series_"));
  fs.mkdirSync(path.join(raiz, "canal", "series"), { recursive: true });
  fs.writeFileSync(path.join(raiz, "canal", "series", "b.json"), JSON.stringify({
    _aviso: "nota para humanos",
    frase_do_canal: "frase da B",
    protagonista: { id: "eu", maos: { pele: "#f2c4a2" } },
    elenco: [{ id: "vila", papel: "vilao" }],
    estilo: { legenda: { cores_por_personagem: { vila: "#ff9e9e" } } },
  }));
  return raiz;
}
const base = {
  nome_exibicao: "Canal",
  frase_do_canal: "frase da A",
  protagonista: { id: "eu", maos: { pele: "#7a4a28", manga: "#a9c7e8" }, pistas: { objeto: "carimbo" } },
  elenco: [{ id: "dalva", papel: "colega" }],
  audio: { lufs_alvo: -14 },
  estilo: { semente: 7, legenda: { tamanho: 44, cores_por_personagem: { eu: "#ffffff", dalva: "#fcb46c" } } },
  series: { padrao: "a", ativa: "b", lista: [{ id: "a", nome: "Série A" }, { id: "b", nome: "Série B", arquivo: "canal/series/b.json", prefixo_pasta: "bb" }] },
};

test("séries: a série substitui protagonista, elenco e frase; funde o estilo; ignora notas; o resto vem do canal", () => {
  const raiz = raizTemp();
  const b = canalDaSerie(base, "b", raiz);
  assert.equal(b.frase_do_canal, "frase da B");
  assert.deepEqual(b.protagonista, { id: "eu", maos: { pele: "#f2c4a2" } }, "o protagonista da série não herda pistas do outro");
  assert.deepEqual(b.elenco.map((p) => p.id), ["vila"]);
  assert.equal(b.estilo.legenda.tamanho, 44);
  assert.deepEqual(b.estilo.legenda.cores_por_personagem, { eu: "#ffffff", dalva: "#fcb46c", vila: "#ff9e9e" });
  assert.equal(b.audio.lufs_alvo, -14);
  assert.equal("_aviso" in b, false);
  assert.deepEqual(b.serie, { id: "b", nome: "Série B", prefixo_pasta: "bb", padrao: false, varias: true });
  fs.rmSync(raiz, { recursive: true, force: true });
});

test("séries: a padrão é igual ao canal.json; serie fica fora do JSON; trocar de série parte sempre do canal base", () => {
  const raiz = raizTemp();
  const a = canalDaSerie(base, "a", raiz);
  assert.equal(JSON.stringify(a), JSON.stringify(base), "a série padrão não muda nenhum hash");
  assert.equal(a.serie.padrao, true);
  assert.equal(Object.keys(a).includes("serie"), false);
  const b = canalDaSerie(a, "b", raiz);
  assert.equal(canalDaSerie(b, "b", raiz), b, "idempotente");
  const deNovoA = canalDaSerie(b, "a", raiz);
  assert.equal(deNovoA.frase_do_canal, "frase da A");
  assert.throws(() => canalDaSerie(base, "zzz", raiz), /não existe/);
  assert.equal(mesclarSerie(base, {}).frase_do_canal, "frase da A");
  fs.rmSync(raiz, { recursive: true, force: true });
});

test("séries: a série de uma pasta vem do roteiro, senão do prefixo, senão é a padrão; o nome da pasta leva o prefixo", () => {
  const raiz = raizTemp();
  const p1 = path.join(raiz, "bb-ep01_teste"); fs.mkdirSync(p1);
  const p2 = path.join(raiz, "ep02_teste"); fs.mkdirSync(p2);
  const p3 = path.join(raiz, "ep03_outra"); fs.mkdirSync(p3);
  fs.writeFileSync(path.join(p3, "roteiro.json"), JSON.stringify({ numero: 3, serie: "b" }));
  assert.equal(serieDaPasta(p1, base), "b");
  assert.equal(serieDaPasta(p2, base), "a");
  assert.equal(serieDaPasta(p3, base), "b");
  assert.deepEqual(infoSeries({ nome_exibicao: "X" }), { padrao: "padrao", ativa: "padrao", lista: [{ id: "padrao", nome: "X" }] });
  assert.equal(nomePastaEpisodio(1, "segura_o_elevador", "72h"), "72h-ep01_segura_o_elevador");
  assert.equal(nomePastaEpisodio(2, "a_passagem"), "ep02_a_passagem");
  fs.rmSync(raiz, { recursive: true, force: true });
});

test("séries: com várias séries, o texto diz qual (\"72 Horas · Epi. 01\"); sem série, fica igual", () => {
  assert.equal(numeroEpisodio(1), "Epi. 01");
  assert.equal(numeroEpisodio(1, "72 Horas"), "72 Horas · Epi. 01");
  assert.equal(formulaTexto({ situacao: "A síndica escondeu a água", numero: 1, serie: "72 Horas", hashtags: ["pov"] }), "A síndica escondeu a água. 72 Horas · Epi. 01 #pov");
  assert.equal(formulaTexto({ situacao: "A passagem saiu sozinha", numero: 1, hashtags: ["pov"] }), "A passagem saiu sozinha. Epi. 01 #pov");
});
