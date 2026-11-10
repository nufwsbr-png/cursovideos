// Orquestrador como um make, versões por etapa e o portão final (entrega publicável) — com etapas falsas.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { produzir } from "../orquestrador.js";
import { situacao } from "../etapas/registro.js";
import { entradaDe, compararVersao } from "../util/versoes.js";
import { conferirEntrega, montarEntrega } from "../etapas/09b_entrega.js";
import { resolverEpisodio } from "../util/arquivos.js";
import { lerCanal } from "../config.js";
import { criarEpisodioFalso, etapasFalsas, editarRoteiro, limpar } from "./_episodio_falso.js";

const canal = lerCanal();
const acoes = (r) => Object.fromEntries(r.relatorio.map((x) => [x.etapa, x.acao]));

test("compararVersao explica o que mudou e o que falta", () => {
  const a = entradaDe({ roteiro: "sha256:1", medidas: "sha256:2" });
  const b = entradaDe({ roteiro: "sha256:9", medidas: "sha256:2" });
  const reg = { entrada: a, saidas: { "x.json": "sha256:a", "y.json": null } };
  assert.equal(compararVersao(reg, a, { "x.json": "sha256:a", "y.json": null }).valida, true);
  const c = compararVersao(reg, b, { "x.json": null });
  assert.equal(c.valida, false);
  assert.deepEqual(c.mudou, ["roteiro"]);
  assert.deepEqual(c.faltam, ["x.json"]);
  assert.equal(compararVersao(null, a, {}).valida, false);
});

test("primeira vez roda tudo; a segunda pula tudo (só a entrega confere de novo)", async () => {
  const ep = criarEpisodioFalso();
  try {
    const { rodar, rodou } = etapasFalsas();
    const r1 = await produzir({ canal, ep, E: {}, rodar });
    assert.equal(r1.parou_em, null, r1.motivo);
    assert.deepEqual(rodou, ["roteiro", "vozes", "conferir", "tempo", "quadros", "critico", "render", "som", "prova", "capa", "entrega"]);
    rodou.length = 0;
    const r2 = await produzir({ canal, ep, E: {}, rodar });
    assert.deepEqual(rodou, ["entrega"]);
    assert.equal(acoes(r2).render, "pulou");
    const entrega = JSON.parse(fs.readFileSync(path.join(ep.dir, "entrega.json"), "utf8"));
    assert.equal(entrega.publicavel, true, entrega.motivos.join(" | "));
  } finally { limpar(ep.dir); }
});

test("mudar a direção refaz a partir do tempo sem refazer as vozes", async () => {
  const ep = criarEpisodioFalso();
  try {
    const { rodar, rodou } = etapasFalsas();
    await produzir({ canal, ep, E: {}, rodar });
    rodou.length = 0;
    editarRoteiro(ep.dir, (r) => { r.linhas[3].direcao.olhar = "painel"; });
    const ctx = { canal, ep: resolverEpisodio(ep.dir), dir: ep.dir, roteiro: resolverEpisodio(ep.dir).roteiro, opcoes: {} };
    assert.equal(situacao("vozes", ctx).valida, true);
    assert.deepEqual(situacao("tempo", ctx).mudou, ["roteiro"]);
    await produzir({ canal, ep, E: {}, rodar });
    assert.ok(!rodou.includes("vozes") && !rodou.includes("conferir"), rodou.join(","));
    for (const e of ["roteiro", "tempo", "quadros", "critico", "render", "som", "prova", "capa"]) assert.ok(rodou.includes(e), `${e} devia rodar: ${rodou.join(",")}`);
  } finally { limpar(ep.dir); }
});

test("mudar o texto de uma fala invalida as vozes", async () => {
  const ep = criarEpisodioFalso();
  try {
    const { rodar } = etapasFalsas();
    await produzir({ canal, ep, E: {}, rodar });
    editarRoteiro(ep.dir, (r) => { r.falas[0].texto = "Novato, a impressora ligou de novo."; });
    const e = resolverEpisodio(ep.dir);
    const s = situacao("vozes", { canal, ep: e, dir: ep.dir, roteiro: e.roteiro, opcoes: {} });
    assert.equal(s.valida, false);
    assert.ok(s.mudou.includes("falas"));
  } finally { limpar(ep.dir); }
});

test("portões: revisor grave para antes do crítico; crítico reprovado para antes do render", async () => {
  const a = criarEpisodioFalso();
  const b = criarEpisodioFalso();
  try {
    let f = etapasFalsas({ revisorGraves: 0 });
    // revisor com problema grave: a etapa quadros grava o bloqueio, o crítico não roda
    const { definirBloqueios } = await import("../util/arquivos.js");
    f.rodar.quadros = async (ctx) => { fs.writeFileSync(path.join(ctx.dir, "revisao.json"), JSON.stringify({ problemas: [{ tipo: "x" }] })); fs.writeFileSync(path.join(ctx.dir, "folha.png"), "f"); definirBloqueios(ctx.dir, "quadros", ["revisor: 1 problema(s) grave(s) nos quadros"]); return {}; };
    const r1 = await produzir({ canal, ep: a, E: {}, rodar: f.rodar });
    assert.equal(r1.parou_em, "critico");
    assert.match(r1.motivo, /revisor/);
    f = etapasFalsas({ critico: { aprovado: false, fonte: "api" } });
    const r2 = await produzir({ canal, ep: b, E: {}, rodar: f.rodar });
    assert.equal(r2.parou_em, "render");
    assert.match(r2.motivo, /crítico visual não aprovou/);
    assert.ok(!f.rodou.includes("render"));
  } finally { limpar(a.dir); limpar(b.dir); }
});

test("entrega: voz falsa e crítico da IA falsa não publicam; 1 byte a mais no MP4 faz a publicação recusar", async () => {
  const ep = criarEpisodioFalso({ provedor: "falso" });
  const ep2 = criarEpisodioFalso();
  try {
    const f = etapasFalsas({ critico: { aprovado: true, fonte: "ia_falsa" } });
    await produzir({ canal, ep, E: {}, rodar: f.rodar });
    const e = montarEntrega({ canal, ep: resolverEpisodio(ep.dir) });
    assert.equal(e.publicavel, false);
    assert.equal(e.checagens.voz_real.ok, false);
    assert.equal(e.checagens.critico.ok, false);
    assert.match(e.checagens.critico.detalhe, /IA falsa/);

    const g = etapasFalsas();
    await produzir({ canal, ep: ep2, E: {}, rodar: g.rodar });
    const alvo = resolverEpisodio(ep2.dir);
    assert.equal(conferirEntrega({ canal, ep: alvo }).ok, true);
    fs.appendFileSync(path.join(ep2.dir, "ep01.mp4"), "x");
    const c = conferirEntrega({ canal, ep: alvo });
    assert.equal(c.ok, false);
    assert.match(c.motivo, /ep01\.mp4 mudou depois da entrega/);
  } finally { limpar(ep.dir); limpar(ep2.dir); }
});
