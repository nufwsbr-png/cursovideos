// O mundo: lugares (módulos) conectados por passagens, com um grafo de caminhos por onde a câmera anda sem atravessar
// parede. JS puro (roda no navegador e no Node): sem three.js aqui.
//
// canal.json:
//   mundos[]   { id, nome, modulos: [ids de cenários], passagens: [{ id, porta, liga: [nó A, nó B], auto }] }
//   cenarios[] { id, mundo, origem: [x,y,z], rot_y_graus (0/90/180/270), piso: [[x0,z0,x1,z1,(y)]...],
//                caminho: { nos: {id: [x,y,z]}, arestas: [[a,b]...], assentos: {id: {yaw_graus}} }, marcas, props, ambiente }
// Coordenadas de cada módulo são locais; mundo = origem + rot_y × local. Ids de nós, marcas e props são únicos no mundo.

const r3 = (v) => Math.round(v * 1000) / 1000;

export function moduloDoMundo(canal, idCenario) {
  const cen = (canal.cenarios || []).find((c) => c.id === idCenario) || (canal.cenarios || [])[0];
  const m = (canal.mundos || []).find((w) => (w.modulos || []).includes(cen?.id));
  return { mundoDef: m || null, cenario: cen };
}

function transformador(cen) {
  const o = cen.origem || [0, 0, 0];
  const ang = ((cen.rot_y_graus || 0) * Math.PI) / 180;
  const c = Math.cos(ang), s = Math.sin(ang);
  return {
    origem: o, rotY: ang,
    ponto: (p) => [o[0] + c * p[0] + s * (p[2] || 0), o[1] + (p[1] || 0), o[2] - s * p[0] + c * (p[2] || 0)],
    retangulo: (r) => {
      const a = [o[0] + c * r[0] + s * r[1], o[2] - s * r[0] + c * r[1]], b = [o[0] + c * r[2] + s * r[3], o[2] - s * r[2] + c * r[3]];
      return { x0: Math.min(a[0], b[0]), z0: Math.min(a[1], b[1]), x1: Math.max(a[0], b[0]), z1: Math.max(a[1], b[1]), y: (r[4] || 0) + o[1] };
    },
  };
}

/** Monta o mundo do cenário inicial de um roteiro (ou do primeiro cenário). Funciona também sem `mundos` (um módulo só). */
export function montarMundo(canal, idCenario) {
  const { mundoDef, cenario } = moduloDoMundo(canal, idCenario);
  const ids = mundoDef ? mundoDef.modulos : [cenario.id];
  const modulos = ids.map((id) => (canal.cenarios || []).find((c) => c.id === id)).filter(Boolean);
  const mundo = { id: mundoDef?.id ?? cenario.id, modulos: [], nos: {}, marcas: {}, props: {}, adj: {}, passagens: [], elevadores: [], pisos: [], avisos: [] };
  for (const cen of modulos) {
    const tf = transformador(cen);
    const mod = { id: cen.id, def: cen, origem: tf.origem, rotY: tf.rotY, pisos: (cen.piso || []).map(tf.retangulo), ambiente: cen.ambiente || null, ver_tambem: cen.ver_tambem || [] };
    if (!mod.pisos.length) mod.pisos.push({ x0: -1e3, z0: -1e3, x1: 1e3, z1: 1e3, y: tf.origem[1] }); // cenário antigo: piso livre
    mundo.modulos.push(mod);
    mundo.pisos.push(...mod.pisos.map((p) => ({ ...p, modulo: cen.id })));
    const assentos = cen.caminho?.assentos || {};
    for (const [id, p] of Object.entries(cen.caminho?.nos || {})) {
      if (mundo.nos[id]) mundo.avisos.push(`nó repetido: ${id}`);
      mundo.nos[id] = { id, pos: tf.ponto(p).map(r3), modulo: cen.id, assento: assentos[id] ? { yaw: ((assentos[id].yaw_graus || 0) * Math.PI) / 180 + tf.rotY } : null };
    }
    for (const [id, p] of Object.entries(cen.marcas || {})) {
      if (mundo.marcas[id]) mundo.avisos.push(`marca repetida: ${id}`);
      mundo.marcas[id] = { id, pos: tf.ponto(p).map(r3), modulo: cen.id };
    }
    for (const def of cen.props || []) {
      if (mundo.props[def.id]) mundo.avisos.push(`prop repetido: ${def.id}`);
      mundo.props[def.id] = { id: def.id, def, modulo: cen.id, pos: tf.ponto(def.pos || [0, 0, 0]).map(r3) };
    }
    for (const [a, b] of cen.caminho?.arestas || []) ligar(mundo, a, b);
  }
  for (const ps of mundoDef?.passagens || []) {
    // elevador: liga dois lugares sem caminho a pé (só se chega pela transição no preto, com camera.ir)
    if (ps.elevador) { mundo.elevadores.push({ ...ps }); continue; }
    const [a, b] = ps.liga;
    ligar(mundo, a, b);
    mundo.passagens.push({ ...ps, auto: ps.auto !== false, pos: ps.porta && mundo.props[ps.porta] ? mundo.props[ps.porta].pos : null });
  }
  return mundo;
}

function ligar(mundo, a, b) {
  (mundo.adj[a] ||= []).push(b);
  (mundo.adj[b] ||= []).push(a);
}

export const distancia = (p, q) => Math.hypot(p[0] - q[0], p[2] - q[2]);

/** Módulo onde está um ponto (x, z): o primeiro cujo piso o contém; senão o mais próximo. */
export function moduloDoPonto(mundo, p) {
  for (const pi of mundo.pisos) if (p[0] >= pi.x0 - 1e-6 && p[0] <= pi.x1 + 1e-6 && p[2] >= pi.z0 - 1e-6 && p[2] <= pi.z1 + 1e-6) return pi.modulo;
  let melhor = null, dm = Infinity;
  for (const pi of mundo.pisos) { const dx = Math.max(pi.x0 - p[0], 0, p[0] - pi.x1), dz = Math.max(pi.z0 - p[2], 0, p[2] - pi.z1); const d = Math.hypot(dx, dz); if (d < dm) { dm = d; melhor = pi.modulo; } }
  return melhor;
}

/** Altura do piso no ponto (plataforma elevada, etc.). */
export function alturaDoPiso(mundo, p) {
  for (const pi of mundo.pisos) if (p[0] >= pi.x0 - 1e-6 && p[0] <= pi.x1 + 1e-6 && p[2] >= pi.z0 - 1e-6 && p[2] <= pi.z1 + 1e-6) return pi.y || 0;
  return 0;
}

export function dentroDoPiso(mundo, p, folga = 0) {
  return mundo.pisos.some((pi) => p[0] >= pi.x0 + folga - 1e-6 && p[0] <= pi.x1 - folga + 1e-6 && p[2] >= pi.z0 + folga - 1e-6 && p[2] <= pi.z1 - folga + 1e-6);
}

/** O segmento a→b fica todo dentro do piso? (amostras a cada `passo` m) */
export function linhaLivre(mundo, a, b, passo = 0.05) {
  const n = Math.max(1, Math.ceil(distancia(a, b) / passo));
  for (let i = 0; i <= n; i++) { const k = i / n; if (!dentroDoPiso(mundo, [a[0] + (b[0] - a[0]) * k, 0, a[2] + (b[2] - a[2]) * k])) return false; }
  return true;
}

/** Menor caminho entre dois nós (Dijkstra; empate decidido por distância e depois pelo id: determinístico). */
export function rota(mundo, de, para) {
  if (!mundo.nos[de] || !mundo.nos[para]) return null;
  const dist = { [de]: 0 }, ant = {}, feitos = new Set();
  for (;;) {
    let u = null;
    for (const k of Object.keys(dist)) if (!feitos.has(k) && (u === null || dist[k] < dist[u] - 1e-9 || (Math.abs(dist[k] - dist[u]) <= 1e-9 && k < u))) u = k;
    if (u === null) return null;
    if (u === para) break;
    feitos.add(u);
    for (const v of (mundo.adj[u] || []).slice().sort()) {
      if (!mundo.nos[v] || feitos.has(v)) continue;
      const d = dist[u] + Math.hypot(mundo.nos[u].pos[0] - mundo.nos[v].pos[0], mundo.nos[u].pos[2] - mundo.nos[v].pos[2], (mundo.nos[u].pos[1] - mundo.nos[v].pos[1]) * 0);
      if (dist[v] === undefined || d < dist[v] - 1e-9) { dist[v] = d; ant[v] = u; }
    }
  }
  const nos = [para]; while (nos[0] !== de) nos.unshift(ant[nos[0]]);
  return { nos, comprimento: dist[para] };
}

/** Nó mais próximo de um ponto (opcional: só de um módulo; opcional: exigindo linha livre). */
export function noMaisProximo(mundo, p, { modulo = null, livre = false } = {}) {
  let melhor = null, dm = Infinity;
  for (const n of Object.values(mundo.nos).sort((a, b) => (a.id < b.id ? -1 : 1))) {
    if (modulo && n.modulo !== modulo) continue;
    const d = distancia(p, n.pos);
    if (d < dm - 1e-9 && (!livre || linhaLivre(mundo, p, n.pos))) { dm = d; melhor = n; }
  }
  return melhor;
}

/** Ponto e módulo de um alvo de movimento: nó, marca ou prop (pelo id). */
export function posicaoDoAlvo(mundo, nome) {
  if (mundo.nos[nome]) return { pos: mundo.nos[nome].pos, modulo: mundo.nos[nome].modulo, no: nome, tipo: 'no' };
  if (mundo.marcas[nome]) return { pos: mundo.marcas[nome].pos, modulo: mundo.marcas[nome].modulo, tipo: 'marca' };
  if (mundo.props[nome]) return { pos: mundo.props[nome].pos, modulo: mundo.props[nome].modulo, tipo: 'prop' };
  return null;
}

/** Módulos visíveis com a câmera em `p`: o dela, os de `ver_tambem` e os vizinhos por passagens abertas (ou sem porta). */
export function visiveis(mundo, p, aberturaDaPorta = () => 0) {
  const atual = moduloDoPonto(mundo, p);
  const vis = new Set([atual]);
  const mod = mundo.modulos.find((m) => m.id === atual);
  for (const v of mod?.ver_tambem || []) vis.add(v);
  for (const ps of mundo.passagens) {
    const [a, b] = ps.liga.map((n) => mundo.nos[n]?.modulo);
    if (a !== atual && b !== atual) continue;
    const outro = a === atual ? b : a;
    if (!ps.porta || aberturaDaPorta(ps.porta) > 0.02) vis.add(outro);
  }
  return vis;
}

/** Erros de construção do mundo (ids, nós e arestas no piso, passagens, grafo conectado). */
export function validarMundo(canal) {
  const erros = [];
  for (const w of canal.mundos || []) {
    const mundo = montarMundo(canal, w.modulos[0]);
    erros.push(...mundo.avisos.map((a) => `${w.id}: ${a}`));
    for (const n of Object.values(mundo.nos)) if (!dentroDoPiso(mundo, n.pos)) erros.push(`${w.id}: nó ${n.id} fora do piso (${n.pos.join(', ')})`);
    const vistos = new Set();
    for (const [a, viz] of Object.entries(mundo.adj)) for (const b of viz) {
      const k = [a, b].sort().join('|'); if (vistos.has(k)) continue; vistos.add(k);
      if (!mundo.nos[a] || !mundo.nos[b]) { erros.push(`${w.id}: aresta ${a}–${b} com nó inexistente`); continue; }
      if (!linhaLivre(mundo, mundo.nos[a].pos, mundo.nos[b].pos)) erros.push(`${w.id}: aresta ${a}–${b} sai do piso (atravessaria parede)`);
    }
    for (const ps of w.passagens || []) {
      if (ps.porta && !mundo.props[ps.porta]) erros.push(`${w.id}: passagem ${ps.id} aponta para a porta ${ps.porta}, que não existe`);
      for (const n of ps.liga) if (!mundo.nos[n]) erros.push(`${w.id}: passagem ${ps.id} liga o nó ${n}, que não existe`);
    }
    const nos = Object.keys(mundo.nos);
    if (nos.length) {
      const alcancados = new Set([nos[0]]); const fila = [nos[0]];
      const vizinhos = (u) => [...(mundo.adj[u] || []), ...mundo.elevadores.flatMap((el) => (el.liga[0] === u ? [el.liga[1]] : el.liga[1] === u ? [el.liga[0]] : []))];
      while (fila.length) { const u = fila.shift(); for (const v of vizinhos(u)) if (!alcancados.has(v)) { alcancados.add(v); fila.push(v); } }
      const soltos = nos.filter((n) => !alcancados.has(n));
      if (soltos.length) erros.push(`${w.id}: nós sem caminho até o resto: ${soltos.join(', ')}`);
    }
  }
  return erros;
}
