// Biblioteca de props paramétricos. Cada prop devolve { grupo, atualizar(estadoProp, t, ctxQuadro), pontoOlhar }.
// Regras do livro: 4 lados fechados, objetos grandes nos cantos, muitos objetos pequenos, nada de marca real.
import * as THREE from 'three';
import { texturaTexto, texturaLadrilho, escurecer, clarear } from './estilo.js';
import { mulberry32, sementeDeTexto, lerp, clamp } from './util.js';

const V3 = (a) => new THREE.Vector3(a?.[0] || 0, a?.[1] || 0, a?.[2] || 0);

function caixa(e, w, h, d, cor, opcoes) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), e.material(cor, opcoes)); }
function cilindro(e, r1, r2, h, cor, seg = 12) { return new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), e.material(cor)); }
function esfera(e, r, cor, seg = 10) { return new THREE.Mesh(new THREE.SphereGeometry(r, seg, seg), e.material(cor)); }
function planoTextura(e, w, h, tex, luminoso = false, opcoes = {}) {
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), luminoso ? e.luminosoTextura(tex, opcoes) : e.materialTextura(tex, opcoes));
}

export function criarProp(def, ctx) {
  const f = TIPOS[def.tipo];
  const resultado = f ? f(def, ctx) : caixaGenerica(def, ctx);
  const grupo = resultado.grupo;
  if (!f) ctx.avisos.push(`prop '${def.id}': tipo desconhecido '${def.tipo}', virou caixa simples`);
  if (def.rot) grupo.rotation.set(def.rot[0] || 0, def.rot[1] || 0, def.rot[2] || 0);
  grupo.name = 'prop:' + def.id;
  grupo.userData.id = def.id;
  if (!resultado.pontoOlhar) {
    const caixaB = new THREE.Box3().setFromObject(grupo);
    resultado.pontoOlhar = caixaB.isEmpty() ? V3(def.pos) : caixaB.getCenter(new THREE.Vector3());
  }
  return resultado;
}

function caixaGenerica(def, ctx) {
  const t = def.tamanho || [0.5, 0.5, 0.5];
  const g = new THREE.Group();
  const m = caixa(ctx.estilo, t[0], t[1], t[2], def.cor || '#888');
  m.position.set(def.pos[0], (def.pos[1] || 0) + t[1] / 2, def.pos[2]);
  g.add(m);
  return { grupo: g, atualizar() {} };
}

const TIPOS = {
  // ---------------------------------------------------------------- sala
  sala(def, ctx) {
    const e = ctx.estilo;
    const [w, h, d] = def.tamanho || [10, 4, 12];
    const c = def.centro || [0, 0, -6];
    const g = new THREE.Group();
    const corParede = def.cor_parede || '#efe3c2';
    const corPiso = def.cor_piso || '#9d9480';
    const piso = new THREE.Mesh(new THREE.PlaneGeometry(w, d), def.piso_padrao === 'ladrilho' ? e.materialTextura(texturaLadrilho(corPiso, Math.round(w / 1.2), ctx.semente)) : e.material(corPiso));
    piso.rotation.x = -Math.PI / 2; piso.position.set(c[0], 0, c[2]); g.add(piso);
    const teto = new THREE.Mesh(new THREE.PlaneGeometry(w, d), e.material(def.cor_teto || '#d8d0b8'));
    teto.rotation.x = Math.PI / 2; teto.position.set(c[0], h, c[2]); g.add(teto);
    // paredes (planos virados para dentro)
    const paredes = [
      { pos: [c[0], h / 2, c[2] - d / 2], rot: [0, 0, 0], w: w, fundo: true }, // fundo
      { pos: [c[0], h / 2, c[2] + d / 2], rot: [0, Math.PI, 0], w: w },    // atrás da câmera
      { pos: [c[0] - w / 2, h / 2, c[2]], rot: [0, Math.PI / 2, 0], w: d }, // esquerda
      { pos: [c[0] + w / 2, h / 2, c[2]], rot: [0, -Math.PI / 2, 0], w: d },// direita
    ];
    // portas na parede do fundo viram aberturas (senão a parede tapa a plataforma)
    const portas = (ctx.cenario?.props || []).filter(pp => pp.tipo === 'porta' && Math.abs(pp.pos[2] - (c[2] - d / 2)) < 1.2);
    for (const p of paredes) {
      if (p.fundo && portas.length) {
        for (const pt of portas) {
          const [pw, ph] = pt.tamanho || [1.8, 2.4];
          const abertura = pw + 0.3, altAb = ph + 0.15;
          const esq = new THREE.Mesh(new THREE.PlaneGeometry((pt.pos[0] - abertura / 2) - (c[0] - w / 2), h), e.material(corParede));
          esq.position.set((c[0] - w / 2 + pt.pos[0] - abertura / 2) / 2, h / 2, p.pos[2]); g.add(esq);
          const dir = new THREE.Mesh(new THREE.PlaneGeometry((c[0] + w / 2) - (pt.pos[0] + abertura / 2), h), e.material(corParede));
          dir.position.set((c[0] + w / 2 + pt.pos[0] + abertura / 2) / 2, h / 2, p.pos[2]); g.add(dir);
          const cima = new THREE.Mesh(new THREE.PlaneGeometry(abertura, h - altAb), e.material(corParede));
          cima.position.set(pt.pos[0], altAb + (h - altAb) / 2, p.pos[2]); g.add(cima);
          // batentes ligando a porta à parede (túnel curto)
          const prof = Math.max(0.05, p.pos[2] - pt.pos[2]) ;
          for (const lado of [-1, 1]) { const b = caixa(e, 0.06, altAb, Math.abs(prof) + 0.02, escurecer(corParede, 0.75)); b.position.set(pt.pos[0] + lado * abertura / 2, altAb / 2, (p.pos[2] + pt.pos[2]) / 2); g.add(b); }
          const topo = caixa(e, abertura, 0.06, Math.abs(prof) + 0.02, escurecer(corParede, 0.75)); topo.position.set(pt.pos[0], altAb, (p.pos[2] + pt.pos[2]) / 2); g.add(topo);
        }
        continue;
      }
      const m = new THREE.Mesh(new THREE.PlaneGeometry(p.w, h), e.material(corParede));
      m.position.set(...p.pos); m.rotation.set(...p.rot); g.add(m);
      // rodapé e faixa pintada (detalhe de rodoviária antiga)
      const rodape = new THREE.Mesh(new THREE.PlaneGeometry(p.w, 0.18), e.material(escurecer(corParede, 0.55)));
      rodape.position.set(...p.pos); rodape.position.y = 0.09; rodape.rotation.set(...p.rot); rodape.translateZ(0.005); g.add(rodape);
      const faixa = new THREE.Mesh(new THREE.PlaneGeometry(p.w, 0.9), e.material(def.cor_faixa || escurecer(corParede, 0.8)));
      faixa.position.set(...p.pos); faixa.position.y = 1.0; faixa.rotation.set(...p.rot); faixa.translateZ(0.004); g.add(faixa);
    }
    // marcas de uso no piso (sujeira) com semente
    const rnd = mulberry32(ctx.semente + 11);
    for (let i = 0; i < 9; i++) {
      const mancha = new THREE.Mesh(new THREE.CircleGeometry(0.15 + rnd() * 0.3, 8), e.material(escurecer(corPiso, 0.8)));
      mancha.rotation.x = -Math.PI / 2; mancha.position.set(c[0] + (rnd() - 0.5) * w * 0.9, 0.003, c[2] + (rnd() - 0.5) * d * 0.9);
      mancha.scale.set(1, 0.5 + rnd(), 1); g.add(mancha);
    }
    return { grupo: g, atualizar() {}, pontoOlhar: new THREE.Vector3(c[0], 1.5, c[2] - d / 2) };
  },

  // ---------------------------------------------------------------- guichê (balcão + vidro + cabine)
  guiche(def, ctx) {
    const e = ctx.estilo;
    const g = new THREE.Group();
    const [x, , z] = def.pos;
    const larg = def.largura || 2.2, hb = def.altura_balcao || 1.05;
    const corB = def.cor_balcao || '#6b4a2b';
    // balcão
    const balcao = caixa(e, larg + 0.4, hb - 0.05, 0.7, corB); balcao.position.set(x, (hb - 0.05) / 2, z + 0.05); g.add(balcao);
    const tampo = caixa(e, larg + 0.5, 0.05, 0.8, clarear(corB, 0.15)); tampo.position.set(x, hb - 0.025, z + 0.05); g.add(tampo); // tampo termina em hb: as mãos apoiam em cima
    // moldura e vidro (vidro não escreve profundidade, para o traço não "achatar" o saguão)
    const alturaVidro = 1.45;
    const vidroTex = texturaVidro(def.furos !== false, def.fenda !== false, def.cor_vidro || '#bcd8e6');
    const vidro = new THREE.Mesh(new THREE.PlaneGeometry(larg, alturaVidro), new THREE.MeshBasicMaterial({ map: vidroTex, transparent: true, opacity: 1, depthWrite: false }));
    vidro.position.set(x, hb + alturaVidro / 2, z - 0.07); vidro.userData.vidro = true; g.add(vidro);
    const molduraCor = escurecer(corB, 0.7);
    const mold = [
      [x - larg / 2 - 0.06, hb + alturaVidro / 2, 0.12, alturaVidro + 0.12], [x + larg / 2 + 0.06, hb + alturaVidro / 2, 0.12, alturaVidro + 0.12],
      [x, hb + alturaVidro + 0.06, larg + 0.24, 0.12], [x, hb + 0.03, larg + 0.24, 0.06],
    ];
    for (const [mx, my, mw, mh] of mold) { const m = caixa(e, mw, mh, 0.08, molduraCor); m.position.set(mx, my, z - 0.07); g.add(m); }
    // paredes da cabine (atrás e dos lados da câmera): fechar os 4 lados
    const corCab = ctx.cores.c2 || '#efe3c2';
    const prof = 1.8;
    const lateralE = caixa(e, 0.1, 3.0, prof, escurecer(corCab, 0.9)); lateralE.position.set(x - larg / 2 - 0.17, 1.5, z + prof / 2); g.add(lateralE);
    const lateralD = lateralE.clone(); lateralD.position.x = x + larg / 2 + 0.17; g.add(lateralD);
    const fundoCab = caixa(e, larg + 0.5, 3.0, 0.1, escurecer(corCab, 0.85)); fundoCab.position.set(x, 1.5, z + prof); g.add(fundoCab);
    for (const lado of [-1, 1]) { const faixa = caixa(e, 0.02, 1.0, prof, ctx.cores.c1 || '#1f4e5f'); faixa.position.set(x + lado * (larg / 2 + 0.12), 0.5, z + prof / 2); g.add(faixa); }
    const tetoCab = caixa(e, larg + 0.5, 0.1, prof + 0.2, escurecer(corCab, 0.75)); tetoCab.position.set(x, 3.0, z + prof / 2); g.add(tetoCab);
    const alturaAcima = 3.0 - (hb + alturaVidro + 0.12);
    const acima = caixa(e, larg + 0.5, alturaAcima, 0.1, escurecer(corCab, 0.95)); acima.position.set(x, hb + alturaVidro + 0.12 + alturaAcima / 2, z - 0.07); g.add(acima);
    // prateleira atrás com coisas (vida)
    const prat = caixa(e, 1.6, 0.04, 0.25, corB); prat.position.set(x, 1.9, z + prof - 0.2); g.add(prat);
    const rnd = mulberry32(ctx.semente + 5);
    for (let i = 0; i < 5; i++) { const o = caixa(e, 0.12 + rnd() * 0.1, 0.18 + rnd() * 0.14, 0.14, [ctx.cores.c1, ctx.cores.c3, '#d2c3a0', '#7a6a4f'][i % 4]); o.position.set(x - 0.6 + i * 0.3, 1.92 + o.geometry.parameters.height / 2, z + prof - 0.2); g.add(o); }
    // gaveta de dinheiro e teclado
    // gaveta de dinheiro: painel frontal abaixo do tampo (não fica na frente das mãos)
    const gaveta = caixa(e, 0.5, 0.1, 0.03, '#3a3a3a'); gaveta.position.set(x + 0.15, hb - 0.12, z + 0.45); g.add(gaveta);
    const puxadorG = caixa(e, 0.12, 0.02, 0.03, '#c9c9c9'); puxadorG.position.set(x + 0.15, hb - 0.12, z + 0.47); g.add(puxadorG);
    const papel = caixa(e, 0.3, 0.008, 0.2, '#f5f1e4'); papel.position.set(x + 0.62, hb + 0.004, z - 0.1); papel.rotation.y = 0.2; g.add(papel);
    return { grupo: g, atualizar() {}, pontoOlhar: new THREE.Vector3(x, hb + 0.6, z - 0.07) };
  },

  bilhete(def, ctx) {
    const e = ctx.estilo;
    const g = new THREE.Group();
    const tex = texturaTexto({ largura: 256, altura: 192, fundo: def.cor || '#ffe066', cor: '#2a2a2a', linhas: def.texto || ['AVISO'], fonte: def.manuscrito ? 'italic 700 34px Nunito, sans-serif' : 'bold 30px Anton, sans-serif', entrelinha: 1.2,
      desenharExtra: (c, w, h) => { c.strokeStyle = 'rgba(0,0,0,0.12)'; c.lineWidth = 2; for (let y = 40; y < h; y += 40) { c.beginPath(); c.moveTo(16, y); c.lineTo(w - 16, y); c.stroke(); } c.fillStyle = 'rgba(255,255,255,0.55)'; c.fillRect(w / 2 - 36, -4, 72, 22); } });
    const p = planoTextura(e, 0.22, 0.165, tex); p.position.set(def.pos[0], def.pos[1], def.pos[2]); p.rotation.z = -0.06; g.add(p);
    return { grupo: g, atualizar() {}, pontoOlhar: new THREE.Vector3(def.pos[0], def.pos[1], def.pos[2]) };
  },

  telefone_fixo(def, ctx) {
    const e = ctx.estilo;
    const g = new THREE.Group();
    const cor = def.cor || '#1f4e5f';
    const base = caixa(e, 0.22, 0.07, 0.18, cor); base.position.set(def.pos[0], def.pos[1] + 0.035, def.pos[2]); g.add(base);
    const teclas = caixa(e, 0.12, 0.01, 0.09, '#e8e8e8'); teclas.position.set(def.pos[0] + 0.03, def.pos[1] + 0.075, def.pos[2] + 0.02); g.add(teclas);
    const fone = new THREE.Group();
    const corpoF = caixa(e, 0.05, 0.04, 0.2, escurecer(cor, 0.8)); fone.add(corpoF);
    const pontaA = caixa(e, 0.06, 0.05, 0.05, escurecer(cor, 0.8)); pontaA.position.z = -0.09; fone.add(pontaA);
    const pontaB = pontaA.clone(); pontaB.position.z = 0.09; fone.add(pontaB);
    fone.position.set(def.pos[0] - 0.07, def.pos[1] + 0.1, def.pos[2]); g.add(fone);
    const fio = cilindro(e, 0.006, 0.006, 0.12, '#222'); fio.position.set(def.pos[0] - 0.12, def.pos[1] + 0.06, def.pos[2] + 0.08); fio.rotation.z = 0.5; g.add(fio);
    return {
      grupo: g, fone,
      atualizar(est, t) {
        const s = est?.estado || 'parado';
        fone.visible = s !== 'na_mao';
        if (s === 'tocando') { fone.position.y = def.pos[1] + 0.1 + Math.abs(Math.sin(t * 40)) * 0.006; fone.rotation.z = Math.sin(t * 40) * 0.03; }
        else { fone.position.y = def.pos[1] + 0.1; fone.rotation.z = 0; }
      },
      pontoOlhar: new THREE.Vector3(def.pos[0], def.pos[1] + 0.06, def.pos[2]),
    };
  },

  bloco_passagens(def, ctx) {
    const e = ctx.estilo;
    const g = new THREE.Group();
    const tex = texturaTexto({ largura: 256, altura: 160, fundo: def.cor || '#ffe066', cor: '#333', linhas: ['PASSAGEM', 'BOA VISTA DO SUL', '____  ____'], fonte: 'bold 22px Nunito, sans-serif', borda: { cor: '#7a6a2a', espessura: 6 } });
    const bloco = caixa(e, 0.16, 0.03, 0.1, escurecer(def.cor || '#ffe066', 0.9)); bloco.position.set(def.pos[0], def.pos[1] + 0.015, def.pos[2]); g.add(bloco);
    const capa = planoTextura(e, 0.16, 0.1, tex); capa.rotation.x = -Math.PI / 2; capa.position.set(def.pos[0], def.pos[1] + 0.031, def.pos[2]); g.add(capa);
    return { grupo: g, atualizar() {}, pontoOlhar: new THREE.Vector3(def.pos[0], def.pos[1] + 0.03, def.pos[2]) };
  },

  caneca(def, ctx) {
    const e = ctx.estilo; const g = new THREE.Group();
    const c = cilindro(e, 0.04, 0.035, 0.09, def.cor || '#d9772b'); c.position.set(def.pos[0], def.pos[1] + 0.045, def.pos[2]); g.add(c);
    const alca = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.006, 6, 10), e.material(def.cor || '#d9772b')); alca.position.set(def.pos[0] + 0.045, def.pos[1] + 0.045, def.pos[2]); g.add(alca);
    const cafe = new THREE.Mesh(new THREE.CircleGeometry(0.033, 10), e.material('#3b2416')); cafe.rotation.x = -Math.PI / 2; cafe.position.set(def.pos[0], def.pos[1] + 0.085, def.pos[2]); g.add(cafe);
    return { grupo: g, atualizar() {} };
  },

  lampada(def, ctx) {
    const e = ctx.estilo; const g = new THREE.Group();
    const q = def.quantidade || 1;
    const luzes = [];
    const tubos = [];
    for (let i = 0; i < q; i++) {
      const dz = (i - (q - 1) / 2) * 3.2;
      const cal = caixa(e, 1.2, 0.08, 0.3, '#cfcfcf'); cal.position.set(def.pos[0], def.pos[1] - 0.04, def.pos[2] + dz); g.add(cal);
      const tubo = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.04, 0.12), new THREE.MeshBasicMaterial({ color: '#fff7dc' })); tubo.position.set(def.pos[0], def.pos[1] - 0.09, def.pos[2] + dz); g.add(tubo); tubos.push(tubo);
      const luz = new THREE.PointLight('#fff1cc', 1.0, 9, 1.2); luz.position.set(def.pos[0], def.pos[1] - 0.4, def.pos[2] + dz); g.add(luz); luzes.push(luz);
    }
    const rnd = mulberry32(sementeDeTexto(def.id));
    const padraoPisca = Array.from({ length: 24 }, () => rnd() < 0.3 ? 0.15 : 1);
    return {
      grupo: g, luzes,
      atualizar(est, t, q) {
        const s = est?.estado || 'normal';
        let fator = s === 'apagada' ? 0 : s === 'fraca' ? 0.42 : s === 'piscar' ? padraoPisca[Math.floor(t * 9) % padraoPisca.length] : 1;
        fator *= q.luz;
        for (const l of luzes) l.intensity = (def.intensidade || 1.0) * fator * 1.5;
        for (const tb of tubos) tb.material.color.set(fator > 0.3 ? '#fff7dc' : fator > 0.05 ? '#8a8470' : '#3a3a3a');
      },
    };
  },

  placa(def, ctx) {
    const e = ctx.estilo; const g = new THREE.Group();
    const [w, h] = def.tamanho || [1, 0.3];
    const tex = texturaTexto({ largura: Math.round(w * 400), altura: Math.round(h * 400), fundo: def.cor || '#1f4e5f', cor: def.cor_texto || '#fff', linhas: def.texto || [''], fonte: `bold ${Math.round(h * 400 * 0.5)}px Anton, sans-serif`, borda: { cor: escurecer(def.cor || '#1f4e5f', 0.6), espessura: 8 } });
    const p = planoTextura(e, w, h, tex); p.position.set(def.pos[0], def.pos[1], def.pos[2]); g.add(p);
    const fundo = caixa(e, w + 0.04, h + 0.04, 0.03, escurecer(def.cor || '#1f4e5f', 0.6)); fundo.position.set(def.pos[0], def.pos[1], def.pos[2] - 0.02); g.add(fundo);
    return { grupo: g, atualizar() {}, pontoOlhar: new THREE.Vector3(def.pos[0], def.pos[1], def.pos[2]) };
  },

  // Painel de partidas em LED: a "cor que conta a história".
  painel(def, ctx) {
    const e = ctx.estilo; const g = new THREE.Group();
    const [w, h] = def.tamanho || [3.6, 1.1];
    const corpo = caixa(e, w + 0.16, h + 0.16, 0.14, def.cor || '#141414'); corpo.position.set(def.pos[0], def.pos[1], def.pos[2] - 0.08); g.add(corpo);
    const L = 1024, A = Math.round(L * h / w);
    const tex = texturaTexto({ largura: L, altura: A, fundo: '#0a0a0a', linhas: [] });
    const tela = planoTextura(e, w, h, tex, true); tela.position.set(def.pos[0], def.pos[1], def.pos[2]); g.add(tela);
    const luz = new THREE.PointLight(def.cor_led || '#ffb000', 0.6, 6, 1.5); luz.position.set(def.pos[0], def.pos[1] - 0.3, def.pos[2] + 0.8); g.add(luz);
    let chave = '';
    const ctxT = tex._ctx;
    const rnd = mulberry32(sementeDeTexto(def.id) + 3);
    const ruido = Array.from({ length: 64 }, () => rnd());
    const cores = ctx.cores;
    return {
      grupo: g, luzes: [luz],
      atualizar(est, t) {
        const estado = est?.estado || 'normal';
        const linhas = est?.texto || def.texto || [];
        const passo = Math.floor(t * (estado === 'alerta' ? 3 : estado === 'alerta_forte' ? 1.6 : 0.5));
        const k = estado + '|' + linhas.join('|') + '|' + passo;
        if (k === chave) return; chave = k;
        ctxT.fillStyle = '#0a0a0a'; ctxT.fillRect(0, 0, L, A);
        // cabeçalho
        ctxT.fillStyle = '#1c1c1c'; ctxT.fillRect(0, 0, L, A * 0.16);
        ctxT.font = `bold ${Math.round(A * 0.1)}px monospace`; ctxT.textBaseline = 'middle'; ctxT.textAlign = 'left';
        ctxT.fillStyle = '#777'; ctxT.fillText('PARTIDAS', 24, A * 0.08); ctxT.textAlign = 'right'; ctxT.fillText('PLATAFORMA', L - 24, A * 0.08); ctxT.textAlign = 'left';
        const corNormal = def.cor_led || '#ffb000';
        const corForte = cores.alerta_forte || '#b3261e';
        const n = Math.max(1, linhas.length);
        const alturaLinha = (A * 0.84) / Math.max(4, n);
        ctxT.font = `bold ${Math.round(alturaLinha * 0.78)}px monospace`;
        linhas.forEach((ln, i) => {
          const estranha = /PLAT 7|· ·|SEM DESTINO|\?\?/.test(ln);
          let cor = corNormal;
          let visivel = true;
          if (estado === 'apagado') visivel = false;
          else if (estado === 'alerta' && estranha) { visivel = (passo % 2 === 0); cor = corNormal; }
          else if (estado === 'alerta_forte') { cor = estranha ? corForte : escurecer(corNormal, 0.55); if (estranha) visivel = (passo % 3 !== 2); }
          if (!visivel) return;
          const y = A * 0.16 + alturaLinha * (i + 0.5);
          ctxT.fillStyle = cor;
          ctxT.fillText(ln, 28, y);
          // "leds" queimados: pequenos pontos apagados (vida)
          ctxT.fillStyle = '#0a0a0a';
          for (let j = 0; j < 3; j++) { const rx = ruido[(i * 7 + j * 3) % 64] * L, ry = y - alturaLinha * 0.3 + ruido[(i * 5 + j) % 64] * alturaLinha * 0.6; ctxT.fillRect(rx, ry, 3, 3); }
        });
        tex.needsUpdate = true;
        luz.color.set(estado === 'alerta_forte' ? corForte : corNormal);
        luz.intensity = estado === 'apagado' ? 0 : estado === 'alerta_forte' ? 1.6 : 0.6;
      },
      pontoOlhar: new THREE.Vector3(def.pos[0], def.pos[1], def.pos[2]),
    };
  },

  porta(def, ctx) {
    const e = ctx.estilo; const g = new THREE.Group();
    const [w, h] = def.tamanho || [1.8, 2.4];
    const cor = def.cor || '#1f4e5f';
    const z = def.pos[2];
    // batente
    const bat = caixa(e, w + 0.3, 0.15, 0.3, escurecer(cor, 0.7)); bat.position.set(def.pos[0], h + 0.075, z); g.add(bat);
    const batE = caixa(e, 0.15, h, 0.3, escurecer(cor, 0.7)); batE.position.set(def.pos[0] - w / 2 - 0.075, h / 2, z); g.add(batE);
    const batD = batE.clone(); batD.position.x = def.pos[0] + w / 2 + 0.075; g.add(batD);
    // duas folhas que giram
    const folhas = [];
    for (const lado of [-1, 1]) {
      const pivo = new THREE.Group(); pivo.position.set(def.pos[0] + lado * w / 2, 0, z);
      const folha = caixa(e, w / 2, h, 0.08, cor); folha.position.set(-lado * w / 4, h / 2, 0); pivo.add(folha);
      if (def.vidro !== false) { const janela = new THREE.Mesh(new THREE.PlaneGeometry(w / 2 - 0.2, h * 0.45), new THREE.MeshBasicMaterial({ color: '#0f1a24', transparent: true, opacity: 0.55, depthWrite: false })); janela.position.set(-lado * w / 4, h * 0.62, 0.045); janela.userData.vidro = true; pivo.add(janela); }
      const puxador = caixa(e, 0.04, 0.3, 0.04, '#c9c9c9'); puxador.position.set(-lado * (w / 2 - 0.12), h / 2, 0.07); pivo.add(puxador);
      g.add(pivo); folhas.push({ pivo, lado });
    }
    const placa = caixa(e, 0.9, 0.22, 0.03, '#2a2a2a'); placa.position.set(def.pos[0], h + 0.3, z + 0.02); g.add(placa);
    const texSaida = texturaTexto({ largura: 256, altura: 64, fundo: null, cor: '#6fe39a', linhas: ['PLATAFORMAS'], fonte: 'bold 30px Anton, sans-serif' });
    const pl = planoTextura(e, 0.86, 0.2, texSaida, true, { transparent: true }); pl.position.set(def.pos[0], h + 0.3, z + 0.04); g.add(pl);
    return {
      grupo: g,
      atualizar(est, t) {
        const aberta = (est?.estado === 'aberta');
        const inicio = est?.inicioEstado || 0;
        const k = aberta ? clamp((t - inicio) / 2.4, 0, 1) : 1 - clamp((t - inicio) / 1.2, 0, 1);
        const ang = (k * k * (3 - 2 * k)) * Math.PI * 0.52;
        for (const f of folhas) f.pivo.rotation.y = -f.lado * ang; // abre para fora (para a plataforma)
      },
      pontoOlhar: new THREE.Vector3(def.pos[0], 1.3, z),
    };
  },

  relogio(def, ctx) {
    const e = ctx.estilo; const g = new THREE.Group();
    const r = def.raio || 0.35;
    const mostrador = new THREE.Mesh(new THREE.CircleGeometry(r, 24), e.luminoso('#f3eee0')); mostrador.position.set(def.pos[0], def.pos[1], def.pos[2] + 0.01); g.add(mostrador);
    const aro = new THREE.Mesh(new THREE.RingGeometry(r, r + 0.04, 24), e.material('#222')); aro.position.set(def.pos[0], def.pos[1], def.pos[2] + 0.012); g.add(aro);
    for (let i = 0; i < 12; i++) { const m = caixa(e, 0.02, i % 3 === 0 ? 0.07 : 0.04, 0.005, '#222'); const a = i / 12 * Math.PI * 2; m.position.set(def.pos[0] + Math.sin(a) * r * 0.85, def.pos[1] + Math.cos(a) * r * 0.85, def.pos[2] + 0.015); m.rotation.z = -a; g.add(m); }
    const pH = new THREE.Group(); const pontH = caixa(e, 0.035, r * 0.55, 0.006, '#222'); pontH.position.y = r * 0.25; pH.add(pontH); pH.position.set(def.pos[0], def.pos[1], def.pos[2] + 0.02); g.add(pH);
    const pM = new THREE.Group(); const pontM = caixa(e, 0.025, r * 0.8, 0.006, '#222'); pontM.position.y = r * 0.38; pM.add(pontM); pM.position.set(def.pos[0], def.pos[1], def.pos[2] + 0.025); g.add(pM);
    return {
      grupo: g,
      atualizar(est, t) {
        const hora = (est?.texto && est.texto[0]) || est?.hora || def.hora || '02:40';
        const [hh, mm] = hora.split(':').map(Number);
        const minutos = mm + t / 60; // o relógio anda de verdade durante o episódio
        pM.rotation.z = -(minutos / 60) * Math.PI * 2;
        pH.rotation.z = -((hh % 12) / 12 + minutos / 720) * Math.PI * 2;
      },
      pontoOlhar: new THREE.Vector3(def.pos[0], def.pos[1], def.pos[2]),
    };
  },

  bancos(def, ctx) {
    const e = ctx.estilo; const g = new THREE.Group();
    const n = def.assentos || 4, fil = def.fileiras || 1, cor = def.cor || '#1f4e5f';
    for (let f = 0; f < fil; f++) {
      const z = def.pos[2] - f * 1.1;
      const viga = caixa(e, n * 0.55 + 0.2, 0.06, 0.08, '#555'); viga.position.set(def.pos[0], 0.42, z); g.add(viga);
      for (const dx of [-n * 0.275 + 0.1, n * 0.275 - 0.1]) { const pe = caixa(e, 0.06, 0.42, 0.5, '#555'); pe.position.set(def.pos[0] + dx, 0.21, z); g.add(pe); }
      for (let i = 0; i < n; i++) {
        const x = def.pos[0] + (i - (n - 1) / 2) * 0.55;
        const assento = caixa(e, 0.48, 0.05, 0.45, cor); assento.position.set(x, 0.47, z); g.add(assento);
        const encosto = caixa(e, 0.48, 0.42, 0.05, cor); encosto.position.set(x, 0.72, z - 0.22); encosto.rotation.x = -0.15; g.add(encosto);
      }
    }
    return { grupo: g, atualizar() {}, pontoOlhar: new THREE.Vector3(def.pos[0], 0.7, def.pos[2]) };
  },

  lanchonete(def, ctx) {
    const e = ctx.estilo; const g = new THREE.Group();
    const [w, h] = def.tamanho || [3.2, 2.6];
    const cor = def.cor || '#d9772b';
    const interior = new THREE.Group();
    // nicho na parede
    const fundo = caixa(e, w, h, 0.06, escurecer(cor, 0.35)); fundo.position.set(0, h / 2, -1.2); interior.add(fundo);
    for (const lado of [-1, 1]) { const par = caixa(e, 0.06, h, 1.2, escurecer(cor, 0.4)); par.position.set(lado * w / 2, h / 2, -0.6); interior.add(par); }
    const tetoN = caixa(e, w, 0.06, 1.2, escurecer(cor, 0.45)); tetoN.position.set(0, h, -0.6); interior.add(tetoN);
    const balcao = caixa(e, w - 0.3, 0.95, 0.5, escurecer(cor, 0.8)); balcao.position.set(0, 0.475, -0.35); interior.add(balcao);
    const vitrine = new THREE.Mesh(new THREE.BoxGeometry(w - 0.6, 0.45, 0.4), new THREE.MeshBasicMaterial({ color: '#dfe9ef', transparent: true, opacity: 0.35, depthWrite: false })); vitrine.position.set(0, 1.2, -0.35); vitrine.userData.vidro = true; interior.add(vitrine);
    const prat = caixa(e, w - 0.6, 0.04, 0.3, escurecer(cor, 0.6)); prat.position.set(0, 1.9, -1.0); interior.add(prat);
    const rnd = mulberry32(sementeDeTexto(def.id));
    for (let i = 0; i < 6; i++) { const o = caixa(e, 0.14, 0.2 + rnd() * 0.15, 0.14, [ctx.cores.c1, '#ffe066', '#f5f1e4', ctx.cores.c3][i % 4]); o.position.set(-w / 2 + 0.5 + i * (w - 1) / 5, 1.92 + o.geometry.parameters.height / 2, -1.0); interior.add(o); }
    const sacola = caixa(e, 0.3, 0.22, 0.2, '#f1e9d2'); sacola.position.set(w / 4, 1.06, -0.35); interior.add(sacola);
    const luzPainel = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.4, 0.3), new THREE.MeshBasicMaterial({ color: '#333' })); luzPainel.position.set(0, h - 0.25, -1.1); interior.add(luzPainel);
    const luz = new THREE.PointLight('#ffd27a', 0, 6, 1.4); luz.position.set(0, h - 0.5, -0.5); interior.add(luz);
    // grade (barras verticais) e letreiro
    for (let i = 0; i <= 12; i++) { const b = caixa(e, 0.03, h, 0.03, '#4a4a4a'); b.position.set(-w / 2 + i * w / 12, h / 2, 0.02); interior.add(b); }
    const barraH = caixa(e, w, 0.04, 0.04, '#4a4a4a'); barraH.position.set(0, h * 0.55, 0.02); interior.add(barraH);
    const tex = texturaTexto({ largura: 768, altura: 160, fundo: cor, cor: '#fff8e6', linhas: def.texto || ['LANCHES'], fonte: 'bold 84px Anton, sans-serif' });
    const letreiro = planoTextura(e, w, h * 0.22, tex); letreiro.position.set(0, h + 0.3, 0.03); interior.add(letreiro);
    interior.position.set(def.pos[0], 0, def.pos[2]);
    g.add(interior);
    const grupoRot = new THREE.Group(); // a rotação do def se aplica no grupo externo (criarProp); aqui só posicionamos
    grupoRot.add(g);
    return {
      grupo: grupoRot, luzes: [luz],
      atualizar(est) {
        const acesa = est?.estado === 'acesa';
        luz.intensity = acesa ? 2.4 : 0;
        luzPainel.material.color.set(acesa ? '#fff0b8' : '#333');
      },
      pontoOlhar: new THREE.Vector3(def.pos[0], 1.5, def.pos[2]),
    };
  },

  mural(def, ctx) {
    const e = ctx.estilo; const g = new THREE.Group();
    const [w, h] = def.tamanho || [2, 1.3];
    const quadro = caixa(e, w, h, 0.05, def.cor || '#6b4a2b'); quadro.position.set(0, 0, 0); g.add(quadro);
    const rnd = mulberry32(sementeDeTexto(def.id));
    const cores = ['#f5f1e4', '#ffe066', '#cfe3f5', '#f7c6c6', '#dff0d0'];
    for (let i = 0; i < (def.papeis || 6); i++) {
      const pw = 0.25 + rnd() * 0.2, ph = 0.3 + rnd() * 0.2;
      const p = caixa(e, pw, ph, 0.01, cores[i % cores.length]); p.position.set((rnd() - 0.5) * (w - 0.5), (rnd() - 0.5) * (h - 0.5), 0.03); p.rotation.z = (rnd() - 0.5) * 0.3; g.add(p);
      for (let j = 0; j < 3; j++) { const linha = caixa(e, pw * 0.7, 0.012, 0.004, '#6a6a6a'); linha.position.set(0, ph * 0.3 - j * ph * 0.22, 0.008); p.add(linha); }
    }
    g.position.set(def.pos[0], def.pos[1], def.pos[2]);
    const ext = new THREE.Group(); ext.add(g);
    // a rotação do def gira em torno da posição: aplicamos ao grupo interno
    ext.position.set(0, 0, 0);
    return { grupo: rotacionarEmTorno(ext, g, def), atualizar() {}, pontoOlhar: new THREE.Vector3(def.pos[0], def.pos[1], def.pos[2]) };
  },

  alto_falante(def, ctx) {
    const e = ctx.estilo; const g = new THREE.Group();
    const corpo = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.3, 10, 1, true), e.material(def.cor || '#777', { side: THREE.DoubleSide })); corpo.position.set(def.pos[0], def.pos[1] - 0.2, def.pos[2]); corpo.rotation.x = -0.5; g.add(corpo);
    const suporte = caixa(e, 0.05, 0.12, 0.05, '#555'); suporte.position.set(def.pos[0], def.pos[1] - 0.06, def.pos[2]); g.add(suporte);
    const grade = new THREE.Mesh(new THREE.CircleGeometry(0.15, 10), e.material('#333')); grade.position.set(def.pos[0], def.pos[1] - 0.33, def.pos[2] + 0.08); grade.rotation.x = -Math.PI / 2 + 0.5; g.add(grade);
    return { grupo: g, atualizar() {}, pontoOlhar: new THREE.Vector3(def.pos[0], def.pos[1] - 0.25, def.pos[2]) };
  },

  ventilador_teto(def, ctx) {
    const e = ctx.estilo; const g = new THREE.Group();
    const haste = cilindro(e, 0.03, 0.03, 0.4, '#555'); haste.position.set(def.pos[0], def.pos[1] - 0.2, def.pos[2]); g.add(haste);
    const rotor = new THREE.Group(); rotor.position.set(def.pos[0], def.pos[1] - 0.42, def.pos[2]);
    const cubo = cilindro(e, 0.12, 0.12, 0.1, '#444'); rotor.add(cubo);
    for (let i = 0; i < 3; i++) { const pa = caixa(e, 0.14, 0.015, 0.7, def.cor || '#d8d0b8'); pa.position.z = 0.42; const pivo = new THREE.Group(); pivo.rotation.y = i * Math.PI * 2 / 3; pivo.add(pa); rotor.add(pivo); }
    g.add(rotor);
    return { grupo: g, atualizar(est, t) { rotor.rotation.y = est?.estado === 'parado' ? 0 : t * 2.4; } };
  },

  bebedouro(def, ctx) {
    const e = ctx.estilo; const g = new THREE.Group();
    const corpo = caixa(e, 0.4, 1.0, 0.4, def.cor || '#bcd8e6'); corpo.position.set(def.pos[0], 0.5, def.pos[2]); g.add(corpo);
    const topo = caixa(e, 0.42, 0.08, 0.42, '#555'); topo.position.set(def.pos[0], 1.04, def.pos[2]); g.add(topo);
    const torneira = cilindro(e, 0.015, 0.015, 0.12, '#888'); torneira.position.set(def.pos[0] + 0.1, 1.14, def.pos[2]); g.add(torneira);
    return { grupo: g, atualizar() {} };
  },

  lixeira(def, ctx) {
    const e = ctx.estilo; const g = new THREE.Group();
    const c = cilindro(e, 0.22, 0.18, 0.7, def.cor || '#1f4e5f'); c.position.set(def.pos[0], 0.35, def.pos[2]); g.add(c);
    const tampa = cilindro(e, 0.24, 0.24, 0.05, escurecer(def.cor || '#1f4e5f', 0.7)); tampa.position.set(def.pos[0], 0.72, def.pos[2]); g.add(tampa);
    const papel = esfera(e, 0.05, '#f5f1e4', 6); papel.position.set(def.pos[0] + 0.3, 0.05, def.pos[2] + 0.2); g.add(papel);
    return { grupo: g, atualizar() {} };
  },

  planta(def, ctx) {
    const e = ctx.estilo; const g = new THREE.Group();
    const vaso = cilindro(e, 0.22, 0.17, 0.4, '#8a5a3a'); vaso.position.set(def.pos[0], 0.2, def.pos[2]); g.add(vaso);
    const rnd = mulberry32(sementeDeTexto(def.id));
    for (let i = 0; i < 6; i++) { const f = esfera(e, 0.14 + rnd() * 0.1, def.cor || '#4f7a3a', 8); f.position.set(def.pos[0] + (rnd() - 0.5) * 0.4, 0.55 + rnd() * 0.5, def.pos[2] + (rnd() - 0.5) * 0.4); g.add(f); }
    return { grupo: g, atualizar() {} };
  },

  extintor(def, ctx) {
    const e = ctx.estilo; const g = new THREE.Group();
    const corpo = cilindro(e, 0.09, 0.09, 0.5, def.cor || '#b3261e'); corpo.position.set(0, 0, 0.12); g.add(corpo);
    const topo = cilindro(e, 0.03, 0.03, 0.1, '#333'); topo.position.set(0, 0.3, 0.12); g.add(topo);
    const placa = caixa(e, 0.25, 0.25, 0.01, '#fff'); placa.position.set(0, 0.55, 0.01); g.add(placa);
    const tex = texturaTexto({ largura: 128, altura: 128, fundo: '#fff', cor: '#b3261e', linhas: ['EXT'], fonte: 'bold 48px Anton, sans-serif' });
    const p = planoTextura(e, 0.22, 0.22, tex); p.position.set(0, 0.55, 0.02); g.add(p);
    g.position.set(def.pos[0], def.pos[1], def.pos[2]);
    return { grupo: g, atualizar() {} };
  },

  // Ônibus das 3h: visto pela porta. Janelas embaçadas e acesas; nunca se vê motorista.
  onibus(def, ctx) {
    const e = ctx.estilo; const g = new THREE.Group();
    const corpo = new THREE.Group();
    const cor = def.cor || '#8a8f99', det = def.cor_detalhe || '#1f4e5f';
    const compr = 10, alt = 3.0, larg = 2.5;
    const casco = caixa(e, compr, alt, larg, cor); casco.position.set(0, 0.6 + alt / 2, 0); corpo.add(casco);
    const faixa = caixa(e, compr + 0.02, 0.5, larg + 0.02, det); faixa.position.set(0, 1.2, 0); corpo.add(faixa);
    const janelas = [];
    for (let i = 0; i < 6; i++) {
      const j = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.0), new THREE.MeshBasicMaterial({ color: '#2a2f38' }));
      j.position.set(-compr / 2 + 1.2 + i * 1.45, 2.4, larg / 2 + 0.011); corpo.add(j); janelas.push(j);
    }
    const porta = caixa(e, 0.9, 2.1, 0.08, escurecer(cor, 0.7)); porta.position.set(compr / 2 - 1.0, 1.7, larg / 2 + 0.02); corpo.add(porta);
    const parabrisa = new THREE.Mesh(new THREE.PlaneGeometry(larg - 0.3, 1.4), new THREE.MeshBasicMaterial({ color: '#2a2f38' })); parabrisa.position.set(compr / 2 + 0.011, 2.5, 0); parabrisa.rotation.y = Math.PI / 2; corpo.add(parabrisa);
    const texDestino = texturaTexto({ largura: 512, altura: 128, fundo: '#111', cor: '#ffb000', linhas: def.texto || ['03:00'], fonte: 'bold 90px monospace' });
    const letreiro = planoTextura(e, larg - 0.5, 0.45, texDestino, true); letreiro.position.set(compr / 2 + 0.012, 3.35, 0); letreiro.rotation.y = Math.PI / 2; corpo.add(letreiro);
    const letreiroLado = planoTextura(e, 2.2, 0.5, texDestino, true); letreiroLado.position.set(-def.pos[0], 3.3, larg / 2 + 0.012); corpo.add(letreiroLado); // centrado no vão da porta quando parado
    for (const dx of [-3.2, 3.0]) for (const dz of [-1, 1]) { const roda = cilindro(e, 0.55, 0.55, 0.35, '#222', 14); roda.rotation.x = Math.PI / 2; roda.position.set(dx, 0.55, dz * (larg / 2)); corpo.add(roda); }
    const luzInterna = new THREE.PointLight('#ffe9b0', 0, 8, 1.5); luzInterna.position.set(0, 2.6, larg / 2 + 0.8); corpo.add(luzInterna);
    g.add(corpo); // comprimento ao longo de x, paralelo à plataforma; o lado das janelas (+z) fica virado para a porta
    g.position.set(def.pos[0], 0, def.pos[2]);
    const pos0 = def.pos.slice();
    return {
      grupo: g, luzes: [luzInterna],
      atualizar(est, t) {
        const s = est?.estado || 'ausente';
        const inicio = est?.inicioEstado || 0;
        g.visible = s !== 'ausente';
        if (!g.visible) return;
        let k = 1;
        if (s === 'chegando') { k = clamp((t - inicio) / 3.6, 0, 1); k = 1 - Math.pow(1 - k, 2); }
        const deslocX = (1 - k) * 14; // vem da direita
        g.position.set(pos0[0] + deslocX, 0, pos0[2]);
        const aceso = s !== 'chegando' || k > 0.5;
        for (const j of janelas) j.material.color.set(aceso ? '#f3e7c0' : '#2a2f38');
        parabrisa.material.color.set(aceso ? '#e9dcb5' : '#2a2f38'); // embaçado e claro: não se vê ninguém
        luzInterna.intensity = aceso ? 2.5 : 0;
        porta.visible = s !== 'portas_abertas';
      },
      pontoOlhar: new THREE.Vector3(def.pos[0], 2.0, def.pos[2]),
    };
  },

  exterior(def, ctx) {
    const e = ctx.estilo; const g = new THREE.Group();
    const chao = new THREE.Mesh(new THREE.PlaneGeometry(60, 40), e.material(def.cor_chao || '#3b3a36')); chao.rotation.x = -Math.PI / 2; chao.position.set(def.pos[0], -0.01, def.pos[2] - 10); g.add(chao);
    const ceu = new THREE.Mesh(new THREE.PlaneGeometry(80, 40), e.luminoso(def.cor_ceu || '#0b1420')); ceu.position.set(def.pos[0], 15, def.pos[2] - 28); g.add(ceu);
    // calçada da plataforma colada à parede (z da parede ≈ pos.z + 3), cobertura e colunas fora do vão da porta
    const zParede = def.pos[2] + 3.0;
    const plataforma = caixa(e, 14, 0.25, 2.2, '#55524a'); plataforma.position.set(def.pos[0], 0.12, zParede - 1.0); g.add(plataforma);
    const cobertura = caixa(e, 14, 0.12, 2.6, '#2f3a40'); cobertura.position.set(def.pos[0], 3.4, zParede - 1.1); g.add(cobertura);
    for (const dx of [-4, 4]) { const col = cilindro(e, 0.08, 0.08, 3.3, '#2f3a40'); col.position.set(def.pos[0] + dx, 1.7, zParede - 2.0); g.add(col); }
    const faixaAmarela = caixa(e, 14, 0.01, 0.12, '#ffe066'); faixaAmarela.position.set(def.pos[0], 0.255, zParede - 2.0); g.add(faixaAmarela);
    const luzes = [];
    for (let i = 0; i < (def.postes || 2); i++) {
      const x = def.pos[0] - 6 + i * 12;
      const poste = cilindro(e, 0.06, 0.06, 5, '#444'); poste.position.set(x, 2.5, def.pos[2] - 4); g.add(poste);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), e.luminoso('#ffcf7a')); lamp.position.set(x, 5, def.pos[2] - 4); g.add(lamp);
      const luz = new THREE.PointLight('#ffb866', 1.2, 14, 1.3); luz.position.set(x, 4.8, def.pos[2] - 4); g.add(luz); luzes.push(luz);
    }
    const texPlat = texturaTexto({ largura: 256, altura: 128, fundo: '#1f4e5f', cor: '#ffe066', linhas: ['7'], fonte: 'bold 100px Anton, sans-serif' });
    const placa7 = planoTextura(e, 0.6, 0.3, texPlat, true); placa7.position.set(def.pos[0] + 1.1, 2.9, zParede - 2.1); g.add(placa7);
    return { grupo: g, luzes, atualizar() {}, pontoOlhar: new THREE.Vector3(def.pos[0], 1.5, def.pos[2]) };
  },

  // ---------------------------------------------------------------- genéricos
  caixa(def, ctx) { return caixaGenerica(def, ctx); },
  mesa(def, ctx) {
    const e = ctx.estilo; const g = new THREE.Group(); const [w, h, d] = def.tamanho || [1.2, 0.75, 0.7];
    const tampo = caixa(e, w, 0.05, d, def.cor || '#6b4a2b'); tampo.position.set(def.pos[0], h, def.pos[2]); g.add(tampo);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const p = caixa(e, 0.06, h, 0.06, escurecer(def.cor || '#6b4a2b', 0.8)); p.position.set(def.pos[0] + sx * (w / 2 - 0.05), h / 2, def.pos[2] + sz * (d / 2 - 0.05)); g.add(p); }
    return { grupo: g, atualizar() {} };
  },
  cadeira(def, ctx) {
    const e = ctx.estilo; const g = new THREE.Group(); const cor = def.cor || '#1f4e5f';
    const assento = caixa(e, 0.45, 0.05, 0.45, cor); assento.position.set(def.pos[0], 0.45, def.pos[2]); g.add(assento);
    const encosto = caixa(e, 0.45, 0.45, 0.05, cor); encosto.position.set(def.pos[0], 0.7, def.pos[2] - 0.2); g.add(encosto);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const p = caixa(e, 0.04, 0.45, 0.04, '#555'); p.position.set(def.pos[0] + sx * 0.2, 0.22, def.pos[2] + sz * 0.2); if (def.torta && sx === 1 && sz === 1) p.rotation.z = 0.2; g.add(p); }
    return { grupo: g, atualizar() {} };
  },
  prateleira(def, ctx) {
    const e = ctx.estilo; const g = new THREE.Group(); const [w, h, d] = def.tamanho || [1.2, 1.8, 0.35];
    for (let i = 0; i <= 3; i++) { const p = caixa(e, w, 0.04, d, def.cor || '#6b4a2b'); p.position.set(def.pos[0], (def.pos[1] || 0) + i * h / 3 + 0.02, def.pos[2]); g.add(p); }
    for (const sx of [-1, 1]) { const l = caixa(e, 0.04, h, d, def.cor || '#6b4a2b'); l.position.set(def.pos[0] + sx * w / 2, (def.pos[1] || 0) + h / 2, def.pos[2]); g.add(l); }
    return { grupo: g, atualizar() {} };
  },
  poster(def, ctx) {
    const e = ctx.estilo; const g = new THREE.Group(); const [w, h] = def.tamanho || [0.6, 0.9];
    const tex = texturaTexto({ largura: 256, altura: 384, fundo: def.cor || '#f5f1e4', cor: def.cor_texto || '#1f4e5f', linhas: def.texto || ['FESTA', 'JUNINA'], fonte: 'bold 44px Anton, sans-serif' });
    const p = planoTextura(e, w, h, tex); p.position.set(def.pos[0], def.pos[1], def.pos[2]); g.add(p);
    return { grupo: g, atualizar() {} };
  },
  janela(def, ctx) {
    const e = ctx.estilo; const g = new THREE.Group(); const [w, h] = def.tamanho || [1.2, 1.0];
    const vidro = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: def.cor || '#0f1a24', transparent: true, opacity: 0.8, depthWrite: false })); vidro.position.set(def.pos[0], def.pos[1], def.pos[2]); vidro.userData.vidro = true; g.add(vidro);
    const mold = caixa(e, w + 0.1, h + 0.1, 0.04, '#555'); mold.position.set(def.pos[0], def.pos[1], def.pos[2] - 0.03); g.add(mold);
    return { grupo: g, atualizar() {} };
  },
  carro(def, ctx) {
    const e = ctx.estilo; const g = new THREE.Group(); const cor = def.cor || '#8a8f99';
    const base = caixa(e, 4.2, 0.7, 1.8, cor); base.position.set(0, 0.65, 0); g.add(base);
    const cab = caixa(e, 2.2, 0.6, 1.6, cor); cab.position.set(-0.2, 1.3, 0); g.add(cab);
    for (const dx of [-1.4, 1.4]) for (const dz of [-0.9, 0.9]) { const r = cilindro(e, 0.35, 0.35, 0.25, '#222', 12); r.rotation.x = Math.PI / 2; r.position.set(dx, 0.35, dz); g.add(r); }
    g.position.set(def.pos[0], 0, def.pos[2]);
    return { grupo: g, atualizar(est) { g.visible = (est?.estado || 'parado') !== 'ausente'; } };
  },
  radio(def, ctx) {
    const e = ctx.estilo; const g = new THREE.Group();
    const c = caixa(e, 0.3, 0.16, 0.12, def.cor || '#444'); c.position.set(def.pos[0], (def.pos[1] || 0) + 0.08, def.pos[2]); g.add(c);
    const grade = caixa(e, 0.14, 0.1, 0.01, '#222'); grade.position.set(def.pos[0] - 0.06, (def.pos[1] || 0) + 0.08, def.pos[2] + 0.065); g.add(grade);
    const antena = cilindro(e, 0.005, 0.005, 0.35, '#999'); antena.position.set(def.pos[0] + 0.12, (def.pos[1] || 0) + 0.3, def.pos[2]); g.add(antena);
    return { grupo: g, atualizar() {} };
  },
  computador(def, ctx) {
    const e = ctx.estilo; const g = new THREE.Group();
    const tela = caixa(e, 0.5, 0.35, 0.05, '#d8d0b8'); tela.position.set(def.pos[0], (def.pos[1] || 0) + 0.35, def.pos[2]); g.add(tela);
    const luz = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.28), e.luminoso(def.cor || '#2f7d5a')); luz.position.set(def.pos[0], (def.pos[1] || 0) + 0.35, def.pos[2] + 0.03); g.add(luz);
    const base = caixa(e, 0.2, 0.15, 0.2, '#d8d0b8'); base.position.set(def.pos[0], (def.pos[1] || 0) + 0.08, def.pos[2]); g.add(base);
    return { grupo: g, atualizar() {} };
  },
};

function rotacionarEmTorno(ext, interno, def) {
  // mantém a posição do def como pivô de rotação (a rotação é aplicada em criarProp no grupo externo;
  // por isso o grupo externo recebe a posição e o interno fica na origem)
  interno.position.set(0, 0, 0);
  ext.position.set(def.pos[0], def.pos[1], def.pos[2]);
  return ext;
}

function texturaVidro(furos, fenda, cor) {
  // Vidro quase invisível: fundo transparente, só um leve tom, um reflexo diagonal, os furos e a fenda.
  const c = document.createElement('canvas'); c.width = 1024; c.height = 608;
  const ctx = c.getContext('2d');
  ctx.scale(2, 2);
  ctx.clearRect(0, 0, 512, 304);
  ctx.fillStyle = 'rgba(188,216,230,0.08)'; ctx.fillRect(0, 0, 512, 304);
  ctx.fillStyle = 'rgba(255,255,255,0.16)'; ctx.beginPath(); ctx.moveTo(60, 0); ctx.lineTo(130, 0); ctx.lineTo(30, 304); ctx.lineTo(0, 304); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.beginPath(); ctx.moveTo(420, 0); ctx.lineTo(470, 0); ctx.lineTo(300, 304); ctx.lineTo(270, 304); ctx.fill();
  if (furos) { ctx.fillStyle = 'rgba(20,20,20,0.22)'; const cx = 256, cy = 250; for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) { const x = cx + (i - 3) * 6, y = cy + (j - 3) * 6; if (Math.hypot(i - 3, j - 3) <= 3.2) { ctx.beginPath(); ctx.arc(x, y, 1.0, 0, Math.PI * 2); ctx.fill(); } } }
  if (fenda) { ctx.fillStyle = 'rgba(20,20,20,0.95)'; ctx.fillRect(176, 292, 160, 10); }
  ctx.fillStyle = 'rgba(255,250,220,0.7)'; ctx.fillRect(400, 30, 60, 16); ctx.fillRect(420, 20, 20, 36);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
  return tex;
}

// Pequenos objetos de "vida" sorteados com semente a partir das frases de detalhes_vida.
export function criarDetalhesVida(frases, cenario, ctx) {
  const e = ctx.estilo; const g = new THREE.Group();
  const rnd = mulberry32(ctx.semente + 99);
  const guiche = (cenario.props || []).find(p => p.tipo === 'guiche');
  const balcaoY = guiche ? (guiche.altura_balcao || 1.05) + 0.05 : 1.0;
  const bancos = (cenario.props || []).filter(p => p.tipo === 'bancos');
  for (const frase of frases || []) {
    const f = frase.toLowerCase();
    if (f.includes('copo')) { const c = cilindro(e, 0.035, 0.028, 0.08, '#f5f1e4', 8); c.position.set(0.95 - rnd() * 0.1, balcaoY + 0.03, -0.5); c.rotation.z = 1.2; c.rotation.x = 0.3; g.add(c); }
    else if (f.includes('mancha')) { const m = new THREE.Mesh(new THREE.CircleGeometry(0.35, 10), e.material('#2b2622')); m.rotation.x = -Math.PI / 2; m.position.set(0.8, 0.004, -11.0); m.scale.set(1.4, 0.7, 1); g.add(m); }
    else if (f.includes('cadeira')) { const r = TIPOS.cadeira({ pos: [3.8, 0, -3.2], cor: ctx.cores.c1, torta: true }, ctx); r.grupo.rotation.y = 0.4; g.add(r.grupo); }
    else if (f.includes('chiclete') && bancos[0]) { const b = esfera(e, 0.025, '#f1a7c0', 6); b.position.set(bancos[0].pos[0] + 0.3, 0.44, bancos[0].pos[2] + 0.1); g.add(b); }
    else if (f.includes('guarda-chuva') && bancos[1]) { const u = cilindro(e, 0.03, 0.03, 0.8, '#2a2a2a', 8); u.rotation.z = Math.PI / 2 - 0.15; u.position.set(bancos[1].pos[0] - 0.4, 0.53, bancos[1].pos[2]); g.add(u); }
    else if (f.includes('pôster') || f.includes('poster')) { const r = TIPOS.poster({ pos: [5.93, 2.5, -8.3], tamanho: [0.5, 0.7], texto: ['FESTA', 'DE JUNHO'], cor: '#ffe066' }, ctx); r.grupo.rotation.y = -Math.PI / 2; g.add(r.grupo); }
    else if (f.includes('fita') || f.includes('sacola')) { /* já desenhados no vidro e na lanchonete */ }
    else { const o = caixa(e, 0.1 + rnd() * 0.1, 0.05 + rnd() * 0.1, 0.1, ['#f5f1e4', ctx.cores.c3, ctx.cores.c1][Math.floor(rnd() * 3)]); o.position.set((rnd() - 0.5) * 8, 0.05, -3 - rnd() * 8); g.add(o); }
  }
  return g;
}

export { caixa, cilindro, esfera, planoTextura };
