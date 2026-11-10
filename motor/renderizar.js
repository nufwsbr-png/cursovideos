#!/usr/bin/env node
// Renderizador: abre o motor num Chromium controlado (Playwright) e gera stills, sequências, folha de quadros e o vídeo mudo.
// Uso (seção 6 do contrato):
//   node motor/renderizar.js --episodio episodios/ep01_x --stills 0,2,5.6
//   node motor/renderizar.js --episodio episodios/ep01_x --folha
//   node motor/renderizar.js --episodio episodios/ep01_x --video [--escala 0.5] [--inicio 0 --fim 8]
//   node motor/renderizar.js --episodio episodios/ep01_x --sequencia 23.5,25.5
//   --stills ... --pasta critico/rodada_1/quadros --formato jpg --sem-registro   (quadros do crítico: outra pasta, sem mexer no render.json)
//   node motor/renderizar.js --teste-estilos --cenario saguao --saida padrao_aprovado/estilos [--tempo-estilo 24]
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { iniciarServidor, RAIZ } from './servidor.js';
import { garantirFfmpegNoPath } from '../fabrica/util/binarios.js';
import { canalDaPasta } from './canal_serie.js';

garantirFfmpegNoPath();
const require = createRequire(import.meta.url);
const AQUI = path.dirname(fileURLToPath(import.meta.url));

function lerArgs(argv) {
  const a = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const x = argv[i];
    if (x.startsWith('--')) {
      const k = x.slice(2);
      const prox = argv[i + 1];
      if (prox === undefined || prox.startsWith('--')) a[k] = true; else { a[k] = prox; i++; }
    } else a._.push(x);
  }
  return a;
}
const args = lerArgs(process.argv.slice(2));
const lerJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const existe = (p) => { try { fs.accessSync(p); return true; } catch { return false; } };
const nomeTempo = (t) => 't_' + t.toFixed(2).padStart(7, '0');
const log = (...m) => console.log('[motor]', ...m);

async function abrirNavegador() {
  const { chromium } = require('playwright');
  const usarGpu = process.env.MOTOR_GPU === '1';
  const argsChrome = usarGpu
    ? ['--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--enable-zero-copy', '--disable-dev-shm-usage']
    : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-dev-shm-usage'];
  const executablePath = process.env.CHROME_PATH || process.env.PUPPETEER_EXECUTABLE_PATH || process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;
  const navegador = await chromium.launch({ headless: true, executablePath, args: argsChrome });
  const pagina = await navegador.newPage({ viewport: { width: 540, height: 960 } });
  pagina.on('console', (msg) => { if (['error', 'warning'].includes(msg.type())) log('navegador:', msg.type(), msg.text().slice(0, 300)); });
  pagina.on('pageerror', (e) => log('erro na página:', e.message));
  return { navegador, pagina };
}

async function carregarMotor(pagina, url, canal, roteiro, linha, medidas, opcoes) {
  await pagina.goto(url + '/motor/index.html', { waitUntil: 'load' });
  await pagina.waitForFunction(() => typeof window.carregar === 'function', null, { timeout: 30000 });
  const info = await pagina.evaluate(async ([c, r, l, m, o]) => await window.carregar(c, r, l, m, o), [canal, roteiro, linha, medidas, opcoes]);
  return info;
}

function salvarDataUrl(dataUrl, arquivo) {
  const b = Buffer.from(dataUrl.split(',')[1], 'base64');
  fs.mkdirSync(path.dirname(arquivo), { recursive: true });
  fs.writeFileSync(arquivo, b);
  return b.length;
}

function gravarRenderJson(pastaEp, novo) {
  const arq = path.join(pastaEp, 'render.json');
  let atual = {};
  if (existe(arq)) { try { atual = lerJson(arq); } catch { atual = {}; } }
  const mesclado = { ...atual, ...novo, atualizado_em: new Date().toISOString() };
  // legendas: junta sem repetir
  const leg = new Map();
  for (const l of [...(atual.legendas || []), ...(novo.legendas || [])]) leg.set(l.id + '|' + l.texto, l);
  mesclado.legendas = [...leg.values()].sort((a, b) => a.t - b.t);
  if (atual.amostras && novo.amostras) { const m = new Map(); for (const s of [...atual.amostras, ...novo.amostras]) m.set(s.t.toFixed(2), s); mesclado.amostras = [...m.values()].sort((a, b) => a.t - b.t); }
  fs.writeFileSync(arq, JSON.stringify(mesclado, null, 2));
  return mesclado;
}

// Elementos 2D vistos (cartão, selo, pergunta, preto): guarda a caixa e o primeiro/último instante em que apareceram.
function coletarLayout(acum, t, layout) {
  for (const el of layout || []) {
    const chave = el.tipo + '|' + (el.subtipo ?? '') + '|' + (el.indice ?? '');
    const atual = acum.get(chave);
    const tt = Number(t.toFixed(3));
    if (!atual) acum.set(chave, { ...el, t_primeiro: tt, t_ultimo: tt, t_primeiro_opaco: el.opaco ? tt : null });
    else { atual.t_ultimo = Math.max(atual.t_ultimo, tt); atual.t_primeiro = Math.min(atual.t_primeiro, tt); if (el.opaco && (atual.t_primeiro_opaco === null || tt < atual.t_primeiro_opaco)) atual.t_primeiro_opaco = tt; if (el.opaco) { atual.caixa = el.caixa ?? atual.caixa; atual.botoes = el.botoes ?? atual.botoes; } }
  }
}

function coletarLegendas(acum, t, legendas) {
  for (const l of legendas || []) { const k = l.id + '|' + l.texto; if (!acum.has(k)) acum.set(k, { t: Number(t.toFixed(2)), id: l.id, quem: l.quem, texto: l.texto, caixa: l.caixa, base: l.base }); }
}

async function main() {
  const t0 = Date.now();
  // o canal da série do episódio (canal.json + canal/series/<id>.json)
  const canal = canalDaPasta(lerJson(path.join(RAIZ, 'canal', 'canal.json')), args.episodio ? path.resolve(RAIZ, String(args.episodio)) : RAIZ, RAIZ);
  const escala = args.escala ? Number(args.escala) : 1;
  const formato = args.formato || null;

  if (args['teste-estilos']) return await testeEstilos(canal, escala);
  if (args.autoteste) return await autoteste();

  if (!args.episodio) { console.error('uso: node motor/renderizar.js --episodio <pasta> (--stills a,b | --folha | --video | --sequencia a,b) [--escala 0.5] [--inicio s --fim s]'); process.exit(2); }
  const pastaEp = path.resolve(RAIZ, args.episodio);
  const roteiro = lerJson(path.join(pastaEp, 'roteiro.json'));
  const linha = existe(path.join(pastaEp, 'linha_do_tempo.json')) ? lerJson(path.join(pastaEp, 'linha_do_tempo.json')) : null;
  const medidas = existe(path.join(pastaEp, 'medidas.json')) ? lerJson(path.join(pastaEp, 'medidas.json')) : null;
  if (!linha) log('linha_do_tempo.json não existe: modo prévia (tempos nominais do roteiro)');
  if (!medidas) log('medidas.json não existe: envelopes sintéticos para a boca');

  const servidor = await iniciarServidor();
  const { navegador, pagina } = await abrirNavegador();
  const legendas = new Map();
  const layout = new Map();
  const amostras = [];
  const saida = { escala, previa: !linha, medidas_sinteticas: !medidas, comandos: [] };
  try {
    const opcoesMotor = { escala, semFxaa: process.env.MOTOR_SEM_FXAA === '1', tamanhoFace: process.env.MOTOR_FACE ? Number(process.env.MOTOR_FACE) : null, perfil: process.env.MOTOR_PERFIL === '1', exigirFontes: process.env.MOTOR_EXIGIR_FONTES === '1' };
    const info = await carregarMotor(pagina, servidor.url, canal, roteiro, linha, medidas, opcoesMotor);
    saida.gpu = info.gpu; saida.avisos = info.avisos; saida.duracao_total_s = info.duracao_total_s; saida.fps = info.fps; saida.variacao = info.variacao; saida.fontes = info.fontes;
    if (!info.fontes?.ok) log('ATENÇÃO: fontes diferentes da referência:', JSON.stringify(info.fontes));
    log('GPU/WebGL:', info.gpu); log('duração:', info.duracao_total_s, 's', info.previa ? '(prévia)' : '');
    if (info.avisos?.length) log('avisos:', info.avisos.join(' | '));
    const fps = info.fps;
    const dur = info.duracao_total_s;
    if (!linha) fs.writeFileSync(path.join(pastaEp, 'linha_do_tempo_previa.json'), JSON.stringify(info.linha, null, 2));

    if (process.env.MOTOR_DEPURAR) await pagina.evaluate((m) => window.depurarLente(m), process.env.MOTOR_DEPURAR);
    if (args.stills) {
      const tempos = String(args.stills).split(',').map(Number).filter(n => !Number.isNaN(n));
      const pasta = path.join(pastaEp, args.pasta ? String(args.pasta) : 'stills');
      const ini = Date.now();
      for (const t of tempos) {
        const [q] = await pagina.evaluate(([ts, f]) => window.renderizarLote(ts, f, 0.95, true), [[t], formato || 'png']);
        const arq = path.join(pasta, nomeTempo(t) + (formato === 'jpg' ? '.jpg' : '.png'));
        salvarDataUrl(q.dados, arq);
        coletarLegendas(legendas, t, q.legendas); coletarLayout(layout, t, q.layout); amostras.push({ t, ...q.stats, clima: q.clima });
        log('still', path.relative(RAIZ, arq), 'clima', q.clima, 'legendas', q.legendas.length);
      }
      saida.segundos_por_quadro_stills = (Date.now() - ini) / 1000 / Math.max(1, tempos.length);
      saida.comandos.push('stills ' + tempos.join(','));
    }

    if (args.sequencia) {
      const [a, b] = String(args.sequencia).split(',').map(Number);
      const pasta = path.join(pastaEp, 'sequencia');
      const tempos = []; for (let t = a; t <= b + 1e-6; t += 0.1) tempos.push(Number(t.toFixed(2)));
      for (let i = 0; i < tempos.length; i += 6) {
        const lote = tempos.slice(i, i + 6);
        const qs = await pagina.evaluate(([ts, f]) => window.renderizarLote(ts, f, 0.92, false), [lote, formato || 'png']);
        qs.forEach((q, j) => { salvarDataUrl(q.dados, path.join(pasta, nomeTempo(lote[j]) + (formato === 'jpg' ? '.jpg' : '.png'))); coletarLegendas(legendas, lote[j], q.legendas); coletarLayout(layout, lote[j], q.layout); });
      }
      log('sequência', a, '→', b, ':', tempos.length, 'quadros em', path.relative(RAIZ, pasta));
      saida.comandos.push(`sequencia ${a},${b}`);
    }

    if (args.folha) {
      const passo = args.passo ? Number(args.passo) : 2;
      const ini = args.inicio ? Number(args.inicio) : 0, fim = args.fim ? Number(args.fim) : dur;
      const tempos = []; for (let t = ini; t < fim; t += passo) tempos.push(Number(t.toFixed(2)));
      const t1 = Date.now();
      const dados = await pagina.evaluate(([ts]) => window.montarFolha(ts, 5, 216), [tempos]);
      const arq = path.join(pastaEp, 'folha.png');
      salvarDataUrl(dados, arq);
      // estatísticas por quadro da folha (para o revisor)
      for (let i = 0; i < tempos.length; i += 1) {
        const [q] = await pagina.evaluate(([ts]) => { const info = window.renderizarQuadro(ts[0]); return [{ clima: info.clima, legendas: info.legendas, stats: window.estatisticasQuadro() }]; }, [[tempos[i]]]);
        amostras.push({ t: tempos[i], ...q.stats, clima: q.clima }); coletarLegendas(legendas, tempos[i], q.legendas);
      }
      log('folha com', tempos.length, 'quadros em', path.relative(RAIZ, arq), `(${((Date.now() - t1) / 1000).toFixed(1)} s)`);
      saida.comandos.push('folha');
    }

    if (args.video) {
      const ini = args.inicio ? Number(args.inicio) : 0;
      const fim = args.fim ? Math.min(Number(args.fim), dur) : dur;
      const parcial = ini > 0 || fim < dur - 1e-6;
      const nome = parcial ? `video_mudo_${ini.toFixed(1)}-${fim.toFixed(1)}.mp4` : 'video_mudo.mp4';
      const arq = path.join(pastaEp, nome);
      const total = Math.round((fim - ini) * fps);
      const fmt = formato || 'jpg';
      log(`vídeo: ${total} quadros (${ini}s → ${fim}s) a ${fps} fps → ${path.relative(RAIZ, arq)}`);
      const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-vcodec', fmt === 'png' ? 'png' : 'mjpeg', '-framerate', String(fps), '-i', '-', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', process.env.MOTOR_X264_PRESET || 'faster', '-threads', process.env.MOTOR_X264_THREADS || '2', '-movflags', '+faststart', arq], { stdio: ['pipe', 'inherit', 'inherit'] });
      const fimFf = new Promise((res, rej) => { ff.on('close', (c) => c === 0 ? res() : rej(new Error('ffmpeg saiu com código ' + c))); ff.on('error', rej); });
      const t1 = Date.now();
      const LOTE = 10;
      for (let i = 0; i < total; i += LOTE) {
        const tempos = []; for (let j = i; j < Math.min(total, i + LOTE); j++) tempos.push(Number((ini + j / fps).toFixed(4)));
        const comStats = (i / LOTE) % 3 === 0;
        const qs = await pagina.evaluate(([ts, f, s]) => window.renderizarLote(ts, f, 0.95, s), [tempos, fmt, comStats]);
        for (let j = 0; j < qs.length; j++) {
          const b = Buffer.from(qs[j].dados.split(',')[1], 'base64');
          if (!ff.stdin.write(b)) await new Promise(r => ff.stdin.once('drain', r));
          coletarLegendas(legendas, tempos[j], qs[j].legendas); coletarLayout(layout, tempos[j], qs[j].layout);
          if (qs[j].stats && j === 0) amostras.push({ t: tempos[j], ...qs[j].stats, clima: qs[j].clima });
        }
        if ((i / LOTE) % 15 === 0 || i + LOTE >= total) {
          const feitos = Math.min(total, i + LOTE); const dt = (Date.now() - t1) / 1000;
          log(`quadro ${feitos}/${total} · ${(dt / feitos).toFixed(2)} s/quadro · faltam ~${((total - feitos) * dt / feitos / 60).toFixed(1)} min`);
        }
      }
      if (process.env.MOTOR_PERFIL === '1') { const perfil = await pagina.evaluate(() => window.perfilLente()); log('perfil (ms somados):', JSON.stringify(Object.fromEntries(Object.entries(perfil).map(([k, v]) => [k, Math.round(v)])))); }
      ff.stdin.end();
      await fimFf;
      const dt = (Date.now() - t1) / 1000;
      saida.quadros = total; saida.segundos_por_quadro = dt / total; saida.video = path.relative(RAIZ, arq); saida.video_parcial = parcial;
      log(`pronto: ${path.relative(RAIZ, arq)} · ${(dt / 60).toFixed(1)} min · ${(dt / total).toFixed(2)} s/quadro`);
      saida.comandos.push(`video ${ini}-${fim}`);
    }
  } finally {
    await navegador.close().catch(() => {});
    await servidor.fechar();
  }
  saida.legendas = [...legendas.values()];
  if (layout.size) saida.layout2d = [...layout.values()].sort((a, b) => a.t_primeiro - b.t_primeiro);
  saida.amostras = amostras;
  saida.tempo_total_s = (Date.now() - t0) / 1000;
  if (args['sem-registro']) { log('render.json não alterado (--sem-registro)'); return; }
  gravarRenderJson(pastaEp, saida);
  log('render.json atualizado');
}

// Autoteste do ambiente de render: fontes (Verdana Bold medida e emoji colorido) e o renderer WebGL. Imprime JSON.
async function autoteste() {
  const servidor = await iniciarServidor();
  const { navegador, pagina } = await abrirNavegador();
  try {
    await pagina.goto(servidor.url + '/motor/index.html', { waitUntil: 'load' });
    await pagina.waitForFunction(() => typeof window.autotesteFontes === 'function', null, { timeout: 30000 });
    const fontes = await pagina.evaluate(async () => await window.autotesteFontes());
    const gpu = await pagina.evaluate(() => { const c = document.createElement('canvas'); const gl = c.getContext('webgl2') || c.getContext('webgl'); if (!gl) return null; const d = gl.getExtension('WEBGL_debug_renderer_info'); return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER); });
    console.log(JSON.stringify({ fontes, gpu }));
  } finally {
    await navegador.close().catch(() => {});
    await servidor.fechar();
  }
}

async function testeEstilos(canal, escala) {
  const idCen = args.cenario || canal.cenarios[0].id;
  const pastaSaida = path.resolve(RAIZ, args.saida || 'padrao_aprovado/estilos');
  fs.mkdirSync(pastaSaida, { recursive: true });
  // usa o piloto (ou um roteiro mínimo) só para ter um quadro com mãos, elenco e legenda
  let roteiro;
  const candidatos = fs.existsSync(path.join(RAIZ, 'episodios')) ? fs.readdirSync(path.join(RAIZ, 'episodios')).filter(d => fs.existsSync(path.join(RAIZ, 'episodios', d, 'roteiro.json'))).sort() : [];
  if (args.roteiro) roteiro = lerJson(path.resolve(RAIZ, args.roteiro));
  else if (candidatos.length) roteiro = lerJson(path.join(RAIZ, 'episodios', candidatos[0], 'roteiro.json'));
  else roteiro = { numero: 0, slug: 'teste', cenario: idCen, linhas: [{ t: 0, ato: 'rotina', fala: null, direcao: { olhar: 'frente', acao: 'parar', clima: 'rotina', eventos: [] } }], falas: [], celular: [], dilema: null };
  roteiro = { ...roteiro, cenario: idCen };
  const tempo = args['tempo-estilo'] ? Number(args['tempo-estilo']) : (roteiro.capa?.t_quadro ?? 24);
  const servidor = await iniciarServidor();
  const { navegador, pagina } = await abrirNavegador();
  const imagens = [];
  try {
    for (const v of ['A', 'B', 'C']) {
      const info = await carregarMotor(pagina, servidor.url, canal, roteiro, null, null, { escala, estilo: v });
      const [q] = await pagina.evaluate(([ts]) => window.renderizarLote(ts, 'png', 1, false), [[tempo]]);
      const arq = path.join(pastaSaida, `estilo_${v}.png`);
      salvarDataUrl(q.dados, arq);
      imagens.push({ v, nome: info.variacao, dados: q.dados });
      log('estilo', v, '→', path.relative(RAIZ, arq), '·', info.variacao);
    }
    // folha comparativa com os nomes em cima
    const dados = await pagina.evaluate(async ([imgs]) => {
      const carregadas = await Promise.all(imgs.map(i => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.src = i.dados; })));
      const w = 480, h = Math.round(480 * carregadas[0].height / carregadas[0].width), rot = 70;
      const c = document.createElement('canvas'); c.width = imgs.length * (w + 16) + 16; c.height = h + rot + 24;
      const cx = c.getContext('2d'); cx.fillStyle = '#222'; cx.fillRect(0, 0, c.width, c.height);
      cx.fillStyle = '#fff'; cx.font = '28px Anton, sans-serif'; cx.textBaseline = 'middle'; cx.textAlign = 'center';
      imgs.forEach((i, k) => { const x = 16 + k * (w + 16); cx.fillText(i.nome, x + w / 2, rot / 2); cx.drawImage(carregadas[k], x, rot, w, h); });
      return c.toDataURL('image/png');
    }, [imagens]);
    const arqComp = path.join(pastaSaida, 'estilos_comparacao.png');
    salvarDataUrl(dados, arqComp);
    log('comparação →', path.relative(RAIZ, arqComp));
    fs.writeFileSync(path.join(pastaSaida, 'estilos.json'), JSON.stringify({ tempo, cenario: idCen, variacoes: imagens.map(i => ({ letra: i.v, nome: i.nome, arquivo: `estilo_${i.v}.png` })), gerado_em: new Date().toISOString() }, null, 2));
  } finally {
    await navegador.close().catch(() => {});
    await servidor.fechar();
  }
}

main().catch((e) => { console.error('[motor] erro:', e); process.exit(1); });
