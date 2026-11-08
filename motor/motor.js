// Motor de vídeos em primeira pessoa. Expõe em window: carregar, renderizarQuadro, capturar, renderizarLote, montarFolha, estatisticasQuadro.
// Regra de ouro: cada quadro depende só de t. Nada acumula entre quadros; aleatório só com semente.
import * as THREE from 'three';
import { Estilo } from './cena/estilo.js';
import { criarProp, criarDetalhesVida } from './cena/props.js';
import { Boneco } from './cena/boneco.js';
import { CorpoPOV } from './cena/corpo_pov.js';
import { Estado } from './cena/estado.js';
import { Cabeca } from './cena/cabeca.js';
import { Sobreposicao, TelaCelular } from './cena/sobreposicao.js';
import { construirLinhaDoTempo, medidasSinteticas, envelopeSintetico } from './cena/linha_previa.js';
import { suave, lerp, misturarCor, hexParaRgb, clamp, sementeDeTexto, formatarTempo } from './cena/util.js';

const M = { pronto: false };
window.__motor = M;

// Variações para o teste dos 3 estilos (capítulo 35 / 57). Cada uma troca traço, paleta, sombra, textura e lente.
const VARIACOES = {
  A: { nome: 'A · xilogravura (traço grosso, papel forte)', traco: { espessura: 0.022, cor: '#14100c', acabamento: 'irregular' }, textura: 'papel', intensidade_textura: 0.34, sombra: { degraus: 2, intensidade: 0.7 },
       mapaCores: { '#1f4e5f': '#17394a', '#efe3c2': '#e4d3a4', '#d9772b': '#b8611f', '#ffb000': '#ffa400' } },
  B: { nome: 'B · gibi antigo (retícula, cores vivas)', traco: { espessura: 0.009, cor: '#101820', acabamento: 'uniforme' }, textura: 'reticula', intensidade_textura: 0.35, sombra: { degraus: 3, intensidade: 0.5 },
       mapaCores: { '#1f4e5f': '#1d5f8a', '#efe3c2': '#f4e9c8', '#d9772b': '#e8832a', '#ffb000': '#ffc300' } },
  C: { nome: 'C · cartaz pintado à mão (chapado, lente suave)', traco: { espessura: 0.013, cor: '#1c1a17', acabamento: 'uniforme' }, textura: 'papel', intensidade_textura: 0.12, sombra: { degraus: 1, intensidade: 0.35 }, lente: { rotina: 0.2, sinal: 0.22, escalada: 0.26, climax: 0.34, pergunta: 0.34 },
       mapaCores: { '#1f4e5f': '#24505c', '#efe3c2': '#f2e6c4', '#d9772b': '#d9772b', '#ffb000': '#ffb000' } },
};

function clonar(o) { return JSON.parse(JSON.stringify(o)); }

function aplicarVariacao(canal, nomeVar) {
  const c = clonar(canal);
  if (!nomeVar || nomeVar === 'cartela') return c;
  const v = VARIACOES[nomeVar] || (typeof nomeVar === 'object' ? nomeVar : null);
  if (!v) return c;
  c.estilo = { ...c.estilo, ...Object.fromEntries(Object.entries(v).filter(([k]) => !['mapaCores', 'nome'].includes(k))) };
  if (v.mapaCores) {
    const mapa = Object.fromEntries(Object.entries(v.mapaCores).map(([a, b]) => [a.toLowerCase(), b]));
    const trocar = (x) => (typeof x === 'string' && mapa[x.toLowerCase()]) ? mapa[x.toLowerCase()] : x;
    const anda = (o) => { if (Array.isArray(o)) return o.map(anda); if (o && typeof o === 'object') { for (const k in o) o[k] = anda(o[k]); return o; } return trocar(o); };
    c.cenarios = anda(c.cenarios); c.elenco = anda(c.elenco); c.protagonista = anda(c.protagonista);
    c.estilo.cores = anda(c.estilo.cores);
  }
  c.estilo._variacao = v.nome || nomeVar;
  return c;
}

window.carregar = async function carregar(canalOriginal, roteiro, linhaDoTempo, medidas, opcoes = {}) {
  await Promise.all([document.fonts.load('48px Anton'), document.fonts.load('30px Nunito'), document.fonts.load('bold 30px Nunito')]);
  await document.fonts.ready;
  const canal = aplicarVariacao(canalOriginal, opcoes.estilo);
  const fps = canal.formato?.fps || 30;
  const escala = opcoes.escala || 1;
  const W = Math.round((canal.formato?.largura || 1080) * escala), H = Math.round((canal.formato?.altura || 1920) * escala);
  Object.assign(M, { canal, roteiro, W, H, escala, fps, avisos: [] });
  M.estiloCfg = canal.estilo || {};
  M.cores = M.estiloCfg.cores || {};
  M.semente = M.estiloCfg.semente ?? 7;
  M.linha = linhaDoTempo || construirLinhaDoTempo(roteiro, medidas, fps);
  if (!linhaDoTempo) M.avisos.push('linha do tempo em modo prévia (derivada do roteiro)');
  M.medidas = medidas ? clonar(medidas) : medidasSinteticas(roteiro, M.linha);
  if (!medidas) M.avisos.push('medidas sintéticas (vozes ainda não medidas)');
  for (const f of M.linha.falas) {
    if (!M.medidas[f.id] || !Array.isArray(M.medidas[f.id].envelope)) {
      M.medidas[f.id] = { ...(M.medidas[f.id] || {}), envelope_passo_s: 0.05, envelope: envelopeSintetico(f.fim_s - f.inicio_s, sementeDeTexto(f.id)), sintetico: true };
    }
  }
  M.cenario = (canal.cenarios || []).find(c => c.id === roteiro.cenario) || canal.cenarios[0];

  // canvases
  M.canvasGL = document.getElementById('gl'); M.canvasFinal = document.getElementById('final');
  M.canvasGL.width = W; M.canvasGL.height = H; M.canvasFinal.width = W; M.canvasFinal.height = H;
  M.ctx = M.canvasFinal.getContext('2d');
  if (M.renderer) { M.renderer.dispose(); }
  M.renderer = new THREE.WebGLRenderer({ canvas: M.canvasGL, antialias: false, preserveDrawingBuffer: true, alpha: false, powerPreference: 'high-performance' });
  M.renderer.setPixelRatio(1); M.renderer.setSize(W, H, false);
  M.renderer.outputColorSpace = THREE.SRGBColorSpace;
  M.renderer.shadowMap.enabled = false;
  const gl = M.renderer.getContext();
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  M.gpu = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);

  // cena
  M.cena = new THREE.Scene();
  M.cena.background = new THREE.Color(M.estiloCfg.traco?.cor || '#101820');
  M.camera = new THREE.PerspectiveCamera(62, W / H, 0.05, 80);
  M.estilo = new Estilo(M.estiloCfg);
  const ctxProps = { estilo: M.estilo, cores: M.cores, semente: M.semente, avisos: M.avisos, canal, cenario: M.cenario };
  M.props = {}; M.luzesProps = [];
  for (const def of (M.cenario.props || [])) {
    const r = criarProp(def, ctxProps);
    M.cena.add(r.grupo); M.props[def.id] = r;
    if (r.luzes) M.luzesProps.push(...r.luzes);
  }
  M.cena.add(criarDetalhesVida(M.cenario.detalhes_vida, M.cenario, ctxProps));
  // luzes gerais
  M.hemi = new THREE.HemisphereLight('#fff4d6', '#3a3428', 1.2); M.cena.add(M.hemi);
  M.dir = new THREE.DirectionalLight('#fff4d6', 1.6); M.dir.position.set(2, 6, 3); M.cena.add(M.dir);
  M.dir2 = new THREE.DirectionalLight('#dfe6ff', 0.5); M.dir2.position.set(-3, 4, -6); M.cena.add(M.dir2);
  // elenco
  M.bonecos = {};
  for (const pe of (canal.elenco || [])) {
    if (!pe.visivel || !pe.visual) continue;
    const b = new Boneco(pe, M.estilo, M.estiloCfg, M.cores);
    M.cena.add(b.grupo); M.bonecos[pe.id] = b;
  }
  // corpo em primeira pessoa e celular
  M.corpo = new CorpoPOV(canal.protagonista || {}, M.estilo, M.cores);
  M.cena.add(M.corpo.grupo);
  M.telaCelular = new TelaCelular(M.estiloCfg.celular, roteiro.celular || [], M.cores);
  M.corpo.definirTexturaCelular(M.telaCelular.textura);
  // estado, cabeça, sobreposição
  M.estado = new Estado(canal, roteiro, M.linha, M.cenario);
  M.cabeca = new Cabeca(M.linha, canal, M.cenario, resolverAlvo, M.semente);
  M.sobre = new Sobreposicao(canal, M.estiloCfg, W, H, escala);
  M.pancadas = [ ...(M.linha.efeitos || []).filter(e => e.tipo === 'pancada').map(e => e.t) ];
  if (M.linha.pergunta && !M.pancadas.some(p => Math.abs(p - M.linha.pergunta.inicio_s) < 0.5)) M.pancadas.push(M.linha.pergunta.inicio_s);
  prepararPos();
  M.pronto = true;
  return { gpu: M.gpu, avisos: M.avisos, duracao_total_s: M.linha.duracao_total_s, fps, previa: !!M.linha.previa, variacao: M.estiloCfg._variacao || 'cartela', linha: M.linha };
};

// ------------------------------------------------------------------ alvos do olhar
function alturaCabeca(id) {
  const b = M.bonecos[id];
  if (!b) return 1.5;
  const m = b.medidas; return m.perna + m.tronco + 0.06 + m.raioCab * b.oval[1];
}
function resolverAlvo(nome, t, posCamera) {
  if (!nome) return null;
  const pc = posCamera || new THREE.Vector3(0, 1.25, 0);
  switch (nome) {
    case 'maos': return new THREE.Vector3(pc.x, 1.03, pc.z - 0.36);
    case 'celular': return new THREE.Vector3(pc.x + 0.06, 1.25, pc.z - 0.22);
    case 'frente': return new THREE.Vector3(pc.x, pc.y - 0.05, pc.z - 6);
    case 'chao': return new THREE.Vector3(pc.x, 0, pc.z - 1.5);
    case 'teto': return new THREE.Vector3(pc.x, 4, pc.z - 2);
  }
  if (M.props[nome]) return M.props[nome].pontoOlhar.clone();
  if (M.bonecos[nome]) {
    const pe = M.estado.em(t).personagens[nome];
    if (pe && pe.visivel) return new THREE.Vector3(pe.pos[0], alturaCabeca(nome) - 0.05, pe.pos[2]);
    return null;
  }
  const marca = M.cenario.marcas?.[nome];
  if (marca) return new THREE.Vector3(marca[0], 1.2, marca[2]);
  if (nome.includes(':')) return resolverAlvo(nome.split(':')[1], t, posCamera);
  return null;
}

// ------------------------------------------------------------------ climas
function climaEm(t) {
  const lista = M.linha.climas || [{ inicio_s: 0, clima: 'rotina' }];
  let i = 0; for (let k = 0; k < lista.length; k++) { if (lista[k].inicio_s <= t) i = k; else break; }
  const atual = lista[i], anterior = lista[i - 1] || atual;
  const cfg = M.estiloCfg.climas || {};
  const pa = cfg[anterior.clima] || cfg.rotina || {}, pb = cfg[atual.clima] || cfg.rotina || {};
  const k = suave((t - atual.inicio_s) / 1.2);
  const lente = M.estiloCfg.lente || {};
  const la = typeof lente === 'number' ? lente : (lente[anterior.clima] ?? 0.3), lb = typeof lente === 'number' ? lente : (lente[atual.clima] ?? 0.3);
  return {
    nome: atual.clima, inicio: atual.inicio_s, k,
    luz: lerp(pa.luz ?? 1, pb.luz ?? 1, k), cor_luz: misturarCor(pa.cor_luz || '#ffffff', pb.cor_luz || '#ffffff', k),
    vinheta: lerp(pa.vinheta ?? 0.15, pb.vinheta ?? 0.15, k), tremor: lerp(pa.tremor ?? 0, pb.tremor ?? 0, k), lente: lerp(la, lb, k),
  };
}

// ------------------------------------------------------------------ boca
function aberturaBoca(quem, t) {
  for (const f of M.linha.falas) {
    if (f.quem !== quem || t < f.inicio_s || t > f.fim_s) continue;
    const m = M.medidas[f.id]; if (!m || !m.envelope) return 0.5;
    const passo = m.envelope_passo_s || 0.05;
    const i = Math.floor((t - f.inicio_s) / passo);
    const e = m.envelope;
    const v = (e[i] ?? 0) * 0.6 + (e[i - 1] ?? 0) * 0.2 + (e[i + 1] ?? 0) * 0.2;
    return v < 0.08 ? 0 : clamp(v, 0, 1); // evita boca abrindo em ruído muito baixo
  }
  return 0;
}
function quemFala(t) {
  const ativos = M.linha.falas.filter(f => t >= f.inicio_s && t <= f.fim_s);
  return ativos.length ? ativos[ativos.length - 1].quem : null;
}

// ------------------------------------------------------------------ pós-processo (traço, lente, textura, vinheta)
function prepararPos() {
  const { W, H } = M;
  if (M.rtCor) { M.rtCor.dispose(); M.rtNorm.dispose(); }
  const depthTexture = new THREE.DepthTexture(W, H); depthTexture.type = THREE.UnsignedIntType;
  M.rtCor = new THREE.WebGLRenderTarget(W, H, { depthTexture, depthBuffer: true, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
  M.rtNorm = new THREE.WebGLRenderTarget(Math.round(W / 2), Math.round(H / 2), { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
  M.matNormal = new THREE.MeshNormalMaterial();
  const traco = M.estiloCfg.traco || {};
  const espessuraPx = Math.max(1, (traco.espessura ?? 0.012) * 1000 * M.escala);
  const [tr, tg, tb] = hexParaRgb(traco.cor || '#101820').map(v => Math.pow(v / 255, 2.2));
  M.uniformes = {
    tCor: { value: M.rtCor.texture }, tProf: { value: depthTexture }, tNorm: { value: M.rtNorm.texture },
    resolucao: { value: new THREE.Vector2(W, H) }, espessura: { value: espessuraPx }, corTraco: { value: new THREE.Vector3(tr, tg, tb) },
    lente: { value: 0.3 }, vinheta: { value: 0.15 }, textura: { value: M.estiloCfg.textura === 'reticula' ? 2 : M.estiloCfg.textura === 'nenhuma' ? 0 : 1 },
    intensidadeTextura: { value: M.estiloCfg.intensidade_textura ?? 0.18 }, corLuz: { value: new THREE.Vector3(1, 1, 1) }, luz: { value: 1 },
    semente: { value: (M.semente % 97) * 0.37 }, perto: { value: M.camera.near }, longe: { value: M.camera.far }, fade: { value: 0 },
    limiarProf: { value: 0.035 }, limiarNorm: { value: 0.3 }, limiarCor: { value: 0.3 }, irregular: { value: traco.acabamento === 'irregular' ? 1 : 0 },
  };
  M.matPos = new THREE.ShaderMaterial({
    uniforms: M.uniformes, depthTest: false, depthWrite: false,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: `
      precision highp float;
      uniform sampler2D tCor, tProf, tNorm; uniform vec2 resolucao; uniform float espessura; uniform vec3 corTraco;
      uniform float lente, vinheta, intensidadeTextura, luz, semente, perto, longe, fade, limiarProf, limiarNorm, limiarCor; uniform int textura; uniform int irregular; uniform vec3 corLuz;
      varying vec2 vUv;
      float linear(float d){ float z = d*2.0-1.0; return (2.0*perto*longe)/(longe+perto - z*(longe-perto)); }
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)) + semente)*43758.5453); }
      void main(){
        float asp = resolucao.x/resolucao.y;
        vec2 p = (vUv - 0.5) * 2.0; p.x *= asp;
        float r2 = dot(p,p);
        float rmax2 = 1.0 + asp*asp;
        float k = lente*0.33;
        vec2 ps = p * (1.0 + k*r2) / (1.0 + k*rmax2*0.70);
        ps.x /= asp;
        vec2 uv = ps*0.5 + 0.5;
        if (uv.x<0.0||uv.x>1.0||uv.y<0.0||uv.y>1.0) { gl_FragColor = vec4(corTraco*0.6, 1.0); return; }
        vec4 amostra = texture2D(tCor, uv);
        vec3 cor = amostra.rgb;
        float brilha = step(amostra.a, 0.995); // telas, painéis e lâmpadas: sem traço por diferença de cor
        float d0 = linear(texture2D(tProf, uv).x);
        float fatorDist = clamp(2.2 / max(d0, 0.4), 0.3, 1.0); // traço mais fino ao longe: personagem distante não vira borrão
        vec2 px = (espessura*0.5*fatorDist) / resolucao;
        if (irregular == 1) { float j = hash(floor(gl_FragCoord.xy/3.0)); px *= 0.75 + j*0.6; }
        float dmax = 0.0;
        dmax = max(dmax, abs(linear(texture2D(tProf, uv+vec2(px.x,0.0)).x)-d0));
        dmax = max(dmax, abs(linear(texture2D(tProf, uv-vec2(px.x,0.0)).x)-d0));
        dmax = max(dmax, abs(linear(texture2D(tProf, uv+vec2(0.0,px.y)).x)-d0));
        dmax = max(dmax, abs(linear(texture2D(tProf, uv-vec2(0.0,px.y)).x)-d0));
        float bordaProf = step(limiarProf*d0 + 0.004, dmax);
        vec3 n0 = texture2D(tNorm, uv).xyz*2.0-1.0;
        float nd = 0.0;
        nd = max(nd, 1.0-dot(n0, texture2D(tNorm, uv+vec2(px.x,0.0)).xyz*2.0-1.0));
        nd = max(nd, 1.0-dot(n0, texture2D(tNorm, uv-vec2(px.x,0.0)).xyz*2.0-1.0));
        nd = max(nd, 1.0-dot(n0, texture2D(tNorm, uv+vec2(0.0,px.y)).xyz*2.0-1.0));
        nd = max(nd, 1.0-dot(n0, texture2D(tNorm, uv-vec2(0.0,px.y)).xyz*2.0-1.0));
        float bordaNorm = step(limiarNorm, nd) * step(d0, 40.0);
        float cd = 0.0;
        cd = max(cd, length(texture2D(tCor, uv+vec2(px.x,0.0)).rgb - cor));
        cd = max(cd, length(texture2D(tCor, uv-vec2(px.x,0.0)).rgb - cor));
        cd = max(cd, length(texture2D(tCor, uv+vec2(0.0,px.y)).rgb - cor));
        cd = max(cd, length(texture2D(tCor, uv-vec2(0.0,px.y)).rgb - cor));
        float bordaCor = step(limiarCor, cd) * (1.0 - brilha);
        float borda = max(max(bordaProf, bordaNorm), bordaCor);
        cor = mix(cor, corTraco, borda);
        if (textura == 1) {
          float g = hash(floor(gl_FragCoord.xy)); float g2 = hash(floor(gl_FragCoord.xy/9.0)+3.0); float g3 = hash(floor(gl_FragCoord.xy/37.0)+7.0);
          cor *= 1.0 - intensidadeTextura*((g-0.5)*0.7 + (g2-0.5)*0.5 + (g3-0.5)*0.4);
        } else if (textura == 2) {
          float lum = dot(cor, vec3(0.299,0.587,0.114));
          float ang = 0.785; mat2 R = mat2(cos(ang),-sin(ang),sin(ang),cos(ang));
          vec2 c = R*gl_FragCoord.xy / (6.0 + espessura*0.4); vec2 f = fract(c)-0.5; float dist = length(f);
          float raio = (1.0-lum)*0.65; float ponto = smoothstep(raio, raio-0.15, dist);
          cor = mix(cor, cor*0.55, ponto*intensidadeTextura*2.2*(1.0-borda));
        }
        cor *= corLuz;
        float vin = smoothstep(0.45, 1.5, length(p)) * vinheta;
        cor *= 1.0 - vin;
        cor *= (1.0 - fade);
        gl_FragColor = vec4(cor, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  M.cenaPos = new THREE.Scene();
  M.cenaPos.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), M.matPos));
  M.camPos = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
}

// ------------------------------------------------------------------ quadro
window.renderizarQuadro = function renderizarQuadro(t) {
  if (!M.pronto) throw new Error('chame carregar() antes');
  t = Math.max(0, t);
  const est = M.estado.em(t);
  const clima = climaEm(t);
  const linhaAtual = est.linha;
  const acao = linhaAtual.direcao?.acao || 'parar';
  const acaoAnterior = est.indice > 0 ? (M.linha.linhas[est.indice - 1].direcao?.acao || 'parar') : 'parar';
  const tLinha = t - linhaAtual.inicio_s;

  // câmera primeiro (os bonecos olham para ela)
  M.cabeca.limparCache();
  const infoCam = M.cabeca.aplicar(M.camera, t, clima, M.pancadas);
  const posCam = M.camera.position.clone();

  // props
  for (const id in M.props) { try { M.props[id].atualizar(est.props[id], t, { luz: clima.luz, clima: clima.nome }); } catch (e) { M.avisos.push('prop ' + id + ': ' + e.message); } }
  // bonecos
  const falante = quemFala(t);
  for (const id in M.bonecos) {
    const pe = est.personagens[id];
    if (!pe) continue;
    let alvoOlhar = posCam;
    if (falante && falante !== id && falante !== 'eu' && M.bonecos[falante]) {
      const pf = est.personagens[falante];
      if (pf && pf.visivel) alvoOlhar = new THREE.Vector3(pf.pos[0], alturaCabeca(falante), pf.pos[2]);
    }
    if (pe.pose === 'limpando' && falante !== id) alvoOlhar = new THREE.Vector3(pe.pos[0] + 0.5, 0, pe.pos[2] + 0.8); // olha o chão que limpa
    M.bonecos[id].aplicar(pe, t, aberturaBoca(id, t), alvoOlhar, posCam);
  }
  // corpo em primeira pessoa segue a posição do corpo (sentado na origem; anda junto com a câmera)
  const base = M.cabeca.posBase;
  M.corpo.grupo.position.set(posCam.x - base.x, 0, posCam.z - base.z);
  const tremorAcao = acao.startsWith('tremor:') ? parseFloat(acao.split(':')[1]) || 0 : 0;
  M.corpo.aplicar(acao, tLinha, t, clima.tremor * 0.5 + tremorAcao, acaoAnterior);
  M.telaCelular.desenhar(est.celular.tela, t);
  // luzes gerais seguem o clima
  const luz = clima.luz;
  M.hemi.intensity = 0.12 + 0.42 * luz; M.hemi.color.set(clima.cor_luz);
  M.dir.intensity = 0.8 * luz; M.dir.color.set(clima.cor_luz);
  M.dir2.intensity = 0.22 * luz;

  // fade
  let fade = 0;
  if (acao === 'fade') fade = suave(tLinha / 0.8);
  if (clima.nome === 'pergunta') fade = Math.max(fade, suave((t - clima.inicio) / 0.9));
  if (M.linha.pergunta && t >= M.linha.pergunta.inicio_s) fade = Math.max(fade, suave((t - M.linha.pergunta.inicio_s) / 0.9));

  // passes
  const r = M.renderer;
  if (M.semPos) { r.setRenderTarget(null); r.setClearColor(M.cena.background); r.clear(); r.render(M.cena, M.camera); M.ctx.setTransform(1, 0, 0, 1, 0, 0); M.ctx.drawImage(M.canvasGL, 0, 0); M.ultimoQuadro = { t, clima: clima.nome, acao, linha: est.indice, legendas: [] }; return M.ultimoQuadro; }
  r.setRenderTarget(M.rtCor); r.setClearColor(M.cena.background); r.clear(); r.render(M.cena, M.camera);
  // normais em meia resolução (vidros e sombras de contato ficam fora)
  const escondidos = [];
  M.cena.traverse(o => { if (o.isMesh && (o.userData.vidro || o.userData.semTraco) && o.visible) { o.visible = false; escondidos.push(o); } });
  M.cena.overrideMaterial = M.matNormal;
  r.setRenderTarget(M.rtNorm); r.setClearColor(0x808080); r.clear(); r.render(M.cena, M.camera);
  M.cena.overrideMaterial = null;
  for (const o of escondidos) o.visible = true;
  // composição
  const u = M.uniformes;
  u.lente.value = clima.lente; u.vinheta.value = clima.vinheta; u.fade.value = fade; u.luz.value = luz;
  const cl = hexParaRgb(clima.cor_luz).map(v => v / 255); const mx = Math.max(cl[0], cl[1], cl[2], 0.01);
  u.corLuz.value.set(cl[0] / mx, cl[1] / mx, cl[2] / mx).lerp(new THREE.Vector3(1, 1, 1), 0.5);
  u.perto.value = M.camera.near; u.longe.value = M.camera.far;
  r.setRenderTarget(null); r.render(M.cenaPos, M.camPos);

  // sobreposição 2D
  const ctx = M.ctx;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
  ctx.drawImage(M.canvasGL, 0, 0);
  const falasAtivas = M.linha.falas.filter(f => t >= f.inicio_s && t <= f.fim_s + 0.15).map(f => ({ ...f, texto: f.texto || (M.roteiro.falas.find(x => x.id === f.id)?.texto || '') }));
  const notificacao = est.celular.notificacao !== null && M.roteiro.celular?.[est.celular.notificacao] ? { ...M.roteiro.celular[est.celular.notificacao], inicio: est.celular.inicioNotificacao } : null;
  const pergunta = M.linha.pergunta ? { ...M.linha.pergunta, ativa: t >= M.linha.pergunta.inicio_s } : null;
  const legendas = M.sobre.desenhar(ctx, t, { falasAtivas, notificacao, selo: est.selo, pergunta, fade: clima.nome === 'pergunta' || (pergunta && pergunta.ativa) ? 0 : 0, clima: clima.nome });
  M.ultimoQuadro = { t, clima: clima.nome, acao, linha: est.indice, legendas };
  return M.ultimoQuadro;
};

window.capturar = function capturar(formato = 'png', qualidade = 0.95) {
  return M.canvasFinal.toDataURL(formato === 'jpg' || formato === 'jpeg' ? 'image/jpeg' : 'image/png', qualidade);
};

window.renderizarLote = function renderizarLote(tempos, formato = 'jpg', qualidade = 0.95, comStats = false) {
  const saida = [];
  for (const t of tempos) {
    const info = window.renderizarQuadro(t);
    const item = { t, dados: window.capturar(formato, qualidade), legendas: info.legendas, clima: info.clima };
    if (comStats) item.stats = window.estatisticasQuadro();
    saida.push(item);
  }
  return saida;
};

// Estatísticas simples do quadro atual (para o revisor): luminância média e fração de pixels iguais à cor dominante.
window.estatisticasQuadro = function estatisticasQuadro() {
  const c = document.createElement('canvas'); c.width = 54; c.height = 96;
  const cx = c.getContext('2d'); cx.drawImage(M.canvasFinal, 0, 0, 54, 96);
  const d = cx.getImageData(0, 0, 54, 96).data;
  let soma = 0; const cont = new Map(); let n = 0;
  for (let i = 0; i < d.length; i += 4) {
    const l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; soma += l; n++;
    const k = (d[i] >> 4) + ':' + (d[i + 1] >> 4) + ':' + (d[i + 2] >> 4); cont.set(k, (cont.get(k) || 0) + 1);
  }
  let max = 0; for (const v of cont.values()) max = Math.max(max, v);
  return { luminancia: soma / n / 255, uniforme: max / n };
};

// Folha de quadros: miniaturas com o tempo escrito.
window.montarFolha = function montarFolha(tempos, colunas = 5, larguraMini = 216) {
  const { W, H } = M;
  const alturaMini = Math.round(larguraMini * H / W);
  const rotulo = Math.round(larguraMini * 0.16);
  const linhas = Math.ceil(tempos.length / colunas);
  const c = document.createElement('canvas'); c.width = colunas * (larguraMini + 8) + 8; c.height = linhas * (alturaMini + rotulo + 8) + 8;
  const cx = c.getContext('2d'); cx.fillStyle = '#1b1b1b'; cx.fillRect(0, 0, c.width, c.height);
  tempos.forEach((t, i) => {
    const info = window.renderizarQuadro(t);
    const x = 8 + (i % colunas) * (larguraMini + 8), y = 8 + Math.floor(i / colunas) * (alturaMini + rotulo + 8);
    cx.drawImage(M.canvasFinal, x, y, larguraMini, alturaMini);
    cx.fillStyle = '#ffffff'; cx.font = `${Math.round(rotulo * 0.6)}px Anton, sans-serif`; cx.textBaseline = 'middle'; cx.textAlign = 'left';
    cx.fillText(formatarTempo(t) + '  ' + info.clima + (info.legendas.length ? '  💬' : ''), x + 4, y + alturaMini + rotulo / 2);
  });
  return c.toDataURL('image/png');
};

window.linhaDoTempoAtual = () => M.linha;

// Sonda de depuração: o que a câmera vê em pontos da tela (nx, ny em 0..1). Devolve nomes dos objetos atingidos.
window.sondar = function sondar(pontos) {
  const rc = new THREE.Raycaster();
  const saida = [];
  for (const [nx, ny] of pontos) {
    rc.setFromCamera(new THREE.Vector2(nx * 2 - 1, -(ny * 2 - 1)), M.camera);
    const visivelNaCadeia = (o) => { while (o) { if (!o.visible) return false; o = o.parent; } return true; };
    const hits = rc.intersectObjects(M.cena.children, true).filter(h => visivelNaCadeia(h.object));
    const h = hits[0];
    let nome = null, cor = null;
    if (h) { let o = h.object; const cadeia = []; while (o) { if (o.name) cadeia.push(o.name); o = o.parent; } nome = cadeia.join(' < ') || h.object.type; cor = h.object.material?.color?.getHexString?.() || null; }
    saida.push({ nx, ny, nome, cor, dist: h ? Number(h.distance.toFixed(3)) : null, ponto: h ? [h.point.x, h.point.y, h.point.z].map(v => Number(v.toFixed(2))) : null });
  }
  return saida;
};
