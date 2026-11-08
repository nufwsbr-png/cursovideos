// Modo prévia: deriva uma linha do tempo nominal a partir do roteiro (seção 5 e 11 do contrato),
// usada quando linha_do_tempo.json / medidas.json ainda não existem.
// Também produz envelopes sintéticos para a boca dos bonecos.
import { mulberry32, sementeDeTexto } from './util.js';

const PALAVRAS_POR_SEGUNDO = 2.5;
const FOLGA_ENTRE_FALAS = 0.35;

export function duracaoEstimada(texto) {
  const palavras = String(texto).trim().split(/\s+/).filter(Boolean).length;
  const pausas = (String(texto).match(/\.\.\./g) || []).length;
  return palavras / PALAVRAS_POR_SEGUNDO + 0.3 + pausas * 0.5;
}

export function envelopeSintetico(duracao, semente, passo = 0.05) {
  const rnd = mulberry32(semente);
  const n = Math.max(1, Math.round(duracao / passo));
  const env = [];
  const freq = 3.6 + rnd() * 1.0; // sílabas por segundo
  const fase = rnd() * Math.PI * 2;
  for (let i = 0; i < n; i++) {
    const t = i * passo;
    const borda = Math.min(1, t / 0.08, (duracao - t) / 0.12);
    const silaba = 0.55 + 0.45 * Math.max(0, Math.sin(t * freq * Math.PI * 2 + fase));
    const variacao = 0.8 + rnd() * 0.3;
    env.push(Math.max(0, Math.min(1, borda * silaba * variacao)));
  }
  return env;
}

// Constrói linha do tempo. `medidas` é opcional: se existir, usa as durações reais.
export function construirLinhaDoTempo(roteiro, medidas, fps = 30) {
  const falasPorId = Object.fromEntries((roteiro.falas || []).map(f => [f.id, f]));
  const linhas = [];
  const falas = [];
  let deslocamento = 0;
  const nominais = roteiro.linhas || [];
  for (let i = 0; i < nominais.length; i++) {
    const l = nominais[i];
    const inicio = l.t + deslocamento;
    let fimFala = null;
    if (l.fala && falasPorId[l.fala]) {
      const f = falasPorId[l.fala];
      const m = medidas && medidas[l.fala];
      const dur = m && m.duracao_s ? m.duracao_s : duracaoEstimada(f.texto);
      fimFala = inicio + dur;
      falas.push({ id: f.id, quem: f.quem, inicio_s: inicio, fim_s: fimFala, filtro: f.filtro || null, texto: f.texto });
      const proximoNominal = i + 1 < nominais.length ? nominais[i + 1].t + deslocamento : null;
      if (proximoNominal !== null && fimFala + FOLGA_ENTRE_FALAS > proximoNominal) {
        deslocamento += (fimFala + FOLGA_ENTRE_FALAS) - proximoNominal;
      }
    }
    linhas.push({ indice: i, t_nominal: l.t, inicio_s: inicio, fim_s: null, ato: l.ato, fala: l.fala || null, imagem: l.imagem || '', direcao: l.direcao || {} });
  }
  for (let i = 0; i < linhas.length; i++) {
    linhas[i].fim_s = i + 1 < linhas.length ? linhas[i + 1].inicio_s : linhas[i].inicio_s + 5;
  }
  const ultimaFala = falas.reduce((m, f) => Math.max(m, f.fim_s), 0);
  const ultima = linhas[linhas.length - 1];
  const duracaoTotal = Math.max(ultima ? ultima.inicio_s + 5 : 5, ultimaFala + 1);
  if (ultima) ultima.fim_s = duracaoTotal;

  // climas
  const climas = [];
  let climaAtual = null;
  for (const l of linhas) {
    const c = (l.direcao && l.direcao.clima) || 'rotina';
    if (c !== climaAtual) { climas.push({ inicio_s: l.inicio_s, clima: c }); climaAtual = c; }
  }
  // celular
  const celular = [];
  for (const l of linhas) {
    for (const ev of (l.direcao?.eventos || [])) {
      const m = /^celular\.(tela|notificacao)=(\d+)$/.exec(ev);
      if (m && m[1] === 'notificacao') {
        const msg = (roteiro.celular || [])[Number(m[2])];
        if (msg) celular.push({ inicio_s: l.inicio_s, de: msg.de, texto: msg.texto, tipo: msg.tipo || 'mensagem' });
      }
    }
  }
  const efeitos = (roteiro.efeitos_extra || []).map(e => ({ ...e, t: deslocar(e.t, nominais, linhas) }));
  const silencios = (roteiro.silencios || []).map(s => ({ inicio_s: deslocar(s.inicio_s, nominais, linhas), fim_s: deslocar(s.fim_s, nominais, linhas) }));
  let pergunta = null;
  const linhaPergunta = linhas.find(l => l.direcao?.clima === 'pergunta');
  if (roteiro.dilema) {
    pergunta = { inicio_s: linhaPergunta ? linhaPergunta.inicio_s : duracaoTotal - 5, fim_s: duracaoTotal, ...roteiro.dilema };
  }
  return {
    fps, duracao_total_s: Number(duracaoTotal.toFixed(3)), previa: true,
    falas, linhas, climas, celular, efeitos,
    ambiente: [{ inicio_s: 0, fim_s: duracaoTotal, tipo: 'saguao_noite', ganho_db: -26 }],
    silencios, pergunta,
  };
}

// Converte um tempo nominal do roteiro para o tempo real, usando o deslocamento da linha anterior.
function deslocar(tNominal, nominais, linhas) {
  let desl = 0;
  for (let i = 0; i < nominais.length; i++) {
    if (nominais[i].t <= tNominal) desl = linhas[i].inicio_s - nominais[i].t; else break;
  }
  return tNominal + desl;
}

export function medidasSinteticas(roteiro, linha) {
  const medidas = {};
  for (const f of linha.falas) {
    const dur = f.fim_s - f.inicio_s;
    medidas[f.id] = {
      arquivo: null, duracao_s: dur, inicio_voz_s: 0.05, fim_voz_s: Math.max(0.1, dur - 0.08),
      rms_dbfs: -20, pico_dbfs: -3, envelope_passo_s: 0.05,
      envelope: envelopeSintetico(dur, sementeDeTexto(f.id + f.texto)), transcricao: null, igual: null, sintetico: true,
    };
  }
  return medidas;
}
