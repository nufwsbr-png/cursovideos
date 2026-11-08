// Corpo em primeira pessoa (capítulo 58) no estilo da referência: mãos de desenho animado (palma arredondada, quatro
// dedos em cápsulas, polegar), manga da camisa com punho dobrado, apoiadas no balcão nos cantos de baixo do quadro.
// Braço nunca estica; a mão recolhe perto de objetos; nada atravessa a câmera. Tudo é função só de t.
import * as THREE from 'three';
import { escurecer, clarear, geoCapsula, geoCaixaArredondada } from './estilo.js';
import { clamp, lerp, suave } from './util.js';

function alinhar(mesh, a, b) {
  const dir = new THREE.Vector3().subVectors(b, a); const comp = dir.length();
  mesh.position.copy(a).add(dir.clone().multiplyScalar(0.5));
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  mesh.scale.set(1, comp, 1);
}

export class CorpoPOV {
  constructor(protagonista, estilo, cores, alturaOlhos = 1.48) {
    this.estilo = estilo; this.alturaOlhos = alturaOlhos;
    const maos = protagonista.maos || {};
    this.pele = maos.pele || '#7a4a28';
    this.manga = maos.manga || '#a9c7e8';
    const corPunho = maos.punho || clarear(this.manga, 0.12);
    this.grupo = new THREE.Group(); this.grupo.name = 'corpo_pov';
    this.maos = {};
    const RD = 0.0115; // raio do dedo
    for (const lado of ['esq', 'dir']) {
      const g = new THREE.Group();
      const s = lado === 'esq' ? -1 : 1;
      // palma: caixa arredondada, mais larga nos nós dos dedos
      const palma = new THREE.Mesh(geoCaixaArredondada(0.1, 0.026, 0.084, 0.012, 4), estilo.material(this.pele)); palma.position.set(0, 0, -0.002); g.add(palma);
      const dorso = new THREE.Mesh(new THREE.SphereGeometry(0.04, 14, 10), estilo.material(this.pele)); dorso.scale.set(1.1, 0.3, 1.0); dorso.position.set(0, 0.009, -0.01); g.add(dorso);
      // dedos: 4 cápsulas em duas falanges, levemente abertos e curvados; o do meio é o maior
      const dedos = new THREE.Group(); dedos.position.set(0, -0.002, -0.044);
      const comp = [0.066, 0.076, 0.071, 0.056];
      this.dedos = this.dedos || {}; this.dedos[lado] = [];
      for (let i = 0; i < 4; i++) {
        const x = (i - 1.5) * 0.027;
        const d = new THREE.Group(); d.position.set(x, 0, 0); d.rotation.y = (i - 1.5) * -0.13 * s; d.rotation.x = -0.06;
        const f1 = new THREE.Mesh(geoCapsula(RD, comp[i] * 0.55), estilo.material(this.pele)); f1.rotation.x = Math.PI / 2; f1.position.z = -comp[i] * 0.3; d.add(f1);
        const junta = new THREE.Group(); junta.position.z = -comp[i] * 0.58; junta.rotation.x = -0.18; d.add(junta);
        const f2 = new THREE.Mesh(geoCapsula(RD * 0.92, comp[i] * 0.45), estilo.material(this.pele)); f2.rotation.x = Math.PI / 2; f2.position.z = -comp[i] * 0.25; junta.add(f2);
        dedos.add(d); this.dedos[lado].push({ base: d, junta });
      }
      g.add(dedos);
      // polegar: para o lado de fora, um pouco para trás
      const polegar = new THREE.Group(); polegar.position.set(-s * 0.052, -0.003, -0.03); polegar.rotation.set(-0.05, s * 0.75, 0);
      const p1 = new THREE.Mesh(geoCapsula(RD * 1.15, 0.046), estilo.material(this.pele)); p1.rotation.x = Math.PI / 2; p1.position.z = -0.026; polegar.add(p1);
      g.add(polegar);
      if (lado === 'esq' && /esparadrapo/i.test(maos.detalhe || '')) {
        const esp = new THREE.Mesh(new THREE.CylinderGeometry(RD * 1.25, RD * 1.25, 0.016, 12), estilo.material('#f3efe6')); esp.rotation.x = Math.PI / 2; esp.position.set(0, 0, -comp[1] * 0.3); this.dedos[lado][1].base.add(esp);
      }
      // antebraço (pele) + manga da camisa + punho dobrado: alinhados a cada quadro entre o pulso e um cotovelo fora do quadro
      const ante = new THREE.Mesh(new THREE.CylinderGeometry(0.027, 0.030, 1, 14), estilo.material(this.pele));
      const mangaM = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.056, 1, 14), estilo.material(this.manga));
      const dobra = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.045, 14), estilo.material(corPunho));
      this.grupo.add(ante); this.grupo.add(mangaM); this.grupo.add(dobra);
      // sombra de contato da mão no balcão (a referência tem sombras suaves embaixo das mãos)
      const sombra = new THREE.Mesh(new THREE.CircleGeometry(0.085, 20), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.16, depthWrite: false }));
      sombra.rotation.x = -Math.PI / 2; sombra.scale.set(1, 1.25, 1); sombra.userData.semTraco = true; this.grupo.add(sombra);
      this.grupo.add(g);
      this.maos[lado] = { grupo: g, palma, dedos, polegar, ante, mangaM, dobra, sombra, s };
    }
    // objetos
    this.objetos = {};
    const carimbo = new THREE.Group();
    const cabo = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.015, 0.07, 12), estilo.material('#8a5a3a')); cabo.position.y = -0.03; carimbo.add(cabo);
    const botao = new THREE.Mesh(new THREE.SphereGeometry(0.016, 12, 8), estilo.material('#8a5a3a')); botao.position.y = 0.012; carimbo.add(botao);
    const baseC = new THREE.Mesh(geoCaixaArredondada(0.06, 0.018, 0.035, 0.005), estilo.material('#2a2a2a')); baseC.position.y = -0.072; carimbo.add(baseC);
    this.objetos.carimbo = carimbo;
    const bloco = new THREE.Group();
    const blocoM = new THREE.Mesh(geoCaixaArredondada(0.17, 0.03, 0.11, 0.006), estilo.material('#f2d95c')); bloco.add(blocoM);
    for (const z of [-0.02, 0, 0.02]) { const linha = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.002, 0.004), estilo.material('#6b5a1a')); linha.position.set(0, 0.016, z); bloco.add(linha); }
    const carimbado = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.002, 0.03), estilo.material('#3a4f8a')); carimbado.position.set(0.04, 0.0165, 0.03); carimbado.rotation.y = 0.2; bloco.add(carimbado);
    this.objetos.bloco_passagens = bloco;
    const caneta = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0035, 0.14, 8), estilo.material('#2b4fb0')); caneta.rotation.z = Math.PI / 2; caneta.rotation.y = 0.3;
    this.objetos.caneta = caneta;
    const pano = new THREE.Mesh(geoCaixaArredondada(0.13, 0.012, 0.1, 0.005), estilo.material('#9a9a90'));
    this.objetos.pano = pano;
    const fone = new THREE.Group();
    const corpoF = new THREE.Mesh(geoCaixaArredondada(0.05, 0.04, 0.2, 0.015), estilo.material('#193f4c')); fone.add(corpoF);
    for (const z of [-0.09, 0.09]) { const p = new THREE.Mesh(geoCaixaArredondada(0.06, 0.05, 0.05, 0.02), estilo.material('#193f4c')); p.position.z = z; fone.add(p); }
    this.objetos.fone = fone;
    // celular: tela recebe a textura do motor
    const celular = new THREE.Group();
    const corpoCel = new THREE.Mesh(geoCaixaArredondada(0.076, 0.156, 0.008, 0.008), estilo.material('#1a1a1a')); celular.add(corpoCel);
    this.telaCelular = new THREE.Mesh(new THREE.PlaneGeometry(0.068, 0.146), new THREE.MeshBasicMaterial({ color: '#e9eef2' })); this.telaCelular.position.z = 0.0045; this.telaCelular.userData.semTraco = true; celular.add(this.telaCelular);
    this.objetos.celular = celular;
    for (const k in this.objetos) { this.objetos[k].visible = false; this.grupo.add(this.objetos[k]); }
    // posições de descanso (sentado ao balcão; balcão a 1,05 m): mãos nos cantos de baixo, dedos apontando para a frente e um pouco para dentro
    this.repouso = {
      esq: { pos: new THREE.Vector3(-0.23, 1.072, -0.43), rot: new THREE.Euler(0.02, 0.26, 0) },
      dir: { pos: new THREE.Vector3(0.24, 1.074, -0.42), rot: new THREE.Euler(0.02, -0.24, 0) },
    };
    this.celularNoBalcao = new THREE.Vector3(0.36, 1.072, -0.55);
    this.balcaoY = 1.05;
  }

  definirTexturaCelular(tex) { this.telaCelular.material = new THREE.MeshBasicMaterial({ map: tex }); }

  // acao: string da direção; tLinha: segundos desde o começo da linha; tremor 0..1
  aplicar(acao, tLinha, t, tremor, acaoAnterior) {
    const [nome, arg] = String(acao || 'parar').split(':');
    const esq = this.maos.esq.grupo, dir = this.maos.dir.grupo;
    const r = this.repouso;
    const respira = Math.sin(t * 1.6) * 0.0025;
    esq.position.copy(r.esq.pos); esq.rotation.copy(r.esq.rot); esq.position.y += respira;
    dir.position.copy(r.dir.pos); dir.rotation.copy(r.dir.rot); dir.position.y += respira * 0.8;
    for (const k in this.objetos) this.objetos[k].visible = false;
    const tremorAmp = tremor * 0.004;
    if (tremorAmp > 0) { dir.position.x += Math.sin(t * 37) * tremorAmp; dir.position.y += Math.sin(t * 29 + 1) * tremorAmp; esq.position.y += Math.sin(t * 31 + 2) * tremorAmp * 0.6; }
    // dedos: leve curvatura de repouso que respira
    for (const lado of ['esq', 'dir']) for (const d of this.dedos[lado]) { d.base.rotation.x = -0.08 + Math.sin(t * 0.9) * 0.015; d.junta.rotation.x = -0.18; }

    // objetos de descanso: bloco sob a mão esquerda; carimbo na mão direita; celular no balcão
    const bloco = this.objetos.bloco_passagens; bloco.visible = true; bloco.position.set(-0.05, 1.065, -0.52); bloco.rotation.set(0, 0.12, 0);
    const caneta = this.objetos.caneta; caneta.visible = true; caneta.position.set(0.12, 1.056, -0.56); caneta.rotation.set(Math.PI / 2, 0, 0.25);
    const carimbo = this.objetos.carimbo; carimbo.visible = true;
    const celular = this.objetos.celular; celular.visible = true; celular.position.copy(this.celularNoBalcao); celular.rotation.set(-Math.PI / 2 + 0.05, 0.3, 0);
    const colocarCarimboNaMaoDireita = () => { carimbo.position.copy(dir.position).add(new THREE.Vector3(0.0, 0.04, -0.03)); carimbo.rotation.set(0, 0, 0); for (const d of this.dedos.dir) { d.base.rotation.x = -0.9; d.junta.rotation.x = -1.1; } };
    colocarCarimboNaMaoDireita();

    const k = suave(tLinha / 0.7);
    if (nome === 'trabalhar') {
      const ciclo = (t % 1.8) / 1.8;
      const sobe = Math.sin(ciclo * Math.PI);
      const indo = ciclo < 0.5 ? suave(ciclo / 0.5) : 1 - suave((ciclo - 0.5) / 0.5);
      dir.position.x = lerp(r.dir.pos.x, 0.02, indo);
      dir.position.z = lerp(r.dir.pos.z, -0.52, indo);
      dir.position.y = r.dir.pos.y + sobe * 0.035 + (ciclo > 0.46 && ciclo < 0.54 ? -0.01 : 0);
      dir.rotation.z = -0.1 * indo;
      colocarCarimboNaMaoDireita();
    } else if (nome === 'segurar' && arg === 'telefone') {
      const alvo = new THREE.Vector3(0.46, this.alturaOlhos - 0.06, -0.02);
      dir.position.lerpVectors(r.dir.pos, alvo, k);
      dir.rotation.set(-0.6 * k, -0.9 * k, 0.8 * k);
      carimbo.position.set(0.2, 1.068, -0.44); carimbo.rotation.set(0, 0, 0);
      const fone = this.objetos.fone; fone.visible = true; fone.position.copy(dir.position).add(new THREE.Vector3(0, -0.02, -0.03)); fone.rotation.copy(dir.rotation);
      for (const d of this.dedos.dir) { d.base.rotation.x = -1.0; d.junta.rotation.x = -1.2; }
    } else if (nome === 'pegar_celular' || nome === 'guardar_celular') {
      const kk = nome === 'pegar_celular' ? k : 1 - k;
      const alvoFinal = new THREE.Vector3(0.06, this.alturaOlhos - 0.32, -0.22);
      const meio = this.celularNoBalcao.clone().add(new THREE.Vector3(0, 0.02, 0.02));
      let p;
      if (kk < 0.4) p = new THREE.Vector3().lerpVectors(r.dir.pos, meio, suave(kk / 0.4));
      else p = new THREE.Vector3().lerpVectors(meio, alvoFinal, suave((kk - 0.4) / 0.6));
      dir.position.copy(p);
      const inclinacao = kk < 0.4 ? 0 : suave((kk - 0.4) / 0.6);
      dir.rotation.set(-1.05 * inclinacao, 0.1, 0.0);
      carimbo.position.set(0.2, 1.068, -0.44); carimbo.rotation.set(0, 0, 0);
      for (const d of this.dedos.dir) { d.base.rotation.x = -0.6; d.junta.rotation.x = -0.8; }
      if (kk >= 0.4) {
        const C = new THREE.Vector3().lerpVectors(meio, alvoFinal, suave((kk - 0.4) / 0.6)).add(new THREE.Vector3(0, 0.1 * inclinacao, 0));
        celular.position.copy(C);
        celular.rotation.set(lerp(-Math.PI / 2 + 0.05, -0.3, inclinacao), 0.03, 0);
        dir.position.copy(C).add(new THREE.Vector3(0.0, -0.13, 0.03));
        dir.rotation.set(lerp(0, 1.3, inclinacao), 0.03, 0);
      }
    } else if (nome === 'segurar' && arg === 'bloco_passagens') {
      const dx = 0.22 * k;
      esq.position.add(new THREE.Vector3(dx, 0.02 * k, 0.03 * k)); dir.position.add(new THREE.Vector3(-0.14 + dx * 0.6, 0.0, 0.02 * k)); dir.rotation.y = 0.35;
      bloco.position.set(-0.12 + dx + 0.05, 1.07 + 0.02 * k, -0.38 + 0.03 * k); bloco.rotation.set(0, 0.1 + 0.2 * k, 0);
      carimbo.position.set(0.2, 1.068, -0.46); carimbo.rotation.set(0, 0, 0);
      for (const d of this.dedos.dir) { d.base.rotation.x = -0.25; d.junta.rotation.x = -0.35; }
    } else if (nome === 'andar') {
      const fase = t * 2 * Math.PI * 1.8;
      esq.position.set(-0.28, 0.80 + Math.sin(fase) * 0.02, -0.26 + Math.sin(fase) * 0.06); esq.rotation.set(0.6, 0.3, 0.5);
      dir.position.set(0.28, 0.80 - Math.sin(fase) * 0.02, -0.26 - Math.sin(fase) * 0.06); dir.rotation.set(0.6, -0.3, -0.5);
      bloco.visible = false; caneta.visible = false; carimbo.visible = false; celular.visible = false;
      for (const lado of ['esq', 'dir']) for (const d of this.dedos[lado]) { d.base.rotation.x = -0.6; d.junta.rotation.x = -0.7; }
    } else {
      if (acaoAnterior && acaoAnterior.startsWith('segurar:telefone') && tLinha < 0.7) {
        const alvo = new THREE.Vector3(0.46, this.alturaOlhos - 0.06, -0.02);
        dir.position.lerpVectors(alvo, r.dir.pos, k); dir.rotation.set(-0.6 * (1 - k), -0.9 * (1 - k), 0.8 * (1 - k));
        carimbo.position.set(0.2, 1.068, -0.44); carimbo.rotation.set(0, 0, 0);
      }
      if (acaoAnterior && acaoAnterior.startsWith('pegar_celular')) {
        const C = new THREE.Vector3(0.06, this.alturaOlhos - 0.22, -0.22);
        celular.position.copy(C); celular.rotation.set(-0.3, 0.03, 0);
        dir.position.copy(C).add(new THREE.Vector3(0, -0.13, 0.03)); dir.rotation.set(1.3, 0.03, 0);
        carimbo.position.set(0.2, 1.068, -0.44); carimbo.rotation.set(0, 0, 0);
        for (const d of this.dedos.dir) { d.base.rotation.x = -0.6; d.junta.rotation.x = -0.8; }
      }
    }
    // antebraços: do punho até um cotovelo fora do quadro; a manga do cotovelo até o ombro; sombra sob a palma
    for (const lado of ['esq', 'dir']) {
      const m = this.maos[lado];
      m.grupo.updateMatrix();
      const punho = new THREE.Vector3(0, -0.003, 0.05).applyMatrix4(m.grupo.matrix);
      const maoPos = m.grupo.position;
      const levantada = clamp((maoPos.y - 1.13) / 0.06, 0, 1);
      const cot = new THREE.Vector3(maoPos.x + m.s * lerp(0.17, 0.12, levantada), maoPos.y - lerp(0.005, 0.33, levantada), maoPos.z + lerp(0.36, 0.08, levantada));
      const omb = new THREE.Vector3(maoPos.x + m.s * lerp(0.26, 0.2, levantada), maoPos.y - lerp(0.42, 0.55, levantada), maoPos.z + lerp(0.62, 0.40, levantada));
      const meio = new THREE.Vector3().lerpVectors(punho, cot, 0.3);
      alinhar(m.ante, punho, meio);
      m.dobra.position.copy(meio); m.dobra.quaternion.copy(m.ante.quaternion); m.dobra.scale.set(1, 1, 1);
      alinhar(m.mangaM, meio, omb);
      const noBalcao = clamp(1 - (maoPos.y - this.balcaoY - 0.03) / 0.08, 0, 1);
      m.sombra.visible = noBalcao > 0.01; m.sombra.position.set(maoPos.x + m.s * 0.01, this.balcaoY + 0.004, maoPos.z - 0.02); m.sombra.material.opacity = 0.16 * noBalcao;
    }
  }
}
