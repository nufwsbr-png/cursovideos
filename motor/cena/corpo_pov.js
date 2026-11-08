// Corpo em primeira pessoa (capítulo 58): duas mãos com antebraços saindo da borda de baixo.
// Braço nunca estica; a mão recolhe perto de objetos; nada atravessa a câmera.
import * as THREE from 'three';
import { escurecer } from './estilo.js';
import { clamp, lerp, suave } from './util.js';

function cilindroEntre(estilo, a, b, raioA, raioB, cor) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const comp = dir.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(raioA, raioB, comp, 10), estilo.material(cor));
  m.position.copy(a).add(dir.clone().multiplyScalar(0.5));
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return m;
}

function alinhar(mesh, a, b) {
  const dir = new THREE.Vector3().subVectors(b, a); const comp = dir.length();
  mesh.position.copy(a).add(dir.clone().multiplyScalar(0.5));
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  mesh.scale.set(1, comp, 1);
}

export class CorpoPOV {
  constructor(protagonista, estilo, cores) {
    this.estilo = estilo;
    const maos = protagonista.maos || {};
    this.pele = maos.pele || '#7a4a28';
    this.manga = maos.manga || '#a9c7e8';
    this.grupo = new THREE.Group(); this.grupo.name = 'corpo_pov';
    this.maos = {};
    for (const lado of ['esq', 'dir']) {
      const g = new THREE.Group();
      const s = lado === 'esq' ? -1 : 1;
      // palma
      const palma = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.028, 0.095), estilo.material(this.pele)); g.add(palma);
      // dedos: 4 em frente, levemente curvados; tratados como um bloco com sulcos (menos linhas entre dedos)
      const dedos = new THREE.Group(); dedos.position.set(0, -0.002, -0.05);
      for (let i = 0; i < 4; i++) {
        const d = new THREE.Mesh(new THREE.BoxGeometry(0.019, 0.022, 0.055), estilo.material(this.pele));
        d.position.set((i - 1.5) * 0.021, 0, -0.025); d.rotation.x = -0.35 - i * 0.03; dedos.add(d);
      }
      g.add(dedos);
      const polegar = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.05), estilo.material(this.pele));
      polegar.position.set(-s * 0.05, -0.002, -0.01); polegar.rotation.y = s * 0.6; polegar.rotation.x = -0.3; g.add(polegar);
      if (lado === 'esq' && /esparadrapo/i.test(maos.detalhe || '')) {
        const esp = new THREE.Mesh(new THREE.BoxGeometry(0.023, 0.026, 0.02), estilo.material('#f3efe6')); esp.position.set((0 - 1.5) * 0.021, 0, -0.08); esp.rotation.x = -0.35; dedos.add(esp);
      }
      // antebraço: do punho para baixo/trás (sai do quadro pela borda inferior). Manga dobrada mais atrás.
      // antebraço e manga são alinhados a cada quadro entre o punho (atrás da palma) e um cotovelo fixo fora do quadro
      const ante = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.031, 1, 10), estilo.material(this.pele));
      const mangaM = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.046, 1, 10), estilo.material(this.manga));
      const dobra = new THREE.Mesh(new THREE.CylinderGeometry(0.039, 0.039, 0.04, 10), estilo.material(escurecer(this.manga, 0.8)));
      this.grupo.add(ante); this.grupo.add(mangaM); this.grupo.add(dobra);
      const cotovelo = new THREE.Vector3(s * 0.2, 0.62, 0.22);
      const ombro = new THREE.Vector3(s * 0.26, 0.45, 0.65);
      this.grupo.add(g);
      this.maos[lado] = { grupo: g, palma, dedos, polegar, ante, mangaM, dobra, cotovelo, ombro, s };
    }
    // objetos
    this.objetos = {};
    const carimbo = new THREE.Group();
    const cabo = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.07, 8), estilo.material('#8a5a3a')); cabo.position.y = -0.03; carimbo.add(cabo);
    const botao = new THREE.Mesh(new THREE.SphereGeometry(0.013, 8, 6), estilo.material('#8a5a3a')); botao.position.y = 0.012; carimbo.add(botao);
    const baseC = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.018, 0.035), estilo.material('#2a2a2a')); baseC.position.y = -0.072; carimbo.add(baseC);
    this.objetos.carimbo = carimbo;
    const bloco = new THREE.Group();
    const blocoM = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.03, 0.11), estilo.material('#f2d95c')); bloco.add(blocoM);
    const linhas = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.002, 0.004), estilo.material('#6b5a1a')); linhas.position.set(0, 0.016, -0.02); bloco.add(linhas);
    const linhas2 = linhas.clone(); linhas2.position.z = 0.0; bloco.add(linhas2);
    const linhas3 = linhas.clone(); linhas3.position.z = 0.02; bloco.add(linhas3);
    const carimbado = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.002, 0.03), estilo.material('#3a4f8a')); carimbado.position.set(0.04, 0.0165, 0.03); carimbado.rotation.y = 0.2; bloco.add(carimbado);
    this.objetos.bloco_passagens = bloco;
    const caneta = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.003, 0.14, 6), estilo.material('#2b4fb0')); caneta.rotation.z = Math.PI / 2; caneta.rotation.y = 0.3;
    this.objetos.caneta = caneta;
    const pano = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.012, 0.1), estilo.material('#9a9a90'));
    this.objetos.pano = pano;
    const fone = new THREE.Group();
    const corpoF = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.2), estilo.material('#193f4c')); fone.add(corpoF);
    for (const z of [-0.09, 0.09]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.05), estilo.material('#193f4c')); p.position.z = z; fone.add(p); }
    this.objetos.fone = fone;
    // celular: tela recebe a textura do motor
    const celular = new THREE.Group();
    const corpoCel = new THREE.Mesh(new THREE.BoxGeometry(0.076, 0.156, 0.008), estilo.material('#1a1a1a')); celular.add(corpoCel);
    this.telaCelular = new THREE.Mesh(new THREE.PlaneGeometry(0.068, 0.146), new THREE.MeshBasicMaterial({ color: '#e9eef2', opacity: 0.99, transparent: true, blending: THREE.NoBlending })); this.telaCelular.position.z = 0.0045; celular.add(this.telaCelular);
    this.objetos.celular = celular;
    for (const k in this.objetos) { this.objetos[k].visible = false; this.grupo.add(this.objetos[k]); }
    // posições de descanso (sentado ao balcão; balcão a 1,05 m)
    this.repouso = {
      esq: { pos: new THREE.Vector3(-0.13, 1.082, -0.36), rot: new THREE.Euler(0, 0.18, 0) },
      dir: { pos: new THREE.Vector3(0.15, 1.098, -0.35), rot: new THREE.Euler(0, -0.15, 0) },
    };
    this.celularNoBalcao = new THREE.Vector3(0.30, 1.072, -0.30);
  }

  definirTexturaCelular(tex) { this.telaCelular.material = new THREE.MeshBasicMaterial({ map: tex, opacity: 0.99, transparent: true, blending: THREE.NoBlending }); }

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

    // objetos de descanso: bloco sob a mão esquerda; carimbo na mão direita; celular no balcão
    const bloco = this.objetos.bloco_passagens; bloco.visible = true; bloco.position.set(-0.12, 1.065, -0.38); bloco.rotation.set(0, 0.1, 0);
    const caneta = this.objetos.caneta; caneta.visible = true; caneta.position.set(0.02, 1.056, -0.46); caneta.rotation.set(Math.PI / 2, 0, 0.25); 
    const carimbo = this.objetos.carimbo; carimbo.visible = true;
    const celular = this.objetos.celular; celular.visible = true; celular.position.copy(this.celularNoBalcao); celular.rotation.set(-Math.PI / 2 + 0.05, 0.3, 0);
    const colocarCarimboNaMaoDireita = () => { carimbo.position.copy(dir.position).add(new THREE.Vector3(0.005, 0.035, -0.035)); carimbo.rotation.set(0, 0, 0); };
    colocarCarimboNaMaoDireita();

    const k = suave(tLinha / 0.7);
    if (nome === 'trabalhar') {
      // carimbar: a mão direita sobe, vai até o bloco e bate
      const ciclo = (t % 1.8) / 1.8;
      const sobe = Math.sin(ciclo * Math.PI);
      const indo = ciclo < 0.5 ? suave(ciclo / 0.5) : 1 - suave((ciclo - 0.5) / 0.5);
      dir.position.x = lerp(r.dir.pos.x, -0.06, indo);
      dir.position.z = lerp(r.dir.pos.z, -0.39, indo);
      dir.position.y = r.dir.pos.y + sobe * 0.035 + (ciclo > 0.46 && ciclo < 0.54 ? -0.01 : 0);
      dir.rotation.z = -0.1 * indo;
      colocarCarimboNaMaoDireita();
    } else if (nome === 'segurar' && arg === 'telefone') {
      // a mão direita leva o fone ao ouvido: sai pela borda direita do quadro
      const alvo = new THREE.Vector3(0.46, 1.42, -0.02);
      dir.position.lerpVectors(r.dir.pos, alvo, k);
      dir.rotation.set(-0.6 * k, -0.9 * k, 0.8 * k);
      carimbo.position.set(0.2, 1.068, -0.44); carimbo.rotation.set(0, 0, 0); // carimbo deixado no balcão
      const fone = this.objetos.fone; fone.visible = true; fone.position.copy(dir.position).add(new THREE.Vector3(0, -0.02, -0.03)); fone.rotation.copy(dir.rotation);
    } else if (nome === 'pegar_celular' || nome === 'guardar_celular') {
      const kk = nome === 'pegar_celular' ? k : 1 - k;
      // fase 1: mão vai ao celular no balcão; fase 2: traz para a frente dos olhos
      const alvoFinal = new THREE.Vector3(0.06, 1.165, -0.22);
      const meio = this.celularNoBalcao.clone().add(new THREE.Vector3(0, 0.02, 0.02));
      let p;
      if (kk < 0.4) p = new THREE.Vector3().lerpVectors(r.dir.pos, meio, suave(kk / 0.4));
      else p = new THREE.Vector3().lerpVectors(meio, alvoFinal, suave((kk - 0.4) / 0.6));
      dir.position.copy(p);
      const inclinacao = kk < 0.4 ? 0 : suave((kk - 0.4) / 0.6);
      dir.rotation.set(-1.05 * inclinacao, 0.1, 0.0);
      carimbo.position.set(0.2, 1.068, -0.44); carimbo.rotation.set(0, 0, 0);
      if (kk >= 0.4) {
        // celular segurado por baixo: a palma fica abaixo da borda inferior, os dedos sobem só até o rodapé da tela (nada tampa a mensagem)
        const C = new THREE.Vector3().lerpVectors(meio, alvoFinal, suave((kk - 0.4) / 0.6)).add(new THREE.Vector3(0, 0.1 * inclinacao, 0));
        celular.position.copy(C);
        celular.rotation.set(lerp(-Math.PI / 2 + 0.05, -0.3, inclinacao), 0.03, 0);
        dir.position.copy(C).add(new THREE.Vector3(0.0, -0.13, 0.03));
        dir.rotation.set(lerp(0, 1.3, inclinacao), 0.03, 0);
      }
    } else if (nome === 'segurar' && arg === 'bloco_passagens') {
      // as duas mãos levantam o bloco e o levam para a direita (guardando)
      const dx = 0.22 * k;
      esq.position.add(new THREE.Vector3(dx, 0.02 * k, 0.03 * k)); dir.position.add(new THREE.Vector3(-0.14 + dx * 0.6, 0.0, 0.02 * k)); dir.rotation.y = 0.35;
      bloco.position.set(-0.12 + dx + 0.05, 1.07 + 0.02 * k, -0.38 + 0.03 * k); bloco.rotation.set(0, 0.1 + 0.2 * k, 0);
      carimbo.position.set(0.2, 1.068, -0.46); carimbo.rotation.set(0, 0, 0);
    } else if (nome === 'andar') {
      const fase = t * 2 * Math.PI * 1.8;
      esq.position.set(-0.26, 0.78 + Math.sin(fase) * 0.02, -0.25 + Math.sin(fase) * 0.06);
      dir.position.set(0.26, 0.78 - Math.sin(fase) * 0.02, -0.25 - Math.sin(fase) * 0.06);
      bloco.visible = false; caneta.visible = false; carimbo.visible = false; celular.visible = false;
    } else {
      // parar / voltar / aproximar / fade / tremor: mãos em repouso
      if (acaoAnterior && acaoAnterior.startsWith('segurar:telefone') && tLinha < 0.7) {
        // volta do telefone: a mão desce de volta
        const alvo = new THREE.Vector3(0.46, 1.42, -0.02);
        dir.position.lerpVectors(alvo, r.dir.pos, k); dir.rotation.set(-0.6 * (1 - k), -0.9 * (1 - k), 0.8 * (1 - k));
        carimbo.position.set(0.2, 1.068, -0.44); carimbo.rotation.set(0, 0, 0);
      }
      if (acaoAnterior && acaoAnterior.startsWith('pegar_celular')) {
        // continua com o celular na mão enquanto a ação não for guardar
        const C = new THREE.Vector3(0.06, 1.265, -0.22);
        celular.position.copy(C); celular.rotation.set(-0.3, 0.03, 0);
        dir.position.copy(C).add(new THREE.Vector3(0, -0.13, 0.03)); dir.rotation.set(1.3, 0.03, 0);
        carimbo.position.set(0.2, 1.068, -0.44); carimbo.rotation.set(0, 0, 0);
      }
    }
    // antebraços: do punho (atrás da palma) até o cotovelo fixo, e a manga do cotovelo até o ombro
    for (const lado of ['esq', 'dir']) {
      const m = this.maos[lado];
      m.grupo.updateMatrix();
      const punho = new THREE.Vector3(0, -0.004, 0.05).applyMatrix4(m.grupo.matrix); // espaço local do corpo
      const maoPos = m.grupo.position;
      // Mão no balcão: o antebraço vai para trás, apoiado, e sai do quadro por baixo (como quem está sentado atendendo).
      // Mão levantada (celular, fone): o cotovelo desce quase na vertical e se afasta um pouco para o lado.
      const levantada = clamp((maoPos.y - 1.13) / 0.03, 0, 1);
      const cot = new THREE.Vector3(maoPos.x + m.s * lerp(0.07, 0.12, levantada), maoPos.y - lerp(0.20, 0.33, levantada), maoPos.z + lerp(0.28, 0.08, levantada));
      const omb = new THREE.Vector3(maoPos.x + m.s * 0.2, maoPos.y - lerp(0.60, 0.55, levantada), maoPos.z + lerp(0.52, 0.40, levantada));
      const meio = new THREE.Vector3().lerpVectors(punho, cot, 0.5);
      alinhar(m.ante, punho, meio);
      m.dobra.position.copy(meio); m.dobra.quaternion.copy(m.ante.quaternion); m.dobra.scale.set(1, 1, 1);
      alinhar(m.mangaM, meio, omb);
    }

  }
}
