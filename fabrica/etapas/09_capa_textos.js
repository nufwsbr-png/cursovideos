// Etapa 9 — Capa e textos (capítulos 70 e 71): 3 capas com área segura (texto entre 240 e 1680 px),
// frase de gancho de até 5 palavras, número do episódio grande, cores do canal no mesmo lugar; textos por plataforma.
import fs from "node:fs";
import path from "node:path";
import { RAIZ } from "../config.js";
import { lerJson, gravarJson, atualizarEstado } from "../util/arquivos.js";
import { executar } from "../util/exec.js";
import { log } from "../util/log.js";
import { nomeMp4 } from "./07_som.js";
import { textoPara, formulaTexto, normalizarHashtags } from "../publicar/textos.js";

async function abrirNavegador() {
  const { chromium } = await import("playwright");
  const executablePath = process.env.CHROME_PATH || process.env.PUPPETEER_EXECUTABLE_PATH || process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;
  return chromium.launch({ executablePath, args: ["--no-sandbox", "--disable-gpu"] });
}

// Quadros da capa: o motor renderiza os instantes exatos em PNG (sempre com o visual atual, sem compressão do vídeo).
// Se o motor falhar, cai para extrair do MP4 pronto.
async function quadrosDoMotor(ep, tempos) {
  const renderizar = path.join(RAIZ, "motor", "renderizar.js");
  if (!fs.existsSync(renderizar)) return null;
  const lista = tempos.map((t) => Number(t.toFixed(2)));
  try {
    await executar("node", [renderizar, "--episodio", ep.dir, "--stills", lista.join(","), "--formato", "png"]);
  } catch (e) { log.aviso(`motor não conseguiu renderizar os quadros da capa (${e.message}); usando o vídeo pronto`); return null; }
  const saida = [];
  for (let i = 0; i < lista.length; i++) {
    const origem = path.join(ep.dir, "stills", "t_" + lista[i].toFixed(2).padStart(7, "0") + ".png");
    if (!fs.existsSync(origem)) return null;
    const destino = path.join(ep.dir, `quadro_capa_${i + 1}.png`);
    fs.copyFileSync(origem, destino); saida.push(destino);
  }
  return saida;
}

async function extrairQuadro(video, t, destino) {
  await executar("ffmpeg", ["-y", "-v", "error", "-ss", String(t), "-i", video, "-frames:v", "1", "-q:v", "2", destino]);
}

// A fonte da capa é a mesma das legendas (Baloo 2, peso 800): uma identidade só. Cai para Anton se a Baloo não estiver instalada.
function fonteBase64() {
  const base = path.join(RAIZ, "node_modules", "@fontsource");
  const baloo = path.join(base, "baloo-2", "files", "baloo-2-latin-800-normal.woff2");
  const balooExt = path.join(base, "baloo-2", "files", "baloo-2-latin-ext-800-normal.woff2");
  if (fs.existsSync(baloo)) return { familia: "Baloo 2", peso: 800, latin: fs.readFileSync(baloo).toString("base64"), ext: fs.existsSync(balooExt) ? fs.readFileSync(balooExt).toString("base64") : null };
  const anton = path.join(base, "anton", "files", "anton-latin-400-normal.woff2");
  return fs.existsSync(anton) ? { familia: "Anton", peso: 400, latin: fs.readFileSync(anton).toString("base64"), ext: null } : null;
}

function htmlCapa({ quadroBase64, gancho, numero, cores, variante, nomeCanal, fonteB64, largura, altura }) {
  const ep = String(numero).padStart(2, "0");
  const fonte = fonteB64 ? `@font-face{font-family:"${fonteB64.familia}";font-weight:${fonteB64.peso};src:url(data:font/woff2;base64,${fonteB64.latin}) format("woff2");}` + (fonteB64.ext ? `@font-face{font-family:"${fonteB64.familia}";font-weight:${fonteB64.peso};src:url(data:font/woff2;base64,${fonteB64.ext}) format("woff2");unicode-range:U+0100-024F,U+1E00-1EFF;}` : "") + `.gancho,.epi,.canal{font-weight:${fonteB64.peso}}` : "";
  const familia = fonteB64 ? `"${fonteB64.familia}"` : "Impact, 'Arial Black', sans-serif";
  const ganchoLinhas = gancho.toUpperCase();
  const posicoes = {
    1: `.gancho{top:300px}.epi{top:1380px}`,
    2: `.gancho{top:760px;font-size:168px;line-height:0.95}.epi{top:300px}`,
    3: `.gancho{top:1180px}.epi{top:300px;left:80px;right:auto;text-align:left}`,
  }[variante];
  return `<!doctype html><html><head><meta charset="utf-8"><style>
${fonte}
html,body{margin:0;padding:0;width:${largura}px;height:${altura}px;overflow:hidden;background:#000}
.quadro{position:absolute;inset:0;background:url(data:image/png;base64,${quadroBase64}) center/cover no-repeat}
.sombra{position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.55) 0,rgba(0,0,0,0) 30%,rgba(0,0,0,0) 65%,rgba(0,0,0,.6) 100%)}
.faixa{position:absolute;left:0;right:0;top:240px;height:14px;background:${cores.c3}}
.faixa2{position:absolute;left:0;right:0;top:1666px;height:14px;background:${cores.c1}}
.gancho{position:absolute;left:70px;right:70px;text-align:center;font-family:${familia};font-size:150px;line-height:1;color:#fff;letter-spacing:1px;
  text-shadow:0 0 0 #000;-webkit-text-stroke:3px #0b0b0b;paint-order:stroke fill;filter:drop-shadow(0 10px 0 ${cores.c1}) drop-shadow(0 0 22px rgba(0,0,0,.8))}
.epi{position:absolute;left:0;right:0;text-align:center;font-family:${familia};font-size:120px;color:${cores.alerta};-webkit-text-stroke:3px #0b0b0b;paint-order:stroke fill;filter:drop-shadow(0 8px 0 #0b0b0b)}
.epi small{display:block;font-size:54px;color:#fff;letter-spacing:6px;margin-bottom:-10px}
.canal{position:absolute;left:0;right:0;top:1560px;text-align:center;font-family:${familia};font-size:56px;color:${cores.c2};letter-spacing:4px;-webkit-text-stroke:2px #0b0b0b;paint-order:stroke fill}
${posicoes}
</style></head><body>
<div class="quadro"></div><div class="sombra"></div><div class="faixa"></div><div class="faixa2"></div>
<div class="gancho">${ganchoLinhas}</div>
<div class="epi"><small>EPISÓDIO</small>${ep}</div>
<div class="canal">${nomeCanal.toUpperCase()}</div>
</body></html>`;
}

function htmlGrade(capas) {
  const itens = capas.map((c) => `<div class="c"><img src="data:image/png;base64,${c}"></div>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;background:#111;display:flex;gap:12px;padding:12px;width:fit-content}.c{width:270px;height:360px;overflow:hidden;border-radius:8px;background:#000}.c img{width:270px;height:480px;object-fit:cover;margin-top:-60px}</style></head><body>${itens}</body></html>`;
}

export function montarTextos({ canal, roteiro }) {
  const numero = roteiro.numero;
  const hashtags = normalizarHashtags([...(roteiro.hashtags ?? []), ...(canal.publicacao?.hashtags_base ?? [])], canal.publicacao?.hashtags_max ?? 4);
  const situacao = String(roteiro.descricao ?? roteiro.titulos?.[0] ?? roteiro.titulo).replace(/\s*Epi\.?\s*\d+\s*$/i, "").trim();
  const descricao = formulaTexto({ situacao, numero, hashtags: [], max_hashtags: 0 });
  const titulos = roteiro.titulos?.length ? roteiro.titulos : [roteiro.titulo];
  const tituloCurto = (roteiro.frase_memoravel ? `${roteiro.frase_memoravel.replace(/\.$/, "")} · Epi. ${String(numero).padStart(2, "0")}` : titulos[0]);
  const textos = {
    titulo: titulos[0],
    descricao,
    hashtags,
    comentario_fixado: roteiro.comentario_fixado,
    promocao: false,
    por_plataforma: {
      tiktok: { titulo: formulaTexto({ situacao, numero, hashtags }) },
      youtube: { titulo: tituloCurto.length <= 92 ? tituloCurto : titulos[1] ?? titulos[0], descricao: [descricao, `${roteiro.dilema?.pergunta ?? "O que você faria?"} A) ${roteiro.dilema?.opcao_a} · B) ${roteiro.dilema?.opcao_b}`, roteiro.comentario_fixado, hashtags.map((h) => "#" + h).join(" "), `Canal ${canal.nome_exibicao} · história e personagens originais · vozes e animação feitas com IA`].filter(Boolean).join("\n\n"), tags: [...hashtags, "pov", "shorts", "historia", "suspense", "brasil"] },
      instagram: { legenda: [descricao, roteiro.comentario_fixado, hashtags.map((h) => "#" + h).join(" ")].filter(Boolean).join("\n\n") },
      facebook: { titulo: titulos[0], descricao: [descricao, roteiro.comentario_fixado, hashtags.map((h) => "#" + h).join(" ")].filter(Boolean).join("\n\n") },
      kwai: { legenda: formulaTexto({ situacao, numero, hashtags }) },
    },
  };
  textos.conferencia = Object.fromEntries(["tiktok", "instagram", "facebook", "youtube", "kwai"].map((p) => [p, textoPara(p, textos, canal)]));
  return textos;
}

export async function etapaCapaTextos({ canal, ep }) {
  log.passo(`Etapa 9 — Capa e textos do episódio ${ep.roteiro.numero}`);
  const r = ep.roteiro;
  const video = [path.join(ep.dir, nomeMp4(r.numero)), path.join(ep.dir, "video_mudo.mp4")].find((p) => fs.existsSync(p));
  const { largura, altura } = canal.formato;
  const cores = canal.estilo?.cores ?? { c1: "#1f4e5f", c2: "#efe3c2", c3: "#d9772b", alerta: "#ffb000" };
  const fonteB64 = fonteBase64();
  // O quadro da capa não pode ter legenda (capítulo 70). Os tempos do roteiro são nominais; as vozes deslocam
  // a linha do tempo, então cada instante é empurrado para fora das falas reais.
  const lt = lerJson(path.join(ep.dir, "linha_do_tempo.json"), null);
  const semLegenda = (t) => {
    const total = lt?.duracao_total_s ?? Infinity;
    for (let i = 0; i < 40; i++) {
      const dentro = (lt?.falas ?? []).find((f) => t >= f.inicio_s - 0.25 && t <= f.fim_s + 0.35);
      if (!dentro) return Math.min(t, total - 0.5);
      t = dentro.fim_s + 0.6;
    }
    return t;
  };
  const tempos = [r.capa?.t_quadro ?? 10, ...(r.capa?.alternativas_t ?? [])].slice(0, 3).map(semLegenda);
  while (tempos.length < 3) tempos.push(tempos[0]);
  log.info(`quadros da capa em ${tempos.map((t) => t.toFixed(1) + "s").join(", ")} (fora das falas)`);
  const quadrosMotor = await quadrosDoMotor(ep, tempos);
  if (!quadrosMotor && !video) throw new Error("Não há motor nem vídeo para tirar o quadro da capa (rode render antes).");
  log.info(quadrosMotor ? "quadros renderizados pelo motor (PNG)" : "quadros extraídos do vídeo pronto");
  const navegador = await abrirNavegador();
  const capasB64 = [];
  try {
    const pagina = await navegador.newPage({ viewport: { width: largura, height: altura }, deviceScaleFactor: 1 });
    for (let i = 0; i < 3; i++) {
      const quadro = path.join(ep.dir, `quadro_capa_${i + 1}.png`);
      if (!quadrosMotor) await extrairQuadro(video, tempos[i], quadro);
      const html = htmlCapa({ quadroBase64: fs.readFileSync(quadro).toString("base64"), gancho: r.capa?.frase_gancho ?? r.titulo, numero: r.numero, cores, variante: i + 1, nomeCanal: canal.nome_exibicao, fonteB64, largura, altura });
      await pagina.setContent(html, { waitUntil: "load" });
      await pagina.evaluate(() => document.fonts.ready);
      const destino = path.join(ep.dir, `capa_${i + 1}.png`);
      await pagina.screenshot({ path: destino, type: "png" });
      capasB64.push(fs.readFileSync(destino).toString("base64"));
      fs.rmSync(quadro, { force: true });
    }
    const grade = await navegador.newPage({ viewport: { width: 3 * 270 + 4 * 12, height: 384 } });
    await grade.setContent(htmlGrade(capasB64));
    await grade.screenshot({ path: path.join(ep.dir, "capas_grade.png"), type: "png" });
  } finally {
    await navegador.close();
  }
  const escolhida = Math.min(Math.max(Number(canal.publicacao?.capa_padrao ?? 1), 1), 3);
  fs.copyFileSync(path.join(ep.dir, `capa_${escolhida}.png`), path.join(ep.dir, "capa.png"));
  const textos = montarTextos({ canal, roteiro: r });
  gravarJson(path.join(ep.dir, "textos.json"), textos);
  atualizarEstado(ep.dir, { etapa: "capa" });
  log.ok(`capa_1..3.png (texto entre 240 e 1680 px), capas_grade.png, capa.png = capa_${escolhida}.png, textos.json.`);
  log.info(`TikTok: ${textos.conferencia.tiktok.titulo}`);
  log.info(`YouTube: ${textos.conferencia.youtube.titulo}`);
  return textos;
}
