// Motor de vídeos em primeira pessoa. Expõe em window: carregar, renderizarQuadro, capturar, renderizarLote, montarFolha, estatisticasQuadro.
// Regra de ouro: cada quadro depende só de t. Nada acumula entre quadros; aleatório só com semente.
import * as THREE from 'three';
import { Estilo, definirAnisotropia } from './cena/estilo.js';
import { criarProp, criarDetalhesVida } from './cena/props.js';
import { Boneco } from './cena/boneco.js';
import { CorpoPOV } from './cena/corpo_pov.js';
import { Estado } from './cena/estado.js';
import { Cabeca } from './cena/cabeca.js';
import { Sobreposicao, TelaCelular, janelasCartoes } from './cena/sobreposicao.js';
import { Lente } from './cena/lente.js';
import { construirLinhaDoTempo, medidasSinteticas, envelopeSintetico } from './cena/linha_previa.js';
import { visiveis, moduloDoPonto } from './cena/mundo.js';
import { planejar, planejarDuracoes, aberturaPortas } from './cena/plano_camera.js';
import { suave, lerp, misturarCor, hexParaRgb, clamp, sementeDeTexto, formatarTempo } from './cena/util.js';

const M = { pronto: false };
window.__motor = M;

// Variações para o teste dos 3 estilos (capítulo 35 / 57). Cada uma troca traço, paleta, sombra, textura e lente.
const VARIACOES = {
  A: { nome: 'A · traço 8 px, papel', traco: { espessura_px: 8, espessura_min_px: 3, cor: '#14100c' }, textura: 'papel', intensidade_textura: 0.12, sombra: { degraus: 2, intensidade: 0.4 },
       mapaCores: { '#1f5f8a': '#17496b', '#f3ead8': '#eadfc6', '#e07b2a': '#c8661c', '#ffb000': '#ffa400' } },
  B: { nome: 'B · traço 4 px, sem papel', traco: { espessura_px: 4, espessura_min_px: 1.6, cor: '#101820' }, textura: 'nenhuma', intensidade_textura: 0, sombra: { degraus: 3, intensidade: 0.22 },
       mapaCores: { '#1f5f8a': '#1d6fb0', '#f3ead8': '#f8f1e0', '#e07b2a': '#f08a2e', '#ffb000': '#ffc300' } },
  C: { nome: 'C · referência, traço 6 px', traco: { espessura_px: 6, espessura_min_px: 2.2, cor: '#1a1410' }, textura: 'papel', intensidade_textura: 0.06, sombra: { degraus: 3, intensidade: 0.3 },
       mapaCores: {} },
};

function clonar(o) { return JSON.parse(JSON.stringify(o)); }

function aplicarVariacao(canal, nomeVar) {
  const c = clonar(canal);
  if (!nomeVar || nomeVar === 'cartela') return c;
  const v = VARIACOES[nomeVar] || (typeof nomeVar === 'object' ? nomeVar : null);
  if (!v) return c;
  c.estilo = { ...c.estilo, ...Object.fromEntries(Object.entries(v).filter(([k]) => !['mapaCores', 'nome'].includes(k))) };
  if (v.mapaCores) {
    const mapa = Object.fromEntries(Object.entries(v.mapaCores).map(([a, b]) => [a.toLowerCase(), b]));
    const trocar = (x) => (typeof x === 'string' && mapa[x.toLowerCase()]) ? mapa[x.toLowerCase()] : x;
    const anda = (o) => { if (Array.isArray(o)) return o.map(anda); if (o && typeof o === 'object') { for (const k in o) o[k] = anda(o[k]); return o; } return trocar(o); };
    c.cenarios = anda(c.cenarios); c.elenco = anda(c.elenco); c.protagonista = anda(c.protagonista);
    c.estilo.cores = anda(c.estilo.cores);
  }
  c.estilo._variacao = v.nome || nomeVar;
  return c;
}

// Autoteste das fontes (o mesmo que o doctor e a prova usam): a Verdana Bold do sistema tem de medir a frase da
// referência com 909 px a 44 px (±2 %), e o emoji tem de sair colorido. Fonte trocada = vídeo diferente da referência.
export const FRASE_TESTE = 'Delta é b ao quadrado, menos quatro';
async function verificarFontes() {
  const r = { verdana: { ok: false }, emoji: { ok: false } };
  try {
    const f = new FontFace('Verdana POV Teste', 'local("Verdana Bold"), local("Verdana-Bold")', { weight: '700' });
    await f.load(); r.verdana.carregou = true;
  } catch (e) { r.verdana.carregou = false; r.verdana.erro = String(e?.message || e); }
  await document.fonts.load('700 44px "Verdana POV"').catch(() => {});
  const c = document.createElement('canvas'); c.width = 1400; c.height = 120;
  const cx = c.getContext('2d'); cx.font = '700 44px "Verdana POV"'; cx.textAlign = 'left';
  const m = cx.measureText(FRASE_TESTE);
  const largura = (m.actualBoundingBoxLeft || 0) + (m.actualBoundingBoxRight || m.width);
  r.verdana.largura_px = Number(largura.toFixed(2)); r.verdana.alvo_px = 909;
  r.verdana.ok = r.verdana.carregou && Math.abs(largura - 909) / 909 <= 0.02;
  const e = document.createElement('canvas'); e.width = 96; e.height = 96;
  const ex = e.getContext('2d');
  ex.font = '64px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", "Twemoji Mozilla", sans-serif';
  ex.textBaseline = 'middle'; ex.textAlign = 'center'; ex.fillStyle = '#000'; ex.fillText(String.fromCodePoint(0x1F447), 48, 52);
  const d = ex.getImageData(0, 0, 96, 96).data; let n = 0;
  for (let i = 0; i < d.length; i += 4) { const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]); if (d[i + 3] > 128 && mx - mn > 60) n++; }
  r.emoji.pixels_coloridos = n; r.emoji.ok = n >= 150;
  r.ok = r.verdana.ok && r.emoji.ok;
  return r;
}
window.autotesteFontes = verificarFontes;

window.carregar = async function carregar(canalOriginal, roteiro, linhaDoTempo, medidas, opcoes = {}) {
  await Promise.all([document.fonts.load('48px Anton'), document.fonts.load('30px Nunito'), document.fonts.load('bold 30px Nunito'), document.fonts.load('800 48px "Baloo 2"'), document.fonts.load('700 48px "Baloo 2"'), document.fonts.load('700 44px "Verdana POV"').catch(() => {})]);
  await document.fonts.ready;
  const fontes = await verificarFontes();
  if (opcoes.exigirFontes && !fontes.ok) throw new Error('fontes diferentes da referência: ' + JSON.stringify(fontes));
  const canal = aplicarVariacao(canalOriginal, opcoes.estilo);
  const fps = canal.formato?.fps || 30;
  const escala = opcoes.escala || 1;
  const W = Math.round((canal.formato?.largura || 1080) * escala), H = Math.round((canal.formato?.altura || 1920) * escala);
  Object.assign(M, { canal, roteiro, W, H, escala, fps, avisos: [] });
  M.estiloCfg = canal.estilo || {};
  M.cores = M.estiloCfg.cores || {};
  M.semente = M.estiloCfg.semente ?? 7;
  M.linha = linhaDoTempo || construirLinhaDoTempo(roteiro, medidas, canal, planejarDuracoes(roteiro, canal));
  if (!linhaDoTempo) M.avisos.push('linha do tempo em modo prévia (derivada do roteiro)');
  M.medidas = medidas ? clonar(medidas) : medidasSinteticas(roteiro, M.linha);
  if (!medidas) M.avisos.push('medidas sintéticas (vozes ainda não medidas)');
  for (const f of M.linha.falas) {
    if (!M.medidas[f.id] || !Array.isArray(M.medidas[f.id].envelope)) {
      M.medidas[f.id] = { ...(M.medidas[f.id] || {}), envelope_passo_s: 0.05, envelope: envelopeSintetico(f.fim_s - f.inicio_s, sementeDeTexto(f.id)), sintetico: true };
    }
  }
  M.cenario = (canal.cenarios || []).find(c => c.id === roteiro.cenario) || canal.cenarios[0];
  // o mundo: os lugares (módulos) conectados e o plano do corpo/câmera
  M.plano = planejar(roteiro, canal);
  M.mundo = M.plano.mundo;
  for (const a of M.plano.avisos) M.avisos.push('plano de câmera: ' + a);

  // canvases
  M.canvasGL = document.getElementById('gl'); M.canvasFinal = document.getElementById('final');
  M.canvasGL.width = W; M.canvasGL.height = H; M.canvasFinal.width = W; M.canvasFinal.height = H;
  M.ctx = M.canvasFinal.getContext('2d');
  if (M.renderer) { M.renderer.dispose(); }
  M.renderer = new THREE.WebGLRenderer({ canvas: M.canvasGL, antialias: false, preserveDrawingBuffer: true, alpha: false, powerPreference: 'high-performance' });
  M.renderer.setPixelRatio(1); M.renderer.setSize(W, H, false);
  M.renderer.outputColorSpace = THREE.SRGBColorSpace;
  M.renderer.shadowMap.enabled = false;
  const gl = M.renderer.getContext();
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  M.gpu = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  definirAnisotropia(Math.min(4, M.renderer.capabilities.getMaxAnisotropy()));

  // cena
  M.cena = new THREE.Scene();
  M.cena.background = new THREE.Color(M.estiloCfg.traco?.cor || '#101820');
  M.camera = new THREE.PerspectiveCamera(115, W / H, 0.05, 80); // a 'cabeça': posição, orientação e abertura vertical do olho de peixe
  M.estilo = new Estilo(M.estiloCfg);
  M.props = {}; M.luzesProps = []; M.modulos = {};
  // portas das passagens ficam num grupo que nunca some (porta fechada nunca deixa buraco na parede)
  const portasPassagem = new Set(M.mundo.passagens.map(ps => ps.porta).filter(Boolean));
  M.grupoPortas = new THREE.Group(); M.grupoPortas.name = 'portas_passagens'; M.cena.add(M.grupoPortas);
  for (const mod of M.mundo.modulos) {
    const g = new THREE.Group(); g.name = 'modulo:' + mod.id;
    g.position.set(...mod.origem); g.rotation.y = mod.rotY;
    M.cena.add(g); M.modulos[mod.id] = g;
    const ctxProps = { estilo: M.estilo, cores: M.cores, semente: M.semente, avisos: M.avisos, canal, cenario: mod.def };
    for (const def of (mod.def.props || [])) {
      const r = criarProp(def, ctxProps);
      if (portasPassagem.has(def.id)) { const gp = new THREE.Group(); gp.position.set(...mod.origem); gp.rotation.y = mod.rotY; gp.add(r.grupo); M.grupoPortas.add(gp); }
      else g.add(r.grupo);
      M.props[def.id] = r; r.modulo = mod.id;
      if (r.luzes) M.luzesProps.push(...r.luzes);
    }
    g.add(criarDetalhesVida(mod.def.detalhes_vida, mod.def, ctxProps));
  }
  // quem manda no apagão (quadro de luz) e na lanterna do celular: props especiais do mundo
  M.quadrosLuz = Object.keys(M.props).filter((id) => M.mundo.props[id]?.def.tipo === 'quadro_luz');
  M.lanternas = Object.keys(M.props).filter((id) => M.mundo.props[id]?.def.tipo === 'lanterna');
  // pontos de olhar dos props no referencial do mundo
  M.cena.updateMatrixWorld(true);
  for (const id in M.props) { const r = M.props[id]; const mod = M.modulos[r.modulo]; if (r.pontoOlhar && mod) r.pontoOlharMundo = r.pontoOlhar.clone().applyMatrix4(mod.matrixWorld); }
  // visão do mundo para o estado (marcas e props com posição de mundo)
  M.cenarioMundo = { id: M.cenario.id, camera_inicial: M.cenario.camera_inicial, marcas: Object.fromEntries(Object.values(M.mundo.marcas).map(m => [m.id, m.pos])), props: Object.values(M.mundo.props).map(p => ({ ...p.def, pos: p.pos })) };
  // luzes gerais
  // luz chapada e clara (como na referência): céu/chão + uma direcional que dá o degrau de sombra + um preenchimento frio
  M.hemi = new THREE.HemisphereLight('#ffffff', '#b8b0a4', 1.0); M.cena.add(M.hemi);
  M.dir = new THREE.DirectionalLight('#fff6e6', 1.3); M.dir.position.set(3, 8, 4); M.cena.add(M.dir);
  M.dir2 = new THREE.DirectionalLight('#dfe8ff', 0.35); M.dir2.position.set(-4, 5, -6); M.cena.add(M.dir2);
  // elenco
  M.bonecos = {};
  for (const pe of (canal.elenco || [])) {
    if (!pe.visivel || !pe.visual) continue;
    const b = new Boneco(pe, M.estilo, M.estiloCfg, M.cores);
    M.cena.add(b.grupo); M.bonecos[pe.id] = b;
  }
  // corpo em primeira pessoa e celular
  const guiche = Object.values(M.mundo.props).find(p => p.def.tipo === 'guiche');
  const balcao = guiche ? { y: guiche.def.altura_balcao || 1.05, zBeira: (guiche.pos?.[2] || 0) + 0.45 } : null; // tampo: 0,8 m de fundo centrado em z+0,05 (props.js)
  M.corpo = new CorpoPOV(canal.protagonista || {}, M.estilo, M.cores, M.plano.olhos.sentado, balcao);
  M.cena.add(M.corpo.grupo);
  (M.modulos[guiche?.modulo] || M.cena).add(M.corpo.ancora); // objetos do balcão ficam no lugar do guichê
  M.telaCelular = new TelaCelular(M.estiloCfg.celular, roteiro.celular || [], M.cores);
  M.corpo.definirTexturaCelular(M.telaCelular.textura);
  // estado, cabeça, sobreposição
  M.estado = new Estado(canal, roteiro, M.linha, M.cenarioMundo);
  M.cabeca = new Cabeca(M.linha, canal, M.plano, resolverAlvo, M.semente);
  M.cabeca.olharInicial = M.cenario.camera_inicial?.olhar || 'frente';
  M.sobre = new Sobreposicao(canal, M.estiloCfg, W, H, escala);
  // trancos de câmera só onde o roteiro pede (pancada); a pergunta final entra sem tranco, como na referência
  M.pancadas = (M.linha.efeitos || []).filter(e => e.tipo === 'pancada').map(e => e.t);
  if (M.linha.pergunta) M.pancadas = M.pancadas.filter(p => Math.abs(p - M.linha.pergunta.inicio_s) >= 0.5);
  // cartões do alto: janelas calculadas uma vez (troca no lugar; terminam quando a pergunta começa)
  const notifs = [];
  for (const l of M.linha.linhas) for (const ev of (l.direcao?.eventos || [])) { const mm = /^celular\.notificacao=(\d+)$/.exec(ev); if (mm) notifs.push({ indice: Number(mm[1]), inicio: l.t_eventos ?? l.inicio_s }); }
  M.cartoes = janelasCartoes(notifs, roteiro.celular || [], M.estiloCfg.cartao);
  if (M.linha.pergunta) M.cartoes = M.cartoes.map(c => ({ ...c, fim: Math.min(c.fim, M.linha.pergunta.inicio_s) })).filter(c => c.fim > c.ini);
  M.fontes = fontes;
  if (M.lente) M.lente.dispose();
  M.lente = new Lente(M.renderer, W, H, escala, M.estiloCfg, { perto: M.camera.near, longe: M.camera.far, semFxaa: !!opcoes.semFxaa, tamanhoFace: opcoes.tamanhoFace || null, perfil: !!opcoes.perfil });
  M.pronto = true;
  return { gpu: M.gpu, avisos: M.avisos, duracao_total_s: M.linha.duracao_total_s, fps, previa: !!M.linha.previa, variacao: M.estiloCfg._variacao || 'cartela', linha: M.linha, fontes };
};

// ------------------------------------------------------------------ alvos do olhar
function alturaCabeca(id) {
  const b = M.bonecos[id];
  if (!b) return 1.5;
  const m = b.medidas; return m.perna + m.tronco + 0.06 + m.raioCab * b.oval[1];
}
function resolverAlvo(nome, t, posCamera, corpo = null) {
  if (!nome) return null;
  const pc = posCamera || new THREE.Vector3(0, 1.25, 0);
  // alvos relativos ao corpo giram com ele (yaw 0 = de frente para −z, sentado no guichê)
  const yaw = corpo?.yaw ?? 0, fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
  const emPe = corpo && corpo.postura !== 'sentado';
  const naFrente = (dist, y, lado = 0) => new THREE.Vector3(pc.x + fx * dist + rx * lado, y, pc.z + fz * dist + rz * lado);
  switch (nome) {
    case 'maos': return emPe ? naFrente(0.55, pc.y - 0.85) : naFrente(0.8, 1.04);
    case 'celular': return naFrente(0.22, pc.y - 0.2, 0.06);
    case 'frente': return naFrente(6, pc.y - 0.05);
    case 'chao': return naFrente(1.5, 0);
    case 'teto': return naFrente(2, 4);
  }
  if (M.props[nome]) return (M.props[nome].pontoOlharMundo || M.props[nome].pontoOlhar).clone();
  if (M.mundo?.nos[nome]) { const n = M.mundo.nos[nome].pos; return new THREE.Vector3(n[0], 1.2 + (n[1] || 0), n[2]); }
  if (M.bonecos[nome]) {
    const pe = M.estado.em(t).personagens[nome];
    if (pe && pe.visivel) return new THREE.Vector3(pe.pos[0], alturaCabeca(nome) - 0.05, pe.pos[2]);
    return null;
  }
  const marca = M.mundo?.marcas[nome]?.pos || M.cenario.marcas?.[nome];
  if (marca) return new THREE.Vector3(marca[0], 1.2 + (marca[1] || 0), marca[2]);
  if (nome.includes(':')) return resolverAlvo(nome.split(':')[1], t, posCamera);
  return null;
}

// ------------------------------------------------------------------ climas
function climaEm(t) {
  const lista = M.linha.climas || [{ inicio_s: 0, clima: 'rotina' }];
  let i = 0; for (let k = 0; k < lista.length; k++) { if (lista[k].inicio_s <= t) i = k; else break; }
  const atual = lista[i], anterior = lista[i - 1] || atual;
  const cfg = M.estiloCfg.climas || {};
  // um clima com "herdar" (a pergunta) mantém a luz do clima de antes: a cena continua visível sob o véu
  if (cfg[atual.clima]?.herdar) {
    let j = i - 1; while (j >= 0 && cfg[lista[j].clima]?.herdar) j--;
    const base = j >= 0 ? cfg[lista[j].clima] || cfg.rotina || {} : cfg.rotina || {};
    return { nome: atual.clima, inicio: atual.inicio_s, k: 1, luz: base.luz ?? 1, cor_luz: base.cor_luz || '#ffffff', vinheta: base.vinheta ?? 0.15, tremor: cfg[atual.clima].tremor ?? 0, lente: 0.3 };
  }
  const pa = cfg[anterior.clima]?.herdar ? (cfg.rotina || {}) : (cfg[anterior.clima] || cfg.rotina || {}), pb = cfg[atual.clima] || cfg.rotina || {};
  const k = suave((t - atual.inicio_s) / 1.2);
  const lente = M.estiloCfg.lente || {};
  const la = typeof lente === 'number' ? lente : (lente[anterior.clima] ?? 0.3), lb = typeof lente === 'number' ? lente : (lente[atual.clima] ?? 0.3);
  return {
    nome: atual.clima, inicio: atual.inicio_s, k,
    luz: lerp(pa.luz ?? 1, pb.luz ?? 1, k), cor_luz: misturarCor(pa.cor_luz || '#ffffff', pb.cor_luz || '#ffffff', k),
    vinheta: lerp(pa.vinheta ?? 0.15, pb.vinheta ?? 0.15, k), tremor: lerp(pa.tremor ?? 0, pb.tremor ?? 0, k), lente: lerp(la, lb, k),
  };
}

// ------------------------------------------------------------------ boca
function aberturaBoca(quem, t) {
  for (const f of M.linha.falas) {
    if (f.quem !== quem || t < f.inicio_s || t > f.fim_s) continue;
    const m = M.medidas[f.id]; if (!m || !m.envelope) return 0.5;
    const passo = m.envelope_passo_s || 0.05;
    const i = Math.floor((t - f.inicio_s) / passo);
    const e = m.envelope;
    const v = (e[i] ?? 0) * 0.6 + (e[i - 1] ?? 0) * 0.2 + (e[i + 1] ?? 0) * 0.2;
    return v < 0.08 ? 0 : clamp(v, 0, 1); // evita boca abrindo em ruído muito baixo
  }
  return 0;
}
function quemFala(t) {
  const ativos = M.linha.falas.filter(f => t >= f.inicio_s && t <= f.fim_s);
  return ativos.length ? ativos[ativos.length - 1].quem : null;
}

// ------------------------------------------------------------------ quadro
// Apagão do prédio (série 72 Horas): quadro de luz no estado "apagao". 0 = luz normal, 1 = escuro; a luz cai piscando
// em 0,7 s. Função só do tempo (o instante do evento está no estado do prop).
const PISCA_APAGAO = [0, 1, 0, 0, 1, 1, 0, 1, 1, 1];
function apagaoEm(est, t) {
  let k = 0;
  for (const id of M.quadrosLuz || []) {
    const p = est.props[id];
    if (p?.estado !== 'apagao') continue;
    const dt = t - (p.inicioEstado || 0);
    k = Math.max(k, dt >= 0.7 ? 1 : PISCA_APAGAO[Math.max(0, Math.floor(dt / 0.07))]);
  }
  return k;
}
const COR_APAGAO = new THREE.Color('#7f95b8');
// Lanterna do celular acesa (prop "lanterna" no estado "acesa"): liga em 0,25 s.
function lanternaEm(est, t) {
  let k = 0;
  for (const id of M.lanternas || []) { const p = est.props[id]; if (p?.estado === 'acesa') k = Math.max(k, Math.min(1, Math.max(0, (t - (p.inicioEstado || 0)) / 0.25))); }
  return k;
}
// O facho: escurece as bordas e clareia o centro da imagem (antes das legendas e cartões, que ficam por cima).
function desenharFacho(ctx, k) {
  const W = M.W, H = M.H, cx = W * 0.5, cy = H * 0.58, r = Math.max(W, H) * 0.64;
  ctx.save();
  ctx.globalAlpha = k;
  ctx.globalCompositeOperation = 'multiply';
  const g1 = ctx.createRadialGradient(cx, cy, r * 0.12, cx, cy, r);
  g1.addColorStop(0, '#ffffff'); g1.addColorStop(0.42, '#b6b9c8'); g1.addColorStop(1, '#262a36');
  ctx.fillStyle = g1; ctx.fillRect(0, 0, W, H);
  // clarão do centro em soft-light: clareia os meios-tons e mantém o preto do traço (o "screen" deixava tudo lavado e
  // as pernas de quem estava no facho pareciam transparentes)
  ctx.globalCompositeOperation = 'soft-light';
  const g2 = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.45);
  g2.addColorStop(0, 'rgba(255,244,214,0.85)'); g2.addColorStop(1, 'rgba(255,244,214,0)');
  ctx.fillStyle = g2; ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

window.renderizarQuadro = function renderizarQuadro(t) {
  if (!M.pronto) throw new Error('chame carregar() antes');
  t = Math.max(0, t);
  const est = M.estado.em(t);
  const clima = climaEm(t);
  const linhaAtual = est.linha;
  const acao = linhaAtual.direcao?.acao || 'parar';
  const acaoAnterior = est.indice > 0 ? (M.linha.linhas[est.indice - 1].direcao?.acao || 'parar') : 'parar';
  const tLinha = t - linhaAtual.inicio_s;

  // câmera primeiro (os bonecos olham para ela)
  M.cabeca.limparCache();
  const infoCam = M.cabeca.aplicar(M.camera, t, clima, M.pancadas);
  const posCam = M.camera.position.clone();
  const corpo = infoCam.corpo;

  // props (as portas das passagens abrem sozinhas quando a câmera chega perto)
  const aberturas = aberturaPortas(M.plano, M.linha, t);
  for (const id in aberturas) if (est.props[id]) est.props[id].abertura_auto = aberturas[id]; else est.props[id] = { estado: 'fechada', inicioEstado: 0, abertura_auto: aberturas[id] };
  const sentado = ['sentado', 'levantando', 'sentando'].includes(corpo.postura);
  const apagao = apagaoEm(est, t);
  const falante = quemFala(t); // o rádio da portaria mostra quem fala
  for (const id in M.props) { try { M.props[id].atualizar(est.props[id], t, { luz: clima.luz, clima: clima.nome, sentado, apagao, falando: falante }); } catch (e) { M.avisos.push('prop ' + id + ': ' + e.message); } }
  // só desenha o lugar onde a câmera está e os vizinhos com passagem aberta (economiza render em CPU)
  const vis = visiveis(M.mundo, [corpo.pos[0], 0, corpo.pos[2]], (id) => M.props[id]?.abertura ?? 0);
  for (const id in M.modulos) M.modulos[id].visible = vis.has(id);
  // bonecos
  for (const id in M.bonecos) {
    const pe = est.personagens[id];
    if (!pe) continue;
    let alvoOlhar = posCam;
    if (falante && falante !== id && falante !== 'eu' && M.bonecos[falante]) {
      const pf = est.personagens[falante];
      if (pf && pf.visivel) alvoOlhar = new THREE.Vector3(pf.pos[0], alturaCabeca(falante), pf.pos[2]);
    }
    if (pe.pose === 'limpando' && falante !== id) { alvoOlhar = null; pe.olharRodo = true; } // olha a ponta do rodo (o chão que limpa)
    M.bonecos[id].aplicar(pe, t, aberturaBoca(id, t), alvoOlhar, posCam);
    if (pe.visivel && M.mundo.modulos.length > 1 && !vis.has(moduloDoPonto(M.mundo, pe.pos))) M.bonecos[id].grupo.visible = false;
  }
  // corpo em primeira pessoa segue a posição do corpo (sentado na origem; anda junto com a câmera)
  M.corpo.grupo.position.set(corpo.pos[0], corpo.piso || 0, corpo.pos[2]);
  // em pé, o corpo acompanha a cabeça quando ela vira mais de ~35° (ninguém olha para trás só com o pescoço; antes a
  // manga do outro braço aparecia no canto quando a câmera virava para quem estava atrás). Sentado, o corpo fica na cadeira.
  let yawCorpo = corpo.yaw || 0;
  if (!sentado) {
    const frente = new THREE.Vector3(); M.camera.getWorldDirection(frente);
    if (Math.hypot(frente.x, frente.z) > 1e-3) {
      let d = Math.atan2(-frente.x, -frente.z) - yawCorpo; d = Math.atan2(Math.sin(d), Math.cos(d));
      const MAX_PESCOCO = 0.6;
      if (Math.abs(d) > MAX_PESCOCO) yawCorpo += d - Math.sign(d) * MAX_PESCOCO;
    }
  }
  M.corpo.grupo.rotation.set(0, yawCorpo, 0);
  const tremorAcao = acao.startsWith('tremor:') ? parseFloat(acao.split(':')[1]) || 0 : 0;
  M.corpo.aplicar(acao, tLinha, t, clima.tremor * 0.5 + tremorAcao, acaoAnterior, corpo);
  M.telaCelular.desenhar(est.celular.tela, t);
  // luzes gerais seguem o clima
  // no apagão: céu e direcional caem, a cor esfria, o preenchimento frio sobe um pouco (a cena continua legível)
  const luz = clima.luz;
  M.hemi.intensity = (0.3 + 0.8 * luz) * (1 - 0.66 * apagao); M.hemi.color.set(clima.cor_luz); if (apagao > 0) M.hemi.color.lerp(COR_APAGAO, apagao);
  M.dir.intensity = 1.2 * luz * (1 - 0.88 * apagao); M.dir.color.set(clima.cor_luz);
  M.dir2.intensity = 0.35 * luz * (1 + 0.7 * apagao);

  // preto (mergulho/fade antigo): desenhado pela sobreposição; a pergunta final nunca escurece até o preto
  const naPergunta = !!(M.linha.pergunta && t >= M.linha.pergunta.inicio_s);
  let preto = 0;
  if (acao === 'fade' && clima.nome !== 'pergunta' && !naPergunta) preto = suave(tLinha / 0.8);
  if (!naPergunta && corpo.preto > 0) preto = Math.max(preto, corpo.preto); // transição pelo preto
  const fade = 0;

  // passes: a lente faz as duas câmeras, o G-buffer, o olho de peixe, o traço e o FXAA no canvas GL
  const cl = hexParaRgb(clima.cor_luz).map(v => v / 255); const mx = Math.max(cl[0], cl[1], cl[2], 0.01);
  const corLuz = new THREE.Vector3(cl[0] / mx, cl[1] / mx, cl[2] / mx).lerp(new THREE.Vector3(1, 1, 1), 0.5);
  M.lente.renderizar(M.cena, M.camera, { corLuz, vinheta: clima.vinheta + 0.18 * apagao, fade });

  // sobreposição 2D
  const ctx = M.ctx;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
  ctx.drawImage(M.canvasGL, 0, 0);
  const facho = lanternaEm(est, t);
  if (facho > 0) desenharFacho(ctx, facho);
  const some = M.estiloCfg.legenda?.some_apos_s ?? 0.15;
  const falasAtivas = M.linha.falas.filter(f => t >= f.inicio_s && t <= f.fim_s + some).map(f => ({ ...f, texto: f.texto || (M.roteiro.falas.find(x => x.id === f.id)?.texto || '') }));
  const pergunta = M.linha.pergunta ? { ...(M.roteiro.dilema || {}), ...M.linha.pergunta, ativa: naPergunta } : null;
  const r2d = M.sobre.desenhar(ctx, t, { falasAtivas, cartoes: M.cartoes, selo: est.selo, pergunta, preto, clima: clima.nome });
  M.ultimoQuadro = { t, clima: clima.nome, acao, linha: est.indice, legendas: r2d.legendas, layout: r2d.layout, camera: { pos: [posCam.x, posCam.y, posCam.z].map(v => Number(v.toFixed(3))), modulo: corpo.modulo, postura: corpo.postura, vel: Number((corpo.vel || 0).toFixed(3)), visiveis: [...vis] } };
  return M.ultimoQuadro;
};

window.capturar = function capturar(formato = 'png', qualidade = 0.95) {
  return M.canvasFinal.toDataURL(formato === 'jpg' || formato === 'jpeg' ? 'image/jpeg' : 'image/png', qualidade);
};

window.renderizarLote = function renderizarLote(tempos, formato = 'jpg', qualidade = 0.95, comStats = false) {
  const saida = [];
  for (const t of tempos) {
    const info = window.renderizarQuadro(t);
    const item = { t, dados: window.capturar(formato, qualidade), legendas: info.legendas, layout: info.layout, clima: info.clima };
    if (comStats) item.stats = window.estatisticasQuadro();
    saida.push(item);
  }
  return saida;
};

// Estatísticas simples do quadro atual (para o revisor): luminância média e fração de pixels iguais à cor dominante.
window.estatisticasQuadro = function estatisticasQuadro() {
  const c = document.createElement('canvas'); c.width = 54; c.height = 96;
  const cx = c.getContext('2d'); cx.drawImage(M.canvasFinal, 0, 0, 54, 96);
  const d = cx.getImageData(0, 0, 54, 96).data;
  let soma = 0; const cont = new Map(); let n = 0;
  for (let i = 0; i < d.length; i += 4) {
    const l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; soma += l; n++;
    const k = (d[i] >> 4) + ':' + (d[i + 1] >> 4) + ':' + (d[i + 2] >> 4); cont.set(k, (cont.get(k) || 0) + 1);
  }
  let max = 0; for (const v of cont.values()) max = Math.max(max, v);
  return { luminancia: soma / n / 255, uniforme: max / n };
};

// Folha de quadros: miniaturas com o tempo escrito.
window.montarFolha = function montarFolha(tempos, colunas = 5, larguraMini = 216) {
  const { W, H } = M;
  const alturaMini = Math.round(larguraMini * H / W);
  const rotulo = Math.round(larguraMini * 0.16);
  const linhas = Math.ceil(tempos.length / colunas);
  const c = document.createElement('canvas'); c.width = colunas * (larguraMini + 8) + 8; c.height = linhas * (alturaMini + rotulo + 8) + 8;
  const cx = c.getContext('2d'); cx.fillStyle = '#1b1b1b'; cx.fillRect(0, 0, c.width, c.height);
  tempos.forEach((t, i) => {
    const info = window.renderizarQuadro(t);
    const x = 8 + (i % colunas) * (larguraMini + 8), y = 8 + Math.floor(i / colunas) * (alturaMini + rotulo + 8);
    cx.drawImage(M.canvasFinal, x, y, larguraMini, alturaMini);
    cx.fillStyle = '#ffffff'; cx.font = `${Math.round(rotulo * 0.6)}px Anton, sans-serif`; cx.textBaseline = 'middle'; cx.textAlign = 'left';
    cx.fillText(formatarTempo(t) + '  ' + info.clima + (info.legendas.length ? '  💬' : ''), x + 4, y + alturaMini + rotulo / 2);
  });
  return c.toDataURL('image/png');
};

window.linhaDoTempoAtual = () => M.linha;
window.depurarLente = (modo) => M.lente.depurar(modo);
window.perfilLente = () => { const t = M.lente.tempos; M.lente.tempos = {}; return t; };
// Mede um quadro por etapa (só para afinar desempenho): render, sobreposição, captura.
window.medirQuadro = function medirQuadro(t, formato = 'jpg') {
  const a = performance.now(); window.renderizarQuadro(t); const b = performance.now();
  const d = window.capturar(formato, 0.95); const c = performance.now();
  return { render_ms: Math.round(b - a), captura_ms: Math.round(c - b), bytes: d.length, lente: window.perfilLente() };
};

// Sonda de depuração: o que a câmera vê em pontos da tela (nx, ny em 0..1). Devolve nomes dos objetos atingidos.
window.sondar = function sondar(pontos) {
  const rc = new THREE.Raycaster();
  const saida = [];
  for (const [nx, ny] of pontos) {
    rc.set(M.camera.position.clone(), M.lente.direcaoDoPixel(nx, ny, M.camera));
    const visivelNaCadeia = (o) => { while (o) { if (!o.visible) return false; o = o.parent; } return true; };
    const hits = rc.intersectObjects(M.cena.children, true).filter(h => visivelNaCadeia(h.object));
    const h = hits[0];
    let nome = null, cor = null;
    if (h) { let o = h.object; const cadeia = []; while (o) { if (o.name) cadeia.push(o.name); o = o.parent; } nome = cadeia.join(' < ') || h.object.type; cor = h.object.material?.color?.getHexString?.() || null; }
    saida.push({ nx, ny, nome, cor, dist: h ? Number(h.distance.toFixed(3)) : null, ponto: h ? [h.point.x, h.point.y, h.point.z].map(v => Number(v.toFixed(2))) : null });
  }
  return saida;
};
