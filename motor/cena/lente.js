// Lente olho-de-peixe e traço de tinta (estilo aprovado pelo dono: câmera "olho de peixe", linha preta grossa e limpa).
// Como funciona: a cabeça enxerga ~115° na vertical. Nenhuma câmera comum faz isso sem esticar as bordas, então a
// imagem é montada a partir de DUAS câmeras normais (uma inclinada 45° para cima, outra 45° para baixo) e remapeada
// para a projeção equidistante (olho de peixe) no pós-processo. O centro do quadro cai na costura das duas câmeras,
// onde as duas têm mais pixels por grau: é onde ficam rostos e mãos.
// O traço é desenhado por descontinuidade de DISTÂNCIA e de NORMAL (nunca por cor, que fazia ruído em textos e texturas),
// com largura uniforme em pixels e mais fino ao longe. Depois: papel suave (sem ruído por pixel), vinheta, fade e FXAA.
// Cada quadro depende só de t: nada aqui acumula estado entre quadros.
import * as THREE from 'three';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { hexParaRgb, clamp } from './util.js';

const ANG_RIG = Math.PI / 4;   // inclinação das duas câmeras (45°)
const FOV_FACE = 94;           // cada câmera vê 94°×94°: sobra 2° de cada lado da costura

function mat3Rot(ang) { return new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().makeRotationX(ang)); }

// Ruído de valor suave, 256x256, repetível, com semente (o grão do papel). Gerado uma vez; amostrado 3 vezes por pixel.
function texturaRuido(semente) {
  const N = 256, G = 16, passo = N / G;
  let a = (semente * 2654435761) >>> 0;
  const rnd = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const grade = Array.from({ length: G * G }, () => rnd());
  const dados = new Uint8Array(N * N * 4);
  const su = (t) => t * t * (3 - 2 * t);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const gx = Math.floor(x / passo), gy = Math.floor(y / passo), fx = su((x % passo) / passo), fy = su((y % passo) / passo);
    const v00 = grade[gy * G + gx], v10 = grade[gy * G + (gx + 1) % G], v01 = grade[((gy + 1) % G) * G + gx], v11 = grade[((gy + 1) % G) * G + (gx + 1) % G];
    const v = (v00 * (1 - fx) + v10 * fx) * (1 - fy) + (v01 * (1 - fx) + v11 * fx) * fy;
    const i = (y * N + x) * 4; dados[i] = dados[i + 1] = dados[i + 2] = Math.round(v * 255); dados[i + 3] = 255;
  }
  const tex = new THREE.DataTexture(dados, N, N, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = false; tex.needsUpdate = true;
  return tex;
}

export class Lente {
  constructor(renderer, W, H, escala, estiloCfg, opcoes = {}) {
    this.renderer = renderer; this.W = W; this.H = H; this.escala = escala;
    const cfg = this.cfg = Object.assign({ fov_vertical: 115, anamorfico: 1.2, tamanho_face: 1536, msaa: 0, aproximar_fov: 65 }, typeof estiloCfg.lente === 'object' && !Array.isArray(estiloCfg.lente) && estiloCfg.lente.fov_vertical ? estiloCfg.lente : {});
    this.perto = opcoes.perto ?? 0.05; this.longe = opcoes.longe ?? 80;
    const S = this.S = Math.max(256, Math.round((opcoes.tamanhoFace || cfg.tamanho_face) * escala));
    this.perfil = !!opcoes.perfil; this.tempos = {};
    const traco = estiloCfg.traco || {};
    // ---- rig: duas câmeras penduradas na cabeça
    this.rig = new THREE.Group(); this.rig.name = 'rig_lente';
    this.cams = [new THREE.PerspectiveCamera(FOV_FACE, 1, this.perto, this.longe), new THREE.PerspectiveCamera(FOV_FACE, 1, this.perto, this.longe)];
    this.cams[0].rotation.x = ANG_RIG; this.cams[1].rotation.x = -ANG_RIG;   // 0 = para cima, 1 = para baixo
    for (const c of this.cams) this.rig.add(c);
    // ---- alvos de render
    const msaa = cfg.msaa || 0;
    this.rtCor = [0, 1].map(() => new THREE.WebGLRenderTarget(S, S, { colorSpace: THREE.SRGBColorSpace, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false, depthBuffer: true, samples: msaa }));
    this.rtG = [0, 1].map(() => new THREE.WebGLRenderTarget(S, S, { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false, depthBuffer: true }));
    this.rtFinal = new THREE.WebGLRenderTarget(W, H, { colorSpace: THREE.SRGBColorSpace, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false, depthBuffer: false });
    // ---- material do G-buffer: normal do mundo + distância radial (independe da câmera: a costura não aparece)
    this.matG = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: { longe: { value: this.longe } },
      vertexShader: `
        out vec3 vN; out vec3 vWp;
        void main() {
          mat3 nm = transpose(inverse(mat3(modelMatrix)));
          vN = normalize(nm * normal);
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWp = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: `
        precision highp float;
        uniform float longe;
        in vec3 vN; in vec3 vWp;
        out vec4 oG;
        void main() {
          vec3 n = normalize(vN);
          if (!gl_FrontFacing) n = -n;
          // distância por fragmento (a posição do mundo interpola certo; a distância interpolada por vértice, não)
          oG = vec4(n, distance(vWp, cameraPosition));
        }`,
    });
    // ---- pós-processo: remapeamento olho de peixe + traço + papel + vinheta
    const [tr, tg, tb] = hexParaRgb(traco.cor || '#1a1410').map(v => Math.pow(v / 255, 2.2));
    const espPx = (traco.espessura_px ?? 6) * escala;
    this.u = {
      tCor0: { value: this.rtCor[0].texture }, tCor1: { value: this.rtCor[1].texture },
      tG0: { value: this.rtG[0].texture }, tG1: { value: this.rtG[1].texture },
      mCam0: { value: mat3Rot(-ANG_RIG) }, mCam1: { value: mat3Rot(ANG_RIG) },
      tanFace: { value: Math.tan(THREE.MathUtils.degToRad(FOV_FACE / 2)) },
      resolucao: { value: new THREE.Vector2(W, H) },
      thetaMax: { value: THREE.MathUtils.degToRad(cfg.fov_vertical / 2) }, anam: { value: cfg.anamorfico },
      longe: { value: this.longe },
      corTraco: { value: new THREE.Vector3(tr, tg, tb) },
      espessura: { value: espPx }, espMin: { value: (traco.espessura_min_px ?? 2.2) * escala }, distRef: { value: traco.distancia_referencia_m ?? 1.0 },
      limiarD: { value: traco.limiar_distancia ?? 0.035 }, limiarN: { value: traco.limiar_normal ?? 0.22 },
      textura: { value: estiloCfg.textura === 'nenhuma' ? 0 : 1 }, intensidadeTextura: { value: estiloCfg.intensidade_textura ?? 0.06 },
      corLuz: { value: new THREE.Vector3(1, 1, 1) }, vinheta: { value: 0.15 }, fade: { value: 0 },
      semente: { value: ((estiloCfg.semente ?? 7) % 97) * 0.37 },
      depurar: { value: 0 },
    };
    this.matPos = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3, uniforms: this.u, depthTest: false, depthWrite: false,
      vertexShader: `void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: `
        precision highp float;
        uniform sampler2D tCor0, tCor1, tG0, tG1, tRuido;
        uniform mat3 mCam0, mCam1; uniform float tanFace; uniform vec2 resolucao;
        uniform float thetaMax, anam, longe, espessura, espMin, distRef, limiarD, limiarN, intensidadeTextura, vinheta, fade, semente;
        uniform vec3 corTraco, corLuz; uniform int textura; uniform int depurar;
        out vec4 oCor;
        // 3 pares opostos (0°, 60°, 120°): largura quase isotrópica com 6 leituras por pixel
        const vec2 OFFS[6] = vec2[6](vec2(1,0), vec2(-1,0), vec2(0.5,0.866), vec2(-0.5,-0.866), vec2(-0.5,0.866), vec2(0.5,-0.866));
        float ruido(vec2 p) { return texture(tRuido, p / 256.0).r; }
        vec2 uvDe(mat3 m, vec3 d) { vec3 p = m * d; return (p.xy / max(-p.z, 1e-4)) / tanFace * 0.5 + 0.5; }
        // distância radial e normal do mundo na direção d (escolhe a câmera pela elevação)
        vec4 gDe(vec3 d) {
          vec4 g = (d.y >= 0.0) ? texture(tG0, uvDe(mCam0, d)) : texture(tG1, uvDe(mCam1, d));
          if (g.w < 0.01) g.w = longe;
          return g;
        }
        vec3 corDe(vec3 d) { if (d.y >= 0.0) return texture(tCor0, uvDe(mCam0, d)).rgb; return texture(tCor1, uvDe(mCam1, d)).rgb; }
        void main() {
          vec2 px = gl_FragCoord.xy - 0.5 * resolucao;
          float k = thetaMax / (0.5 * resolucao.y);
          vec2 a0 = px * k * vec2(anam, 1.0);
          float th = length(a0);
          vec2 u = th > 1e-5 ? a0 / th : vec2(1.0, 0.0);
          float s = sin(th), c = cos(th), sc = th > 1e-5 ? s / th : 1.0;
          vec3 d0 = vec3(u * s, -c);
          vec3 Jx = vec3((1.0 - u.x * u.x) * sc + u.x * u.x * c, (-u.x * u.y) * sc + u.y * u.x * c, s * u.x);
          vec3 Jy = vec3((-u.y * u.x) * sc + u.x * u.y * c, (1.0 - u.y * u.y) * sc + u.y * u.y * c, s * u.y);
          vec3 cor = corDe(d0);
          vec4 g0 = gDe(d0);
          if (depurar == 1) { oCor = vec4(g0.xyz * 0.5 + 0.5, 1.0); return; }
          if (depurar == 2) { oCor = vec4(vec3(fract(g0.w / 2.0)), 1.0); return; }
          float R = clamp(espessura * pow(distRef / max(g0.w, 0.05), 0.4), espMin, espessura) * 0.5;
          float md = 0.0, mn = 0.0;
          vec4 gs[6];
          for (int i = 0; i < 6; i++) {
            vec2 da = OFFS[i] * R * k * vec2(anam, 1.0);
            vec3 dk = d0 + Jx * da.x + Jy * da.y;
            gs[i] = gDe(dk);
            mn = max(mn, 1.0 - dot(g0.xyz, gs[i].xyz));
          }
          // segunda diferença em cada eixo: superfícies planas (mesmo rasantes) dão ~0; bordas dão salto
          for (int i = 0; i < 6; i += 2) {
            float res = abs(gs[i].w + gs[i + 1].w - 2.0 * g0.w) / g0.w;
            md = max(md, res);
          }
          float borda = max(smoothstep(limiarD, limiarD * 1.8, md), smoothstep(limiarN, limiarN * 1.6, mn));
          cor = mix(cor, corTraco, borda * 0.96);
          if (textura == 1) {
            vec2 q = gl_FragCoord.xy;
            float p = (ruido(q / 7.0) - 0.5) * 0.55 + (ruido(q / 1.9 + 70.0) - 0.5) * 0.3 + (ruido(q / 0.5 + 30.0) - 0.5) * 0.15;
            cor *= 1.0 - intensidadeTextura * p * 2.0;
          }
          cor *= corLuz;
          vec2 pn = px / (0.5 * resolucao.y);
          float vin = smoothstep(0.55, 1.6, length(pn)) * vinheta;
          cor *= 1.0 - vin;
          cor *= (1.0 - fade);
          oCor = vec4(cor, 1.0);
        }`,
    });
    this.u.tRuido = { value: texturaRuido(estiloCfg.semente ?? 7) };
    this.matPos.uniforms = this.u;
    this.cenaPos = new THREE.Scene(); this.cenaPos.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.matPos));
    this.camPos = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    // ---- FXAA (suaviza serrilhado do traço e das bordas)
    const fx = FXAAShader;
    this.matFxaa = new THREE.ShaderMaterial({ uniforms: THREE.UniformsUtils.clone(fx.uniforms), vertexShader: fx.vertexShader, fragmentShader: fx.fragmentShader.replace(/}\s*$/, '\n#include <colorspace_fragment>\n}'), depthTest: false, depthWrite: false });
    this.matFxaa.uniforms.tDiffuse.value = this.rtFinal.texture;
    this.matFxaa.uniforms.resolution.value.set(1 / W, 1 / H);
    this.cenaFxaa = new THREE.Scene(); this.cenaFxaa.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.matFxaa));
    this.semFxaa = opcoes.semFxaa ?? (estiloCfg.antialias !== 'fxaa');
  }

  // Renderiza a cena vista pela "cabeça" (câmera comum: posição, orientação e fov vertical do olho de peixe) no canvas.
  renderizar(cena, cabeca, p = {}) {
    const r = this.renderer;
    const gl = r.getContext();
    const px1 = this._px1 || (this._px1 = new Uint8Array(4));
    const marca = (nome) => { if (!this.perfil) return; gl.finish(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px1); const agora = performance.now(); if (this._t0 !== undefined) this.tempos[nome] = (this.tempos[nome] || 0) + (agora - this._t0); this._t0 = agora; };
    this._t0 = undefined; marca('inicio');
    this.rig.position.copy(cabeca.position); this.rig.quaternion.copy(cabeca.quaternion); this.rig.updateMatrixWorld(true);
    this.u.thetaMax.value = THREE.MathUtils.degToRad(clamp(cabeca.fov, 20, 170) / 2);
    const fundo = cena.background;
    // 1) cor (com sombras, se ligadas: o mapa de sombra é calculado uma vez por quadro)
    if (r.shadowMap.enabled) r.shadowMap.needsUpdate = true;
    for (let i = 0; i < 2; i++) { r.setRenderTarget(this.rtCor[i]); r.setClearColor(fundo || 0x000000, 1); r.clear(); r.render(cena, this.cams[i]); if (r.shadowMap.enabled) r.shadowMap.needsUpdate = false; }
    marca('cor');
    // 2) G-buffer (normal + distância), sem vidros nem sombras de contato
    const escondidos = [];
    cena.traverse(o => { if (o.isMesh && (o.userData.vidro || o.userData.semTraco) && o.visible) { o.visible = false; escondidos.push(o); } });
    cena.overrideMaterial = this.matG;
    for (let i = 0; i < 2; i++) { r.setRenderTarget(this.rtG[i]); r.setClearColor(0x000000, 1); r.clear(); r.render(cena, this.cams[i]); }
    cena.overrideMaterial = null;
    for (const o of escondidos) o.visible = true;
    marca('gbuffer');
    // 3) composição olho de peixe + traço
    const u = this.u;
    if (p.corLuz) u.corLuz.value.copy(p.corLuz);
    u.vinheta.value = p.vinheta ?? 0.15; u.fade.value = p.fade ?? 0;
    r.setRenderTarget(this.semFxaa ? null : this.rtFinal); r.render(this.cenaPos, this.camPos);
    marca('pos');
    // 4) FXAA para o canvas
    if (!this.semFxaa) { r.setRenderTarget(null); r.render(this.cenaFxaa, this.camPos); }
    r.setRenderTarget(null);
    marca('fxaa');
  }

  // Direção (mundo) do raio que passa pelo pixel normalizado (nx, ny em 0..1, origem no canto superior esquerdo).
  direcaoDoPixel(nx, ny, cabeca) {
    const px = (nx - 0.5) * this.W, py = (0.5 - ny) * this.H;
    const k = this.u.thetaMax.value / (0.5 * this.H);
    const ax = px * k * this.cfg.anamorfico, ay = py * k;
    const th = Math.hypot(ax, ay);
    const ux = th > 1e-6 ? ax / th : 1, uy = th > 1e-6 ? ay / th : 0;
    const d = new THREE.Vector3(ux * Math.sin(th), uy * Math.sin(th), -Math.cos(th));
    return d.applyQuaternion(cabeca.quaternion).normalize();
  }

  // Depuração: 'normais' mostra o G-buffer de normais, 'distancia' as faixas de distância, null volta ao normal.
  depurar(modo) { this.u.depurar.value = modo === 'normais' ? 1 : modo === 'distancia' ? 2 : 0; }
  dispose() { for (const t of [...this.rtCor, ...this.rtG, this.rtFinal]) t.dispose(); }
}
