// Estilo visual: materiais em degraus suaves (toon), texturas de texto nítidas, ladrilhos, formas arredondadas.
// Regra: nada aqui depende do tempo; texturas são criadas uma vez (determinísticas) e reaproveitadas.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { hexParaRgb, escurecer, clarear } from './util.js';

const cacheGradientes = new Map();
const cacheMateriais = new Map();
let ANISOTROPIA = 4;
export function definirAnisotropia(n) { ANISOTROPIA = Math.max(1, Math.min(8, n || 1)); }

// Mapa de gradiente para sombra em N degraus com transição macia (a referência tem sombra suave, quase chapada).
export function mapaDeDegraus(degraus = 3, intensidade = 0.3) {
  const chave = degraus + ':' + intensidade;
  if (cacheGradientes.has(chave)) return cacheGradientes.get(chave);
  const n = Math.max(1, Math.min(6, Math.round(degraus))) + 1;
  const dados = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) {
    const k = n === 1 ? 1 : i / (n - 1);
    const v = Math.round(255 * ((1 - intensidade) + intensidade * k));
    dados[i * 4] = v; dados[i * 4 + 1] = v; dados[i * 4 + 2] = v; dados[i * 4 + 3] = 255;
  }
  const tex = new THREE.DataTexture(dados, n, 1, THREE.RGBAFormat);
  tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = false; tex.needsUpdate = true;
  cacheGradientes.set(chave, tex);
  return tex;
}

export class Estilo {
  constructor(estiloCanal) {
    this.cfg = estiloCanal;
    this.gradiente = mapaDeDegraus(estiloCanal.sombra?.degraus ?? 3, estiloCanal.sombra?.intensidade ?? 0.3);
    this.cores = estiloCanal.cores || {};
    this.corTraco = estiloCanal.traco?.cor || '#1a1410';
  }
  // Material principal em degraus. Mesma cor devolve o mesmo material (economia na GPU por software).
  material(cor, opcoes = {}) {
    const chave = 'toon:' + cor + ':' + JSON.stringify(opcoes);
    if (cacheMateriais.has(chave)) return cacheMateriais.get(chave);
    const m = new THREE.MeshToonMaterial({ color: new THREE.Color(cor), gradientMap: this.gradiente, ...opcoes });
    cacheMateriais.set(chave, m);
    return m;
  }
  // Material sem luz (coisas que brilham sozinhas: painel, tela, lâmpada, branco dos olhos).
  luminoso(cor, opcoes = {}) {
    const chave = 'lum:' + cor + ':' + JSON.stringify(opcoes);
    if (cacheMateriais.has(chave)) return cacheMateriais.get(chave);
    const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(cor), ...opcoes });
    cacheMateriais.set(chave, m);
    return m;
  }
  // Material da cor do traço (para linhas "desenhadas" à mão onde o detector não vê borda: raiz do cabelo, cós da calça).
  tinta() { return this.luminoso(this.corTraco); }
  materialTextura(textura, opcoes = {}) {
    return new THREE.MeshToonMaterial({ map: textura, gradientMap: this.gradiente, ...opcoes });
  }
  luminosoTextura(textura, opcoes = {}) {
    return new THREE.MeshBasicMaterial({ map: textura, ...opcoes });
  }
}

function prepararTextura(tex, repetir = false) {
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = ANISOTROPIA;
  tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter;
  if (repetir) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// Fonte padrão dos letreiros do canal (arredondada e pesada, como nas placas da referência).
export const FONTE_PLACA = '"Baloo 2"';

// Textura a partir de um canvas 2D com texto. `desenharExtra(ctx, w, h)` permite detalhes. Resolução alta e mipmaps: nada de letra borrada.
export function texturaTexto({ largura = 1024, altura = 256, fundo = '#222', cor = '#fff', linhas = [], fonte = `800 96px ${FONTE_PLACA}, sans-serif`, alinhamento = 'center', margem = 24, entrelinha = 1.12, desenharExtra = null, cantosArredondados = 0, borda = null }) {
  const c = document.createElement('canvas');
  c.width = largura; c.height = altura;
  const ctx = c.getContext('2d');
  if (fundo) {
    ctx.fillStyle = fundo;
    if (cantosArredondados > 0) { arredondado(ctx, 0, 0, largura, altura, cantosArredondados); ctx.fill(); }
    else ctx.fillRect(0, 0, largura, altura);
  }
  if (borda) {
    ctx.strokeStyle = borda.cor; ctx.lineWidth = borda.espessura;
    if (cantosArredondados > 0) { arredondado(ctx, borda.espessura / 2, borda.espessura / 2, largura - borda.espessura, altura - borda.espessura, cantosArredondados); ctx.stroke(); }
    else ctx.strokeRect(borda.espessura / 2, borda.espessura / 2, largura - borda.espessura, altura - borda.espessura);
  }
  ctx.fillStyle = cor;
  ctx.font = fonte;
  ctx.textAlign = alinhamento;
  ctx.textBaseline = 'middle';
  const tamanho = parseInt(/(\d+)px/.exec(fonte)?.[1] || '48', 10);
  const total = linhas.length;
  const alturaBloco = total * tamanho * entrelinha;
  const x = alinhamento === 'left' ? margem : alinhamento === 'right' ? largura - margem : largura / 2;
  linhas.forEach((l, i) => {
    const y = altura / 2 - alturaBloco / 2 + tamanho * entrelinha * (i + 0.5);
    ctx.fillText(String(l), x, y);
  });
  if (desenharExtra) desenharExtra(ctx, largura, altura);
  const tex = prepararTextura(new THREE.CanvasTexture(c));
  tex._canvas = c; tex._ctx = ctx;
  return tex;
}

export function arredondado(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}

// Textura de ladrilho para o piso: placas claras com rejunte escuro desenhado (as linhas do chão da referência).
export function texturaLadrilho(cor, repeticoes = 8, semente = 1, corRejunte = null) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 1024;
  const ctx = c.getContext('2d');
  ctx.fillStyle = corRejunte || escurecer(cor, 0.55); ctx.fillRect(0, 0, 1024, 1024);
  const n = 4, s = 1024 / n, rej = 14;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const v = ((i * 7 + j * 13 + semente) % 5) / 5;
    ctx.fillStyle = v < 0.5 ? escurecer(cor, 0.96 + v * 0.04) : clarear(cor, (v - 0.5) * 0.06);
    arredondado(ctx, i * s + rej / 2, j * s + rej / 2, s - rej, s - rej, 10); ctx.fill();
  }
  const tex = prepararTextura(new THREE.CanvasTexture(c), true);
  tex.repeat.set(repeticoes, repeticoes);
  return tex;
}

// Textura de forro (placas de teto com frisos), como o teto dos mercados e salas da referência.
export function texturaForro(cor, repeticoes = 6, corFriso = null) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = corFriso || escurecer(cor, 0.7); ctx.fillRect(0, 0, 512, 512);
  ctx.fillStyle = cor; arredondado(ctx, 6, 6, 500, 500, 6); ctx.fill();
  ctx.fillStyle = escurecer(cor, 0.97); ctx.fillRect(40, 40, 432, 432);
  const tex = prepararTextura(new THREE.CanvasTexture(c), true);
  tex.repeat.set(repeticoes, repeticoes);
  return tex;
}

// Textura de parede: cor chapada com um leve "rabisco" de papel (pequenos traços claros/escuros com semente).
export function texturaParede(cor, semente = 1, rabiscos = 40) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 1024;
  const ctx = c.getContext('2d');
  ctx.fillStyle = cor; ctx.fillRect(0, 0, 1024, 1024);
  let a = (semente * 2654435761) >>> 0;
  const rnd = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  ctx.lineCap = 'round';
  for (let i = 0; i < rabiscos; i++) {
    const x = rnd() * 1024, y = rnd() * 1024, l = 30 + rnd() * 120, ang = (rnd() - 0.5) * 1.2;
    ctx.strokeStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.10)'; ctx.lineWidth = 3 + rnd() * 5;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + Math.cos(ang) * l * 0.5 + (rnd() - 0.5) * 30, y + Math.sin(ang) * l * 0.5 + (rnd() - 0.5) * 30, x + Math.cos(ang) * l, y + Math.sin(ang) * l); ctx.stroke();
  }
  const tex = prepararTextura(new THREE.CanvasTexture(c), true);
  return tex;
}

// Geometrias arredondadas (o estilo é de formas macias)
export function geoCaixaArredondada(w, h, d, raio = null, seg = 3) {
  const r = raio ?? Math.min(w, h, d) * 0.22;
  return new RoundedBoxGeometry(w, h, d, seg, Math.min(r, Math.min(w, h, d) / 2 - 1e-4));
}
export function geoCapsula(raio, comprimento, seg = 8, radial = 12) {
  return new THREE.CapsuleGeometry(raio, Math.max(0, comprimento), seg, radial);
}

export { hexParaRgb, escurecer, clarear };
