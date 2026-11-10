// Folhas do crítico visual: escolhe os instantes que importam (gancho, um quadro por linha, caminhadas, mergulhos no
// preto, cartões, selo e pergunta), renderiza com o motor numa pasta própria e monta folhas 4×3 em JPEG com o rótulo de
// cada quadro, mais 6 detalhes em 1080×1920. Tudo determinístico: a mesma linha do tempo dá os mesmos quadros.
import fs from "node:fs";
import path from "node:path";
import { PASTA_MOTOR } from "../config.js";
import { executar } from "../util/exec.js";

const RENDERIZAR = path.join(PASTA_MOTOR, "renderizar.js");
export const MAX_QUADROS = 48;
export const POR_FOLHA = 12; // 4 colunas × 3 linhas
const arred = (t) => Math.round(t * 100) / 100;
const nomeTempo = (t) => "t_" + t.toFixed(2).padStart(7, "0");

function linhaEm(lt, t) {
  const l = (lt.linhas ?? []).find((x) => t >= x.inicio_s && t < x.fim_s);
  return l ? l.indice : null;
}

/** Instantes para o crítico, com prioridade (0 = sempre entra) e o motivo. */
export function escolherQuadros(lt, { max = MAX_QUADROS } = {}) {
  const dur = lt.duracao_total_s;
  const itens = [];
  const add = (t, motivo, prioridade) => { if (Number.isFinite(t) && t >= 0 && t < dur - 0.05) itens.push({ t: arred(t), motivo, prioridade, linha: linhaEm(lt, t) }); };
  add(0, "gancho (0 s)", 0); add(0.5, "gancho (0,5 s)", 0); add(1.5, "gancho (1,5 s)", 0);
  if ((lt.linhas?.[0]?.direcao?.eventos ?? []).some((e) => /^tela\.selo=/.test(e))) add(1.2, "selo PARTE", 0);
  for (const c of (lt.celular ?? []).filter((c) => c.evento === "notificacao")) add(c.inicio_s + 0.9, `cartão ${c.tipo} ${c.indice}`, 0);
  if (lt.pergunta) {
    add(lt.pergunta.inicio_s + 0.5, "pergunta (entrando)", 0);
    add(lt.pergunta.inicio_s + 2.5, "pergunta", 0);
    add(lt.pergunta.fim_s - 0.15, "pergunta (último quadro)", 1);
  }
  for (const l of lt.linhas ?? []) {
    const f = l.fala ? (lt.falas ?? []).find((x) => x.id === l.fala) : null;
    const t = f ? (f.inicio_s + f.fim_s) / 2 : l.inicio_s + Math.min(0.8, (l.fim_s - l.inicio_s) / 2);
    add(t, `linha ${l.indice} (${l.ato})${f ? ` · fala ${f.id}` : ""}`, 1);
    const mv = l.movimento;
    const dmv = mv ? (mv.duracao_s ?? (mv.fim_s - mv.inicio_s)) : 0;
    if (mv && dmv > 2) {
      const ini = mv.inicio_s ?? l.inicio_s;
      add(ini + dmv * 0.33, `${mv.tipo} (1/3) linha ${l.indice}`, 2);
      add(ini + dmv * 0.66, `${mv.tipo} (2/3) linha ${l.indice}`, 2);
    }
    if (l.transicao) {
      add(l.transicao.inicio_s + l.transicao.saida_s * 0.5, `entrando no preto linha ${l.indice}`, 2);
      add(l.transicao.inicio_s + l.transicao.total_s + 0.2, `saindo do preto linha ${l.indice}`, 1);
    }
  }
  // sem repetição: quadros a menos de 0,25 s viram um (fica a maior prioridade)
  itens.sort((a, b) => a.t - b.t || a.prioridade - b.prioridade);
  const unicos = [];
  for (const it of itens) {
    const ultimo = unicos[unicos.length - 1];
    if (ultimo && it.t - ultimo.t < 0.25) { if (it.prioridade < ultimo.prioridade) unicos[unicos.length - 1] = { ...it, motivo: `${it.motivo} + ${ultimo.motivo}` }; else ultimo.motivo += ` + ${it.motivo}`; continue; }
    unicos.push({ ...it });
  }
  const escolhidos = unicos.length <= max ? unicos : [...unicos].sort((a, b) => a.prioridade - b.prioridade || a.t - b.t).slice(0, max).sort((a, b) => a.t - b.t);
  return escolhidos.map((q, i) => ({ id: `Q${String(i + 1).padStart(2, "0")}`, ...q }));
}

/** 6 detalhes em tamanho cheio: 1ª legenda, cartões, selo ou caminhada, a pergunta e o quadro antes dela. */
export function escolherDetalhes(lt) {
  const dur = lt.duracao_total_s;
  const det = [];
  const add = (t, motivo) => { if (Number.isFinite(t) && t >= 0 && t < dur - 0.05 && !det.some((d) => Math.abs(d.t - t) < 0.25)) det.push({ t: arred(t), motivo }); };
  const f0 = (lt.falas ?? [])[0];
  if (f0) add((f0.inicio_s + f0.fim_s) / 2, `primeira legenda (${f0.id})`);
  const cart = (lt.celular ?? []).filter((c) => c.evento === "notificacao");
  const alerta = cart.find((c) => c.tipo === "alerta"), msg = cart.find((c) => c.tipo === "mensagem");
  if (alerta) add(alerta.inicio_s + 0.9, "cartão de alerta");
  if (msg) add(msg.inicio_s + 0.9, "cartão de mensagem");
  if ((lt.linhas?.[0]?.direcao?.eventos ?? []).some((e) => /^tela\.selo=/.test(e))) add(1.2, "selo PARTE");
  const andando = (lt.linhas ?? []).find((l) => l.movimento && /andar|correr/.test(l.movimento.tipo));
  if (andando) add((andando.movimento.inicio_s ?? andando.inicio_s) + (andando.movimento.duracao_s ?? 2) * 0.5, `caminhada (linha ${andando.indice})`);
  if (lt.pergunta) { add(lt.pergunta.inicio_s + 2.5, "pergunta"); add(lt.pergunta.inicio_s - 0.4, "quadro antes da pergunta"); }
  // completa com legendas longas (2 linhas na tela)
  for (const f of [...(lt.falas ?? [])].sort((a, b) => String(b.texto ?? "").length - String(a.texto ?? "").length)) {
    if (det.length >= 6) break;
    add((f.inicio_s + f.fim_s) / 2, `legenda longa (${f.id})`);
  }
  return det.slice(0, 6).sort((a, b) => a.t - b.t).map((d, i) => ({ id: `D${i + 1}`, ...d, linha: linhaEm(lt, d.t) }));
}

/** Renderiza os instantes numa pasta do episódio (sem mexer no render.json). Devolve os caminhos. */
export async function renderizarInstantes(dirEp, tempos, { pasta, escala = 0.5, formato = "jpg" }) {
  fs.rmSync(path.join(dirEp, pasta), { recursive: true, force: true });
  await executar("node", [RENDERIZAR, "--episodio", dirEp, "--stills", tempos.map((t) => t.toFixed(2)).join(","), "--escala", String(escala), "--formato", formato, "--pasta", pasta, "--sem-registro"]);
  return tempos.map((t) => path.join(dirEp, pasta, nomeTempo(t) + "." + formato));
}

function htmlFolha(quadros, titulo) {
  const itens = quadros.map((q) => `<figure><img src="data:image/jpeg;base64,${fs.readFileSync(q.arquivo).toString("base64")}"><figcaption><b>${q.id}</b> · ${q.t.toFixed(1)} s${q.linha !== null && q.linha !== undefined ? ` · L${q.linha}` : ""}</figcaption></figure>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;background:#151515;font-family:Verdana,Arial,sans-serif}
h1{margin:0;padding:6px 10px;font-size:20px;color:#eee;font-weight:700}
.g{display:grid;grid-template-columns:repeat(4,270px);gap:8px;padding:0 8px 8px}
figure{margin:0;background:#000}
img{display:block;width:270px;height:480px;object-fit:cover}
figcaption{color:#fff;font-size:17px;padding:4px 6px;background:#262626}
</style></head><body><h1>${titulo}</h1><div class="g">${itens}</div></body></html>`;
}

/** Monta as folhas 4×3 (JPEG) a partir dos quadros renderizados. */
export async function montarFolhas(quadros, pastaSaida) {
  const { chromium } = await import("playwright");
  const executablePath = process.env.CHROME_PATH || process.env.PUPPETEER_EXECUTABLE_PATH || process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;
  const nav = await chromium.launch({ executablePath, args: ["--no-sandbox", "--disable-gpu"] });
  const folhas = [];
  try {
    for (let i = 0; i < quadros.length; i += POR_FOLHA) {
      const grupo = quadros.slice(i, i + POR_FOLHA);
      const n = folhas.length + 1;
      const titulo = `FOLHA ${n} · ${grupo[0].id}–${grupo[grupo.length - 1].id}`;
      const pagina = await nav.newPage({ viewport: { width: 4 * 270 + 5 * 8, height: 100 }, deviceScaleFactor: 1 });
      await pagina.setContent(htmlFolha(grupo, titulo), { waitUntil: "load" });
      const destino = path.join(pastaSaida, `folha_${n}.jpg`);
      await pagina.screenshot({ path: destino, type: "jpeg", quality: 82, fullPage: true });
      await pagina.close();
      folhas.push({ arquivo: destino, titulo, quadros: grupo.map((q) => q.id) });
    }
  } finally {
    await nav.close();
  }
  return folhas;
}
