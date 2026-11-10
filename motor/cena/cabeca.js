// A cabeça é a câmera (capítulo 61). Onde ela está vem do plano de câmera (plano_camera.js: sentado/em pé, andando,
// correndo, avançando, transições pelo preto); para onde ela olha vem da direção de cada linha (olhar, quem fala,
// aproximar) ou, andando, da direção do passo. Giros suaves (0,6 s), balanço do passo a 2,9 Hz (medido na referência),
// tremor do clima e pancadas. Na pergunta final a câmera fica parada no último enquadramento. Tudo é função de t.
import * as THREE from 'three';
import { clamp, lerp, suave, mulberry32 } from './util.js';
import { avaliarCamera } from './plano_camera.js';

const EIXO_Y = new THREE.Vector3(0, 1, 0);
const DURACAO_GIRO = 0.6;
let FOV_BASE = 115, FOV_APROXIMAR = 65, INCLINACAO_BASE = 0;

export class Cabeca {
  constructor(linha, canal, plano, resolverAlvo, semente) {
    this.linha = linha; this.canal = canal; this.plano = plano; this.resolverAlvo = resolverAlvo;
    const cen = (canal.cenarios || []).find((c) => c.id === plano?.mundo?.modulos?.[0]?.id) || canal.cenarios?.[0];
    this.olharInicial = (canal.cenarios || []).find((c) => c.id === this.cenarioInicial())?.camera_inicial?.olhar || cen?.camera_inicial?.olhar || 'frente';
    const rnd = mulberry32(semente + 17);
    this.fases = Array.from({ length: 6 }, () => rnd() * Math.PI * 2);
    this.cacheOrient = new Map(); this.cacheFov = new Map(); this.cacheEstado = new Map();
    const lente = canal.estilo?.lente || {};
    FOV_BASE = lente.fov_vertical || 115; FOV_APROXIMAR = lente.aproximar_fov || 65; INCLINACAO_BASE = (lente.inclinacao_base_graus ?? 10) * Math.PI / 180;
    this.balanco = canal.estilo?.camera?.balanco || { frequencia_hz: 2.9, andar: { translacao_m: 0.01, pitch_rad: 0.0015, roll_rad: 0.006 }, correr: { translacao_m: 0.018, pitch_rad: 0.0025, roll_rad: 0.01 } };
    this.perguntaInicio = linha.pergunta?.inicio_s ?? null;
    const pergunta = canal.estilo?.pergunta || {};
    this.aproximarAuto = pergunta.aproximar_auto !== false;
    // linha de antes da pergunta: se não tem avançar/aproximar, a câmera fecha um pouco sozinha (como na referência)
    this.iAntesPergunta = null;
    if (this.perguntaInicio !== null) {
      const ip = linha.linhas.findIndex((l) => Math.abs(l.inicio_s - this.perguntaInicio) < 1e-6);
      if (ip > 0) this.iAntesPergunta = ip - 1;
    }
    const falas = linha.falas || [];
    this.fimUltimaFala = falas.length ? Math.max(...falas.map((f) => f.fim_s)) : 0;
  }
  cenarioInicial() { return this.plano?.mundo?.modulos?.[0]?.id; }
  limparCache() { this.cacheOrient.clear(); this.cacheFov.clear(); this.cacheEstado.clear(); }

  indiceLinha(t) {
    const ls = this.linha.linhas; let i = 0;
    for (let k = 0; k < ls.length; k++) { if (ls[k].inicio_s <= t + 1e-6) i = k; else break; }
    return i;
  }
  emPergunta(t) { return this.perguntaInicio !== null && t >= this.perguntaInicio; }
  tCongelado(t) { return this.emPergunta(t) ? this.perguntaInicio - 1e-3 : t; }

  estado(t) {
    const k = Math.round(t * 1e4);
    if (!this.cacheEstado.has(k)) this.cacheEstado.set(k, avaliarCamera(this.plano, this.linha, t));
    return this.cacheEstado.get(k);
  }

  /** Posição dos olhos (sem balanço). */
  posicao(t) {
    const e = this.estado(this.tCongelado(t));
    return new THREE.Vector3(e.pos[0], (e.piso || 0) + e.olhos + (e.dip || 0), e.pos[2]);
  }

  // alvo (ponto do mundo) da linha i no instante t; herda da anterior quando não há olhar nem fala
  alvoDaLinha(i, t) {
    const l = this.linha.linhas[i];
    const d = l.direcao || {};
    const e = this.estado(t);
    const pos = this.posicao(t);
    // andando: olha na direção do passo, salvo um olhar explícito no trecho final (últimos 2,5 m)
    if (e.olharAdiante && (!d.olhar || d.olhar === 'caminho' || d.olhar === 'frente' || (e.restante_m ?? 0) > 2.5)) {
      return new THREE.Vector3(e.olharAdiante[0], pos.y - 0.25, e.olharAdiante[2]);
    }
    let alvoNome = d.olhar;
    if (alvoNome === 'caminho' || alvoNome === 'frente') return this.frenteDoCorpo(e, pos);
    if (!alvoNome && l.fala) {
      const f = this.linha.falas.find((x) => x.id === l.fala);
      if (f && f.quem !== 'eu') alvoNome = f.quem;
    }
    if (!alvoNome && d.acao && /^(aproximar|avancar):/.test(d.acao)) alvoNome = d.acao.split(':')[1];
    if (alvoNome) {
      const p = this.resolverAlvo(alvoNome, t, pos, e);
      if (p) return p;
    }
    if (i === 0) return this.resolverAlvo(this.olharInicial, t, pos, e) || this.frenteDoCorpo(e, pos);
    // depois de uma transição pelo preto, sem olhar: para a frente do corpo
    if (e.teleportou) return this.frenteDoCorpo(e, pos);
    return this.alvoDaLinha(i - 1, t);
  }
  frenteDoCorpo(e, pos) { return new THREE.Vector3(pos.x - Math.sin(e.yaw) * 4, pos.y - 0.35, pos.z - Math.cos(e.yaw) * 4); }

  // orientação (quaternion) suavizada: começa onde a linha anterior terminou; na volta do preto, corta direto
  orientacao(t) {
    const i = this.indiceLinha(t);
    const l = this.linha.linhas[i];
    const pos = this.posicao(t);
    const alvo = this.alvoDaLinha(i, t);
    const qAlvo = olharPara(pos, alvo);
    const e = this.estado(t);
    if (i === 0 || e.teleportou) return { q: qAlvo, k: 1, sinal: 0 };
    const qAntes = this._orientFimLinha(i - 1);
    const k = suave((t - l.inicio_s) / DURACAO_GIRO);
    const q = qAntes.clone().slerp(qAlvo, k);
    const yawA = yawDe(qAntes), yawB = yawDe(qAlvo);
    let dy = yawB - yawA; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    return { q, k, sinal: Math.abs(dy) > 0.05 ? Math.sign(dy) : 0, dy };
  }
  _orientFimLinha(i) {
    if (this.cacheOrient.has(i)) return this.cacheOrient.get(i).clone();
    const l = this.linha.linhas[i];
    const o = this.orientacao(Math.max(l.inicio_s, (l.fim_s ?? l.inicio_s + 1) - 0.001)).q;
    this.cacheOrient.set(i, o.clone());
    return o;
  }

  fov(t) {
    const i = this.indiceLinha(t);
    const l = this.linha.linhas[i];
    const d = l.direcao || {};
    const fovInicio = i === 0 ? FOV_BASE : this._fovFimLinha(i - 1);
    const fim = l.fim_s ?? l.inicio_s + 3;
    if (d.acao && d.acao.startsWith('aproximar')) {
      const dur = Math.min(Math.max(fim - l.inicio_s, 0.5), 6);
      return lerp(fovInicio, FOV_APROXIMAR, suave((t - l.inicio_s) / dur));
    }
    const e = this.estado(t);
    if (e.fov) return lerp(fovInicio, e.fov.para, e.fov.k);
    if (this.aproximarAuto && i === this.iAntesPergunta) {
      const ini = Math.max(l.inicio_s, this.fimUltimaFala + 0.2);
      return lerp(fovInicio, Math.min(fovInicio, 100), suave((t - ini) / Math.max(0.5, this.perguntaInicio - ini)));
    }
    return lerp(fovInicio, FOV_BASE, suave((t - l.inicio_s) / 1.0));
  }
  _fovFimLinha(i) {
    if (this.cacheFov.has(i)) return this.cacheFov.get(i);
    const l = this.linha.linhas[i];
    const f = this.fov(Math.max(l.inicio_s, (l.fim_s ?? l.inicio_s + 1) - 0.001));
    this.cacheFov.set(i, f); return f;
  }

  // aplica tudo na câmera three.js; devolve o estado do corpo (para as mãos e o resto do motor)
  aplicar(camera, t, clima, pancadas) {
    const tc = this.tCongelado(t);
    const i = this.indiceLinha(tc);
    const l = this.linha.linhas[i];
    const d = l.direcao || {};
    const e = this.estado(tc);
    const pos = this.posicao(tc);
    const { q, k, sinal } = this.orientacao(tc);
    camera.position.copy(pos);
    camera.quaternion.copy(q);
    const congelado = this.emPergunta(t);
    const incl = congelado ? 0 : sinal * Math.sin(Math.PI * k) * 0.035;
    let tremorAcao = 0;
    if (d.acao && d.acao.startsWith('tremor:')) tremorAcao = parseFloat(d.acao.split(':')[1]) || 0;
    const amp = congelado ? 0 : clima.tremor * 0.012 + tremorAcao * 0.02;
    const f = this.fases;
    const tx = amp * (Math.sin(t * 13.1 + f[0]) + 0.5 * Math.sin(t * 23.7 + f[1]));
    const ty = amp * (Math.sin(t * 11.3 + f[2]) + 0.5 * Math.sin(t * 19.9 + f[3]));
    const tz = amp * 0.6 * Math.sin(t * 9.7 + f[4]);
    // balanço do passo: 2,9 Hz na vertical e no pitch, metade disso no roll; proporcional à velocidade
    let bob = 0, pitchB = 0, roll = 0;
    if (!congelado && e.vel > 0.001) {
      const b = (e.tipo === 'correr' ? this.balanco.correr : this.balanco.andar) || {};
      const fi = Math.PI * (this.balanco.frequencia_hz || 2.9) * t;
      bob = (b.translacao_m || 0) * Math.cos(2 * fi) * e.vel;
      pitchB = (b.pitch_rad || 0) * Math.cos(2 * fi) * e.vel;
      roll = (b.roll_rad || 0) * Math.sin(fi) * e.vel;
    }
    let px = 0, py = 0;
    if (!congelado) for (const tp of pancadas) { const dt = t - tp; if (dt >= 0 && dt < 0.7) { const a = 0.05 * Math.exp(-dt * 6) * Math.sin(dt * 38); px += a; py += a * 0.6; } } // ~6 Hz: legível a 30 fps
    const extra = new THREE.Quaternion().setFromEuler(new THREE.Euler(ty + py + pitchB, tx + px, incl + tz + roll, 'YXZ'));
    camera.quaternion.multiply(extra);
    camera.position.y += bob;
    camera.fov = this.fov(tc);
    camera.updateProjectionMatrix();
    return { linha: l, acao: d.acao || 'parar', tLinha: t - l.inicio_s, corpo: { ...e, bob } };
  }
}

function olharPara(pos, alvo) {
  const m = new THREE.Matrix4().lookAt(pos, alvo, EIXO_Y);
  const q = new THREE.Quaternion().setFromRotationMatrix(m);
  if (INCLINACAO_BASE) q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -INCLINACAO_BASE));
  return q;
}
function yawDe(q) {
  const e = new THREE.Euler().setFromQuaternion(q, 'YXZ');
  return e.y;
}
