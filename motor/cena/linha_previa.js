// Modo prévia: quando linha_do_tempo.json / medidas.json ainda não existem, o motor monta a mesma linha do tempo da
// etapa 05 (motor/cena/linha_do_tempo.js, fonte única) e envelopes sintéticos para a boca dos bonecos.
import { mulberry32, sementeDeTexto } from './util.js';
import { montarLinhaDoTempo, duracaoEstimada as duracaoBase } from './linha_do_tempo.js';

export function duracaoEstimada(texto, pps = 2.5) { return duracaoBase(texto, pps); }

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

/** Linha do tempo de prévia (mesma regra da produção). `opcoes` repassa as durações do plano de câmera. */
export function construirLinhaDoTempo(roteiro, medidas, canalOuFps = 30, opcoes = {}) {
  const canal = typeof canalOuFps === 'object' && canalOuFps ? canalOuFps : { formato: { fps: canalOuFps } };
  const linha = montarLinhaDoTempo(roteiro, medidas, canal, opcoes);
  linha.previa = true;
  return linha;
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
