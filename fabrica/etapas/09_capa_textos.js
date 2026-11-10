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
    // pasta própria e sem mexer no render.json: os stills do revisor e a versão da etapa "quadros" ficam intactos
    await executar("node", [renderizar, "--episodio", ep.dir, "--stills", lista.join(","), "--formato", "png", "--pasta", "quadros_capa", "--sem-registro"]);
  } catch (e) { log.aviso(`motor não conseguiu renderizar os quadros da capa (${e.message}); usando o vídeo pronto`); return null; }
  const saida = [];
  for (let i = 0; i < lista.length; i++) {
    const origem = path.join(ep.dir, "quadros_capa", "t_" + lista[i].toFixed(2).padStart(7, "0") + ".png");
    if (!fs.existsSync(origem)) return null;
    const destino = path.join(ep.dir, `quadro_capa_${i + 1}.png`);
    fs.copyFileSync(origem, destino); saida.push(destino);
  }
  fs.rmSync(path.join(ep.dir, "quadros_capa"), { recursive: true, force: true });
  return saida;
}

async function extrairQuadro(video, t, destino) {
  await executar("ffmpeg", ["-y", "-v", "error", "-ss", String(t), "-i", video, "-frames:v", "1", "-q:v", "2", destino]);
}

// A fonte da capa é a mesma das legendas e de toda a camada 2D: Verdana Bold (medida na referência), uma identidade só.
// É fonte do sistema, pedida por local() como no motor (motor/index.html), nunca copiada para o repositório.
// Sem ela na máquina, a capa cai para a Baloo 2 embutida (ou Anton) e avisa; quem confere a fonte é o autoteste do motor.
const FONTE_CAPA = { nome: "Verdana Bold", familia: "Verdana POV", peso: 700, css: `@font-face{font-family:"Verdana POV";font-weight:700;src:local("Verdana Bold"),local("Verdana-Bold");font-display:block}` };

function fonteReserva() {
  const base = path.join(RAIZ, "node_modules", "@fontsource");
  const embutir = (familia, peso, latin, ext) => ({
    nome: `${familia} (reserva)`, familia, peso,
    css: `@font-face{font-family:"${familia}";font-weight:${peso};src:url(data:font/woff2;base64,${fs.readFileSync(latin).toString("base64")}) format("woff2");}`
      + (ext && fs.existsSync(ext) ? `@font-face{font-family:"${familia}";font-weight:${peso};src:url(data:font/woff2;base64,${fs.readFileSync(ext).toString("base64")}) format("woff2");unicode-range:U+0100-024F,U+1E00-1EFF;}` : ""),
  });
  const baloo = path.join(base, "baloo-2", "files", "baloo-2-latin-800-normal.woff2");
  if (fs.existsSync(baloo)) return embutir("Baloo 2", 800, baloo, path.join(base, "baloo-2", "files", "baloo-2-latin-ext-800-normal.woff2"));
  const anton = path.join(base, "anton", "files", "anton-latin-400-normal.woff2");
  return fs.existsSync(anton) ? embutir("Anton", 400, anton, null) : null;
}

async function verdanaNaMaquina(pagina) {
  await pagina.setContent(`<!doctype html><html><head><style>${FONTE_CAPA.css}</style></head><body>Aã</body></html>`);
  return pagina.evaluate(async () => {
    try { const f = await document.fonts.load('700 100px "Verdana POV"'); return f.length > 0 && f.every((x) => x.status === "loaded"); } catch { return false; }
  });
}

// Roda dentro da página (não usa nada de fora): diminui o gancho até caber na largura (nenhuma palavra estoura a caixa)
// e acima do próximo texto e da área segura (até 1680 px); devolve as caixas para o capa.json.
function ajustarTextoDaCapa() {
  const g = document.querySelector(".gancho");
  const caixa = (el) => { const r = el.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)]; };
  const topo = g.getBoundingClientRect().top;
  const abaixo = [...document.querySelectorAll(".epi,.canal")].map((e) => e.getBoundingClientRect().top).filter((t) => t > topo);
  const limite = Math.min(1680, ...abaixo.map((t) => t - 20));
  let px = parseFloat(getComputedStyle(g).fontSize);
  const cabe = () => g.scrollWidth <= g.clientWidth + 1 && g.getBoundingClientRect().bottom <= limite;
  for (let i = 0; i < 40 && !cabe() && px > 64; i++) { px = Math.floor(px * 0.96); g.style.fontSize = `${px}px`; }
  const caixas = { gancho: caixa(g), epi: caixa(document.querySelector(".epi")), canal: caixa(document.querySelector(".canal")) };
  const naAreaSegura = Object.values(caixas).every(([, t, , b]) => t >= 240 && b <= 1680);
  return { gancho_px: px, cabe: cabe(), area_segura: naAreaSegura, limite_gancho_px: Math.round(limite), caixas };
}

function htmlCapa({ quadroBase64, gancho, numero, cores, variante, nomeCanal, fonte: fonteCapa, largura, altura }) {
  const ep = String(numero).padStart(2, "0");
  const fonte = fonteCapa ? `${fonteCapa.css}.gancho,.epi,.canal{font-weight:${fonteCapa.peso}}` : "";
  const familia = fonteCapa ? `"${fonteCapa.familia}"` : "Impact, 'Arial Black', sans-serif";
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
  // O quadro da capa não pode ter legenda (capítulo 70) nem cair num mergulho no preto. Os tempos do roteiro são
  // nominais; as vozes deslocam a linha do tempo, então cada instante sai das falas reais e das telas pretas
  // (para a frente; se passar da pergunta final, para trás). Ep01 (2026-11-10): a alternativa de 52 s caía no preto.
  const lt = lerJson(path.join(ep.dir, "linha_do_tempo.json"), null);
  const total = lt?.duracao_total_s ?? Infinity;
  const fimUtil = Math.min(total - 0.5, (lt?.pergunta?.inicio_s ?? total) - 0.3);
  const evitar = [
    ...(lt?.falas ?? []).map((f) => [f.inicio_s - 0.25, f.fim_s + 0.35]),
    ...(lt?.linhas ?? []).filter((l) => l.transicao?.tipo === "preto").map((l) => [l.inicio_s - 0.1, l.inicio_s + Number(l.transicao.total_s ?? 1.5) + 0.2]),
  ];
  const trecho = (t) => evitar.find(([a, b]) => t >= a && t <= b);
  const livre = (t0) => {
    let t = t0;
    for (let i = 0; i < 40 && trecho(t); i++) t = trecho(t)[1] + 0.25;
    if (!trecho(t) && t <= fimUtil) return t;
    t = t0;
    for (let i = 0; i < 40 && trecho(t); i++) t = trecho(t)[0] - 0.25;
    return !trecho(t) && t >= 0.5 ? t : Math.min(t0, fimUtil);
  };
  const tempos = [r.capa?.t_quadro ?? 10, ...(r.capa?.alternativas_t ?? [])].slice(0, 3).map(livre);
  while (tempos.length < 3) tempos.push(tempos[0]);
  log.info(`quadros da capa em ${tempos.map((t) => t.toFixed(1) + "s").join(", ")} (fora das falas e das telas pretas)`);
  const quadrosMotor = await quadrosDoMotor(ep, tempos);
  if (!quadrosMotor && !video) throw new Error("Não há motor nem vídeo para tirar o quadro da capa (rode render antes).");
  log.info(quadrosMotor ? "quadros renderizados pelo motor (PNG)" : "quadros extraídos do vídeo pronto");
  const navegador = await abrirNavegador();
  const capasB64 = [];
  const medidasCapa = [];
  let fonte = null;
  try {
    const pagina = await navegador.newPage({ viewport: { width: largura, height: altura }, deviceScaleFactor: 1 });
    fonte = (await verdanaNaMaquina(pagina)) ? FONTE_CAPA : fonteReserva();
    if (fonte !== FONTE_CAPA) log.aviso(`Verdana Bold não está nesta máquina: capa com ${fonte?.nome ?? "a fonte do navegador"} (instale a Verdana; veja \`doctor\`).`);
    for (let i = 0; i < 3; i++) {
      const quadro = path.join(ep.dir, `quadro_capa_${i + 1}.png`);
      if (!quadrosMotor) await extrairQuadro(video, tempos[i], quadro);
      const html = htmlCapa({ quadroBase64: fs.readFileSync(quadro).toString("base64"), gancho: r.capa?.frase_gancho ?? r.titulo, numero: r.numero, cores, variante: i + 1, nomeCanal: canal.nome_exibicao, fonte, largura, altura });
      await pagina.setContent(html, { waitUntil: "load" });
      await pagina.evaluate(() => document.fonts.ready);
      const medida = await pagina.evaluate(ajustarTextoDaCapa);
      medidasCapa.push({ variante: i + 1, ...medida });
      if (!medida.cabe || !medida.area_segura) log.aviso(`capa ${i + 1}: o texto não coube na área segura (gancho em ${medida.gancho_px} px; caixas ${JSON.stringify(medida.caixas)})`);
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
  gravarJson(path.join(ep.dir, "capa.json"), { fonte: fonte?.nome ?? null, escolhida, variantes: medidasCapa });
  log.info(`fonte da capa: ${fonte?.nome ?? "a do navegador"} · gancho em ${medidasCapa.map((m) => `${m.gancho_px} px`).join(", ")}`);
  const textos = montarTextos({ canal, roteiro: r });
  gravarJson(path.join(ep.dir, "textos.json"), textos);
  atualizarEstado(ep.dir, { etapa: "capa" });
  log.ok(`capa_1..3.png (texto entre 240 e 1680 px), capas_grade.png, capa.png = capa_${escolhida}.png, textos.json.`);
  log.info(`TikTok: ${textos.conferencia.tiktok.titulo}`);
  log.info(`YouTube: ${textos.conferencia.youtube.titulo}`);
  return textos;
}
