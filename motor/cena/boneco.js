// Boneco 3D configurável (capítulo 60): mesmo esqueleto, outra roupa, cabelo e proporção para cada personagem.
import * as THREE from 'three';
import { escurecer, clarear } from './estilo.js';
import { clamp, lerp, mulberry32, sementeDeTexto } from './util.js';

const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();

export class Boneco {
  constructor(personagem, estilo, estiloCanal, cores) {
    this.id = personagem.id;
    this.visual = personagem.visual || {};
    this.estilo = estilo;
    const prop = estiloCanal.bonecos || {};
    const v = this.visual;
    const H = v.altura || 1.7;
    const magro = (v.proporcao || '').includes('magro');
    const baixa = (v.proporcao || '').includes('baixa');
    const escCabeca = prop.cabeca || 1.3;
    const escCorpo = prop.corpo || 0.9;
    const semente = sementeDeTexto(personagem.id);
    this.rnd = mulberry32(semente);
    this.fasePiscar = this.rnd() * 10;

    const pele = v.pele || cores.pele_padrao || '#8d5524';
    const roupaCima = v.roupa_cima || '#555';
    const roupaBaixo = v.roupa_baixo || '#333';
    const acess = (v.acessorio || '').toLowerCase();
    const temColete = acess.includes('colete');
    const temCasaco = acess.includes('casaco');
    const corCamisa = temColete ? '#5b86a8' : roupaCima;

    // medidas
    const perna = H * 0.44, tronco = H * 0.32 * escCorpo + H * 0.04, raioCab = H * 0.085 * escCabeca;
    const largOmbro = (magro ? 0.30 : baixa ? 0.40 : 0.36) * H * 0.55 * escCorpo + 0.08;
    this.medidas = { H, perna, tronco, raioCab, largOmbro };

    this.grupo = new THREE.Group();
    this.grupo.name = 'personagem:' + personagem.id;
    this.quadril = new THREE.Group(); this.quadril.position.y = perna; this.grupo.add(this.quadril);

    // pernas (pivô no quadril)
    const corSapato = '#2a2a2a';
    this.pernas = [];
    for (const lado of [-1, 1]) {
      const p = new THREE.Group(); p.position.set(lado * largOmbro * 0.22, 0, 0);
      const coxa = new THREE.Mesh(new THREE.BoxGeometry(largOmbro * 0.26, perna, largOmbro * 0.26), estilo.material(roupaBaixo)); coxa.position.y = -perna / 2; p.add(coxa);
      const sapato = new THREE.Mesh(new THREE.BoxGeometry(largOmbro * 0.28, 0.06, largOmbro * 0.42), estilo.material(corSapato)); sapato.position.set(0, -perna + 0.03, largOmbro * 0.07); p.add(sapato);
      this.quadril.add(p); this.pernas.push(p);
    }
    // tronco
    this.troncoG = new THREE.Group(); this.quadril.add(this.troncoG);
    const alturaTronco = temCasaco ? tronco * 1.25 : tronco;
    const corpoM = new THREE.Mesh(new THREE.BoxGeometry(largOmbro, alturaTronco, largOmbro * 0.5), estilo.material(roupaCima));
    corpoM.position.y = temCasaco ? tronco - alturaTronco / 2 : tronco / 2; this.troncoG.add(corpoM);
    if (temColete) {
      const colete = new THREE.Mesh(new THREE.BoxGeometry(largOmbro * 1.06, tronco * 0.7, largOmbro * 0.56), estilo.material(roupaCima)); colete.position.y = tronco * 0.6; this.troncoG.add(colete);
      corpoM.material = estilo.material(corCamisa);
      const faixa = new THREE.Mesh(new THREE.BoxGeometry(largOmbro * 1.07, 0.04, largOmbro * 0.57), estilo.material('#e8e8e8')); faixa.position.y = tronco * 0.5; this.troncoG.add(faixa);
    }
    if (temCasaco) {
      const gola = new THREE.Mesh(new THREE.BoxGeometry(largOmbro * 0.5, 0.05, largOmbro * 0.3), estilo.material(escurecer(roupaCima, 0.8))); gola.position.set(0, tronco - 0.02, largOmbro * 0.15); this.troncoG.add(gola);
      const botoes = new THREE.Mesh(new THREE.BoxGeometry(0.02, tronco * 0.8, 0.01), estilo.material(escurecer(roupaCima, 0.6))); botoes.position.set(0, tronco * 0.5, largOmbro * 0.251); this.troncoG.add(botoes);
    }
    // pescoço e cabeça
    const pescoco = new THREE.Mesh(new THREE.CylinderGeometry(raioCab * 0.3, raioCab * 0.3, 0.08, 8), estilo.material(pele)); pescoco.position.y = tronco + 0.03; this.troncoG.add(pescoco);
    this.cabeca = new THREE.Group(); this.cabeca.position.y = tronco + 0.06; this.troncoG.add(this.cabeca);
    const oval = (prop.rosto || '').includes('comprido') ? [0.86, 1.12, 0.9] : [1, 1, 0.95];
    const cab = new THREE.Mesh(new THREE.SphereGeometry(raioCab, 14, 12), estilo.material(pele)); cab.scale.set(...oval); cab.position.y = raioCab * oval[1]; this.cabeca.add(cab);
    this.cabMesh = cab;
    // cabelo
    const corCabelo = v.cabelo || '#222';
    const estiloCabelo = v.cabelo_estilo || 'curto';
    const cabelo = new THREE.Group(); cabelo.position.y = raioCab * oval[1];
    if (estiloCabelo === 'coque') {
      const calota = new THREE.Mesh(new THREE.SphereGeometry(raioCab * 1.04, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), estilo.material(corCabelo)); calota.scale.set(oval[0], oval[1], oval[2]); calota.position.y = raioCab * 0.1; cabelo.add(calota);
      const coque = new THREE.Mesh(new THREE.SphereGeometry(raioCab * 0.42, 10, 8), estilo.material(corCabelo)); coque.position.set(0, raioCab * 0.95, -raioCab * 0.55); cabelo.add(coque);
    } else if (estiloCabelo !== 'nenhum') {
      const calota = new THREE.Mesh(new THREE.SphereGeometry(raioCab * 1.05, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.42), estilo.material(corCabelo)); calota.scale.set(oval[0], oval[1] * 1.02, oval[2]); calota.position.y = raioCab * 0.12; cabelo.add(calota);
      if (estiloCabelo === 'curto_penteado') { const topete = new THREE.Mesh(new THREE.SphereGeometry(raioCab * 0.55, 8, 6), estilo.material(corCabelo)); topete.scale.set(1.3, 0.45, 1.1); topete.position.set(0, raioCab * 0.95, raioCab * 0.15); cabelo.add(topete); }
    }
    this.cabeca.add(cabelo);
    // rosto: olhos grandes brancos, sobrancelhas, boca; sem nariz
    const zRosto = raioCab * oval[2] * 0.86;
    this.olhos = []; this.pupilas = []; this.sobrancelhas = [];
    for (const lado of [-1, 1]) {
      const olho = new THREE.Mesh(new THREE.SphereGeometry(raioCab * 0.3, 10, 8), estilo.luminoso('#ffffff'));
      olho.position.set(lado * raioCab * 0.34, raioCab * oval[1] * 1.02, zRosto); olho.scale.set(1, 1.15, 0.6); this.cabeca.add(olho); this.olhos.push(olho);
      const pupila = new THREE.Mesh(new THREE.SphereGeometry(raioCab * 0.11, 8, 6), estilo.luminoso('#111111'));
      pupila.position.set(lado * raioCab * 0.34, raioCab * oval[1] * 1.02, zRosto + raioCab * 0.13); this.cabeca.add(pupila); this.pupilas.push(pupila);
      const sob = new THREE.Mesh(new THREE.BoxGeometry(raioCab * 0.42, raioCab * 0.07, raioCab * 0.05), estilo.material(corCabelo === '#bdbdbd' ? '#777' : escurecer(corCabelo, 0.9)));
      sob.position.set(lado * raioCab * 0.34, raioCab * oval[1] * 1.02 + raioCab * 0.36, zRosto + raioCab * 0.02); this.cabeca.add(sob); this.sobrancelhas.push(sob);
    }
    this.boca = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), estilo.luminoso('#3a1515')); this.boca.scale.set(raioCab * 0.25, raioCab * 0.04, raioCab * 0.04);
    this.boca.position.set(0, raioCab * oval[1] * 0.5, zRosto + raioCab * 0.02); this.cabeca.add(this.boca);
    this.raioCab = raioCab; this.oval = oval;

    // braços (pivô no ombro)
    this.bracos = [];
    const compBraco = tronco * 0.55, compAnte = tronco * 0.5;
    for (const lado of [-1, 1]) {
      const ombro = new THREE.Group(); ombro.position.set(lado * (largOmbro / 2 + 0.03), tronco * 0.9, 0);
      const sup = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, compBraco, 8), estilo.material(temCasaco ? roupaCima : corCamisa)); sup.position.y = -compBraco / 2; ombro.add(sup);
      const cotovelo = new THREE.Group(); cotovelo.position.y = -compBraco; ombro.add(cotovelo);
      const ante = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.035, compAnte, 8), estilo.material(temCasaco ? roupaCima : corCamisa)); ante.position.y = -compAnte / 2; cotovelo.add(ante);
      const mao = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), estilo.material(pele)); mao.position.y = -compAnte - 0.03; cotovelo.add(mao);
      this.troncoG.add(ombro);
      this.bracos.push({ ombro, cotovelo, mao, lado });
    }
    // objeto na mão
    this.objeto = null;
    if (v.objeto === 'rodo') {
      const o = new THREE.Group();
      const cabo = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.35, 8), estilo.material('#9a9a9a')); o.add(cabo);
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.06), estilo.material('#333')); base.position.y = -0.68; o.add(base);
      const borracha = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.03, 0.03), estilo.material('#222')); borracha.position.y = -0.71; o.add(borracha);
      this.objeto = o; this.tipoObjeto = 'rodo';
    } else if (v.objeto === 'mala') {
      const o = new THREE.Group();
      const corpo = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.28, 0.12), estilo.material('#6b4a2b')); corpo.position.y = -0.2; o.add(corpo);
      const alca = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.01, 6, 10, Math.PI), estilo.material('#3a2a1a')); alca.position.y = -0.06; o.add(alca);
      const fecho = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.03, 0.01), estilo.material('#c9b26a')); fecho.position.set(0, -0.12, 0.065); o.add(fecho);
      this.objeto = o; this.tipoObjeto = 'mala';
    }
    if (this.objeto) this.bracos[1].mao.add(this.objeto);
    // sombra de contato (elipse escura no chão)
    const sombra = new THREE.Mesh(new THREE.CircleGeometry(largOmbro * 0.55, 12), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.22, depthWrite: false }));
    sombra.rotation.x = -Math.PI / 2; sombra.position.y = 0.006; sombra.scale.set(1, 0.6, 1); sombra.userData.semTraco = true; this.grupo.add(sombra);
    this.grupo.visible = false;
  }

  posicaoCabecaMundo(alvo = new THREE.Vector3()) {
    this.cabeca.updateWorldMatrix(true, false);
    return alvo.setFromMatrixPosition(this.cabeca.matrixWorld).add(new THREE.Vector3(0, this.raioCab * this.oval[1], 0));
  }

  // estado: { visivel, pos:[x,y,z], direcao:[dx,dz]|null, andando, pose, expressao }, abertura 0..1, alvoOlhar Vector3|null
  aplicar(estado, t, abertura, alvoOlhar, voltadoPara) {
    this.grupo.visible = !!estado.visivel;
    const { perna, tronco } = this.medidas;
    const pos = estado.pos;
    if (!this.grupo.visible) { this.grupo.position.set(pos[0], -10, pos[2]); return; }
    this.grupo.position.set(pos[0], 0, pos[2]);
    // direção do corpo: para onde anda; parado, de frente para quem olha (câmera) salvo pose de costas
    let yaw;
    if (estado.andando && estado.direcao) yaw = Math.atan2(estado.direcao[0], estado.direcao[1]);
    else if (voltadoPara) yaw = Math.atan2(voltadoPara.x - pos[0], voltadoPara.z - pos[2]);
    else yaw = 0;
    if (estado.pose === 'parado_de_costas') yaw += Math.PI;
    this.grupo.rotation.y = yaw;

    // micro-movimento e respiração
    const resp = Math.sin(t * 1.3 + this.fasePiscar) * 0.006;
    this.troncoG.rotation.set(0, 0, Math.sin(t * 0.7 + this.fasePiscar) * 0.01);
    this.quadril.position.y = perna + resp;
    // reset
    for (const p of this.pernas) p.rotation.set(0, 0, 0);
    for (const b of this.bracos) { b.ombro.rotation.set(0.05, 0, b.lado * 0.08); b.cotovelo.rotation.set(0, 0, 0); }
    if (this.objeto) this.objeto.rotation.set(0, 0, 0), this.objeto.position.set(0, 0, 0);

    const pose = estado.andando ? 'andando' : (estado.pose || 'em_pe');
    if (pose === 'andando') {
      const fase = t * 2 * Math.PI * 1.7;
      this.pernas[0].rotation.x = Math.sin(fase) * 0.5; this.pernas[1].rotation.x = -Math.sin(fase) * 0.5;
      this.bracos[0].ombro.rotation.x = -Math.sin(fase) * 0.3; this.bracos[1].ombro.rotation.x = Math.sin(fase) * 0.3;
      this.quadril.position.y = perna + Math.abs(Math.sin(fase)) * 0.025;
      if (this.tipoObjeto === 'mala') { this.bracos[1].ombro.rotation.x = 0.05; this.objeto.position.y = -0.02; }
    } else if (pose === 'limpando') {
      const sw = Math.sin(t * 2.4 + this.fasePiscar);
      this.troncoG.rotation.x = 0.22; this.troncoG.rotation.y = sw * 0.25;
      for (const b of this.bracos) { b.ombro.rotation.x = -1.0; b.cotovelo.rotation.x = -0.4; }
      if (this.tipoObjeto === 'rodo') { this.objeto.rotation.x = 0.9; this.objeto.position.set(0, -0.3, 0.25); }
    } else if (pose === 'sentado') {
      this.quadril.position.y = perna * 0.55;
      for (const p of this.pernas) p.rotation.x = -Math.PI / 2 + 0.1;
    } else if (pose === 'apontando') {
      this.bracos[1].ombro.rotation.x = -1.5; this.bracos[1].ombro.rotation.z = -0.2;
    } else if (pose === 'segurando') {
      for (const b of this.bracos) { b.ombro.rotation.x = -0.9; b.cotovelo.rotation.x = -0.9; }
    } else {
      // em_pe: rodo em pé ao lado, mala pendurada
      if (this.tipoObjeto === 'rodo') { this.bracos[1].ombro.rotation.x = -0.35; this.objeto.rotation.x = 0.0; this.objeto.position.set(0, 0.25, 0.05); }
    }

    // cabeça olha para o alvo pelo caminho mais curto (limites naturais)
    this.cabeca.rotation.set(0, 0, 0);
    if (alvoOlhar) {
      const cabPos = this.posicaoCabecaMundo(_v);
      const dx = alvoOlhar.x - cabPos.x, dy = alvoOlhar.y - cabPos.y, dz = alvoOlhar.z - cabPos.z;
      let yawAlvo = Math.atan2(dx, dz) - yaw;
      yawAlvo = Math.atan2(Math.sin(yawAlvo), Math.cos(yawAlvo));
      const pitch = Math.atan2(dy, Math.hypot(dx, dz));
      this.cabeca.rotation.y = clamp(yawAlvo, -1.1, 1.1);
      this.cabeca.rotation.x = clamp(-pitch, -0.45, 0.5);
      if (pose === 'limpando') this.cabeca.rotation.x -= 0.2;
    }

    // expressão
    const ex = estado.expressao || 'normal';
    const r = this.raioCab;
    const piscar = ((t * 0.37 + this.fasePiscar) % 3.1) < 0.09;
    let escOlho = 1, escY = 1, sobAng = 0, sobY = 0;
    if (ex === 'medo') { escOlho = 1.22; sobAng = 0.35; sobY = r * 0.08; }
    else if (ex === 'surpresa') { escOlho = 1.3; sobY = r * 0.12; }
    else if (ex === 'raiva') { escY = 0.72; sobAng = -0.45; sobY = -r * 0.05; }
    else if (ex === 'calma') { escY = 0.58; }
    this.olhos.forEach((o, i) => { o.scale.set(escOlho, piscar ? 0.08 : 1.15 * escY * escOlho, 0.6); });
    this.pupilas.forEach(p => { p.visible = !piscar; });
    this.sobrancelhas.forEach((s, i) => { const lado = i === 0 ? -1 : 1; s.rotation.z = -lado * sobAng; s.position.y = r * this.oval[1] * 1.02 + r * 0.36 + sobY; });
    // boca: abre conforme o volume da fala
    let alt = r * 0.06, larg = r * 0.5;
    if (ex === 'surpresa') alt = r * 0.4, larg = r * 0.3;
    if (abertura > 0.02) alt = Math.max(alt, r * (0.06 + abertura * 0.55));
    if (ex === 'medo' && abertura <= 0.02) alt = r * 0.16;
    if (ex === 'calma' && abertura <= 0.02) larg = r * 0.62;
    this.boca.scale.set(larg / 2, alt / 2, r * 0.05);
  }
}
