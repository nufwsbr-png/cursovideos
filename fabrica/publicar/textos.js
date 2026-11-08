// Monta os textos de cada plataforma a partir de textos.json (contrato §8),
// seguindo a fórmula do capítulo 71: [Situação em uma frase] + [Epi. XX] + [2 a 4 hashtags].
import { LIMITES, cortarTexto, cortarBytes } from './limites.js';

export function numeroEpisodio(numero) {
  return `Epi. ${String(numero).padStart(2, '0')}`;
}

/** Normaliza hashtags: tira '#', espaços e repetições; mantém acentos (as redes aceitam). */
export function normalizarHashtags(lista = [], max = 4) {
  const vistas = new Set();
  const saida = [];
  for (const item of lista) {
    const limpa = String(item || '').replace(/^#+/, '').replace(/\s+/g, '').trim();
    if (!limpa) continue;
    const chave = limpa.toLowerCase();
    if (vistas.has(chave)) continue;
    vistas.add(chave);
    saida.push(limpa);
    if (saida.length >= max) break;
  }
  return saida;
}

export function hashtagsComoTexto(lista = [], max = 4) {
  return normalizarHashtags(lista, max).map((h) => `#${h}`).join(' ');
}

/** A fórmula do capítulo 71. `situacao` já deve vir sem "Epi." no fim. */
export function formulaTexto({ situacao, numero, hashtags = [], max_hashtags = 4 }) {
  const frase = String(situacao || '').trim().replace(/\s+$/, '');
  const jaTemEpisodio = /Epi\.\s*\d+\s*$/i.test(frase);
  const fraseComPonto = jaTemEpisodio || /[.!?…]$/.test(frase) ? frase : `${frase}.`;
  const partes = [fraseComPonto];
  if (numero !== undefined && numero !== null && !jaTemEpisodio) partes.push(numeroEpisodio(numero));
  const tags = hashtagsComoTexto(hashtags, max_hashtags);
  if (tags) partes.push(tags);
  return partes.join(' ');
}

function situacaoBase(textos) {
  // `descricao` do roteiro já costuma vir como "Situação. Epi. 01"; não duplicar o número.
  return String(textos.descricao || textos.titulo || '').trim();
}

function garantirShorts(titulo, max = LIMITES.youtube.titulo_max) {
  let t = String(titulo || '').replace(/[<>]/g, '').trim();
  if (/#shorts\b/i.test(t)) return cortarTexto(t, max);
  const sufixo = ' #Shorts';
  if (t.length + sufixo.length <= max) return t + sufixo;
  return cortarTexto(t, max - sufixo.length) + sufixo;
}

function tagsYoutube(lista, maxTotal = LIMITES.youtube.tags_total_max) {
  const tags = [];
  let total = 0;
  for (const tag of [...normalizarHashtags(lista, 30), 'shorts', 'pov']) {
    const t = tag.toLowerCase();
    if (tags.includes(t)) continue;
    // o YouTube conta cada tag mais 2 caracteres quando ela tem espaço; aqui não há espaço
    if (total + t.length + 1 > maxTotal) break;
    tags.push(t);
    total += t.length + 1;
  }
  return tags;
}

/**
 * textoPara(plataforma, textos, canal) → { titulo, descricao, legenda, tags, comentario_fixado, hashtags }
 * Usa `textos.por_plataforma[plataforma]` quando existir; senão monta pela fórmula.
 */
export function textoPara(plataforma, textos = {}, canal = {}) {
  const maxHashtags = canal?.publicacao?.hashtags_max || 4;
  const hashtags = normalizarHashtags(
    (textos.hashtags && textos.hashtags.length ? textos.hashtags : canal?.publicacao?.hashtags_base) || [],
    maxHashtags,
  );
  const tagsTexto = hashtagsComoTexto(hashtags, maxHashtags);
  const situacao = situacaoBase(textos);
  const porPlataforma = (textos.por_plataforma && textos.por_plataforma[plataforma]) || {};
  const comentario = textos.comentario_fixado || null;
  const base = `${situacao}${tagsTexto ? ' ' + tagsTexto : ''}`.trim();

  switch (plataforma) {
    case 'tiktok':
      return { titulo: cortarTexto(porPlataforma.titulo || base, LIMITES.tiktok.titulo_max), hashtags, comentario_fixado: comentario };
    case 'instagram': {
      const legenda = porPlataforma.legenda || `${situacao}\n\n${tagsTexto}`.trim();
      return { legenda: cortarTexto(legenda, LIMITES.instagram.legenda_max), hashtags, comentario_fixado: comentario };
    }
    case 'facebook': {
      const descricao = porPlataforma.descricao || `${situacao}\n\n${tagsTexto}`.trim();
      return { titulo: cortarTexto(porPlataforma.titulo || textos.titulo || situacao, 255), descricao: cortarTexto(descricao, LIMITES.facebook.descricao_max), hashtags, comentario_fixado: comentario };
    }
    case 'youtube': {
      const titulo = garantirShorts(porPlataforma.titulo || textos.titulo || situacao);
      const descricaoBruta = porPlataforma.descricao || [situacao, tagsTexto, comentario ? `\n${comentario}` : ''].filter(Boolean).join('\n\n');
      return {
        titulo,
        descricao: cortarBytes(descricaoBruta, LIMITES.youtube.descricao_max_bytes),
        tags: tagsYoutube(porPlataforma.tags || hashtags),
        hashtags,
        comentario_fixado: comentario,
      };
    }
    case 'kwai':
      return { legenda: cortarTexto(porPlataforma.legenda || base, LIMITES.kwai.legenda_max), hashtags, comentario_fixado: comentario };
    default:
      return { titulo: base, descricao: base, legenda: base, hashtags, comentario_fixado: comentario };
  }
}
