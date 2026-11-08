// Utilidades compartilhadas pelos publicadores (sem dependências externas).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const AQUI = path.dirname(fileURLToPath(import.meta.url));

export function raizRepo() {
  return path.resolve(AQUI, '..', '..');
}

export function existe(caminho) {
  try { fs.accessSync(caminho); return true; } catch { return false; }
}

export function lerJson(caminho, padrao = undefined) {
  if (!existe(caminho)) {
    if (padrao !== undefined) return padrao;
    throw new ErroPublicacao(`Arquivo não encontrado: ${caminho}`);
  }
  return JSON.parse(fs.readFileSync(caminho, 'utf8'));
}

export function escreverJson(caminho, dados) {
  fs.mkdirSync(path.dirname(caminho), { recursive: true });
  fs.writeFileSync(caminho, JSON.stringify(dados, null, 2) + '\n', 'utf8');
}

/** Lê um arquivo .env simples (CHAVE=valor) sem sobrescrever o que já está no ambiente. */
export function carregarEnv(raiz = raizRepo(), alvo = process.env) {
  const caminho = path.join(raiz, '.env');
  if (!existe(caminho)) return alvo;
  for (const linhaBruta of fs.readFileSync(caminho, 'utf8').split(/\r?\n/)) {
    const linha = linhaBruta.trim();
    if (!linha || linha.startsWith('#')) continue;
    const i = linha.indexOf('=');
    if (i < 0) continue;
    const chave = linha.slice(0, i).trim();
    let valor = linha.slice(i + 1).trim();
    if ((valor.startsWith('"') && valor.endsWith('"')) || (valor.startsWith("'") && valor.endsWith("'"))) {
      valor = valor.slice(1, -1);
    }
    if (alvo[chave] === undefined) alvo[chave] = valor;
  }
  return alvo;
}

/** Mede o vídeo com ffprobe. Devolve campos nulos quando o ffprobe não existe. */
export function infoVideo(arquivo) {
  const base = { arquivo, tamanho_bytes: existe(arquivo) ? fs.statSync(arquivo).size : 0 };
  try {
    const saida = execFileSync('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', arquivo], { encoding: 'utf8' });
    const dados = JSON.parse(saida);
    const video = (dados.streams || []).find((s) => s.codec_type === 'video') || {};
    const audio = (dados.streams || []).find((s) => s.codec_type === 'audio') || {};
    const [num, den] = String(video.r_frame_rate || '0/1').split('/').map(Number);
    return {
      ...base,
      duracao_s: Number(dados.format?.duration || video.duration || 0),
      largura: video.width || null,
      altura: video.height || null,
      fps: den ? Math.round((num / den) * 100) / 100 : null,
      codec_video: video.codec_name || null,
      codec_audio: audio.codec_name || null,
      formato: dados.format?.format_name || null,
    };
  } catch {
    return { ...base, duracao_s: null, largura: null, altura: null, fps: null, codec_video: null, codec_audio: null, formato: null, aviso: 'ffprobe indisponível: duração e dimensões não conferidas' };
  }
}

export function hojeISO(data = new Date()) {
  return data.toISOString().slice(0, 10);
}

export function agoraISO() {
  return new Date().toISOString();
}

export function dormir(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Esconde segredos em registros: mostra só os 4 primeiros caracteres. */
export function redigir(valor) {
  if (valor === undefined || valor === null) return valor;
  const texto = String(valor);
  if (texto.length <= 8) return '****';
  return texto.slice(0, 4) + '…' + '*'.repeat(Math.min(8, texto.length - 4));
}

export function redigirHeaders(headers = {}) {
  const saida = {};
  for (const [chave, valor] of Object.entries(headers)) {
    const k = chave.toLowerCase();
    if (k === 'authorization' || k === 'apikey' || k.includes('token') || k.includes('secret') || k.includes('key')) {
      saida[chave] = redigir(valor);
    } else {
      saida[chave] = valor;
    }
  }
  return saida;
}

export function redigirUrl(url) {
  try {
    const u = new URL(url);
    for (const nome of ['access_token', 'client_secret', 'refresh_token', 'code', 'fb_exchange_token']) {
      if (u.searchParams.has(nome)) u.searchParams.set(nome, redigir(u.searchParams.get(nome)));
    }
    return u.toString();
  } catch {
    return url;
  }
}

export class ErroPublicacao extends Error {
  constructor(mensagem, detalhes = {}) {
    super(mensagem);
    this.name = 'ErroPublicacao';
    this.detalhes = detalhes;
  }
}

/** Nome do MP4 final do episódio: epNN.mp4 (NN = número do roteiro com dois dígitos). */
export function nomeArquivoFinal(numero) {
  return `ep${String(numero).padStart(2, '0')}.mp4`;
}

/** Encontra o MP4 final dentro da pasta do episódio. */
export function acharVideoFinal(dirEpisodio, roteiro) {
  if (roteiro?.numero !== undefined) {
    const esperado = path.join(dirEpisodio, nomeArquivoFinal(roteiro.numero));
    if (existe(esperado)) return esperado;
  }
  const candidatos = fs.readdirSync(dirEpisodio)
    .filter((n) => n.toLowerCase().endsWith('.mp4') && !n.includes('mudo') && !n.includes('teste'))
    .map((n) => path.join(dirEpisodio, n));
  return candidatos[0] || null;
}

export function variaveisFaltando(env, nomes) {
  return nomes.filter((n) => !env[n] || String(env[n]).trim() === '');
}

export function slugDe(texto) {
  return String(texto || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'episodio';
}
