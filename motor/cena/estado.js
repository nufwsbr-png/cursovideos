// Estado da cena no instante t: reproduz os eventos de todas as linhas até t (sem estado acumulado entre quadros).
import { clamp } from './util.js';

const VELOCIDADE_ANDAR = 1.1; // m/s

// Quem está "limpando" não fica parado no lugar: desliza devagar de um lado para o outro (±0,45 m em 11 s) com uma
// leve ida e volta em profundidade. É função só do tempo desde que a pose começou, com rampa de 1 s no início;
// quando a pose muda, a pessoa fica onde estava (a posição congelada vira a nova posição base).
export const VARRER = { amplitude_x: 0.45, periodo_x: 11, amplitude_z: 0.12, periodo_z: 17, rampa_s: 1.0 };
export function deslocamentoVarrer(tau) {
  if (!(tau > 0)) return { d: [0, 0], v: [0, 0] };
  const w1 = 2 * Math.PI / VARRER.periodo_x, w2 = 2 * Math.PI / VARRER.periodo_z;
  const r = clamp(tau / VARRER.rampa_s, 0, 1), s = r * r * (3 - 2 * r), ds = tau < VARRER.rampa_s ? 6 * r * (1 - r) / VARRER.rampa_s : 0;
  const x = VARRER.amplitude_x * Math.sin(w1 * tau), z = VARRER.amplitude_z * Math.sin(w2 * tau);
  const vx = VARRER.amplitude_x * w1 * Math.cos(w1 * tau), vz = VARRER.amplitude_z * w2 * Math.cos(w2 * tau);
  return { d: [x * s, z * s], v: [vx * s + x * ds, vz * s + z * ds] };
}

export class Estado {
  constructor(canal, roteiro, linha, cenario) {
    this.canal = canal; this.roteiro = roteiro; this.linha = linha; this.cenario = cenario;
    this.marcas = cenario.marcas || {};
  }

  // Posição de uma marca (vetor [x,y,z]).
  marca(nome) {
    const m = this.marcas[nome];
    if (m) return m.slice();
    const prop = (this.cenario.props || []).find(p => p.id === nome);
    if (prop && prop.pos) return [prop.pos[0], 0, prop.pos[2]];
    return [0, 0, -3];
  }

  // Linha ativa em t (índice).
  indiceLinha(t) {
    const ls = this.linha.linhas;
    let i = 0;
    for (let k = 0; k < ls.length; k++) { if (ls[k].inicio_s <= t + 1e-6) i = k; else break; }
    return i;
  }

  // Reproduz eventos até t e devolve o estado completo.
  em(t) {
    const props = {};
    for (const p of (this.cenario.props || [])) props[p.id] = { estado: p.estado || 'normal', texto: p.texto || null, inicioEstado: 0 };
    const personagens = {};
    for (const pe of (this.canal.elenco || [])) {
      personagens[pe.id] = { visivel: false, posicao: this.marca(Object.keys(this.marcas)[0] || 'porta_plataforma'), andar: null, varrer: null, pose: 'em_pe', expressao: 'normal', inicioPose: 0 };
    }
    const celular = { tela: null, inicioTela: 0, notificacao: null, inicioNotificacao: 0 };
    let selo = null;
    const ls = this.linha.linhas;
    const idx = this.indiceLinha(t);
    for (let i = 0; i <= idx; i++) {
      const l = ls[i];
      const t0 = l.inicio_s;
      for (const ev of (l.direcao?.eventos || [])) this._aplicar(ev, t0, props, personagens, celular, (s) => { selo = { texto: s, inicio: t0 }; });
    }
    // posições com andar e com o deslocamento de quem limpa
    for (const id in personagens) {
      const pe = personagens[id];
      if (pe.pose === 'limpando' && pe.andar && !pe.varrer && progressoAndar(pe.andar, t) >= 1) {
        // chegou andando e continua limpando: passa a varrer a partir do ponto de chegada
        const dist = Math.hypot(pe.andar.para[0] - pe.andar.de[0], pe.andar.para[2] - pe.andar.de[2]);
        pe.varrer = { origem: pe.andar.para.slice(), inicio: pe.andar.inicio + dist / VELOCIDADE_ANDAR };
        pe.posicao = pe.andar.para.slice(); pe.andar = null;
      }
      pe.posicaoEm = (tt) => posicaoEm(pe, tt);
      pe.pos = posicaoEm(pe, t);
      pe.andando = !!(pe.andar && progressoAndar(pe.andar, t) < 1);
      pe.direcao = pe.andar ? [pe.andar.para[0] - pe.andar.de[0], pe.andar.para[2] - pe.andar.de[2]] : null;
      pe.varrendo = pe.varrer && !pe.andando ? deslocamentoVarrer(t - pe.varrer.inicio) : null;
    }
    const l = ls[idx];
    return { t, indice: idx, linha: l, props, personagens, celular, selo };
  }

  _aplicar(ev, t0, props, personagens, celular, defSelo) {
    const m = /^([^.=]+)\.(.+?)=(.*)$/.exec(ev);
    if (!m) return;
    const [, alvo, resto, valor] = m;
    if (alvo === 'prop') {
      const [id, campo] = resto.split('.');
      if (!props[id]) props[id] = { estado: 'normal', texto: null, inicioEstado: 0 };
      if (campo === 'estado') { props[id].estado = valor; props[id].inicioEstado = t0; }
      else if (campo === 'texto') props[id].texto = valor.split('|');
      else props[id][campo] = valor;
    } else if (alvo === 'personagem') {
      const [id, campo] = resto.split('.');
      if (!personagens[id]) personagens[id] = { visivel: false, posicao: [0, 0, -5], andar: null, varrer: null, pose: 'em_pe', expressao: 'normal', inicioPose: 0 };
      const pe = personagens[id];
      if (campo === 'visivel') pe.visivel = valor === 'true';
      else if (campo === 'posicao') { pe.posicao = this.marca(valor); pe.andar = null; pe.varrerPausa = null; pe.varrer = pe.pose === 'limpando' ? { origem: pe.posicao.slice(), inicio: t0 } : null; }
      else if (campo === 'pose') {
        if (valor === 'limpando') {
          if (!pe.varrer) {
            // retoma a varredura de onde pausou (mesma origem, mesmo ponto do trajeto), para não derivar a cada retomada
            if (pe.varrerPausa) pe.varrer = { origem: pe.varrerPausa.origem, inicio: t0 - pe.varrerPausa.tau };
            else { pe.posicao = posicaoEm(pe, t0); pe.varrer = { origem: pe.posicao.slice(), inicio: t0 }; }
            pe.andar = null; pe.varrerPausa = null;
          }
        } else if (pe.varrer) { pe.varrerPausa = { origem: pe.varrer.origem, tau: t0 - pe.varrer.inicio }; pe.posicao = posicaoEm(pe, t0); pe.varrer = null; } // fica onde parou de varrer
        pe.pose = valor; pe.inicioPose = t0;
      }
      else if (campo === 'expressao') pe.expressao = valor;
      else if (campo === 'andar') { const de = posicaoEm(pe, t0); pe.varrer = null; pe.varrerPausa = null; pe.andar = { de, para: this.marca(valor), inicio: t0 }; pe.posicao = pe.andar.para; }
    } else if (alvo === 'celular') {
      if (resto === 'tela') { celular.tela = valor === 'null' ? null : Number(valor); celular.inicioTela = t0; }
      else if (resto === 'notificacao') { celular.notificacao = Number(valor); celular.inicioNotificacao = t0; }
    } else if (alvo === 'tela') {
      if (resto === 'selo') defSelo(valor);
    }
  }
}

function progressoAndar(andar, t) {
  const dx = andar.para[0] - andar.de[0], dz = andar.para[2] - andar.de[2];
  const dist = Math.hypot(dx, dz);
  if (dist < 1e-4) return 1;
  return clamp((t - andar.inicio) * VELOCIDADE_ANDAR / dist, 0, 1);
}

function posicaoAndando(pe, t) {
  if (!pe.andar) return pe.posicao.slice();
  const k = progressoAndar(pe.andar, t);
  // suaviza só o começo e o fim para não parecer robô
  const kk = k < 0.1 ? k * k / 0.1 : k > 0.9 ? 1 - (1 - k) * (1 - k) / 0.1 : k;
  return [pe.andar.de[0] + (pe.andar.para[0] - pe.andar.de[0]) * kk, 0, pe.andar.de[2] + (pe.andar.para[2] - pe.andar.de[2]) * kk];
}

// Posição em t considerando andar (prioridade) ou o deslocamento de quem está limpando.
function posicaoEm(pe, t) {
  if (pe.andar) return posicaoAndando(pe, t);
  if (pe.varrer) { const { d } = deslocamentoVarrer(t - pe.varrer.inicio); return [pe.varrer.origem[0] + d[0], 0, pe.varrer.origem[2] + d[1]]; }
  return pe.posicao.slice();
}

export { progressoAndar, posicaoAndando, posicaoEm };
