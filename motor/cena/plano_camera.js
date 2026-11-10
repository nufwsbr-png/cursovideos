// Plano de câmera: o "corpo" do protagonista ao longo do episódio — postura, onde está, para onde anda, transições
// pelo preto. Calculado uma vez a partir do roteiro e do mundo (função pura, igual no Node e no navegador); avaliado em
// qualquer t a partir da linha do tempo. Nada acumula entre quadros.
//
// Ações (direcao.acao): levantar | sentar | andar:<nó|marca|prop> | correr:<…> | avancar:<alvo> |
//   transicao:preto[:segundos] (com eventos camera.ir=<nó|marca> e camera.postura=sentado|em_pe) | pegar_celular |
//   guardar_celular | (as antigas: trabalhar, parar, segurar:x, aproximar:x, tremor:x, fade, voltar).
import { montarMundo, rota, noMaisProximo, posicaoDoAlvo, moduloDoPonto, alturaDoPiso, dentroDoPiso, linhaLivre, distancia } from './mundo.js';

const r3 = (v) => Math.round(v * 1000) / 1000;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const suave = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const suave2 = (t) => { t = clamp(t, 0, 1); return t * t * t * (t * (t * 6 - 15) + 10); };
const yawDe = (dx, dz) => Math.atan2(-dx, -dz); // yaw 0 = olhando para −z

export const PADRAO_CAMERA = {
  andar: { v: 1.3, aceleracao_s: 0.35, olhar_adiante_m: 1.2 },
  correr: { v: 3.0, aceleracao_s: 0.5, olhar_adiante_m: 2.2 },
  balanco: { frequencia_hz: 2.9, andar: { translacao_m: 0.010, pitch_rad: 0.0015, roll_rad: 0.006 }, correr: { translacao_m: 0.018, pitch_rad: 0.0025, roll_rad: 0.010 } },
  levantar_s: 0.9,
  avancar: { fracao: 0.3, max_m: 1.2, min_dist_m: 0.7, fov: 100, inclinar_sentado_m: 0.2 },
  porta: { aberta_antes_m: 0.85, abrir_min_m: 1.6 },
};

function cfgCamera(canal) {
  const c = canal?.estilo?.camera || {};
  return { ...PADRAO_CAMERA, ...c, andar: { ...PADRAO_CAMERA.andar, ...c.andar }, correr: { ...PADRAO_CAMERA.correr, ...c.correr }, balanco: { ...PADRAO_CAMERA.balanco, ...c.balanco }, avancar: { ...PADRAO_CAMERA.avancar, ...c.avancar }, porta: { ...PADRAO_CAMERA.porta, ...c.porta } };
}

/** Tempo para percorrer L metros com velocidade máxima v e rampas de ta s (trapézio; triângulo se for curto). */
export function duracaoPercurso(L, v, ta) {
  if (L <= 1e-6) return 0;
  return L >= v * ta ? L / v + ta : 2 * Math.sqrt((L * ta) / v);
}
/** Distância percorrida em τ s (mesmo perfil) e a velocidade relativa (0..1). */
export function perfilPercurso(L, v, ta, tau) {
  const T = duracaoPercurso(L, v, ta);
  if (tau <= 0) return { s: 0, vel: 0 };
  if (tau >= T) return { s: L, vel: 0 };
  if (L >= v * ta) {
    const a = v / ta;
    if (tau < ta) return { s: 0.5 * a * tau * tau, vel: tau / ta };
    if (tau > T - ta) { const r = T - tau; return { s: L - 0.5 * a * r * r, vel: r / ta }; }
    return { s: 0.5 * v * ta + v * (tau - ta), vel: 1 };
  }
  const meio = T / 2, a = (2 * L) / (meio * meio * 2); // L/2 = 0.5·a·meio²
  if (tau < meio) return { s: 0.5 * a * tau * tau, vel: (a * tau) / v };
  const r = T - tau; return { s: L - 0.5 * a * r * r, vel: (a * r) / v };
}

/** Caminho denso (amostras a cada 2 cm) por pontos, com cantos arredondados; tabela de comprimento acumulado. */
function caminhoDenso(pontos) {
  const pts = pontos.map((p) => [p[0], p[1] || 0, p[2]]);
  const amostras = [];
  const add = (p) => { if (!amostras.length || distancia(amostras[amostras.length - 1], p) > 1e-4) amostras.push(p); };
  add(pts[0]);
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], c = pts[i + 1];
    if (!c) { add(b); break; }
    const lab = distancia(a, b), lbc = distancia(b, c);
    const r = Math.min(0.45, 0.4 * lab, 0.4 * lbc);
    const p1 = [b[0] + (a[0] - b[0]) * (r / lab), b[1], b[2] + (a[2] - b[2]) * (r / lab)];
    const p2 = [b[0] + (c[0] - b[0]) * (r / lbc), b[1], b[2] + (c[2] - b[2]) * (r / lbc)];
    add(p1);
    for (let k = 1; k <= 8; k++) { const t = k / 8, u = 1 - t; add([u * u * p1[0] + 2 * u * t * b[0] + t * t * p2[0], b[1], u * u * p1[2] + 2 * u * t * b[2] + t * t * p2[2]]); }
    pts[i] = p2; // o próximo trecho sai do fim da curva
  }
  // reamostra a cada 2 cm
  const densos = [amostras[0]]; const acum = [0];
  for (let i = 1; i < amostras.length; i++) {
    const a = amostras[i - 1], b = amostras[i], d = distancia(a, b), n = Math.max(1, Math.ceil(d / 0.02));
    for (let k = 1; k <= n; k++) { const t = k / n; densos.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]); acum.push(acum[acum.length - 1] + d / n); }
  }
  return { pts: densos, acum, total: acum[acum.length - 1] };
}
function pontoNoCaminho(cam, s) {
  const { pts, acum, total } = cam;
  s = clamp(s, 0, total);
  let lo = 0, hi = acum.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (acum[m] <= s) lo = m; else hi = m; }
  const d = acum[hi] - acum[lo] || 1, t = (s - acum[lo]) / d;
  const a = pts[lo], b = pts[hi];
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function acaoDe(l) { const a = String(l.direcao?.acao || 'parar'); const i = a.indexOf(':'); return i < 0 ? [a, null] : [a.slice(0, i), a.slice(i + 1)]; }
function eventosCamera(l) {
  const r = {};
  for (const ev of l.direcao?.eventos || []) { const m = /^camera\.(ir|postura)=(.+)$/.exec(ev); if (m) r[m[1]] = m[2]; }
  return r;
}

/**
 * Planeja o corpo/câmera para o roteiro todo. Devolve as linhas com estado inicial/final e os movimentos.
 * Não depende de tempos (só do roteiro e do mundo): a linha do tempo usa `duracoes` para empurrar as falas.
 */
export function planejar(roteiro, canal) {
  const cfg = cfgCamera(canal);
  const mundo = montarMundo(canal, roteiro.cenario);
  const corpo = canal.protagonista?.corpo || {};
  const OLHOS = { sentado: corpo.olhos_sentado ?? (canal.cenarios?.find((c) => c.id === roteiro.cenario)?.camera_inicial?.pos?.[1] ?? 1.48), em_pe: corpo.olhos_em_pe ?? 1.62 };
  const cen = (canal.cenarios || []).find((c) => c.id === roteiro.cenario) || (canal.cenarios || [])[0];
  const ci = cen?.camera_inicial || {};
  const noIni = ci.no && mundo.nos[ci.no] ? mundo.nos[ci.no] : null;
  const posIni = noIni ? noIni.pos : (ci.pos ? [ci.pos[0], 0, ci.pos[2]] : [0, 0, 0]);
  let estado = { pos: posIni.slice(), no: noIni?.id ?? null, postura: ci.postura || (noIni?.assento ? 'sentado' : 'sentado'), yaw: noIni?.assento?.yaw ?? 0, modulo: noIni?.modulo ?? moduloDoPonto(mundo, posIni), celular: false };
  const avisos = [];
  const linhas = [];
  const posicaoDeAlvo = (nome, i) => {
    const a = posicaoDoAlvo(mundo, nome);
    if (a) return a.pos;
    // personagem: a última posição dada pelos eventos até esta linha
    let marca = null;
    for (let k = 0; k <= i; k++) for (const ev of roteiro.linhas[k].direcao?.eventos || []) { const m = new RegExp(`^personagem\\.${nome}\\.(posicao|andar)=(.+)$`).exec(ev); if (m) marca = m[2]; }
    return marca && mundo.marcas[marca] ? mundo.marcas[marca].pos : null;
  };

  for (let i = 0; i < (roteiro.linhas || []).length; i++) {
    const l = roteiro.linhas[i];
    const [nome, arg] = acaoDe(l);
    const ini = { ...estado, pos: estado.pos.slice() };
    const item = { i, tipo: 'nenhum', ini, fim: null, movimento_s: 0, atraso_s: 0 };
    if (nome === 'pegar_celular') estado.celular = true;
    if (nome === 'guardar_celular' || nome === 'trabalhar' || nome === 'segurar') estado.celular = false;
    if (nome === 'levantar' || ((nome === 'andar' || nome === 'correr') && estado.postura === 'sentado')) {
      if (estado.postura === 'sentado') {
        item.levantar = { de: estado.pos.slice(), yaw: estado.yaw };
        const tras = [Math.sin(estado.yaw) * 0.12, 0, Math.cos(estado.yaw) * 0.12]; // um passo para trás (afasta a banqueta)
        estado.pos = [estado.pos[0] + tras[0], estado.pos[1], estado.pos[2] + tras[2]];
        estado.postura = 'em_pe'; estado.no = null;
        item.atraso_s = cfg.levantar_s;
        item.tipo = 'levantar'; item.movimento_s = cfg.levantar_s;
      } else if (nome === 'levantar') avisos.push(`linha ${i}: levantar, mas já está em pé`);
    }
    if (nome === 'sentar') {
      const seat = noMaisProximo(mundo, estado.pos, {});
      if (seat?.assento && distancia(seat.pos, estado.pos) <= 0.6) {
        item.tipo = 'sentar'; item.sentar = { de: estado.pos.slice(), para: seat.pos.slice(), yawDe: estado.yaw, yawPara: seat.assento.yaw };
        estado.pos = seat.pos.slice(); estado.no = seat.id; estado.postura = 'sentado'; estado.yaw = seat.assento.yaw; estado.modulo = seat.modulo;
        item.movimento_s = cfg.levantar_s;
      } else avisos.push(`linha ${i}: sentar longe de um assento`);
    }
    if (nome === 'andar' || nome === 'correr') {
      const alvo = posicaoDoAlvo(mundo, arg);
      if (!alvo) { avisos.push(`linha ${i}: ${nome}:${arg} — alvo não existe no mundo`); }
      else {
        const destino = alvo.no ? mundo.nos[alvo.no] : noMaisProximo(mundo, alvo.pos, { modulo: alvo.modulo });
        // entrada no grafo: o nó atual, ou o nó mais próximo com linha livre a partir de onde a câmera está
        const entrada = estado.no && mundo.nos[estado.no] ? mundo.nos[estado.no] : noMaisProximo(mundo, estado.pos, { livre: true }) || noMaisProximo(mundo, estado.pos, {});
        const r = rota(mundo, entrada.id, destino.id);
        if (!r) avisos.push(`linha ${i}: ${nome}:${arg} — sem caminho de ${entrada.id} até ${destino.id}`);
        else {
          const pontos = [estado.pos, ...r.nos.map((n) => mundo.nos[n].pos)];
          if (distancia(pontos[0], pontos[1]) < 0.05) pontos.splice(1, 1);
          const cam = caminhoDenso(pontos);
          const c = nome === 'correr' ? cfg.correr : cfg.andar;
          const T = duracaoPercurso(cam.total, c.v, c.aceleracao_s);
          // onde o caminho cruza cada porta de passagem (o ponto do caminho mais perto da porta)
          const portas = [];
          for (const ps of mundo.passagens) {
            if (!ps.porta || !ps.pos) continue;
            const ka = r.nos.indexOf(ps.liga[0]), kb = r.nos.indexOf(ps.liga[1]);
            if (ka < 0 || kb < 0 || Math.abs(ka - kb) !== 1) continue;
            let melhor = 0, dm = Infinity;
            for (let k = 0; k < cam.pts.length; k += 2) { const d = distancia(cam.pts[k], ps.pos); if (d < dm) { dm = d; melhor = cam.acum[k]; } }
            portas.push({ porta: ps.porta, s: melhor, auto: ps.auto });
          }
          const modulos = [];
          for (let k = 0; k < cam.pts.length; k += 5) { const m = moduloDoPonto(mundo, cam.pts[k]); if (!modulos.length || modulos[modulos.length - 1].modulo !== m) modulos.push({ s: cam.acum[k], modulo: m }); }
          const ultimo = cam.pts[cam.pts.length - 1], penultimo = cam.pts[Math.max(0, cam.pts.length - 6)];
          item.tipo = item.tipo === 'levantar' ? `levantar+${nome}` : nome;
          item.percurso = { cam, v: c.v, ta: c.aceleracao_s, adiante: c.olhar_adiante_m, duracao_s: T, nos: r.nos, distancia_m: r3(cam.total), portas, modulos, tipo: nome };
          item.movimento_s = (item.atraso_s || 0) + T;
          estado.pos = ultimo.slice(); estado.no = destino.id; estado.modulo = destino.modulo;
          estado.yaw = yawDe(ultimo[0] - penultimo[0], ultimo[2] - penultimo[2]);
          estado.postura = 'em_pe';
        }
      }
    }
    if (nome === 'avancar') {
      const alvo = posicaoDeAlvo(arg, i);
      if (!alvo) avisos.push(`linha ${i}: avancar:${arg} — alvo sem posição conhecida`);
      else {
        const d = distancia(estado.pos, alvo);
        const sentado = estado.postura === 'sentado';
        let dist = sentado ? cfg.avancar.inclinar_sentado_m : Math.min(cfg.avancar.max_m, cfg.avancar.fracao * d, Math.max(0, d - cfg.avancar.min_dist_m));
        const dir = d > 1e-6 ? [(alvo[0] - estado.pos[0]) / d, 0, (alvo[2] - estado.pos[2]) / d] : [0, 0, -1];
        let fimP = [estado.pos[0] + dir[0] * dist, estado.pos[1], estado.pos[2] + dir[2] * dist];
        while (!sentado && dist > 0.05 && !linhaLivre(mundo, estado.pos, fimP)) { dist *= 0.8; fimP = [estado.pos[0] + dir[0] * dist, estado.pos[1], estado.pos[2] + dir[2] * dist]; }
        item.tipo = 'avancar'; item.avancar = { de: estado.pos.slice(), para: fimP, sentado, descer_m: sentado ? 0.05 : 0, fov: cfg.avancar.fov, alvo };
        if (!sentado) { estado.pos = fimP; estado.no = null; }
        estado.yaw = yawDe(dir[0], dir[2]);
      }
    }
    if (nome === 'transicao') {
      const partes = String(arg || 'preto').split(':');
      const tp = canal?.estilo?.transicao?.preto || { saida_s: 0.3, segurar_s: 0.8, entrada_s: 0.4 };
      const total = Number(partes[1]) > 0 ? clamp(Number(partes[1]), 0.9, 3) : tp.saida_s + tp.segurar_s + tp.entrada_s;
      const segurar = Math.max(0.2, total - tp.saida_s - tp.entrada_s);
      const ev = eventosCamera(l);
      item.tipo = 'transicao';
      item.transicao = { tipo: 'preto', saida_s: tp.saida_s, segurar_s: r3(segurar), entrada_s: tp.entrada_s, total_s: r3(tp.saida_s + segurar + tp.entrada_s), t_eventos_rel: r3(tp.saida_s + segurar / 2) };
      if (ev.ir) {
        const a = posicaoDoAlvo(mundo, ev.ir);
        if (!a) avisos.push(`linha ${i}: camera.ir=${ev.ir} — não existe no mundo`);
        else {
          estado.pos = a.pos.slice(); estado.no = a.no ?? null; estado.modulo = a.modulo;
          if (a.no && mundo.nos[a.no].assento) estado.yaw = mundo.nos[a.no].assento.yaw;
          item.transicao.ir = ev.ir;
        }
      }
      if (ev.postura) { estado.postura = ev.postura === 'sentado' ? 'sentado' : 'em_pe'; item.transicao.postura = estado.postura; }
      // olhar na volta do preto: para o alvo da linha (se houver)
      const olhar = l.direcao?.olhar; const po = olhar ? posicaoDeAlvo(olhar, i) : null;
      if (po && distancia(po, estado.pos) > 0.05) estado.yaw = yawDe(po[0] - estado.pos[0], po[2] - estado.pos[2]);
      item.movimento_s = 0;
    }
    item.fim = { ...estado, pos: estado.pos.slice() };
    item.olhos = { ini: OLHOS[ini.postura], fim: OLHOS[estado.postura] };
    linhas.push(item);
  }
  return { mundo, linhas, olhos: OLHOS, cfg, avisos };
}

/** Durações para a linha do tempo (empurram as falas) + ambiente por linha. */
export function planejarDuracoes(roteiro, canal) {
  let plano;
  try { plano = planejar(roteiro, canal); } catch (e) { return { duracoes: [], ambientes: [], avisos: [`plano de câmera falhou: ${e.message}`] }; }
  const duracoes = plano.linhas.map((p) => {
    const d = {};
    if (p.movimento_s > 0 && p.tipo !== 'avancar') {
      d.movimento_s = r3(p.movimento_s);
      if (p.percurso) d.movimento = { tipo: p.percurso.tipo, nos: p.percurso.nos, distancia_m: p.percurso.distancia_m, duracao_s: r3(p.percurso.duracao_s), atraso_s: r3(p.atraso_s || 0), passo_hz: plano.cfg.balanco.frequencia_hz, portas: p.percurso.portas.map((x) => ({ porta: x.porta, s: r3(x.s), t_rel: r3((p.atraso_s || 0) + tempoDeS(p.percurso, x.s)) })), modulos: p.percurso.modulos.map((x) => ({ modulo: x.modulo, t_rel: r3((p.atraso_s || 0) + tempoDeS(p.percurso, x.s)) })) };
      else d.movimento = { tipo: p.tipo, duracao_s: r3(p.movimento_s), atraso_s: 0 };
    }
    if (p.transicao) { d.transicao_s = p.transicao.total_s; d.t_eventos_rel = p.transicao.t_eventos_rel; d.transicao = { ...p.transicao }; }
    return d;
  });
  const ambientes = plano.linhas.map((p) => {
    const mod = plano.mundo.modulos.find((m) => m.id === p.fim.modulo) || plano.mundo.modulos[0];
    return { tipo: mod?.ambiente?.tipo || 'saguao_noite', ganho_db: mod?.ambiente?.ganho_db ?? -26, modulo: mod?.id };
  });
  return { duracoes, ambientes, avisos: plano.avisos };
}

function tempoDeS(percurso, s) {
  // inverte o perfil (busca binária no tempo)
  let lo = 0, hi = percurso.duracao_s;
  for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; if (perfilPercurso(percurso.cam.total, percurso.v, percurso.ta, m).s < s) lo = m; else hi = m; }
  return (lo + hi) / 2;
}

function indiceLinha(linha, t) {
  const ls = linha.linhas; let i = 0;
  for (let k = 0; k < ls.length; k++) { if (ls[k].inicio_s <= t + 1e-6) i = k; else break; }
  return i;
}

/**
 * Câmera/corpo em t: posição dos olhos, yaw do corpo, postura, módulo, velocidade (0..1), fase do passo, ponto para onde
 * olhar quando anda, preto da transição (0..1), fov alvo do avanço, celular na mão.
 */
export function avaliarCamera(plano, linha, t) {
  const i = indiceLinha(linha, t);
  const p = plano.linhas[i];
  const l = linha.linhas[i];
  const ini = l.inicio_s, fimLinha = l.fim_s ?? ini + 3;
  const r = { linha: i, pos: p.ini.pos.slice(), yaw: p.ini.yaw, postura: p.ini.postura, olhos: p.olhos.ini, modulo: p.ini.modulo, vel: 0, tipo: p.tipo, olharAdiante: null, fov: null, preto: 0, celular: p.ini.celular, dip: 0 };
  const tau = t - ini;
  if (p.levantar && tau >= 0) {
    const k = suave2(tau / plano.cfg.levantar_s);
    const de = p.levantar.de, para = p.percurso ? p.percurso.cam.pts[0] : p.fim.pos;
    r.pos = [de[0] + (para[0] - de[0]) * k, de[1], de[2] + (para[2] - de[2]) * k];
    r.olhos = plano.olhos.sentado + (plano.olhos.em_pe - plano.olhos.sentado) * k;
    r.dip = -0.06 * Math.sin(Math.PI * k);
    r.postura = k < 1 ? 'levantando' : 'em_pe';
    if (!p.percurso) return r;
  }
  if (p.sentar) {
    const k = suave2(tau / plano.cfg.levantar_s);
    r.pos = [p.sentar.de[0] + (p.sentar.para[0] - p.sentar.de[0]) * k, 0, p.sentar.de[2] + (p.sentar.para[2] - p.sentar.de[2]) * k];
    r.yaw = p.sentar.yawDe + angDif(p.sentar.yawDe, p.sentar.yawPara) * k;
    r.olhos = plano.olhos.em_pe + (plano.olhos.sentado - plano.olhos.em_pe) * k;
    r.postura = k < 1 ? 'sentando' : 'sentado';
    return r;
  }
  if (p.percurso) {
    const tm = tau - (p.atraso_s || 0);
    if (tm >= 0) {
      const pc = p.percurso;
      const { s, vel } = perfilPercurso(pc.cam.total, pc.v, pc.ta, tm);
      r.pos = pontoNoCaminho(pc.cam, s);
      const ad = pontoNoCaminho(pc.cam, Math.min(pc.cam.total, s + pc.adiante));
      const tras = pontoNoCaminho(pc.cam, Math.max(0, s - 0.05));
      let dx = ad[0] - r.pos[0], dz = ad[2] - r.pos[2];
      if (Math.hypot(dx, dz) < 0.02) { dx = r.pos[0] - tras[0]; dz = r.pos[2] - tras[2]; }
      if (Math.hypot(dx, dz) > 1e-4) r.yaw = yawDe(dx, dz); else r.yaw = p.fim.yaw;
      r.olharAdiante = [r.pos[0] - Math.sin(r.yaw) * 3, null, r.pos[2] - Math.cos(r.yaw) * 3]; // 3 m à frente, na direção do passo
      r.restante_m = pc.cam.total - s;
      r.vel = vel; r.postura = 'em_pe'; r.olhos = plano.olhos.em_pe;
      r.modulo = moduloDoPonto(plano.mundo, r.pos);
      r.tipo = pc.tipo;
    }
    if (tm < 0 && !p.levantar) { r.pos = p.ini.pos.slice(); }
  }
  if (p.avancar) {
    const dur = clamp(fimLinha - ini, 1, 6);
    const k = suave(tau / dur);
    const a = p.avancar;
    r.pos = [a.de[0] + (a.para[0] - a.de[0]) * k, a.de[1], a.de[2] + (a.para[2] - a.de[2]) * k];
    if (a.sentado) { const dir = [a.alvo[0] - a.de[0], a.alvo[2] - a.de[2]]; const n = Math.hypot(dir[0], dir[1]) || 1; r.pos = [a.de[0] + (dir[0] / n) * 0.2 * k, a.de[1], a.de[2] + (dir[1] / n) * 0.2 * k]; r.olhos -= a.descer_m * k; }
    r.fov = { de: null, para: a.fov, k };
  }
  if (p.transicao) {
    const tr = p.transicao;
    const te = tr.t_eventos_rel;
    if (tau < tr.saida_s) r.preto = suave(tau / tr.saida_s);
    else if (tau < tr.saida_s + tr.segurar_s) r.preto = 1;
    else r.preto = 1 - suave((tau - tr.saida_s - tr.segurar_s) / tr.entrada_s);
    if (tau >= te) { r.pos = p.fim.pos.slice(); r.yaw = p.fim.yaw; r.postura = p.fim.postura; r.olhos = plano.olhos[p.fim.postura]; r.modulo = p.fim.modulo; r.teleportou = true; }
  }
  if (r.modulo === undefined || r.modulo === null) r.modulo = moduloDoPonto(plano.mundo, r.pos);
  r.piso = alturaDoPiso(plano.mundo, r.pos);
  return r;
}

function angDif(a, b) { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; }

/** Abertura automática (0..1) de cada porta de passagem em t: abre quando a câmera se aproxima e fica aberta. */
export function aberturaPortas(plano, linha, t) {
  const r = {};
  const cfgP = plano.cfg.porta;
  for (let i = 0; i < plano.linhas.length; i++) {
    const p = plano.linhas[i];
    if (!p.percurso) continue;
    const ini = linha.linhas[i]?.inicio_s; if (ini === undefined || t < ini) continue;
    const pc = p.percurso;
    const tm = t - ini - (p.atraso_s || 0);
    const s = tm <= 0 ? 0 : perfilPercurso(pc.cam.total, pc.v, pc.ta, tm).s;
    const dAbre = Math.max(cfgP.abrir_min_m, cfgP.aberta_antes_m + 0.6 * pc.v);
    for (const x of pc.portas) {
      if (!x.auto) continue;
      const k = suave((s - (x.s - dAbre)) / (dAbre - cfgP.aberta_antes_m));
      r[x.porta] = Math.max(r[x.porta] || 0, k);
    }
  }
  return r;
}
