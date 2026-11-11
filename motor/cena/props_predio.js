// Props do Edifício Aurora (série "72 Horas", 2026-11-10): monitores com o relógio do reinício, interfone, elevador,
// galões e caixas do estoque, lista na porta, luz de emergência, quadro de luz (que manda no apagão), lanterna do
// celular, cadeado e o carrinho de feira. Mesmo contrato dos outros props: { grupo, atualizar(est, t, q), pontoOlhar }.
// Tudo é função do tempo: os estados vêm dos eventos (prop.<id>.estado / prop.<id>.texto) e de q.apagao (0..1).
import * as THREE from 'three';
import { texturaTexto, escurecer, clarear, geoCaixaArredondada, FONTE_PLACA, arredondado } from './estilo.js';
import { mulberry32, sementeDeTexto, clamp } from './util.js';
import { caixa, cilindro, planoTextura } from './props.js';

const FONTE = FONTE_PLACA;
const suave = (x) => { const k = clamp(x, 0, 1); return k * k * (3 - 2 * k); };

/** Junta geometrias (já posicionadas) numa só: um mesh para muitos objetos iguais (galões, caixas) pesa menos em CPU. */
function juntar(geos) {
  const partes = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  let n = 0;
  for (const g of partes) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
  let o = 0;
  for (const g of partes) {
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    o += g.attributes.position.count;
  }
  const r = new THREE.BufferGeometry();
  r.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  r.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return r;
}
const colocada = (geo, x, y, z, ry = 0) => { const m = new THREE.Matrix4().makeRotationY(ry); m.setPosition(x, y, z); return geo.clone().applyMatrix4(m); };

function hhmmss(s) {
  s = Math.max(0, Math.floor(s));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return [h, m, x].map((v) => String(v).padStart(2, '0')).join(':');
}

// ------------------------------------------------------------------ telas das câmeras (desenho simples, tipo CFTV)
function desenharCamera(c, W, H, cena, rotulo, horaS, t) {
  c.fillStyle = '#0d1410'; c.fillRect(0, 0, W, H);
  const tinta = 'rgba(170,200,180,0.55)', claro = 'rgba(200,225,205,0.75)';
  c.strokeStyle = tinta; c.lineWidth = 3; c.fillStyle = 'rgba(120,150,130,0.35)';
  if (cena === 's2' || cena === 'garagem') {
    // garagem: piso em perspectiva, colunas; no S2, paletes de galões até o teto e um carro
    c.beginPath(); c.moveTo(0, H * 0.62); c.lineTo(W, H * 0.62); c.stroke();
    for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(W * 0.5, H * 0.42); c.lineTo(i * W / 5, H); c.stroke(); }
    for (const x of [0.12, 0.88]) c.fillRect(W * x - 10, H * 0.18, 20, H * 0.5);
    if (cena === 's2') {
      const cols = 4, lins = 4, gx = W * 0.38, gw = W * 0.58, topo = H * 0.1, base = H * 0.66;
      const cw = gw / cols, ch = (base - topo) / lins;
      for (let col = 0; col < cols; col++) for (let lin = 0; lin < lins; lin++) {
        const x0 = gx + col * cw, yb = base - lin * ch, bw = cw * 0.8, bh = ch * 0.7, xb = x0 + (cw - bw) / 2;
        c.fillStyle = 'rgba(160,220,240,0.8)'; arredondado(c, xb, yb - bh, bw, bh, bw * 0.25); c.fill(); // corpo do galão
        c.fillRect(x0 + cw / 2 - bw * 0.15, yb - bh - ch * 0.13, bw * 0.3, ch * 0.14); // gargalo
        c.fillStyle = 'rgba(40,90,120,0.95)'; c.fillRect(x0 + cw / 2 - bw * 0.21, yb - bh - ch * 0.22, bw * 0.42, ch * 0.1); // tampa
        c.fillStyle = 'rgba(30,60,80,0.55)'; c.fillRect(xb + 4, yb - bh * 0.55, bw - 8, 3); // nível da água
      }
      c.fillStyle = 'rgba(140,110,80,0.6)'; c.fillRect(gx, base, gw, 10);
      // carro (a síndica guardou o carro lá embaixo)
      c.fillStyle = 'rgba(90,110,100,0.6)'; arredondado(c, W * 0.08, H * 0.48, W * 0.26, H * 0.12, 10); c.fill();
      arredondado(c, W * 0.12, H * 0.42, W * 0.16, H * 0.08, 10); c.fill();
    } else {
      c.fillStyle = 'rgba(90,110,100,0.6)'; arredondado(c, W * 0.55, H * 0.5, W * 0.3, H * 0.12, 10); c.fill();
    }
  } else if (cena === 'hall') {
    c.beginPath(); c.moveTo(0, H * 0.7); c.lineTo(W, H * 0.66); c.stroke();
    for (const x of [0.28, 0.6]) { c.strokeRect(W * x, H * 0.22, W * 0.16, H * 0.44); c.beginPath(); c.moveTo(W * (x + 0.08), H * 0.22); c.lineTo(W * (x + 0.08), H * 0.66); c.stroke(); }
    c.beginPath(); c.arc(W * 0.12, H * 0.6, 26, 0, Math.PI * 2); c.fill();
  } else if (cena === 'entrada') {
    c.strokeRect(W * 0.2, H * 0.15, W * 0.6, H * 0.6); c.beginPath(); c.moveTo(W * 0.5, H * 0.15); c.lineTo(W * 0.5, H * 0.75); c.stroke();
    c.fillStyle = 'rgba(30,40,35,0.9)'; c.fillRect(W * 0.21, H * 0.16, W * 0.58, H * 0.58);
  } else if (cena === 'elevador') {
    c.strokeRect(W * 0.18, H * 0.1, W * 0.64, H * 0.8);
    c.beginPath(); c.moveTo(W * 0.18, H * 0.1); c.lineTo(W * 0.32, H * 0.28); c.moveTo(W * 0.82, H * 0.1); c.lineTo(W * 0.68, H * 0.28);
    c.moveTo(W * 0.18, H * 0.9); c.lineTo(W * 0.32, H * 0.72); c.moveTo(W * 0.82, H * 0.9); c.lineTo(W * 0.68, H * 0.72); c.stroke();
    c.strokeRect(W * 0.32, H * 0.28, W * 0.36, H * 0.44);
  }
  // linhas de varredura e chuvisco leve (semente pelo quadro: função do tempo)
  const rnd = mulberry32(Math.floor(t * 12) + 7);
  c.fillStyle = 'rgba(0,0,0,0.18)'; for (let y = 0; y < H; y += 4) c.fillRect(0, y, W, 1);
  c.fillStyle = 'rgba(255,255,255,0.05)'; for (let i = 0; i < 40; i++) c.fillRect(rnd() * W, rnd() * H, 2, 2);
  c.font = `700 ${Math.round(H * 0.075)}px ${FONTE}`; c.textBaseline = 'top'; c.textAlign = 'left'; c.fillStyle = claro;
  c.fillText(rotulo || '', W * 0.04, H * 0.04);
  c.textAlign = 'right'; c.fillText(hhmmss(horaS), W * 0.96, H * 0.88);
  if (Math.floor(t * 1.5) % 2 === 0) { c.fillStyle = '#e0302a'; c.beginPath(); c.arc(W * 0.9, H * 0.08, H * 0.03, 0, Math.PI * 2); c.fill(); }
}

function desenharRelogio(c, W, H, restante, t) {
  c.fillStyle = '#050000'; c.fillRect(0, 0, W, H);
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillStyle = '#ff3b30'; c.shadowColor = 'rgba(255,40,30,0.8)'; c.shadowBlur = H * 0.04;
  c.font = `700 ${Math.round(H * 0.12)}px ${FONTE}`; c.fillText('REINÍCIO EM', W / 2, H * 0.3);
  c.font = `700 ${Math.round(H * 0.22)}px ${FONTE}`; c.fillText(hhmmss(restante), W / 2, H * 0.6);
  c.shadowBlur = 0;
  c.fillStyle = 'rgba(0,0,0,0.25)'; for (let y = 0; y < H; y += 4) c.fillRect(0, y, W, 1);
}

function desenharChuvisco(c, W, H, t) {
  const rnd = mulberry32(Math.floor(t * 15) + 99);
  c.fillStyle = '#111'; c.fillRect(0, 0, W, H);
  for (let i = 0; i < 900; i++) { const v = Math.floor(rnd() * 200); c.fillStyle = `rgb(${v},${v},${v})`; c.fillRect(rnd() * W, rnd() * H, 3, 3); }
}

export const TIPOS_PREDIO = {
  // Monitores da portaria (2×2 por padrão). texto = o que cada tela mostra: hall | entrada | garagem | s2 | elevador |
  // relogio | chuvisco | apagado. estado "contando" liga o relógio: REINÍCIO EM (72 h − tempo desde o evento).
  monitores(def, ctx) {
    const e = ctx.estilo; const g = new THREE.Group();
    const [x, y, z] = def.pos;
    const [cols, lins] = def.grade || [2, 2];
    const [tw, th] = def.tamanho_tela || [0.36, 0.26];
    const telasDef = def.telas || [{ cena: 'hall', rotulo: 'CAM 1 HALL' }, { cena: 'entrada', rotulo: 'CAM 2 ENTRADA' }, { cena: 'garagem', rotulo: 'CAM 3 S1' }, { cena: 'elevador', rotulo: 'CAM 5 ELEVADOR' }];
    const total = def.relogio_s ?? 72 * 3600;
    const hora0 = (() => { const [hh, mm] = String(def.hora_inicial || '23:58').split(':').map(Number); return hh * 3600 + mm * 60; })();
    const gap = 0.03;
    const larg = cols * tw + (cols - 1) * gap, alt = lins * th + (lins - 1) * gap;
    const base = caixa(e, Math.min(0.3, larg * 0.5), 0.04, 0.18, '#202020'); base.position.set(x, y + 0.02, z); g.add(base);
    const haste = caixa(e, 0.05, 0.06, 0.05, '#202020'); haste.position.set(x, y + 0.07, z - 0.02); g.add(haste);
    const telas = [];
    for (let i = 0; i < cols * lins; i++) {
      const cx = x - larg / 2 + tw / 2 + (i % cols) * (tw + gap);
      const cy = y + 0.1 + alt - th / 2 - Math.floor(i / cols) * (th + gap);
      const moldura = new THREE.Mesh(geoCaixaArredondada(tw + 0.035, th + 0.035, 0.05, 0.01), e.material('#1b1b1b'));
      moldura.position.set(cx, cy, z - 0.03); g.add(moldura);
      const tex = texturaTexto({ largura: 512, altura: Math.round(512 * th / tw), fundo: '#000', linhas: [] });
      const p = planoTextura(e, tw, th, tex, true); p.position.set(cx, cy, z - 0.004); p.userData.semTraco = true; g.add(p);
      telas.push({ tex, chave: '', def: telasDef[i] || telasDef[0] });
    }
    return {
      grupo: g,
      atualizar(est, t) {
        const modos = est?.texto && est.texto.length ? est.texto : telas.map((tl) => tl.def.cena);
        const contando = est?.estado === 'contando';
        const restante = contando ? total - (t - (est.inicioEstado || 0)) : total;
        telas.forEach((tl, i) => {
          const modo = modos[i] ?? modos[modos.length - 1];
          const seg = Math.floor(t);
          const chave = modo === 'relogio' ? `r${Math.floor(restante)}` : modo === 'chuvisco' ? `c${Math.floor(t * 15)}` : modo === 'apagado' ? 'a' : `${modo}:${seg}:${Math.floor(t * 1.5) % 2}`;
          if (chave === tl.chave) return;
          tl.chave = chave;
          const c = tl.tex._ctx, W = tl.tex._canvas.width, H = tl.tex._canvas.height;
          c.save();
          if (modo === 'relogio') desenharRelogio(c, W, H, restante, t);
          else if (modo === 'chuvisco') desenharChuvisco(c, W, H, t);
          else if (modo === 'apagado') { c.fillStyle = '#030303'; c.fillRect(0, 0, W, H); }
          else desenharCamera(c, W, H, modo, modo === tl.def.cena ? tl.def.rotulo : ({ s2: 'CAM 4 S2', hall: 'CAM 1 HALL', entrada: 'CAM 2 ENTRADA', garagem: 'CAM 3 S1', elevador: 'CAM 5 ELEVADOR' }[modo] || ''), hora0 + t, t);
          c.restore();
          tl.tex.needsUpdate = true;
        });
      },
      pontoOlhar: new THREE.Vector3(x, y + 0.1 + alt / 2, z),
    };
  },

  // Interfone da portaria: teclado e uma coluna de luzes dos andares. estado "todos": todas piscando (todo mundo chamando).
  interfone(def, ctx) {
    const e = ctx.estilo; const g = new THREE.Group();
    const [x, y, z] = def.pos; const [w, h] = def.tamanho || [0.3, 0.46];
    const corpo = new THREE.Mesh(geoCaixaArredondada(w + 0.03, h + 0.03, 0.05, 0.015), e.material('#2b2f33')); corpo.position.set(x, y, z - 0.025); g.add(corpo);
    const tex = texturaTexto({ largura: 300, altura: Math.round(300 * h / w), fundo: '#2b2f33', linhas: [] });
    const p = planoTextura(e, w, h, tex, true); p.position.set(x, y, z + 0.002); p.userData.semTraco = true; g.add(p);
    const andares = def.andares || 14;
    let chave = '';
    const desenhar = (todos, fase) => {
      const c = tex._ctx, W = tex._canvas.width, H = tex._canvas.height;
      c.fillStyle = '#2b2f33'; c.fillRect(0, 0, W, H);
      c.fillStyle = todos ? '#3a0d0d' : '#13261a'; c.fillRect(W * 0.1, H * 0.05, W * 0.8, H * 0.12);
      c.fillStyle = todos ? '#ff6b5a' : '#7fe0a0'; c.font = `700 ${Math.round(H * 0.06)}px ${FONTE}`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(todos ? 'TODOS' : 'PORTARIA', W / 2, H * 0.11);
      for (let i = 0; i < 12; i++) { const cx = W * (0.2 + (i % 3) * 0.2), cy = H * (0.28 + Math.floor(i / 3) * 0.1); c.fillStyle = '#c9ccce'; c.beginPath(); c.arc(cx, cy, W * 0.06, 0, Math.PI * 2); c.fill(); }
      for (let a = 0; a < andares; a++) {
        const cy = H * 0.7 + (a % 7) * H * 0.04, cx = W * (a < 7 ? 0.3 : 0.7);
        c.fillStyle = todos && (fase + a) % 2 === 0 ? '#ff3b30' : '#4a1c1c'; c.beginPath(); c.arc(cx, cy, W * 0.025, 0, Math.PI * 2); c.fill();
      }
      tex.needsUpdate = true;
    };
    desenhar(false, 0);
    return {
      grupo: g,
      atualizar(est, t) {
        const todos = est?.estado === 'todos';
        const fase = todos ? Math.floor(t * 4) : 0;
        const k = `${todos}:${fase % 2}`;
        if (k !== chave) { chave = k; desenhar(todos, fase); }
      },
      pontoOlhar: new THREE.Vector3(x, y, z),
    };
  },

  // Elevador: portas de correr, mostrador do andar em cima e a cabine atrás. estado aberto|fechado (anima 0,9 s);
  // texto = linhas do mostrador (ex.: "▼|S2").
  elevador(def, ctx) {
    const e = ctx.estilo; const g = new THREE.Group();
    const [x, , z] = def.pos; const L = def.largura || 1.0, A = def.altura || 2.1;
    const corPorta = def.cor_porta || '#b8bdc2', corMold = def.cor_moldura || '#5f6368';
    // moldura (batentes largos: as folhas abertas somem atrás deles)
    const lado = L * 0.55;
    for (const s of [-1, 1]) { const b = caixa(e, lado, A + 0.12, 0.1, corMold); b.position.set(x + s * (L / 2 + lado / 2), (A + 0.12) / 2, z + 0.04); g.add(b); }
    const verga = caixa(e, L + 2 * lado, 0.3, 0.1, corMold); verga.position.set(x, A + 0.12 + 0.15, z + 0.04); g.add(verga);
    // folhas
    const folhas = [];
    for (const s of [-1, 1]) {
      const f = caixa(e, L / 2, A, 0.04, corPorta); f.position.set(x + s * L / 4, A / 2, z - 0.02); g.add(f);
      const friso = caixa(e, 0.01, A * 0.9, 0.045, escurecer(corPorta, 0.75)); friso.position.set(x + s * (L / 2 - 0.02), A / 2, z - 0.02); g.add(friso);
      folhas.push({ f, friso, s });
    }
    // cabine (aparece com as portas abertas): fundo, laterais, piso e a luz do teto
    const P = 1.4;
    const fundo = caixa(e, L + 0.3, A + 0.1, 0.06, '#9aa3a8'); fundo.position.set(x, (A + 0.1) / 2, z - P); g.add(fundo);
    for (const s of [-1, 1]) { const lat = caixa(e, 0.06, A + 0.1, P, '#a7afb4'); lat.position.set(x + s * (L / 2 + 0.15), (A + 0.1) / 2, z - P / 2); g.add(lat); }
    const pisoCab = caixa(e, L + 0.3, 0.04, P, '#5c5f63'); pisoCab.position.set(x, 0.02, z - P / 2); g.add(pisoCab);
    const tetoCab = caixa(e, L + 0.3, 0.05, P, '#c8cdd0'); tetoCab.position.set(x, A + 0.07, z - P / 2); g.add(tetoCab);
    const luzCab = new THREE.Mesh(new THREE.PlaneGeometry(L * 0.7, P * 0.5), e.luminoso('#fff8e0')); luzCab.rotation.x = Math.PI / 2; luzCab.position.set(x, A + 0.04, z - P / 2); g.add(luzCab);
    const espelho = new THREE.Mesh(new THREE.PlaneGeometry(L * 0.8, A * 0.5), e.luminoso('#6f7d86')); espelho.position.set(x, A * 0.55, z - P + 0.035); g.add(espelho);
    // mostrador
    const tex = texturaTexto({ largura: 256, altura: 128, fundo: '#120806', linhas: [] });
    // painel largo, numa linha só ("▼ S2"): com '▼' e 'S2' empilhados, a 6 m da guarita virava um ponto laranja
    const mostrador = planoTextura(e, 0.5, 0.25, tex, true); mostrador.position.set(x, A + 0.3, z + 0.095); mostrador.userData.semTraco = true; g.add(mostrador);
    let chave = '';
    const desenharMostrador = (linhas) => {
      const c = tex._ctx; c.fillStyle = '#120806'; c.fillRect(0, 0, 256, 128);
      c.fillStyle = '#ff8a3a'; c.shadowColor = 'rgba(255,120,40,0.8)'; c.shadowBlur = 10; c.textAlign = 'center'; c.textBaseline = 'middle';
      const txt = linhas.map(String).join(' ');
      let px = 100; c.font = `700 ${px}px ${FONTE}`;
      while (px > 30 && c.measureText(txt).width > 236) { px -= 4; c.font = `700 ${px}px ${FONTE}`; }
      c.fillText(txt, 128, 68);
      c.shadowBlur = 0; tex.needsUpdate = true;
    };
    // botões de chamar ao lado
    const placaB = caixa(e, 0.1, 0.22, 0.02, '#8c9196'); placaB.position.set(x + L / 2 + lado * 0.55, 1.15, z + 0.1); g.add(placaB);
    const bot = []; for (const dy of [0.05, -0.05]) { const b = new THREE.Mesh(new THREE.CircleGeometry(0.025, 16), e.luminoso('#3a3a3a')); b.position.set(x + L / 2 + lado * 0.55, 1.15 + dy, z + 0.112); b.userData.semTraco = true; g.add(b); bot.push(b); }
    const res = {
      grupo: g, abertura: 0,
      atualizar(est, t) {
        const aberto = est?.estado === 'aberto';
        const dt = t - (est?.inicioEstado || 0);
        const k = aberto ? suave(dt / 0.9) : (est?.estado === 'fechado' && dt < 0.9 ? 1 - suave(dt / 0.9) : 0);
        res.abertura = k;
        for (const { f, friso, s } of folhas) { const dx = s * (L / 4 + k * L * 0.47); f.position.x = x + dx; friso.position.x = x + dx + s * (L / 4 - 0.02); }
        const linhas = est?.texto && est.texto.length ? est.texto : (def.texto || ['T']);
        const kk = linhas.join('|');
        if (kk !== chave) { chave = kk; desenharMostrador(linhas); }
        const descendo = /▼/.test(kk); bot[1].material = e.luminoso(descendo ? '#ffb347' : '#3a3a3a');
      },
      pontoOlhar: new THREE.Vector3(x, 1.2, z),
    };
    return res;
  },

  // Galões de 20 L empilhados num palete: pilhas = [ao longo de x, ao longo de z, camadas].
  galoes(def, ctx) {
    const e = ctx.estilo; const g = new THREE.Group();
    const [x, y0, z] = [def.pos[0], def.pos[1] || 0, def.pos[2]];
    const [nx, nz, ny] = def.pilhas || [4, 3, 3];
    const passo = 0.29, alt = 0.5;
    const corpoG = new THREE.CylinderGeometry(0.135, 0.135, 0.38, 12), ombroG = new THREE.CylinderGeometry(0.06, 0.135, 0.07, 12), gargaloG = new THREE.CylinderGeometry(0.045, 0.045, 0.05, 10), tampaG = new THREE.CylinderGeometry(0.05, 0.05, 0.03, 10);
    const corpos = [], tampas = [];
    const larg = nx * passo, prof = nz * passo, hp = def.palete === false ? 0 : 0.13;
    for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) {
      const px = x - larg / 2 + passo / 2 + i * passo, pz = z - prof / 2 + passo / 2 + k * passo, py = y0 + hp + j * alt;
      corpos.push(colocada(corpoG, px, py + 0.19, pz), colocada(ombroG, px, py + 0.415, pz), colocada(gargaloG, px, py + 0.475, pz));
      tampas.push(colocada(tampaG, px, py + 0.51, pz));
    }
    g.add(new THREE.Mesh(juntar(corpos), e.material(def.cor || '#4f8fc0')));
    g.add(new THREE.Mesh(juntar(tampas), e.material(def.cor_tampa || '#1f3f6e')));
    if (hp) {
      const tabuas = [];
      for (let s = 0; s < 5; s++) tabuas.push(colocada(new THREE.BoxGeometry(larg + 0.1, 0.03, 0.12), x, y0 + hp - 0.015, z - prof / 2 + (s + 0.5) * (prof / 5)));
      for (const dx of [-1, 0, 1]) tabuas.push(colocada(new THREE.BoxGeometry(0.1, hp - 0.03, prof), x + dx * (larg / 2 - 0.05), y0 + (hp - 0.03) / 2, z));
      g.add(new THREE.Mesh(juntar(tabuas), e.material('#a9845a')));
    }
    return { grupo: g, atualizar() {}, pontoOlhar: new THREE.Vector3(x, y0 + hp + ny * alt * 0.6, z + prof / 2) };
  },

  // Caixas de papelão empilhadas, com a etiqueta virada para +z na fileira da frente.
  caixas_estoque(def, ctx) {
    const e = ctx.estilo; const g = new THREE.Group();
    const [x, y0, z] = [def.pos[0], def.pos[1] || 0, def.pos[2]];
    const [nx, nz, ny] = def.pilhas || [3, 2, 3];
    const [cw, ch, cd] = def.tamanho_caixa || [0.5, 0.34, 0.4];
    const rnd = mulberry32(sementeDeTexto(def.id));
    const geos = [];
    const larg = nx * cw, prof = nz * cd;
    const frentes = [];
    for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) {
      const px = x - larg / 2 + cw / 2 + i * cw + (rnd() - 0.5) * 0.02, pz = z - prof / 2 + cd / 2 + k * cd, py = y0 + ch / 2 + j * ch;
      const ry = (rnd() - 0.5) * 0.06;
      geos.push(colocada(new THREE.BoxGeometry(cw * 0.97, ch * 0.97, cd * 0.97), px, py, pz, ry));
      if (k === nz - 1) frentes.push([px, py, pz + cd / 2 + 0.003, ry]);
    }
    g.add(new THREE.Mesh(juntar(geos), e.material(def.cor || '#c49a63')));
    const linhas = def.rotulo || ['ESTOCADO EM MAIO', '1401 · NÃO MEXER'];
    const tex = texturaTexto({ largura: 512, altura: 256, fundo: '#f3efe2', cor: '#1d1a17', linhas, fonte: `700 58px ${FONTE}`, entrelinha: 1.3, margem: 30, ajustar: true });
    for (const [px, py, pz, ry] of frentes) {
      const et = planoTextura(e, cw * 0.84, cw * 0.42, tex, false); et.position.set(px, py, pz); et.rotation.y = ry; et.userData.semTraco = true; g.add(et);
    }
    return { grupo: g, atualizar() {}, pontoOlhar: new THREE.Vector3(x, y0 + ny * ch / 2, z + prof / 2) };
  },

  // Folha de papel colada (lista): título, linhas; as que começam com "!" saem em vermelho (escrito à mão por cima).
  papel_lista(def, ctx) {
    const e = ctx.estilo; const g = new THREE.Group();
    const [x, y, z] = def.pos; const [w, h] = def.tamanho || [0.42, 0.6];
    const tex = texturaTexto({ largura: 700, altura: Math.round(700 * h / w), fundo: '#f5f2e8', linhas: [] });
    const p = planoTextura(e, w, h, tex, false); p.position.set(x, y, z + 0.004); p.rotation.z = ((def.inclinacao_graus ?? 2.5) * Math.PI) / 180; p.userData.semTraco = true; g.add(p);
    let chave = '';
    const desenhar = (titulo, linhas) => {
      const c = tex._ctx, W = tex._canvas.width, H = tex._canvas.height;
      c.fillStyle = '#f5f2e8'; c.fillRect(0, 0, W, H);
      c.fillStyle = 'rgba(240,215,120,0.75)'; c.fillRect(W * 0.04, -6, W * 0.22, 46); c.fillRect(W * 0.74, -6, W * 0.22, 46);
      c.fillStyle = '#1d1a17'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.font = `700 ${Math.round(W * 0.06)}px ${FONTE}`;
      const tl = String(titulo).split('\n');
      tl.forEach((l, i) => c.fillText(l, W / 2, H * 0.1 + i * W * 0.075));
      c.fillRect(W * 0.08, H * 0.1 + tl.length * W * 0.075 - W * 0.02, W * 0.84, 4);
      c.textAlign = 'left';
      const y0 = H * 0.1 + tl.length * W * 0.075 + W * 0.06;
      // todas as linhas na mesma escala, a maior cabendo na folha (a primeira passava da borda)
      const fonteLinha = (vermelho, k) => `${vermelho ? 'italic 700' : '700'} ${Math.round(W * (vermelho ? 0.062 : 0.052) * k)}px ${FONTE}`;
      let escala = 1;
      for (const l of linhas) {
        const vermelho = String(l).startsWith('!');
        c.font = fonteLinha(vermelho, 1);
        const w = c.measureText(vermelho ? String(l).slice(1) : String(l)).width;
        if (w > W * 0.84) escala = Math.min(escala, (W * 0.84) / w);
      }
      linhas.forEach((l, i) => {
        const vermelho = String(l).startsWith('!');
        c.fillStyle = vermelho ? '#c4211a' : '#1d1a17';
        c.font = fonteLinha(vermelho, escala);
        c.fillText(vermelho ? String(l).slice(1) : String(l), W * 0.1, y0 + i * W * 0.085);
      });
      tex.needsUpdate = true;
    };
    return {
      grupo: g,
      atualizar(est) {
        const linhas = est?.texto && est.texto.length ? est.texto : (def.linhas || []);
        const k = linhas.join('|');
        if (k !== chave) { chave = k; desenhar(def.titulo || '', linhas); }
      },
      pontoOlhar: new THREE.Vector3(x, y, z),
    };
  },

  // Rádio de base da portaria: visor que diz QUEM fala no canal (def.vozes: { personagem: "RÓTULO" }) e um led que pisca
  // enquanto essa pessoa fala. Segue q.falando (quem fala agora, da linha do tempo); sem fala no rádio: "CANAL 1".
  // O visor tem luz própria (bateria): continua aceso no apagão.
  radio_base(def, ctx) {
    const e = ctx.estilo; const g = new THREE.Group();
    const [L, A, P] = def.tamanho || [0.26, 0.13, 0.16];
    const r = new THREE.Group(); r.position.set(def.pos[0], def.pos[1] || 0, def.pos[2]); g.add(r);
    const cor = def.cor || '#3b4148';
    const corpo = new THREE.Mesh(geoCaixaArredondada(L, A, P, 0.018), e.material(cor)); corpo.position.set(0, A / 2, 0); r.add(corpo);
    const painel = caixa(e, L * 0.9, A * 0.78, 0.006, escurecer(cor, 0.35)); painel.position.set(0, A * 0.5, P / 2 + 0.002); r.add(painel);
    // grade do alto-falante: listras claras
    for (let i = 0; i < 4; i++) { const l = caixa(e, L * 0.36, 0.006, 0.004, clarear(cor, 0.35)); l.position.set(-L * 0.2, A * 0.2 + i * 0.016, P / 2 + 0.006); l.userData.semTraco = true; r.add(l); }
    // visor
    const VW = 384, VH = 128;
    const tex = texturaTexto({ largura: VW, altura: VH, fundo: '#0f2a1c', linhas: [] });
    const visor = planoTextura(e, L * 0.78, L * 0.78 * VH / VW, tex, true); visor.position.set(0, A * 0.68, P / 2 + 0.006); visor.userData.semTraco = true; r.add(visor);
    // botões, antena e led
    for (let i = 0; i < 3; i++) { const b = cilindro(e, 0.011, 0.011, 0.01, '#22262b', 10); b.rotation.x = Math.PI / 2; b.position.set(L * 0.12 + i * 0.03, A * 0.27, P / 2 + 0.008); r.add(b); }
    const antena = cilindro(e, 0.009, 0.012, 0.2, '#1c1c1c', 10); antena.position.set(L * 0.36, A + 0.1, -P * 0.25); r.add(antena);
    const ledOn = new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 8), e.luminoso('#ff3b2f')); ledOn.position.set(-L * 0.36, A + 0.006, P * 0.3); ledOn.userData.semTraco = true; r.add(ledOn);
    const ledOff = new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 8), e.material('#5a1a16')); ledOff.position.copy(ledOn.position); r.add(ledOff);
    let chave = '';
    const desenhar = (rotulo, aceso) => {
      const c = tex._ctx;
      c.fillStyle = rotulo ? '#3a0f0d' : '#0f2a1c'; c.fillRect(0, 0, VW, VH);
      c.strokeStyle = 'rgba(255,255,255,0.18)'; c.lineWidth = 6; c.strokeRect(3, 3, VW - 6, VH - 6);
      const txt = rotulo || 'CANAL 1';
      let px = 74; c.font = `700 ${px}px ${FONTE}`;
      const livre = VW - (rotulo ? 110 : 44);
      while (px > 30 && c.measureText(txt).width > livre) { px -= 2; c.font = `700 ${px}px ${FONTE}`; }
      c.fillStyle = rotulo ? '#ffb4a6' : '#6fd39a'; c.textBaseline = 'middle'; c.textAlign = rotulo ? 'left' : 'center';
      c.fillText(txt, rotulo ? 88 : VW / 2, VH / 2 + 2);
      if (rotulo) { c.fillStyle = aceso ? '#ff3b2f' : '#6a1e18'; c.beginPath(); c.arc(48, VH / 2, 20, 0, Math.PI * 2); c.fill(); }
      tex.needsUpdate = true;
    };
    return {
      grupo: g,
      atualizar(est, t, q) {
        const rotulo = (q?.falando && def.vozes?.[q.falando]) || '';
        const aceso = !!rotulo && Math.floor(t * 3) % 2 === 0;
        const k = rotulo + '|' + aceso;
        if (k !== chave) { chave = k; desenhar(rotulo, aceso); }
        ledOn.visible = aceso; ledOff.visible = !aceso;
      },
      pontoOlhar: new THREE.Vector3(def.pos[0], (def.pos[1] || 0) + A * 0.6, def.pos[2] + P / 2),
    };
  },

  // Luz de emergência de parede: acende sozinha no apagão.
  luz_emergencia(def, ctx) {
    const e = ctx.estilo; const g = new THREE.Group();
    const [x, y, z] = def.pos;
    const corpo = new THREE.Mesh(geoCaixaArredondada(0.34, 0.12, 0.08, 0.02), e.material('#e8e6df')); corpo.position.set(x, y, z + 0.04); g.add(corpo);
    const lentes = [];
    for (const s of [-1, 1]) {
      const cab = cilindro(e, 0.045, 0.05, 0.08, '#d9d6cc', 12); cab.rotation.x = Math.PI / 2 - 0.5; cab.position.set(x + s * 0.11, y + 0.07, z + 0.09); g.add(cab);
      const lente = new THREE.Mesh(new THREE.CircleGeometry(0.04, 16), e.luminoso('#6f6d66')); lente.position.set(x + s * 0.11, y + 0.095, z + 0.13); lente.rotation.x = -0.5; lente.userData.semTraco = true; g.add(lente); lentes.push(lente);
    }
    const acesa = e.luminoso('#fffbe6'), apagada = e.luminoso('#6f6d66');
    return { grupo: g, atualizar(est, t, q) { const on = (q?.apagao || 0) > 0.6 || est?.estado === 'acesa'; for (const l of lentes) l.material = on ? acesa : apagada; } };
  },

  // Quadro de luz do prédio: o estado dele ("apagao") apaga o prédio inteiro (motor.js lê os quadros de luz).
  quadro_luz(def, ctx) {
    const e = ctx.estilo; const g = new THREE.Group();
    const [x, y, z] = def.pos;
    const cx = caixa(e, 0.5, 0.7, 0.14, '#9aa0a4'); cx.position.set(x, y, z + 0.07); g.add(cx);
    const porta = caixa(e, 0.44, 0.64, 0.01, '#a9afb3'); porta.position.set(x, y, z + 0.145); g.add(porta);
    const tex = texturaTexto({ largura: 256, altura: 96, fundo: '#f1d23a', cor: '#1d1a17', linhas: ['⚡ QDG'], fonte: `700 52px ${FONTE}` });
    const et = planoTextura(e, 0.16, 0.06, tex, false); et.position.set(x, y + 0.2, z + 0.152); et.userData.semTraco = true; g.add(et);
    const led = new THREE.Mesh(new THREE.CircleGeometry(0.012, 12), e.luminoso('#2f6d3a')); led.position.set(x + 0.15, y - 0.25, z + 0.152); led.userData.semTraco = true; g.add(led);
    return { grupo: g, atualizar(est, t) { const ap = est?.estado === 'apagao'; led.material = e.luminoso(ap ? (Math.floor(t * 2) % 2 ? '#ff3b30' : '#5a1410') : '#3fbf5a'); } };
  },

  // Lanterna do celular: sem geometria; o estado "acesa" liga o facho (motor.js, na imagem final).
  lanterna() { return { grupo: new THREE.Group(), atualizar() {} }; },

  cadeado(def, ctx) {
    const e = ctx.estilo; const g = new THREE.Group();
    const [x, y, z] = def.pos;
    const corpo = new THREE.Mesh(geoCaixaArredondada(0.08, 0.09, 0.035, 0.01), e.material('#c9a43a')); corpo.position.set(x, y, z + 0.03); g.add(corpo);
    const arco = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.007, 8, 16, Math.PI), e.material('#a6a6a6')); arco.position.set(x, y + 0.045, z + 0.03); g.add(arco);
    return { grupo: g, atualizar() {}, pontoOlhar: new THREE.Vector3(x, y, z) };
  },

  // Carrinho de feira com galões e fardos de papel higiênico (a moradora que estoca).
  carrinho_feira(def, ctx) {
    const e = ctx.estilo; const g = new THREE.Group();
    const [x, , z] = def.pos;
    const metal = '#5b6b74';
    for (const s of [-1, 1]) { const r = cilindro(e, 0.09, 0.09, 0.04, '#222', 14); r.rotation.z = Math.PI / 2; r.position.set(x + s * 0.2, 0.09, z); g.add(r); }
    const fundoC = caixa(e, 0.42, 0.02, 0.32, metal); fundoC.position.set(x, 0.12, z); g.add(fundoC);
    for (const [dx, dz] of [[-0.2, -0.15], [0.2, -0.15], [-0.2, 0.15], [0.2, 0.15]]) { const h = caixa(e, 0.015, 0.62, 0.015, metal); h.position.set(x + dx, 0.43, z + dz); g.add(h); }
    for (const yy of [0.35, 0.73]) for (const dz of [-0.15, 0.15]) { const tr = caixa(e, 0.42, 0.015, 0.015, metal); tr.position.set(x, yy, z + dz); g.add(tr); }
    const alca = caixa(e, 0.42, 0.03, 0.03, '#2b2b2b'); alca.position.set(x, 1.0, z + 0.2); g.add(alca);
    for (const s of [-1, 1]) { const ha = caixa(e, 0.015, 0.3, 0.015, metal); ha.position.set(x + s * 0.2, 0.87, z + 0.18); g.add(ha); }
    for (const s of [-1, 1]) { const gl = cilindro(e, 0.11, 0.11, 0.36, '#4f8fc0', 12); gl.position.set(x + s * 0.1, 0.31, z); g.add(gl); const tp = cilindro(e, 0.04, 0.04, 0.05, '#1f3f6e', 10); tp.position.set(x + s * 0.1, 0.52, z); g.add(tp); }
    for (let i = 0; i < 3; i++) {
      const f = new THREE.Mesh(geoCaixaArredondada(0.34, 0.2, 0.24, 0.04), e.material('#f4f4f0')); f.position.set(x, 0.66 + i * 0.2, z - 0.01); f.rotation.y = (i - 1) * 0.12; g.add(f);
      const faixa = caixa(e, 0.345, 0.05, 0.245, '#7fb2dd'); faixa.position.copy(f.position); faixa.rotation.y = f.rotation.y; g.add(faixa);
    }
    return { grupo: g, atualizar() {}, pontoOlhar: new THREE.Vector3(x, 0.8, z) };
  },
};
