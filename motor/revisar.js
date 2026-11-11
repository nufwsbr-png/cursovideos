#!/usr/bin/env node
// Revisor automático (capítulo 65): lê stills, sequência e folha e aponta problemas objetivos.
// Uso: node motor/revisar.js --episodio episodios/ep01_x
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { iniciarServidor, RAIZ } from './servidor.js';
import { canalDaPasta } from './canal_serie.js';
const require = createRequire(import.meta.url);

const args = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => a.startsWith('--') ? [a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true] : []).filter(x => x.length));
if (!args.episodio) { console.error('uso: node motor/revisar.js --episodio <pasta>'); process.exit(2); }
const pastaEp = path.resolve(RAIZ, args.episodio);
const lerJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const existe = (p) => fs.existsSync(p);
const tempoDoNome = (n) => { const m = /t_(\d+\.\d+)/.exec(n); return m ? Number(m[1]) : null; };

const render = existe(path.join(pastaEp, 'render.json')) ? lerJson(path.join(pastaEp, 'render.json')) : {};
const linha = existe(path.join(pastaEp, 'linha_do_tempo.json')) ? lerJson(path.join(pastaEp, 'linha_do_tempo.json')) : existe(path.join(pastaEp, 'linha_do_tempo_previa.json')) ? lerJson(path.join(pastaEp, 'linha_do_tempo_previa.json')) : null;
const canal = canalDaPasta(lerJson(path.join(RAIZ, 'canal', 'canal.json')), pastaEp, RAIZ); // o canal da série do episódio
const W = canal.formato?.largura || 1080, H = canal.formato?.altura || 1920;
const escala = render.escala || 1;

function climaEm(t) {
  if (!linha) return 'desconhecido';
  let c = 'rotina'; for (const k of (linha.climas || [])) { if (k.inicio_s <= t) c = k.clima; }
  if (linha.pergunta && t >= linha.pergunta.inicio_s) c = 'pergunta';
  return c;
}
// instantes de tela preta de propósito (transição pelo preto / fade antigo): não contam como "quadro escuro"
function noPreto(t) {
  if (!linha || t === null || t === undefined) return false;
  for (const l of (linha.linhas || [])) {
    const tr = l.transicao;
    if (tr && t >= tr.inicio_s - 0.05 && t <= tr.inicio_s + (tr.total_s ?? ((tr.saida_s || 0) + (tr.segurar_s || 0) + (tr.entrada_s || 0))) + 0.05) return true;
    if (l.direcao?.acao === 'fade' && t >= l.inicio_s && t <= (l.fim_s ?? l.inicio_s + 2)) return true;
  }
  return false;
}

const problemas = [];
const avisos = [];
const add = (tipo, t, detalhe, grave = true) => (grave ? problemas : avisos).push({ tipo, t, detalhe });

// 1. legendas: área segura e o padrão da referência (base da última linha em 0,70 H, linhas de cima a cada 58 px)
const est2d = canal.estilo || {};
const cfgLeg = est2d.legenda || {};
const baseUltima = (cfgLeg.base_y ?? 0.70) * H * escala, passo = (cfgLeg.entrelinha_px ?? 58) * escala;
for (const l of (render.legendas || [])) {
  const [x, y, w, h] = l.caixa || [0, 0, 0, 0];
  const dir = (x + w) / (W * escala), baixo = (y + h) / (H * escala), esq = x / (W * escala);
  if (dir > 0.96) add('legenda_area_segura', l.t, `"${l.texto}" invade a lateral direita (${(dir * 100).toFixed(0)} %)`);
  if (baixo > 0.80) add('legenda_area_segura', l.t, `"${l.texto}" invade a área dos botões (${(baixo * 100).toFixed(0)} %)`);
  if (esq < 0.04) add('legenda_area_segura', l.t, `"${l.texto}" encosta na borda esquerda`);
  if (typeof l.base === 'number') {
    const k = Math.round((baseUltima - l.base) / passo);
    if (k < 0 || k > 2 || Math.abs(baseUltima - k * passo - l.base) > 2 * escala) add('legenda_fora_do_padrao', l.t, `"${l.texto}" com base em ${l.base} (padrão: ${Math.round(baseUltima)} − n×${Math.round(passo)})`);
  }
}
// 1b. fontes: se a Verdana Bold trocou, o vídeo não é o da referência
if (render.fontes && render.fontes.ok === false) add('fonte_trocada', null, `fontes diferentes da referência: Verdana ${render.fontes.verdana?.largura_px ?? '?'} px (alvo 909 ±2 %), emoji ${render.fontes.emoji?.pixels_coloridos ?? '?'} px coloridos`);
// 1c. cartões, selo e pergunta (caixas desenhadas e quanto tempo ficaram na tela)
const dq = 1 / (render.fps || canal.formato?.fps || 30);
const videoInteiro = !!(render.quadros && !render.video_parcial);
const cc = est2d.cartao || {};
for (const el of (render.layout2d || [])) {
  if (el.tipo === 'cartao' && el.caixa) {
    const [x, y, w] = el.caixa;
    const ex = (cc.x_px ?? 55) * escala, ey = (cc.topo_px ?? 80) * escala, ew = (cc.largura_px ?? 968) * escala;
    if (Math.abs(x - ex) > 3 || Math.abs(y - ey) > 3 || Math.abs(w - ew) > 3) add('cartao_fora_do_padrao', el.t_primeiro, `cartão ${el.subtipo} em [${el.caixa.join(', ')}] (padrão x ${ex}, y ${ey}, largura ${ew})`);
    const cel = (linha?.celular || []).find((c) => c.evento === 'notificacao' && c.indice === el.indice);
    if (videoInteiro && cel?.duracao_s) {
      const visto = el.t_ultimo - el.t_primeiro + dq;
      const esperado = Math.min(cel.duracao_s, (cel.fim_s ?? Infinity) - (cel.inicio_s + (cc.atraso_s ?? 0.3)));
      if (Math.abs(visto - esperado) > 3 * dq + 0.31) add('cartao_duracao', el.t_primeiro, `cartão ${el.indice} ficou ${visto.toFixed(2)} s (roteiro: ${esperado.toFixed(2)} s)`, false);
    }
  }
  if (el.tipo === 'selo' && el.caixa) {
    const cs = est2d.selo || {};
    const [, y, , h] = el.caixa;
    const yc = (cs.posicao === 'baixo' ? cs.y_baixo ?? 0.853 : cs.y_alto ?? 0.087) * H * escala;
    if (Math.abs(y + h / 2 - yc) > 3 * escala) add('selo_fora_do_padrao', el.t_primeiro, `selo centrado em y ${Math.round(y + h / 2)} (padrão ${Math.round(yc)})`);
    if (videoInteiro) {
      const visto = el.t_ultimo - el.t_primeiro + dq, esperado = (cs.fim_s ?? 3.0) - (cs.inicio_s ?? 0.3);
      if (Math.abs(visto - esperado) > 3 * dq) add('selo_tempo', el.t_primeiro, `selo na tela por ${visto.toFixed(2)} s (padrão ${esperado.toFixed(2)} s)`);
    }
  }
  if (el.tipo === 'pergunta' && videoInteiro && linha?.pergunta) {
    const visto = el.t_ultimo - el.t_primeiro + dq, esperado = linha.pergunta.fim_s - linha.pergunta.inicio_s;
    if (Math.abs(visto - esperado) > 3 * dq) add('pergunta_duracao', el.t_primeiro, `pergunta na tela por ${visto.toFixed(2)} s (esperado ${esperado.toFixed(2)} s)`, false);
  }
}
// véu da pergunta: a cena continua visível (brilho cai, mas não apaga)
if (linha?.pergunta && (render.amostras || []).length) {
  const antes = (render.amostras || []).filter((s) => s.t < linha.pergunta.inicio_s - 0.2).slice(-1)[0];
  const depois = (render.amostras || []).filter((s) => s.t > linha.pergunta.inicio_s + 0.3)[0];
  if (antes && depois && antes.luminancia > 0.05) {
    const razao = depois.luminancia / antes.luminancia;
    if (razao < 0.45) add('pergunta_veu', depois.t, `a pergunta escureceu demais a cena (brilho ${(razao * 100).toFixed(0)} % do anterior; a referência fica em 65–80 %)`);
  }
}
// 2. avisos do motor
for (const a of (render.avisos || [])) if (!/prévia|sintéticas/.test(a)) add('aviso_motor', null, a, false);

// 3. imagens: stills, sequência, folha
const imagens = [];
for (const sub of ['stills', 'sequencia']) {
  const p = path.join(pastaEp, sub);
  if (!existe(p)) continue;
  for (const f of fs.readdirSync(p).filter(f => /\.(png|jpe?g)$/i.test(f)).sort()) imagens.push({ sub, arquivo: f, t: tempoDoNome(f), rel: path.relative(RAIZ, path.join(p, f)) });
}
// sequência: quadros faltando (passo 0,1 s)
const seq = imagens.filter(i => i.sub === 'sequencia' && i.t !== null).map(i => i.t).sort((a, b) => a - b);
for (let i = 1; i < seq.length; i++) if (seq[i] - seq[i - 1] > 0.15 && seq[i] - seq[i - 1] < 1.0) add('quadro_faltando', seq[i - 1], `salto de ${(seq[i] - seq[i - 1]).toFixed(2)} s na sequência`);
// vídeo: quadros esperados
if (render.quadros && render.duracao_total_s && render.fps && !render.video_parcial) {
  const esperados = Math.round(render.duracao_total_s * render.fps);
  if (Math.abs(esperados - render.quadros) > 1) add('quadro_faltando', null, `vídeo com ${render.quadros} quadros; esperados ${esperados}`);
}

// padrão aprovado por série: a série padrão usa padrao_aprovado/quadros; as outras, padrao_aprovado/<id>/quadros.
// Sem o padrão da série, não compara (os quadros do Guichê 3 não são régua para o Edifício Aurora).
const padrao = canal.serie && !canal.serie.padrao ? path.join(RAIZ, 'padrao_aprovado', canal.serie.id, 'quadros') : path.join(RAIZ, 'padrao_aprovado', 'quadros');
const temPadrao = existe(padrao);

async function analisarImagens() {
  if (!imagens.length && !existe(path.join(pastaEp, 'folha.png'))) return [];
  const { chromium } = require('playwright');
  const servidor = await iniciarServidor();
  const navegador = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || process.env.PUPPETEER_EXECUTABLE_PATH || undefined });
  const pagina = await navegador.newPage();
  await pagina.goto(servidor.url + '/motor/index.html');
  const resultados = [];
  try {
    for (const img of imagens) {
      const urlPadrao = temPadrao && existe(path.join(padrao, img.arquivo)) ? servidor.url + '/' + path.relative(RAIZ, path.join(padrao, img.arquivo)).split(path.sep).join('/') : null;
      const r = await pagina.evaluate(async ([url, urlPadrao]) => {
        const carregar = (u) => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = u; });
        const im = await carregar(url);
        const c = document.createElement('canvas'); c.width = 54; c.height = 96; const cx = c.getContext('2d'); cx.drawImage(im, 0, 0, 54, 96);
        const d = cx.getImageData(0, 0, 54, 96).data;
        let soma = 0, n = 0, pretos = 0; const cont = new Map();
        for (let i = 0; i < d.length; i += 4) { const l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; soma += l; n++; if (l < 12) pretos++; const k = (d[i] >> 4) + ':' + (d[i + 1] >> 4) + ':' + (d[i + 2] >> 4); cont.set(k, (cont.get(k) || 0) + 1); }
        let max = 0; for (const v of cont.values()) max = Math.max(max, v);
        // faixa inferior (área dos botões) preta? e metade esquerda vs direita
        let dif = null;
        if (urlPadrao) { const ip = await carregar(urlPadrao); const c2 = document.createElement('canvas'); c2.width = 54; c2.height = 96; const cx2 = c2.getContext('2d'); cx2.drawImage(ip, 0, 0, 54, 96); const d2 = cx2.getImageData(0, 0, 54, 96).data; let s2 = 0; for (let i = 0; i < d.length; i += 4) s2 += Math.abs(d[i] - d2[i]) + Math.abs(d[i + 1] - d2[i + 1]) + Math.abs(d[i + 2] - d2[i + 2]); dif = s2 / (n * 3 * 255); }
        return { luminancia: soma / n / 255, uniforme: max / n, pretos: pretos / n, largura: im.width, altura: im.height, dif };
      }, [servidor.url + '/' + img.rel.split(path.sep).join('/'), urlPadrao]);
      resultados.push({ ...img, ...r });
    }
  } finally { await navegador.close(); await servidor.fechar(); }
  return resultados;
}

const analise = await analisarImagens();
for (const a of analise) {
  const clima = a.t !== null ? climaEm(a.t) : 'desconhecido';
  a.clima = clima;
  if (a.uniforme > 0.97 && clima !== 'pergunta' && !noPreto(a.t)) add('quadro_de_uma_cor', a.t, `${a.rel}: ${(a.uniforme * 100).toFixed(0)} % de uma cor só (clima ${clima})`);
  if (a.luminancia < 0.06 && !['climax', 'pergunta'].includes(clima) && !noPreto(a.t)) add('quadro_escuro', a.t, `${a.rel}: luminância ${(a.luminancia * 100).toFixed(0)} % (clima ${clima})`);
  if (a.luminancia > 0.95) add('quadro_estourado', a.t, `${a.rel}: quase branco`);
  if (a.dif !== null && a.dif > 0.12) add('regressao_padrao', a.t, `${a.rel}: diferença média de ${(a.dif * 100).toFixed(1)} % em relação ao padrão aprovado`, false);
  const esperadoW = Math.round(W * escala);
  if (a.sub === 'stills' && Math.abs(a.largura - esperadoW) > 2 && Math.abs(a.largura - W) > 2) add('tamanho_errado', a.t, `${a.rel}: ${a.largura}x${a.altura}`, false);
}
// amostras de vídeo/folha gravadas no render.json
for (const s of (render.amostras || [])) {
  const clima = s.clima || climaEm(s.t);
  if (s.uniforme > 0.97 && clima !== 'pergunta' && !noPreto(s.t)) add('quadro_de_uma_cor', s.t, `amostra do render: ${(s.uniforme * 100).toFixed(0)} % de uma cor só (clima ${clima})`);
  if (s.luminancia < 0.06 && !['climax', 'pergunta'].includes(clima) && !noPreto(s.t)) add('quadro_escuro', s.t, `amostra do render: luminância ${(s.luminancia * 100).toFixed(0)} % (clima ${clima})`);
}
if (!existe(path.join(pastaEp, 'folha.png'))) add('sem_folha', null, 'folha.png não existe: gere com --folha antes do vídeo final', false);
if (render.previa) add('previa', null, 'render feito em modo prévia (sem linha_do_tempo.json / vozes medidas)', false);

const resumo = { gerado_em: new Date().toISOString(), episodio: path.relative(RAIZ, pastaEp), imagens_analisadas: analise.length, legendas_conferidas: (render.legendas || []).length, problemas, avisos, aprovado: problemas.length === 0,
  nao_conferido: ['movimento entre quadros (só a sequência mostra)', 'som', 'sotaque e interpretação das vozes', 'se a história prende'],
  amostras: analise.map(a => ({ t: a.t, arquivo: a.rel, luminancia: Number(a.luminancia.toFixed(3)), uniforme: Number(a.uniforme.toFixed(3)), clima: a.clima })) };
fs.writeFileSync(path.join(pastaEp, 'revisao.json'), JSON.stringify(resumo, null, 2));
console.log(`\nREVISÃO · ${resumo.episodio}`);
console.log(`imagens analisadas: ${analise.length} · legendas conferidas: ${resumo.legendas_conferidas}`);
if (!problemas.length) console.log('✔ nenhum problema objetivo encontrado');
for (const p of problemas) console.log(`✘ ${p.tipo}${p.t !== null && p.t !== undefined ? ' @' + p.t + 's' : ''}: ${p.detalhe}`);
for (const a of avisos) console.log(`• ${a.tipo}${a.t !== null && a.t !== undefined ? ' @' + a.t + 's' : ''}: ${a.detalhe}`);
console.log('não conferido pelo programa: ' + resumo.nao_conferido.join('; '));
console.log('→ revisao.json gravado');
