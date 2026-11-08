// Utilidades compartilhadas do motor: aleatório com semente, interpolações, cores.

// Gerador pseudoaleatório determinístico (mulberry32). Mesma semente, mesma sequência.
export function mulberry32(semente) {
  let a = semente >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Transforma um texto em um número de semente (para variar por id de prop/personagem).
export function sementeDeTexto(texto) {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) { h ^= texto.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function suave(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }          // ease in/out (smoothstep)
export function suave2(t) { t = clamp(t, 0, 1); return t * t * t * (t * (t * 6 - 15) + 10); } // smootherstep
export function graus(r) { return r * Math.PI / 180; }

export function hexParaRgb(hex) {
  const h = String(hex || '#888888').replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function rgbParaHex(r, g, b) {
  return '#' + [r, g, b].map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
}
export function misturarCor(hexA, hexB, t) {
  const a = hexParaRgb(hexA), b = hexParaRgb(hexB);
  return rgbParaHex(lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t));
}
export function escurecer(hex, fator) {
  const [r, g, b] = hexParaRgb(hex); return rgbParaHex(r * fator, g * fator, b * fator);
}
export function clarear(hex, fator) {
  const [r, g, b] = hexParaRgb(hex); return rgbParaHex(r + (255 - r) * fator, g + (255 - g) * fator, b + (255 - b) * fator);
}

// Quebra um texto em linhas que caibam em larguraMax usando o contexto 2D.
export function quebrarLinhas(ctx, texto, larguraMax) {
  const palavras = String(texto).split(/\s+/).filter(Boolean);
  const linhas = [];
  let atual = '';
  for (const p of palavras) {
    const tentativa = atual ? atual + ' ' + p : p;
    if (ctx.measureText(tentativa).width <= larguraMax || !atual) atual = tentativa;
    else { linhas.push(atual); atual = p; }
  }
  if (atual) linhas.push(atual);
  return linhas;
}

export function formatarTempo(t) {
  const m = Math.floor(t / 60), s = t - m * 60;
  return (m > 0 ? m + ':' : '') + s.toFixed(1).padStart(m > 0 ? 4 : 1, '0') + 's';
}
