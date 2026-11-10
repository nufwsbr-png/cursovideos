// A linha do tempo do episódio — fonte única de tempos (o motor em prévia e a etapa 05 usam esta função; o Python só
// acrescenta os efeitos de som em cima das linhas já resolvidas). Regra: "a voz manda" e o corpo também — cada linha
// ocupa o tempo até max(fim da fala + 0,35 s; fim do movimento + 0,15 s; fim da transição); se passar do `t` nominal
// da linha seguinte, tudo depois desliza. A pergunta final começa no mínimo `respiro` s depois da última fala e dura
// `pergunta_duracao_s`. Função pura: mesmos dados, mesma linha do tempo.

export const FOLGA_S = 0.35;

/** Contagem de palavras igual à do Python (audio/_comum.py: normalizar_texto + split). */
export function contarPalavras(texto) {
  return String(texto || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean).length;
}

export function duracaoEstimada(texto, pps = 2.5) { return contarPalavras(texto) / pps + 0.3; }

const ehPergunta = (l) => l.ato === 'pergunta' || l.direcao?.clima === 'pergunta';
const r3 = (v) => Math.round(v * 1000) / 1000;

/**
 * @param roteiro   roteiro.json
 * @param medidas   medidas.json (opcional; durações reais das falas)
 * @param canal     canal.json (pps, duração da pergunta, cartões, ambientes)
 * @param opcoes.duracoes  por linha: { movimento_s, transicao_s, t_eventos_rel, movimento, transicao } (do plano de câmera)
 * @param opcoes.ambientes por linha: tipo de ambiente onde a câmera está (do plano de câmera)
 */
export function montarLinhaDoTempo(roteiro, medidas, canal, opcoes = {}) {
  canal = canal || {};
  const fps = canal.formato?.fps ?? 30;
  const pps = Number(canal.vozes?.palavras_por_segundo_estimadas ?? 2.5);
  const durPergunta = Number(canal.roteiro?.pergunta_duracao_s ?? canal.estilo?.pergunta?.duracao_s ?? 4.0);
  const respiro = Number(canal.estilo?.pergunta?.respiro_min_s ?? 1.0);
  const cartao = canal.estilo?.cartao || {};
  const duracoes = opcoes.duracoes || [];
  const falasPorId = Object.fromEntries((roteiro.falas || []).map((f) => [f.id, f]));
  const nominais = roteiro.linhas || [];

  const durFala = (id) => {
    const m = medidas && medidas[id];
    if (m && Number(m.duracao_s) > 0) return Number(m.duracao_s);
    return duracaoEstimada(falasPorId[id]?.texto, pps);
  };

  let desloc = 0, fimUltimaFala = 0;
  const linhas = [], falas = [], deslocamentos = [];
  for (let i = 0; i < nominais.length; i++) {
    const l = nominais[i];
    let inicio = Number(l.t) + desloc;
    if (ehPergunta(l) && fimUltimaFala > 0 && inicio < fimUltimaFala + respiro) {
      desloc += fimUltimaFala + respiro - inicio;
      inicio = Number(l.t) + desloc;
    }
    deslocamentos.push([Number(l.t), desloc]);
    const d = duracoes[i] || {};
    const tEventos = inicio + (Number(d.t_eventos_rel) || 0);
    let ocupa = inicio;
    if (l.fala && falasPorId[l.fala]) {
      const f = falasPorId[l.fala];
      // numa transição pelo preto, a fala (se houver) entra quando a imagem volta
      const iniFala = d.transicao ? inicio + (Number(d.transicao.saida_s) || 0) + (Number(d.transicao.segurar_s) || 0) : inicio;
      const fim = iniFala + durFala(l.fala);
      falas.push({ id: f.id, quem: f.quem, inicio_s: r3(iniFala), fim_s: r3(fim), filtro: f.filtro || null, texto: f.texto });
      fimUltimaFala = Math.max(fimUltimaFala, fim);
      ocupa = Math.max(ocupa, fim + FOLGA_S);
    }
    if (Number(d.movimento_s) > 0) ocupa = Math.max(ocupa, inicio + Number(d.movimento_s) + 0.15);
    if (Number(d.transicao_s) > 0) ocupa = Math.max(ocupa, inicio + Number(d.transicao_s));
    if (i + 1 < nominais.length) {
      const prox = Number(nominais[i + 1].t) + desloc;
      if (ocupa > prox) desloc += ocupa - prox;
    }
    const item = { indice: i, t_nominal: l.t, inicio_s: r3(inicio), fim_s: null, t_eventos: r3(tEventos), ato: l.ato, fala: l.fala || null, direcao: l.direcao || {}, som: l.som ?? null, imagem: l.imagem ?? null };
    if (d.movimento) item.movimento = { ...d.movimento, inicio_s: r3(inicio + (d.movimento.atraso_s || 0)), fim_s: r3(inicio + (d.movimento.atraso_s || 0) + d.movimento.duracao_s) };
    if (d.transicao) item.transicao = { ...d.transicao, inicio_s: r3(inicio) };
    linhas.push(item);
  }
  for (let i = 0; i < linhas.length; i++) linhas[i].fim_s = i + 1 < linhas.length ? linhas[i + 1].inicio_s : null;
  const ultima = linhas[linhas.length - 1];
  const linhaPergunta = [...linhas].reverse().find(ehPergunta) || null;
  let total = linhaPergunta ? linhaPergunta.inicio_s + durPergunta : (ultima ? ultima.inicio_s + 4 : 4);
  total = Math.max(total, fimUltimaFala + (linhaPergunta ? respiro + durPergunta : 1));
  if (ultima) ultima.fim_s = r3(total);

  const deslocar = (tn) => { let dd = 0; for (const [t0, d0] of deslocamentos) if (t0 <= tn) dd = d0; return r3(tn + dd); };

  const climas = [];
  for (const l of linhas) { const c = l.direcao?.clima || 'rotina'; if (!climas.length || climas[climas.length - 1].clima !== c) climas.push({ inicio_s: l.inicio_s, clima: c }); }

  const celular = [];
  for (const l of linhas) for (const ev of (l.direcao?.eventos || [])) {
    const m = /^celular\.(tela|notificacao)=(\d+|null)$/.exec(ev);
    if (!m || m[2] === 'null') continue;
    const idx = Number(m[2]); const msg = (roteiro.celular || [])[idx] || {};
    const item = { inicio_s: l.t_eventos, evento: m[1], indice: idx, de: msg.de ?? null, texto: msg.texto ?? null, tipo: msg.tipo || 'mensagem', hora: msg.hora ?? null };
    if (msg.rotulo) item.rotulo = msg.rotulo;
    if (m[1] === 'notificacao') {
      item.duracao_s = Number(msg.duracao_s) > 0 ? Number(msg.duracao_s) : (cartao.duracao_padrao_s ?? 4);
      item.fim_s = r3(l.t_eventos + (cartao.atraso_s ?? 0.3) + item.duracao_s);
    }
    celular.push(item);
  }

  const efeitos = (roteiro.efeitos_extra || []).map((e) => ({ ...e, t: deslocar(Number(e.t)) })).sort((a, b) => a.t - b.t);
  const silencios = (roteiro.silencios || []).map((s) => ({ inicio_s: deslocar(Number(s.inicio_s)), fim_s: deslocar(Number(s.fim_s)) }));

  // ambiente: um trecho por lugar onde a câmera está (o plano de câmera informa); sem plano, o do cenário inicial
  const cen = (canal.cenarios || []).find((c) => c.id === roteiro.cenario) || (canal.cenarios || [])[0] || {};
  const ambPadrao = roteiro.ambiente || cen.ambiente?.tipo || (/rua|estrada/.test(roteiro.cenario || '') ? 'rua_noite' : 'saguao_noite');
  const ganhoPadrao = cen.ambiente?.ganho_db ?? -26;
  // o ambiente troca no instante em que a câmera muda de lugar (durante a caminhada ou no meio do preto),
  // com 0,6 s de sobreposição entre um som e outro
  const ambDoModulo = (m) => { const c = (canal.cenarios || []).find((x) => x.id === m); return c?.ambiente ? { tipo: c.ambiente.tipo, ganho_db: c.ambiente.ganho_db ?? ganhoPadrao } : null; };
  const porLinha = opcoes.ambientes || [];
  const mudancas = [{ t: 0, tipo: ambPadrao, ganho_db: ganhoPadrao }];
  for (let i = 0; i < linhas.length; i++) {
    const d = duracoes[i] || {};
    if (d.movimento?.modulos?.length) {
      for (const m of d.movimento.modulos) { const a = ambDoModulo(m.modulo); if (a) mudancas.push({ t: linhas[i].inicio_s + (m.t_rel || 0), ...a }); }
    } else if (porLinha[i]) mudancas.push({ t: d.transicao ? linhas[i].t_eventos : linhas[i].inicio_s, tipo: porLinha[i].tipo, ganho_db: porLinha[i].ganho_db ?? ganhoPadrao });
  }
  const ambiente = [];
  for (const m of mudancas.sort((a, b) => a.t - b.t)) {
    const ult = ambiente[ambiente.length - 1];
    if (ult && ult.tipo === m.tipo) continue;
    if (ult) ult.fim_s = r3(Math.min(total, m.t + 0.3));
    ambiente.push({ inicio_s: r3(ult ? Math.max(0, m.t - 0.3) : 0), fim_s: null, tipo: m.tipo, ganho_db: m.ganho_db });
  }
  ambiente[ambiente.length - 1].fim_s = r3(total);

  let pergunta = null;
  if (roteiro.dilema) {
    pergunta = { inicio_s: linhaPergunta ? linhaPergunta.inicio_s : r3(total - durPergunta), fim_s: r3(total) };
    for (const k of ['pergunta', 'opcao_a', 'opcao_b', 'emoji_a', 'emoji_b', 'arriscada']) if (roteiro.dilema[k] !== undefined && roteiro.dilema[k] !== null) pergunta[k] = roteiro.dilema[k];
  }

  return {
    fps, duracao_total_s: r3(total), deslocamento_final_s: r3(desloc), origem: 'linha_do_tempo.js',
    falas, linhas, climas, celular, efeitos, ambiente, silencios, pergunta,
  };
}
