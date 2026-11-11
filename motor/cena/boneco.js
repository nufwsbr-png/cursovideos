// Boneco 3D configurável (capítulo 60) no estilo da referência aprovada: cabeça grande e redonda, olhos brancos enormes
// com pupila preta, nariz pequeno, sobrancelha fina, corpo curto em formas macias (cápsulas), roupa chapada.
// Mesmo esqueleto para todos; muda cor, cabelo, óculos, proporção, expressão e a boca (que segue o volume da voz).
import * as THREE from 'three';
import { escurecer, clarear, geoCapsula, geoCaixaArredondada } from './estilo.js';
import { clamp, lerp, mulberry32, sementeDeTexto } from './util.js';

const _v = new THREE.Vector3();

function capsulaVertical(estilo, raio, comp, cor, y) { const m = new THREE.Mesh(geoCapsula(raio, comp), estilo.material(cor)); m.position.y = y; return m; }
function anel(estilo, raio, tubo, cor) { return new THREE.Mesh(new THREE.TorusGeometry(raio, tubo, 8, 24), estilo.material(cor)); }

export class Boneco {
  constructor(personagem, estilo, estiloCanal, cores) {
    this.id = personagem.id;
    this.visual = personagem.visual || {};
    this.estilo = estilo;
    const prop = estiloCanal.bonecos || {};
    const v = this.visual;
    const H = v.altura || 1.7;
    const magro = (v.proporcao || '').includes('magro');
    const baixa = (v.proporcao || '').includes('baixa') || (v.proporcao || '').includes('forte');
    const escCabeca = prop.cabeca || 1.0;
    const escCorpo = prop.corpo || 1.0;
    const semente = sementeDeTexto(personagem.id);
    this.rnd = mulberry32(semente);
    this.fasePiscar = this.rnd() * 10;

    const pele = v.pele || cores.pele_padrao || '#8d5524';
    const roupaCima = v.roupa_cima || '#555';
    const roupaBaixo = v.roupa_baixo || '#333';
    const acess = (v.acessorio || '').toLowerCase();
    const temColete = acess.includes('colete');
    const temCasaco = acess.includes('casaco');
    const corCamisa = temColete ? (v.roupa_camisa || '#9ec5e8') : roupaCima;
    const corSapato = v.sapato || '#2a2a2a';

    // medidas: cabeça grande (≈ 1/4 da altura), pernas curtas, tronco macio
    const raioCab = H * 0.118 * escCabeca;
    const perna = H * 0.40, tronco = H * 0.30 * escCorpo;
    const largOmbro = (magro ? 0.19 : baixa ? 0.26 : 0.22) * H * escCorpo;
    this.medidas = { H, perna, tronco, raioCab, largOmbro };
    this.oval = [1, 1, 0.94];

    this.grupo = new THREE.Group();
    this.grupo.name = 'personagem:' + personagem.id;
    this.quadril = new THREE.Group(); this.quadril.position.y = perna; this.grupo.add(this.quadril);

    // pernas (pivô no quadril): cápsula da calça + sapato arredondado
    const rPerna = largOmbro * 0.17;
    this.pernas = [];
    for (const lado of [-1, 1]) {
      const p = new THREE.Group(); p.position.set(lado * largOmbro * 0.24, 0, 0);
      const coxa = capsulaVertical(estilo, rPerna, perna - rPerna * 1.2, roupaBaixo, -perna / 2 + rPerna * 0.2); p.add(coxa);
      const sapato = new THREE.Mesh(geoCaixaArredondada(rPerna * 2.2, 0.07, rPerna * 3.6, 0.025), estilo.material(corSapato)); sapato.position.set(0, -perna + 0.035, rPerna * 0.9); p.add(sapato);
      this.quadril.add(p); this.pernas.push(p);
    }
    // tronco: cápsula larga; colete/casaco por cima; cós desenhado
    this.troncoG = new THREE.Group(); this.quadril.add(this.troncoG);
    const rTronco = largOmbro / 2;
    const alturaTronco = temCasaco ? tronco * 1.2 : tronco;
    const corpoM = new THREE.Mesh(geoCapsula(rTronco, Math.max(0.02, alturaTronco - rTronco * 1.1)), estilo.material(temCasaco ? roupaCima : corCamisa));
    corpoM.scale.set(1, 1, 0.78); corpoM.position.y = temCasaco ? tronco - alturaTronco / 2 + rTronco * 0.1 : tronco / 2 + rTronco * 0.1; this.troncoG.add(corpoM);
    const cos = anel(estilo, rTronco * 0.92, 0.012, estilo.corTraco); cos.rotation.x = Math.PI / 2; cos.scale.set(1, 0.78, 1); cos.position.y = temCasaco ? -0.02 : rTronco * 0.15; this.troncoG.add(cos);
    if (temColete) {
      const colete = new THREE.Mesh(geoCapsula(rTronco * 1.06, Math.max(0.02, tronco * 0.55)), estilo.material(roupaCima));
      colete.scale.set(1, 1, 0.8); colete.position.y = tronco * 0.55; this.troncoG.add(colete);
      const faixa = new THREE.Mesh(new THREE.CylinderGeometry(rTronco * 1.075, rTronco * 1.075, 0.035, 20, 1, true), estilo.material('#f2f2f2', { side: THREE.DoubleSide })); faixa.scale.set(1, 1, 0.8); faixa.position.y = tronco * 0.42; this.troncoG.add(faixa);
    }
    if (temCasaco) {
      const gola = new THREE.Mesh(geoCapsula(rTronco * 0.5, 0.02), estilo.material(escurecer(roupaCima, 0.8))); gola.scale.set(1.3, 0.5, 0.8); gola.position.set(0, tronco + 0.01, rTronco * 0.35); this.troncoG.add(gola);
      for (let i = 0; i < 3; i++) { const bot = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), estilo.material(escurecer(roupaCima, 0.5))); bot.position.set(0, tronco * (0.25 + i * 0.22), rTronco * 0.79); this.troncoG.add(bot); }
    }
    // pescoço e cabeça
    const pescoco = new THREE.Mesh(new THREE.CylinderGeometry(raioCab * 0.28, raioCab * 0.32, 0.07, 12), estilo.material(pele)); pescoco.position.y = tronco + 0.02; this.troncoG.add(pescoco);
    this.cabeca = new THREE.Group(); this.cabeca.position.y = tronco + 0.05; this.troncoG.add(this.cabeca);
    const oval = this.oval;
    const cab = new THREE.Mesh(new THREE.SphereGeometry(raioCab, 24, 18), estilo.material(pele)); cab.scale.set(...oval); cab.position.y = raioCab * oval[1]; this.cabeca.add(cab);
    this.cabMesh = cab;
    const yC = raioCab * oval[1]; // centro da cabeça
    // orelhas pequenas
    for (const lado of [-1, 1]) { const o = new THREE.Mesh(new THREE.SphereGeometry(raioCab * 0.16, 10, 8), estilo.material(pele)); o.position.set(lado * raioCab * 0.97, yC - raioCab * 0.05, 0); o.scale.set(0.5, 1, 0.8); this.cabeca.add(o); }
    // cabelo
    const corCabelo = v.cabelo || '#222';
    const estiloCabelo = v.cabelo_estilo || 'curto';
    const cabelo = new THREE.Group(); cabelo.position.y = yC;
    const linhaCabelo = (phi) => { const a = anel(estilo, raioCab * Math.sin(phi) * 1.03, raioCab * 0.035, estilo.corTraco); a.rotation.x = Math.PI / 2; a.position.y = raioCab * Math.cos(phi) * oval[1] * 1.0; a.scale.set(oval[0], oval[2], 1); return a; };
    if (estiloCabelo !== 'nenhum' && estiloCabelo !== 'careca') {
      const phi = estiloCabelo === 'coque' ? Math.PI * 0.46 : estiloCabelo === 'cacheado' ? Math.PI * 0.42 : Math.PI * 0.44;
      const calota = new THREE.Mesh(new THREE.SphereGeometry(raioCab * 1.07, 24, 12, 0, Math.PI * 2, 0, phi), estilo.material(corCabelo)); calota.scale.set(oval[0], oval[1], oval[2]); calota.position.y = 0; cabelo.add(calota);
      cabelo.add(linhaCabelo(phi));
      if (estiloCabelo === 'coque') { const coque = new THREE.Mesh(new THREE.SphereGeometry(raioCab * 0.42, 14, 10), estilo.material(corCabelo)); coque.position.set(0, raioCab * 0.98, -raioCab * 0.45); cabelo.add(coque); const elast = anel(estilo, raioCab * 0.2, raioCab * 0.035, '#c0392b'); elast.position.set(0, raioCab * 0.9, -raioCab * 0.2); elast.rotation.x = 0.9; cabelo.add(elast); }
      if (estiloCabelo === 'cacheado') { const rnd = mulberry32(semente + 3); for (let i = 0; i < 9; i++) { const a = rnd() * Math.PI * 2, e = 0.25 + rnd() * 0.55; const b = new THREE.Mesh(new THREE.SphereGeometry(raioCab * (0.28 + rnd() * 0.12), 12, 10), estilo.material(corCabelo)); b.position.set(Math.cos(a) * Math.cos(e) * raioCab * 0.95, Math.sin(e) * raioCab * 1.0, Math.sin(a) * Math.cos(e) * raioCab * 0.9); cabelo.add(b); } }
      if (estiloCabelo === 'curto_penteado') { const topete = new THREE.Mesh(new THREE.SphereGeometry(raioCab * 0.5, 12, 8), estilo.material(corCabelo)); topete.scale.set(1.4, 0.4, 1.0); topete.position.set(-raioCab * 0.15, raioCab * 0.98, raioCab * 0.25); cabelo.add(topete); }
    } else if (estiloCabelo === 'careca') {
      for (const lado of [-1, 1]) { const tufo = new THREE.Mesh(new THREE.SphereGeometry(raioCab * 0.32, 12, 8), estilo.material(corCabelo)); tufo.scale.set(0.5, 0.8, 1); tufo.position.set(lado * raioCab * 0.95, raioCab * 0.05, -raioCab * 0.1); cabelo.add(tufo); }
    }
    this.cabeca.add(cabelo);
    // rosto: olhos grandes brancos colados, pupila preta, sobrancelha fina, nariz pequeno, boca
    const zRosto = raioCab * oval[2];
    this.olhos = []; this.pupilas = []; this.sobrancelhas = [];
    const rOlho = raioCab * 0.34;
    for (const lado of [-1, 1]) {
      const olho = new THREE.Mesh(new THREE.SphereGeometry(rOlho, 16, 12), estilo.luminoso('#ffffff'));
      olho.position.set(lado * raioCab * 0.33, yC - raioCab * 0.02, zRosto * 0.80); olho.scale.set(1, 1.1, 0.55); this.cabeca.add(olho); this.olhos.push(olho);
      const pupila = new THREE.Mesh(new THREE.SphereGeometry(rOlho * 0.46, 12, 10), estilo.luminoso('#15110f'));
      pupila.position.set(lado * raioCab * 0.33, yC - raioCab * 0.02, zRosto * 0.80 + rOlho * 0.5); pupila.scale.set(1, 1, 0.5); this.cabeca.add(pupila); this.pupilas.push(pupila);
      const sob = new THREE.Mesh(geoCapsula(raioCab * 0.022, raioCab * 0.34), estilo.luminoso(corCabelo === '#bdbdbd' ? '#5a5a5a' : escurecer(corCabelo, 0.8)));
      sob.rotation.z = Math.PI / 2; sob.position.set(lado * raioCab * 0.33, yC + raioCab * 0.40, zRosto * 0.93); this.cabeca.add(sob); this.sobrancelhas.push(sob);
    }
    if (prop.nariz !== false) { const nariz = new THREE.Mesh(new THREE.SphereGeometry(raioCab * 0.1, 12, 8), estilo.material(escurecer(pele, 0.92))); nariz.position.set(0, yC - raioCab * 0.22, zRosto * 0.98); nariz.scale.set(1, 0.85, 0.9); this.cabeca.add(nariz); }
    this.boca = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), estilo.luminoso('#3a1515')); this.boca.scale.set(raioCab * 0.14, raioCab * 0.02, raioCab * 0.03);
    this.boca.position.set(0, yC - raioCab * 0.48, zRosto * 0.90); this.cabeca.add(this.boca);
    // sorriso de boca fechada (arco): a expressão "sorriso" da vilã quando não está falando
    this.sorriso = new THREE.Mesh(new THREE.TorusGeometry(raioCab * 0.16, raioCab * 0.024, 8, 20, Math.PI), estilo.luminoso('#3a1515'));
    this.sorriso.rotation.z = Math.PI; this.sorriso.scale.set(1, 0.55, 1); this.sorriso.position.set(0, yC - raioCab * 0.40, zRosto * 0.91); this.sorriso.visible = false; this.cabeca.add(this.sorriso);
    this.lingua = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), estilo.luminoso('#b84a5a')); this.lingua.visible = false; this.cabeca.add(this.lingua);
    if (v.oculos) {
      const corOc = v.cor_oculos || '#1a1410';
      for (const lado of [-1, 1]) { const aro = anel(estilo, rOlho * 1.14, raioCab * 0.022, corOc); aro.position.set(lado * raioCab * 0.33, yC - raioCab * 0.02, zRosto * 0.80 + rOlho * 0.5); aro.scale.set(1, 1.1, 1); this.cabeca.add(aro); }
      const ponte = new THREE.Mesh(geoCapsula(raioCab * 0.03, raioCab * 0.1), estilo.material(corOc)); ponte.rotation.z = Math.PI / 2; ponte.position.set(0, yC + raioCab * 0.02, zRosto * 0.80 + rOlho * 0.45); this.cabeca.add(ponte);
    }
    this.raioCab = raioCab;

    // braços (pivô no ombro): cápsulas e mão redonda
    this.bracos = [];
    const compBraco = tronco * 0.5, compAnte = tronco * 0.45, rBraco = largOmbro * 0.14;
    for (const lado of [-1, 1]) {
      const ombro = new THREE.Group(); ombro.position.set(lado * (rTronco * (temColete ? 1.12 : 1.0) + rBraco * 0.8), tronco * 0.86, 0);
      const corManga = temCasaco ? roupaCima : corCamisa;
      const sup = new THREE.Mesh(geoCapsula(rBraco, compBraco - rBraco), estilo.material(corManga)); sup.position.y = -compBraco / 2; ombro.add(sup);
      const cotovelo = new THREE.Group(); cotovelo.position.y = -compBraco; ombro.add(cotovelo);
      const ante = new THREE.Mesh(geoCapsula(rBraco * 0.9, compAnte - rBraco), estilo.material(corManga)); ante.position.y = -compAnte / 2; cotovelo.add(ante);
      const punho = anel(estilo, rBraco * 0.95, 0.008, estilo.corTraco); punho.rotation.x = Math.PI / 2; punho.position.y = -compAnte + rBraco * 0.6; cotovelo.add(punho);
      const mao = new THREE.Mesh(new THREE.SphereGeometry(rBraco * 1.35, 12, 10), estilo.material(pele)); mao.scale.set(1, 1.15, 0.8); mao.position.y = -compAnte - rBraco * 0.6; cotovelo.add(mao);
      const polegar = new THREE.Mesh(geoCapsula(rBraco * 0.4, rBraco * 0.7), estilo.material(pele)); polegar.rotation.z = lado * 0.9; polegar.position.set(lado * rBraco * 1.0, -compAnte - rBraco * 0.3, rBraco * 0.3); cotovelo.add(polegar);
      this.troncoG.add(ombro);
      this.bracos.push({ ombro, cotovelo, mao, lado });
    }
    // objeto na mão
    this.objeto = null;
    if (v.objeto === 'rodo') {
      // origem do grupo = ponto onde a mão segura o cabo; o cabo sobe 0,35 m acima da mão e desce até a base, cujo
      // comprimento é ajustado a cada quadro para a borracha encostar no chão (ajustarRodo)
      const o = new THREE.Group();
      const cabo = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 1, 10), estilo.material('#b9b9b9')); o.add(cabo);
      const base = new THREE.Mesh(geoCaixaArredondada(0.5, 0.05, 0.06, 0.015), estilo.material('#333')); o.add(base);
      const borracha = new THREE.Mesh(geoCaixaArredondada(0.5, 0.03, 0.03, 0.01), estilo.material('#222')); o.add(borracha);
      this.rodo = { cabo, base, borracha };
      this.objeto = o; this.tipoObjeto = 'rodo';
    } else if (v.objeto === 'mala') {
      const o = new THREE.Group();
      const corpo = new THREE.Mesh(geoCaixaArredondada(0.36, 0.28, 0.12, 0.03), estilo.material('#6b4a2b')); corpo.position.y = -0.2; o.add(corpo);
      const alca = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 8, 12, Math.PI), estilo.material('#3a2a1a')); alca.position.y = -0.06; o.add(alca);
      const fecho = new THREE.Mesh(geoCaixaArredondada(0.08, 0.03, 0.01, 0.004), estilo.material('#c9b26a')); fecho.position.set(0, -0.12, 0.065); o.add(fecho);
      this.objeto = o; this.tipoObjeto = 'mala';
    }
    if (v.objeto === 'lanterna') {
      const o = new THREE.Group();
      const corpoL = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.16, 12), estilo.material('#2b2b2b')); corpoL.rotation.x = Math.PI / 2; corpoL.position.set(0, -0.02, 0.06); o.add(corpoL);
      const cabL = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.024, 0.05, 12), estilo.material('#f2c230')); cabL.rotation.x = Math.PI / 2; cabL.position.set(0, -0.02, 0.15); o.add(cabL);
      const lente = new THREE.Mesh(new THREE.CircleGeometry(0.028, 14), estilo.luminoso('#fff6d0')); lente.position.set(0, -0.02, 0.176); lente.userData.semTraco = true; o.add(lente);
      this.objeto = o; this.tipoObjeto = 'lanterna';
    }
    // o objeto pende do cotovelo, na posição da mão (a mão é uma esfera achatada: pendurar nela distorceria o objeto)
    if (this.objeto) { this.objeto.position.copy(this.bracos[1].mao.position); this.bracos[1].cotovelo.add(this.objeto); }
    this.pontaRodo = new THREE.Vector3();
    // sombra de contato (elipse escura no chão)
    const sombra = new THREE.Mesh(new THREE.CircleGeometry(largOmbro * 0.7, 20), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.18, depthWrite: false }));
    sombra.rotation.x = -Math.PI / 2; sombra.position.y = 0.006; sombra.scale.set(1, 0.6, 1); sombra.userData.semTraco = true; this.grupo.add(sombra);
    this.grupo.visible = false;
  }

  posicaoCabecaMundo(alvo = new THREE.Vector3()) {
    this.cabeca.updateWorldMatrix(true, false);
    return alvo.setFromMatrixPosition(this.cabeca.matrixWorld).add(new THREE.Vector3(0, this.raioCab * this.oval[1], 0));
  }

  // Estica ou encurta o cabo do rodo para a borracha encostar no chão, seja qual for a pose; guarda a ponta em pontaRodo.
  ajustarRodo() {
    if (!this.rodo) return;
    const o = this.objeto; o.updateWorldMatrix(true, false);
    const pegada = _v.setFromMatrixPosition(o.matrixWorld);
    const dir = new THREE.Vector3(0, -1, 0).transformDirection(o.matrixWorld);
    let L = 1.0; // cabo quase deitado: comprimento fixo (sem guardar estado entre quadros)
    if (dir.y < -0.25) L = clamp((pegada.y - 0.035) / -dir.y, 0.5, 1.3);
    this.rodo.cabo.scale.y = L + 0.35; this.rodo.cabo.position.y = (0.35 - L) / 2;
    this.rodo.base.position.y = -L + 0.025; this.rodo.borracha.position.y = -L;
    this.pontaRodo.copy(pegada).addScaledVector(dir, L);
  }

  // estado: { visivel, pos:[x,y,z], direcao:[dx,dz]|null, andando, pose, expressao }, abertura 0..1, alvoOlhar Vector3|null
  aplicar(estado, t, abertura, alvoOlhar, voltadoPara) {
    this.grupo.visible = !!estado.visivel;
    const { perna, tronco } = this.medidas;
    const pos = estado.pos;
    if (!this.grupo.visible) { this.grupo.position.set(pos[0], -10, pos[2]); return; }
    this.grupo.position.set(pos[0], 0, pos[2]);
    const pose = estado.andando ? 'andando' : (estado.pose || 'em_pe');
    let yaw;
    if (estado.andando && estado.direcao) yaw = Math.atan2(estado.direcao[0], estado.direcao[1]);
    else if (voltadoPara) yaw = Math.atan2(voltadoPara.x - pos[0], voltadoPara.z - pos[2]);
    else yaw = 0;
    if (estado.pose === 'parado_de_costas') yaw += Math.PI;
    if (pose === 'limpando') yaw += 1.05; // quase de lado para quem olha: o rodo indo e vindo fica visível (de frente parecia um pau parado)
    this.grupo.rotation.y = yaw;

    // micro-movimento e respiração
    const resp = Math.sin(t * 1.3 + this.fasePiscar) * 0.006;
    this.troncoG.rotation.set(0, 0, Math.sin(t * 0.7 + this.fasePiscar) * 0.01);
    this.quadril.position.y = perna + resp;
    for (const p of this.pernas) p.rotation.set(0, 0, 0);
    for (const b of this.bracos) { b.ombro.rotation.set(0.05, 0, b.lado * 0.12); b.cotovelo.rotation.set(-0.15, 0, 0); }
    if (this.objeto) { this.objeto.rotation.set(0, 0, 0); this.objeto.position.copy(this.bracos[1].mao.position); }

    if (pose === 'andando') {
      const fase = t * 2 * Math.PI * 1.7;
      this.pernas[0].rotation.x = Math.sin(fase) * 0.5; this.pernas[1].rotation.x = -Math.sin(fase) * 0.5;
      this.bracos[0].ombro.rotation.x = -Math.sin(fase) * 0.3; this.bracos[1].ombro.rotation.x = Math.sin(fase) * 0.3;
      this.quadril.position.y = perna + Math.abs(Math.sin(fase)) * 0.025;
      if (this.tipoObjeto === 'mala') { this.bracos[1].ombro.rotation.x = 0.05; this.objeto.position.y -= 0.02; }
    } else if (pose === 'limpando') {
      // varrendo: tronco curvado, as duas mãos no cabo, balanço lateral de ida e volta; o rodo é puxado pelo chão
      // (ajustarRodo encosta a borracha no piso) e os pés arrastam conforme a velocidade do deslocamento (estado.varrendo)
      const sw = Math.sin(t * 2.4 + this.fasePiscar);
      this.troncoG.rotation.x = 0.34 + Math.abs(sw) * 0.05; this.troncoG.rotation.y = sw * 0.3;
      for (const b of this.bracos) { b.ombro.rotation.x = -1.05 - sw * 0.12; b.ombro.rotation.z = b.lado * 0.08 + sw * 0.35; b.cotovelo.rotation.x = -0.45; }
      if (this.tipoObjeto === 'rodo') this.objeto.rotation.set(0.95, 0, sw * 0.12);
      const vel = estado.varrendo ? Math.hypot(estado.varrendo.v[0], estado.varrendo.v[1]) : 0;
      const passo = Math.sin(t * 2 * Math.PI * 1.4 + this.fasePiscar) * clamp(vel / 0.26, 0, 1) * 0.26;
      this.pernas[0].rotation.set(passo * 0.5, 0, passo * 0.4); this.pernas[1].rotation.set(-passo * 0.5, 0, passo * 0.4);
      this.quadril.position.y = perna + resp - 0.015 + Math.abs(passo) * 0.04;
    } else if (pose === 'sentado') {
      this.quadril.position.y = perna * 0.55;
      for (const p of this.pernas) p.rotation.x = -Math.PI / 2 + 0.1;
    } else if (pose === 'apontando') {
      this.bracos[1].ombro.rotation.x = -1.5; this.bracos[1].ombro.rotation.z = -0.2;
    } else if (pose === 'segurando') {
      for (const b of this.bracos) { b.ombro.rotation.x = -0.9; b.cotovelo.rotation.x = -0.9; }
    } else if (pose === 'maos_na_cabeca' || pose === 'desespero') {
      for (const b of this.bracos) { b.ombro.rotation.x = -2.6; b.ombro.rotation.z = b.lado * 0.6; b.cotovelo.rotation.x = -1.2; }
    } else {
      if (this.tipoObjeto === 'rodo') { this.bracos[1].ombro.rotation.x = -0.35; this.objeto.rotation.set(0.5, 0, 0); } // cabo em pé ao lado, borracha no chão
    }
    this.ajustarRodo();
    if (estado.olharRodo && this.rodo) alvoOlhar = this.pontaRodo; // quem limpa olha a ponta do rodo

    // cabeça olha para o alvo pelo caminho mais curto (limites naturais); pupilas acompanham um pouco
    this.cabeca.rotation.set(0, 0, 0);
    let olharX = 0, olharY = 0;
    if (alvoOlhar) {
      const cabPos = this.posicaoCabecaMundo(_v);
      const dx = alvoOlhar.x - cabPos.x, dy = alvoOlhar.y - cabPos.y, dz = alvoOlhar.z - cabPos.z;
      let yawAlvo = Math.atan2(dx, dz) - yaw;
      yawAlvo = Math.atan2(Math.sin(yawAlvo), Math.cos(yawAlvo));
      const pitch = Math.atan2(dy, Math.hypot(dx, dz));
      this.cabeca.rotation.y = clamp(yawAlvo, -0.65, 0.65);
      this.cabeca.rotation.x = clamp(-pitch, -0.45, 0.5);
      olharX = clamp((yawAlvo - this.cabeca.rotation.y) * 0.5, -0.3, 0.3) + this.cabeca.rotation.y * 0.12;
      olharY = clamp(-(pitch) * 0.12, -0.2, 0.2);
      if (pose === 'limpando') this.cabeca.rotation.x -= 0.2;
    }

    // expressão
    const ex = estado.expressao || 'normal';
    const r = this.raioCab;
    const yC = r * this.oval[1];
    const piscar = ((t * 0.37 + this.fasePiscar) % 3.1) < 0.09;
    let escOlho = 1, escY = 1, sobAng = 0, sobY = 0;
    if (ex === 'medo') { escOlho = 1.18; sobAng = 0.35; sobY = r * 0.08; }
    else if (ex === 'surpresa') { escOlho = 1.25; sobY = r * 0.12; }
    else if (ex === 'raiva') { escY = 0.7; sobAng = -0.5; sobY = -r * 0.07; }
    else if (ex === 'calma') { escY = 0.6; }
    else if (ex === 'sorriso') { escY = 0.72; sobAng = -0.18; }
    else if (ex === 'triste') { sobAng = 0.5; sobY = r * 0.03; }
    this.olhos.forEach((o) => { o.scale.set(escOlho, piscar ? 0.08 : 1.1 * escY * escOlho, 0.55); });
    this.pupilas.forEach((p, i) => { p.visible = !piscar; const lado = i === 0 ? -1 : 1; p.position.x = lado * r * 0.33 + olharX * r * 0.35; p.position.y = yC - r * 0.02 + olharY * r * 0.3; });
    this.sobrancelhas.forEach((s, i) => { const lado = i === 0 ? -1 : 1; s.rotation.z = Math.PI / 2 - lado * sobAng; s.position.y = yC + r * 0.40 + sobY; });
    // boca: abre conforme o volume da fala
    let alt = r * 0.03, larg = r * 0.28, aberta = false;
    if (ex === 'surpresa') { alt = r * 0.3; larg = r * 0.2; aberta = true; }
    if (abertura > 0.02) { alt = Math.max(alt, r * (0.04 + abertura * 0.42)); larg = r * (0.28 + abertura * 0.12); aberta = true; }
    if (ex === 'medo' && abertura <= 0.02) { alt = r * 0.14; aberta = true; }
    if (ex === 'calma' && abertura <= 0.02) larg = r * 0.34;
    if (ex === 'triste' && abertura <= 0.02) { larg = r * 0.22; }
    this.boca.scale.set(larg / 2, alt / 2, r * 0.03);
    const sorrindo = ex === 'sorriso' && abertura <= 0.02;
    this.boca.visible = !sorrindo; if (this.sorriso) this.sorriso.visible = sorrindo;
    this.lingua.visible = aberta && alt > r * 0.12;
    if (this.lingua.visible) { this.lingua.scale.set(larg * 0.3, alt * 0.22, r * 0.02); this.lingua.position.set(0, this.boca.position.y - alt * 0.22, this.boca.position.z + r * 0.012); }
  }
}
