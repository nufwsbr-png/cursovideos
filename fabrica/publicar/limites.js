// Limites por plataforma usados para avisar, cortar textos e recusar arquivos fora do padrão.
// Fonte: conhecimento das APIs oficiais até 2025 — NÃO CONFERIDO NA DOC nesta sessão (rede bloqueada).
// Confira em docs/LIMITES_PLATAFORMAS.md e nos links oficiais antes de confiar num número para dinheiro ou conta.

const MB = 1024 * 1024;
const GB = 1024 * MB;

export const LIMITES = {
  tiktok: {
    duracao_min_s: 3,
    duracao_max_s: 600,            // o valor real vem de creator_info.max_video_post_duration_sec
    tamanho_max_bytes: 4 * GB,
    titulo_max: 2200,
    hashtags_max: 30,
    pedaco_min_bytes: 5 * MB,
    pedaco_max_bytes: 64 * MB,
    pedaco_padrao_bytes: 10 * MB,
    pedacos_max: 1000,
    proporcao_recomendada: '9:16',
    formatos: ['mp4', 'mov', 'webm'],
  },
  instagram: {
    duracao_min_s: 3,
    duracao_max_s: 900,
    tamanho_max_bytes: 1 * GB,
    legenda_max: 2200,
    hashtags_max: 30,
    largura_min: 540,
    fps_min: 23,
    fps_max: 60,
    publicacoes_24h: 50,
    proporcao_recomendada: '9:16',
    formatos: ['mp4', 'mov'],
  },
  facebook: {
    reels: { duracao_min_s: 3, duracao_max_s: 90, tamanho_max_bytes: 1 * GB, largura_min: 540, fps_min: 24, fps_max: 60, proporcao: '9:16' },
    video: { duracao_max_s: 240 * 60, tamanho_max_bytes: 10 * GB },
    descricao_max: 2200,
    formatos: ['mp4', 'mov'],
  },
  youtube: {
    titulo_max: 100,
    descricao_max_bytes: 5000,
    tags_total_max: 500,
    shorts_duracao_max_s: 180,
    tamanho_max_bytes: 256 * GB,
    quota_insert: 1600,
    formatos: ['mp4', 'mov', 'webm', 'avi'],
  },
  kwai: {
    duracao_max_s: 600,            // palpite conservador; sem API pública, o limite real aparece no aplicativo
    legenda_max: 1000,
    tamanho_max_bytes: 1 * GB,
    formatos: ['mp4'],
  },
};

/** Corta no limite sem partir palavra e, sobretudo, sem partir hashtag (#) ou menção (@). */
export function cortarTexto(texto, max) {
  if (!texto) return '';
  const limpo = String(texto).trim();
  if (limpo.length <= max) return limpo;
  let corte = limpo.slice(0, max);
  // volta até o último espaço para não quebrar palavra
  const ultimoEspaco = corte.lastIndexOf(' ');
  if (ultimoEspaco > 0) corte = corte.slice(0, ultimoEspaco);
  // remove hashtag/menção que ficou incompleta no fim (o token original continuava depois do corte)
  const tokens = corte.split(/\s+/);
  const ultimo = tokens[tokens.length - 1] || '';
  const posicaoOriginal = corte.length;
  const continuava = /\S/.test(limpo.charAt(posicaoOriginal));
  if ((ultimo.startsWith('#') || ultimo.startsWith('@')) && continuava) tokens.pop();
  return tokens.join(' ').trim();
}

/** Corta por bytes UTF-8 (YouTube conta a descrição em bytes). */
export function cortarBytes(texto, maxBytes) {
  if (!texto) return '';
  let saida = String(texto);
  const codificador = new TextEncoder();
  while (codificador.encode(saida).length > maxBytes) {
    const ultimoEspaco = saida.lastIndexOf(' ');
    saida = ultimoEspaco > 0 ? saida.slice(0, ultimoEspaco) : saida.slice(0, -1);
  }
  return saida.trim();
}

/** Valida o arquivo contra os limites de uma plataforma. Devolve { ok, erros, avisos }. */
export function validarArquivo(plataforma, info, opcoes = {}) {
  const erros = [];
  const avisos = [];
  const extensao = String(info.arquivo || '').split('.').pop().toLowerCase();
  const d = info.duracao_s;
  const checarProporcao = () => {
    if (info.largura && info.altura && info.largura > info.altura) avisos.push('vídeo horizontal: o formato recomendado para este canal é vertical 9:16');
  };
  if (d === null || d === undefined) avisos.push('duração não medida (ffprobe indisponível)');

  switch (plataforma) {
    case 'tiktok': {
      const L = LIMITES.tiktok;
      if (!L.formatos.includes(extensao)) erros.push(`formato .${extensao} não aceito pelo TikTok`);
      if (info.tamanho_bytes > L.tamanho_max_bytes) erros.push('arquivo acima de 4 GB');
      const maximo = opcoes.duracao_max_s || L.duracao_max_s;
      if (d !== null && d !== undefined) {
        if (d < L.duracao_min_s) erros.push(`vídeo com menos de ${L.duracao_min_s} s`);
        if (d > maximo) erros.push(`vídeo com ${Math.round(d)} s, acima do máximo da conta (${maximo} s)`);
      }
      checarProporcao();
      break;
    }
    case 'instagram': {
      const L = LIMITES.instagram;
      if (!L.formatos.includes(extensao)) erros.push(`formato .${extensao} não aceito para Reels`);
      if (info.tamanho_bytes > L.tamanho_max_bytes) erros.push('arquivo acima de 1 GB');
      if (d !== null && d !== undefined) {
        if (d < L.duracao_min_s) erros.push('Reels precisa de pelo menos 3 s');
        if (d > L.duracao_max_s) erros.push('Reels aceita no máximo 15 minutos');
      }
      if (info.largura && info.largura < L.largura_min) avisos.push(`largura ${info.largura} px abaixo do mínimo recomendado (${L.largura_min})`);
      if (info.fps && (info.fps < L.fps_min || info.fps > L.fps_max)) avisos.push(`fps ${info.fps} fora da faixa ${L.fps_min}-${L.fps_max}`);
      checarProporcao();
      break;
    }
    case 'facebook': {
      const L = LIMITES.facebook;
      if (!L.formatos.includes(extensao)) erros.push(`formato .${extensao} não aceito pelo Facebook`);
      if (d !== null && d !== undefined && d > L.reels.duracao_max_s) avisos.push(`vídeo com ${Math.round(d)} s: acima de ${L.reels.duracao_max_s} s será publicado como vídeo comum da Página, não como Reels`);
      if (d !== null && d !== undefined && d < L.reels.duracao_min_s) erros.push('vídeo com menos de 3 s');
      if (info.tamanho_bytes > L.video.tamanho_max_bytes) erros.push('arquivo acima de 10 GB');
      checarProporcao();
      break;
    }
    case 'youtube': {
      const L = LIMITES.youtube;
      if (!L.formatos.includes(extensao)) erros.push(`formato .${extensao} não aceito pelo YouTube`);
      if (info.tamanho_bytes > L.tamanho_max_bytes) erros.push('arquivo acima de 256 GB');
      if (d !== null && d !== undefined && d > L.shorts_duracao_max_s) avisos.push(`vídeo com ${Math.round(d)} s: acima de ${L.shorts_duracao_max_s} s o YouTube não trata como Shorts`);
      break;
    }
    case 'kwai': {
      const L = LIMITES.kwai;
      if (!L.formatos.includes(extensao)) erros.push(`formato .${extensao} não aceito pelo Kwai`);
      if (info.tamanho_bytes > L.tamanho_max_bytes) erros.push('arquivo acima de 1 GB');
      if (d !== null && d !== undefined && d > L.duracao_max_s) avisos.push(`vídeo com ${Math.round(d)} s pode ultrapassar o limite do Kwai`);
      break;
    }
    default:
      erros.push(`plataforma desconhecida: ${plataforma}`);
  }
  return { ok: erros.length === 0, erros, avisos };
}
