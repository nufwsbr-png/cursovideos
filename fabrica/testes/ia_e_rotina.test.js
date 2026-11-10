// Parâmetros do Claude (imagens, cache, esquema), limite de chamadas, planilha, rotina diária, mídia e aprender.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { montarParametros, configurarIA, pedir, ErroOrcamentoIA, zerarContagem } from "../ia/claude.js";
import { linhaPlanilha } from "../etapas/01_publico.js";
import { corrigivelPelaIA, causasDe, oQueFazer } from "../diario.js";
import { empacotar, restaurar } from "../midia.js";
import { correcoesDe } from "../aprender.js";

test("parâmetros do Claude: sistema e última imagem em cache, imagens antes do texto, esquema e fallback", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "img_"));
  const img = path.join(dir, "a.jpg");
  fs.writeFileSync(img, Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]));
  const esquema = { type: "object", additionalProperties: false, properties: { x: { type: "string" } }, required: ["x"] };
  const p = montarParametros({ sistema: "S", usuario: "U", imagens: [{ caminho: img, rotulo: "FOLHA 1" }, { caminho: img, rotulo: "D1" }], esquema, modelo: "claude-opus-5-5", esforco: "high", maxTokens: 1000 });
  assert.equal(p.model, "claude-opus-5-5");
  assert.deepEqual(p.system, [{ type: "text", text: "S", cache_control: { type: "ephemeral" } }]);
  const c = p.messages[0].content;
  assert.deepEqual(c.map((b) => b.type), ["text", "image", "text", "image", "text"]);
  assert.equal(c[1].source.type, "base64");
  assert.equal(c[1].source.media_type, "image/jpeg");
  assert.equal(c[1].cache_control, undefined);
  assert.deepEqual(c[3].cache_control, { type: "ephemeral" });
  assert.equal(c[4].text, "U");
  assert.deepEqual(p.output_config, { effort: "high", format: { type: "json_schema", schema: esquema } });
  assert.deepEqual(p.betas, ["server-side-fallback-2026-07-01"]);
  assert.equal(p.fallbacks, "default");
  assert.equal(montarParametros({ sistema: "S", usuario: "só texto" }).messages[0].content, "só texto");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("limite de chamadas à IA por execução", async () => {
  configurarIA({ provedor: "falsa", maxChamadas: 2 });
  zerarContagem();
  try {
    await pedir({ sistema: "s", usuario: "u", rotulo: "votos" });
    await pedir({ sistema: "s", usuario: "u", rotulo: "votos" });
    await assert.rejects(() => pedir({ sistema: "s", usuario: "u", rotulo: "votos" }), ErroOrcamentoIA);
  } finally { configurarIA({ provedor: "claude", maxChamadas: 25 }); zerarContagem(); }
});

test("planilha: uma linha por plataforma, só a partir de 44 h, com a data da publicação", () => {
  const ep = { numero: 3, publicacao: { publicado_em: "2026-11-01T20:30:00Z" }, estado: { duracao_s: 88.2 } };
  const m = { views: 1000, comentarios: 50, salvamentos: 10, tempo_medio_s: 31, percentual_assistido: 42.5, seguidores_novos: 7 };
  assert.equal(linhaPlanilha({ ep, plataforma: "youtube", metricas: m, horas: 20 }), null);
  const l = linhaPlanilha({ ep, plataforma: "youtube", metricas: m, horas: 47 });
  assert.equal(l, "3,2026-11-01,88.2,1000,31,42.5,0.0500,0.0100,7,,,youtube");
  assert.equal(linhaPlanilha({ ep, plataforma: "youtube", metricas: m, horas: 70, csvAtual: `cabeçalho\n${l}\n` }), null);
  assert.ok(linhaPlanilha({ ep, plataforma: "tiktok", metricas: m, horas: 70, csvAtual: `${l}\n` }));
});

test("rotina: o que a IA corrige e o que precisa do dono", () => {
  assert.equal(corrigivelPelaIA("crítico visual reprovou: 3 rodada(s) sem passar"), true);
  assert.equal(corrigivelPelaIA("critico: não aprovado: nota baixa"), true);
  assert.equal(corrigivelPelaIA("duração 140.0s fora de 65–130s: corte ou acrescente falas"), true);
  assert.equal(corrigivelPelaIA("voz_real: 19 fala(s) com voz falsa"), false);
  assert.equal(corrigivelPelaIA("crítico visual não rodou: sem ANTHROPIC_API_KEY"), false);
  assert.equal(corrigivelPelaIA("publicação: credenciais do TikTok"), false);
  assert.match(oQueFazer("voz_real: 19 fala(s) com voz falsa"), /GEMINI_API_KEY/);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "causas_"));
  fs.writeFileSync(path.join(dir, "entrega.json"), JSON.stringify({ publicavel: false, checagens: { voz_real: { ok: false, detalhe: "19 fala(s) com voz falsa" }, bloqueios: { ok: false, detalhe: "x" }, prova: { ok: true } } }));
  assert.deepEqual(causasDe({ parou_em: null }, dir), ["voz_real: 19 fala(s) com voz falsa"]);
  assert.deepEqual(causasDe({ parou_em: "render", motivo: "o crítico visual não aprovou: x" }, dir), ["o crítico visual não aprovou: x"]);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("mídia do CI: empacota com hash, restaura e recusa arquivo corrompido", () => {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), "midia_"));
  const eps = path.join(raiz, "episodios"), cache = path.join(raiz, "cache");
  const dir = path.join(eps, "ep01_teste");
  fs.mkdirSync(path.join(dir, "audio", "falas"), { recursive: true });
  fs.writeFileSync(path.join(dir, "video_mudo.mp4"), "video");
  fs.writeFileSync(path.join(dir, "audio", "falas", "f01.wav"), "wav");
  const m = empacotar({ pasta: cache, episodios: [{ nome: "ep01_teste", dir, numero: 1, estado: { etapa: "render" } }] });
  assert.deepEqual(Object.keys(m.episodios.ep01_teste).sort(), ["audio/falas/f01.wav", "video_mudo.mp4"]);
  fs.rmSync(path.join(dir, "video_mudo.mp4"));
  fs.writeFileSync(path.join(cache, "ep01_teste", "audio", "falas", "f01.wav"), "corrompido");
  fs.rmSync(path.join(dir, "audio", "falas", "f01.wav"));
  const r = restaurar({ pasta: cache, pastaEpisodios: eps });
  assert.equal(r.restaurados, 1);
  assert.equal(fs.readFileSync(path.join(dir, "video_mudo.mp4"), "utf8"), "video");
  assert.ok(r.recusados.some((x) => /f01\.wav: hash diferente/.test(x)));
  assert.ok(!fs.existsSync(path.join(dir, "audio", "falas", "f01.wav")));
  fs.rmSync(raiz, { recursive: true, force: true });
});

test("aprender: correções de um episódio (linter, escrita e crítico)", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aprender_"));
  fs.writeFileSync(path.join(dir, "validacao.json"), JSON.stringify({ itens: [{ id: "falas.mediana", tipo: "desconto" }], rodadas: [{ rodada: 0, itens: ["ritmo.ppm", "falas.mediana"] }] }));
  fs.writeFileSync(path.join(dir, "critico.json"), JSON.stringify({ nota_minima: 7, rodadas: [{ notas: { gancho: 8, legibilidade: 5 } }] }));
  assert.deepEqual([...correcoesDe(dir)].sort(), ["critico.legibilidade", "falas.mediana", "ritmo.ppm"]);
  fs.rmSync(dir, { recursive: true, force: true });
});
