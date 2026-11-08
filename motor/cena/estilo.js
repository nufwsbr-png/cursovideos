// Estilo visual: materiais em degraus (toon), paleta limitada, texturas de texto.
import * as THREE from 'three';
import { hexParaRgb, escurecer, clarear } from './util.js';

const cacheGradientes = new Map();
const cacheMateriais = new Map();

// Mapa de gradiente para sombra em N degraus (capítulo 33: "sombra chapada, em degraus, suave").
export function mapaDeDegraus(degraus = 2, intensidade = 0.55) {
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
  tex.minFilter = THREE.NearestFilter; tex.magFilter = THREE.NearestFilter; tex.generateMipmaps = false; tex.needsUpdate = true;
  cacheGradientes.set(chave, tex);
  return tex;
}

export class Estilo {
  constructor(estiloCanal) {
    this.cfg = estiloCanal;
    this.gradiente = mapaDeDegraus(estiloCanal.sombra?.degraus ?? 2, estiloCanal.sombra?.intensidade ?? 0.55);
    this.cores = estiloCanal.cores || {};
  }
  // Material principal em degraus. Mesma cor devolve o mesmo material (economia na GPU por software).
  material(cor, opcoes = {}) {
    const chave = 'toon:' + cor + ':' + JSON.stringify(opcoes);
    if (cacheMateriais.has(chave)) return cacheMateriais.get(chave);
    const m = new THREE.MeshToonMaterial({ color: new THREE.Color(cor), gradientMap: this.gradiente, ...opcoes });
    cacheMateriais.set(chave, m);
    return m;
  }
  // Material sem luz (coisas que brilham sozinhas: painel, tela, lâmpada).
  luminoso(cor, opcoes = {}) {
    const chave = 'lum:' + cor + ':' + JSON.stringify(opcoes);
    if (cacheMateriais.has(chave)) return cacheMateriais.get(chave);
    const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(cor), ...opcoes });
    cacheMateriais.set(chave, m);
    return m;
  }
  materialTextura(textura, opcoes = {}) {
    return new THREE.MeshToonMaterial({ map: textura, gradientMap: this.gradiente, ...opcoes });
  }
  luminosoTextura(textura, opcoes = {}) {
    return new THREE.MeshBasicMaterial({ map: textura, ...opcoes });
  }
}

// Textura a partir de um canvas 2D com texto. `desenharExtra(ctx, w, h)` permite detalhes.
export function texturaTexto({ largura = 512, altura = 128, fundo = '#222', cor = '#fff', linhas = [], fonte = 'bold 48px Anton, sans-serif', alinhamento = 'center', margem = 16, entrelinha = 1.15, desenharExtra = null, cantosArredondados = 0, borda = null }) {
  const c = document.createElement('canvas');
  c.width = largura; c.height = altura;
  const ctx = c.getContext('2d');
  if (fundo) {
    ctx.fillStyle = fundo;
    if (cantosArredondados > 0) { arredondado(ctx, 0, 0, largura, altura, cantosArredondados); ctx.fill(); }
    else ctx.fillRect(0, 0, largura, altura);
  }
  if (borda) { ctx.strokeStyle = borda.cor; ctx.lineWidth = borda.espessura; ctx.strokeRect(borda.espessura / 2, borda.espessura / 2, largura - borda.espessura, altura - borda.espessura); }
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
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 1; tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
  tex._canvas = c; tex._ctx = ctx;
  return tex;
}

export function arredondado(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}

// Textura de ladrilho para o piso (padrão simples, cores do canal).
export function texturaLadrilho(cor, repeticoes = 8, semente = 1) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = cor; ctx.fillRect(0, 0, 512, 512);
  const n = 8, s = 512 / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const v = ((i * 7 + j * 13 + semente) % 5) / 5;
    ctx.fillStyle = v < 0.5 ? escurecer(cor, 0.93 + v * 0.06) : clarear(cor, (v - 0.5) * 0.08);
    ctx.fillRect(i * s + 2, j * s + 2, s - 4, s - 4);
  }
  ctx.strokeStyle = escurecer(cor, 0.72); ctx.lineWidth = 3;
  for (let i = 0; i <= n; i++) { ctx.beginPath(); ctx.moveTo(i * s, 0); ctx.lineTo(i * s, 512); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, i * s); ctx.lineTo(512, i * s); ctx.stroke(); }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(repeticoes, repeticoes);
  tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
  return tex;
}

export { hexParaRgb, escurecer, clarear };
