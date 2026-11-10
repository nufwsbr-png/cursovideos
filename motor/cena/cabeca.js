// A cabeça é a câmera (capítulo 61): giros suaves, leve inclinação, balanço ao andar, tremor que cresce, pancada, fade e aproximação.
import * as THREE from 'three';
import { clamp, lerp, suave, mulberry32, sementeDeTexto } from './util.js';

const EIXO_Y = new THREE.Vector3(0, 1, 0);
const DURACAO_GIRO = 0.6;
// A lente é olho de peixe e não muda com a distância do alvo (como na referência): só a ação aproximar: fecha a abertura.
let FOV_BASE = 115, FOV_APROXIMAR = 65, INCLINACAO_BASE = 0;

export class Cabeca {
  constructor(linha, canal, cenario, resolverAlvo, semente) {
    this.linha = linha; this.canal = canal; this.cenario = cenario; this.resolverAlvo = resolverAlvo;
    this.posBase = new THREE.Vector3(...(cenario.camera_inicial?.pos || [0, 1.25, 0]));
    this.olharInicial = cenario.camera_inicial?.olhar || 'frente';
    const rnd = mulberry32(semente + 17);
    this.fases = Array.from({ length: 6 }, () => rnd() * Math.PI * 2);
    this.cacheOrient = new Map(); this.cachePos = new Map(); this.cacheFov = new Map();
    const lente = canal.estilo?.lente || {};
    FOV_BASE = lente.fov_vertical || 115; FOV_APROXIMAR = lente.aproximar_fov || 65; INCLINACAO_BASE = (lente.inclinacao_base_graus ?? 10) * Math.PI / 180;
  }
  limparCache() { this.cacheOrient.clear(); this.cachePos.clear(); this.cacheFov.clear(); }

  indiceLinha(t) {
    const ls = this.linha.linhas; let i = 0;
    for (let k = 0; k < ls.length; k++) { if (ls[k].inicio_s <= t + 1e-6) i = k; else break; }
    return i;
  }

  // alvo (Vector3 mundo) da linha i no instante t; herda da anterior quando não há olhar nem fala
  alvoDaLinha(i, t) {
    const l = this.linha.linhas[i];
    const d = l.direcao || {};
    let alvoNome = d.olhar;
    if (!alvoNome && l.fala) {
      const f = this.linha.falas.find(x => x.id === l.fala);
      if (f && f.quem !== 'eu') alvoNome = f.quem;
    }
    if (!alvoNome && d.acao && d.acao.startsWith('aproximar:')) alvoNome = d.acao.split(':')[1];
    if (alvoNome) {
      const p = this.resolverAlvo(alvoNome, t, this.posicao(t));
      if (p) return p;
    }
    if (i === 0) return this.resolverAlvo(this.olharInicial, t, this.posicao(t)) || new THREE.Vector3(0, 1.2, -6);
    return this.alvoDaLinha(i - 1, t);
  }

  // posição da câmera (anda em acao andar:<alvo>)
  posicao(t) {
    const i = this.indiceLinha(t);
    const chave = i;
    const l = this.linha.linhas[i];
    const d = l.direcao || {};
    const inicioLinha = i === 0 ? this.posBase.clone() : this._posFimLinha(i - 1);
    if (d.acao && d.acao.startsWith('andar:')) {
      const alvo = this.resolverAlvo(d.acao.split(':')[1], t, inicioLinha);
      if (alvo) {
        const destino = alvo.clone(); destino.y = inicioLinha.y;
        const dir = destino.clone().sub(inicioLinha); const dist = dir.length();
        const parar = Math.max(0, dist - 0.9);
        const k = dist > 0 ? clamp((t - l.inicio_s) * 1.1 / Math.max(parar, 0.001), 0, 1) : 1;
        return inicioLinha.clone().add(dir.normalize().multiplyScalar(parar * suave(k)));
      }
    }
    return inicioLinha;
  }
  _posFimLinha(i) {
    if (this.cachePos.has(i)) return this.cachePos.get(i).clone();
    const l = this.linha.linhas[i];
    const p = this.posicao(Math.max(l.inicio_s, l.fim_s - 0.001));
    this.cachePos.set(i, p.clone());
    return p;
  }

  // orientação (quaternion) suavizada, recursiva: começa onde a linha anterior terminou
  orientacao(t) {
    const i = this.indiceLinha(t);
    const l = this.linha.linhas[i];
    const pos = this.posicao(t);
    const alvo = this.alvoDaLinha(i, t);
    const qAlvo = olharPara(pos, alvo);
    if (i === 0) return { q: qAlvo, k: 1, sinal: 0 };
    const qAntes = this._orientFimLinha(i - 1);
    const k = suave((t - l.inicio_s) / DURACAO_GIRO);
    const q = qAntes.clone().slerp(qAlvo, k);
    // sinal do giro (para a inclinação): compara yaw
    const yawA = yawDe(qAntes), yawB = yawDe(qAlvo);
    let dy = yawB - yawA; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    return { q, k, sinal: Math.abs(dy) > 0.05 ? Math.sign(dy) : 0, dy };
  }
  _orientFimLinha(i) {
    if (this.cacheOrient.has(i)) return this.cacheOrient.get(i).clone();
    const l = this.linha.linhas[i];
    const o = this.orientacao(Math.max(l.inicio_s, l.fim_s - 0.001)).q;
    this.cacheOrient.set(i, o.clone());
    return o;
  }

  fov(t) {
    const i = this.indiceLinha(t);
    const l = this.linha.linhas[i];
    const d = l.direcao || {};
    const fovInicio = i === 0 ? FOV_BASE : this._fovFimLinha(i - 1);
    if (d.acao && d.acao.startsWith('aproximar')) {
      const dur = Math.min(Math.max(l.fim_s - l.inicio_s, 0.5), 6);
      return lerp(fovInicio, FOV_APROXIMAR, suave((t - l.inicio_s) / dur));
    }
    return lerp(fovInicio, FOV_BASE, suave((t - l.inicio_s) / 1.0));
  }
  _fovFimLinha(i) {
    if (this.cacheFov.has(i)) return this.cacheFov.get(i);
    const l = this.linha.linhas[i];
    const f = this.fov(Math.max(l.inicio_s, l.fim_s - 0.001));
    this.cacheFov.set(i, f); return f;
  }

  // aplica tudo na câmera three.js
  aplicar(camera, t, clima, pancadas) {
    const i = this.indiceLinha(t);
    const l = this.linha.linhas[i];
    const d = l.direcao || {};
    const pos = this.posicao(t);
    const { q, k, sinal } = this.orientacao(t);
    camera.position.copy(pos);
    camera.quaternion.copy(q);
    // leve inclinação no giro
    const incl = sinal * Math.sin(Math.PI * k) * 0.035;
    // tremor: clima + ação
    let tremorAcao = 0;
    if (d.acao && d.acao.startsWith('tremor:')) tremorAcao = parseFloat(d.acao.split(':')[1]) || 0;
    const amp = clima.tremor * 0.012 + tremorAcao * 0.02;
    const f = this.fases;
    const tx = amp * (Math.sin(t * 13.1 + f[0]) + 0.5 * Math.sin(t * 23.7 + f[1]));
    const ty = amp * (Math.sin(t * 11.3 + f[2]) + 0.5 * Math.sin(t * 19.9 + f[3]));
    const tz = amp * 0.6 * Math.sin(t * 9.7 + f[4]);
    // balanço ao andar
    let bob = 0, roll = 0;
    if (d.acao && d.acao.startsWith('andar')) { const fase = t * 2 * Math.PI * 1.8; bob = Math.abs(Math.sin(fase)) * 0.03; roll = Math.sin(fase) * 0.012; }
    // pancada
    let px = 0, py = 0;
    for (const tp of pancadas) { const dt = t - tp; if (dt >= 0 && dt < 0.7) { const a = 0.05 * Math.exp(-dt * 6) * Math.sin(dt * 38); px += a; py += a * 0.6; } } // ~6 Hz: legível a 30 fps
    const extra = new THREE.Quaternion().setFromEuler(new THREE.Euler(ty + py, tx + px, incl + tz + roll, 'YXZ'));
    camera.quaternion.multiply(extra);
    camera.position.y += bob;
    camera.fov = this.fov(t);
    camera.updateProjectionMatrix();
    return { linha: l, acao: d.acao || 'parar', tLinha: t - l.inicio_s };
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
