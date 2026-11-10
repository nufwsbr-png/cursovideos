// Sobreposição 2D no acabamento medido da referência (2026-11-10; medidas em memoria/estilo_visual.md):
// tudo em Verdana Bold. Legenda da fala mais recente, ancorada embaixo (base da última linha em 0,70 H), contorno
// escuro sem sombra, na cor de quem fala; selo "PARTE N" por ~2,7 s; cartão do alto (mensagem ou alerta) pelo tempo do
// roteiro; pergunta final por cima da cena visível (véu), com dois botões com emoji (vermelho = a opção arriscada).
// Cada quadro depende só de t. Medidas em px de 1080×1920, multiplicadas pela escala.
import * as THREE from 'three';
import { quebrarLinhas, clamp, suave } from './util.js';
import { arredondado } from './estilo.js';

// Área segura usada pelo revisor: a referência leva legenda e cartões até ~0,95 W; nada importante abaixo de 0,80 H.
export const AREA_SEGURA = { xMin: 0.04, xMax: 0.96, yMax: 0.80, yMin: 0.03 };

const FONTES_EMOJI = '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", "Twemoji Mozilla", sans-serif';
const PALAVRAS_CURTAS = new Set(['a', 'o', 'e', 'as', 'os', 'na', 'no', 'nas', 'nos', 'da', 'do', 'das', 'dos', 'de', 'em', 'um', 'uma', 'pra', 'pro', 'ao', 'à', 'com', 'por', 'que', 'se', 'sem']);

/** Janela em que cada cartão do alto aparece. Um cartão novo troca o anterior no lugar (sem buraco). */
export function janelasCartoes(notificacoes, celular, cfgCartao) {
  const atraso = cfgCartao?.atraso_s ?? 0.3, padrao = cfgCartao?.duracao_padrao_s ?? 4;
  const lista = (notificacoes || []).map((n) => ({ ...n, dados: celular?.[n.indice] })).filter((n) => n.dados).sort((a, b) => a.inicio - b.inicio);
  return lista.map((n, i) => {
    const ini = n.inicio + atraso;
    let fim = ini + (Number(n.dados.duracao_s) > 0 ? Number(n.dados.duracao_s) : padrao);
    const prox = lista[i + 1];
    const trocaNoLugar = prox && prox.inicio + atraso < fim;
    if (trocaNoLugar) fim = prox.inicio + atraso;
    return { indice: n.indice, ini, fim, trocaNoLugar: !!trocaNoLugar, veioDeTroca: i > 0 && lista[i - 1].inicio + atraso + (Number(lista[i - 1].dados.duracao_s) || padrao) > ini, dados: n.dados };
  });
}

export class Sobreposicao {
  constructor(canal, estilo2d, W, H, escala) {
    this.canal = canal; this.estilo = estilo2d; this.W = W; this.H = H; this.e = escala;
    this.cfg = estilo2d.legenda || {};
    this.cores = estilo2d.cores || {};
    this.fonte = this.cfg.fonte || 'Verdana POV';
    this.peso = this.cfg.peso || 700;
    this.corContorno = this.cfg.contorno || estilo2d.traco?.cor || '#141210';
    this.coresPersonagem = { ...(this.cfg.cores_por_personagem || {}) };
    for (const pe of [canal.protagonista, ...(canal.elenco || [])]) if (pe?.id && pe.cor_legenda && !this.coresPersonagem[pe.id]) this.coresPersonagem[pe.id] = pe.cor_legenda;
    if (!this.coresPersonagem.eu && canal.protagonista?.cor_legenda) this.coresPersonagem.eu = canal.protagonista.cor_legenda;
  }
  fonteCss(tamanho, peso = this.peso) { return `${peso} ${Math.round(tamanho)}px "${this.fonte}", Verdana, "DejaVu Sans", sans-serif`; }
  px(v) { return v * this.e; }

  /**
   * Desenha a camada 2D. info: { falasAtivas, cartoes (janelasCartoes), selo, pergunta, preto, clima }.
   * Devolve { legendas: caixas de legenda, layout: elementos desenhados (para o revisor) }.
   */
  desenhar(ctx, t, info) {
    const layout = [];
    const { falasAtivas, cartoes, selo, pergunta, preto } = info;
    if (preto > 0) { ctx.fillStyle = `rgba(0,0,0,${clamp(preto, 0, 1).toFixed(3)})`; ctx.fillRect(0, 0, this.W, this.H); if (preto >= 0.999) layout.push({ tipo: 'preto' }); }
    if (pergunta && pergunta.ativa) {
      this.telaPergunta(ctx, pergunta, t, layout);
      return { legendas: [], layout };
    }
    const legendas = this.legendas(ctx, falasAtivas);
    const cartao = (cartoes || []).find((c) => t >= c.ini && t < c.fim);
    if (cartao) this.cartaoTopo(ctx, cartao, t, layout);
    else if (selo) this.selo(ctx, selo, t, layout);
    return { legendas, layout };
  }

  // Texto com contorno arredondado e preenchimento (sem sombra, como na referência).
  textoContornado(ctx, texto, x, y, cor, larguraContorno) {
    ctx.lineJoin = 'round'; ctx.miterLimit = 2;
    if (larguraContorno > 0) { ctx.lineWidth = larguraContorno; ctx.strokeStyle = this.corContorno; ctx.strokeText(texto, x, y); }
    ctx.fillStyle = cor; ctx.fillText(texto, x, y);
  }

  // ------------------------------------------------------------------ legendas
  legendas(ctx, falas) {
    if (!falas || !falas.length) return [];
    const f = falas[falas.length - 1]; // só a fala mais recente
    const W = this.W, H = this.H;
    const tamanho = this.px(this.cfg.tamanho || 44);
    const contorno = this.px(this.cfg.espessura_contorno ?? 10);
    const largMax = (this.cfg.largura_max || 0.86) * W;
    const xC = (this.cfg.x_centro ?? 0.5) * W;
    const baseUltima = (this.cfg.base_y ?? 0.70) * H;
    const passo = this.px(this.cfg.entrelinha_px || 58);
    ctx.font = this.fonteCss(tamanho);
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    const linhas = quebrarLinhas(ctx, f.texto, largMax);
    const cor = this.coresPersonagem[f.quem] || '#ffffff';
    const caixas = [];
    linhas.forEach((linha, i) => {
      const base = baseUltima - (linhas.length - 1 - i) * passo;
      this.textoContornado(ctx, linha, xC, base, cor, contorno);
      const m = ctx.measureText(linha);
      const esq = m.actualBoundingBoxLeft ?? m.width / 2, dir = m.actualBoundingBoxRight ?? m.width / 2;
      const sobe = m.actualBoundingBoxAscent ?? tamanho * 0.75, desce = m.actualBoundingBoxDescent ?? tamanho * 0.2;
      caixas.push({ quem: f.quem, id: f.id, texto: linha, base: Math.round(base), caixa: [Math.round(xC - esq - contorno / 2), Math.round(base - sobe - contorno / 2), Math.round(esq + dir + contorno), Math.round(sobe + desce + contorno)] });
    });
    return caixas;
  }

  // ------------------------------------------------------------------ cartão do alto (mensagem / alerta)
  cartaoTopo(ctx, c, t, layout) {
    const cfg = this.estilo.cartao || {};
    const tipo = c.dados.tipo === 'alerta' ? 'alerta' : 'mensagem';
    const cc = cfg[tipo] || {};
    const pop = cfg.pop_s ?? 0.15;
    const entra = c.veioDeTroca ? 1 : suave((t - c.ini) / pop);
    const sai = c.trocaNoLugar ? 1 : 1 - suave((t - (c.fim - pop)) / pop);
    const k = Math.min(entra, sai);
    if (k <= 0) return;
    const x = this.px(cfg.x_px ?? 55), w = this.px(cfg.largura_px ?? 968), y = this.px(cfg.topo_px ?? 80);
    const borda = this.px(cfg.borda_px ?? 8), raio = this.px(cfg.raio_px ?? 26);
    const xTexto = tipo === 'alerta' ? this.px(215) : this.px(100);
    const largTexto = x + w - this.px(40) - xTexto;
    // texto principal: até 2 linhas; se não couber, diminui até 38 px
    let tamTexto = this.px(cc.tamanho_texto ?? 50);
    const textoPrincipal = tipo === 'alerta' ? String(c.dados.texto || '').toUpperCase() : String(c.dados.texto || '');
    let linhas;
    for (;;) {
      ctx.font = this.fonteCss(tamTexto);
      linhas = quebrarLinhas(ctx, textoPrincipal, largTexto);
      if (linhas.length <= 2 || tamTexto <= this.px(38)) break;
      tamTexto -= this.px(2);
    }
    linhas = linhas.slice(0, 2);
    const h = this.px(cfg.altura_px ?? 178) + (linhas.length - 1) * this.px(cfg.linha_extra_px ?? 62);
    ctx.save();
    ctx.globalAlpha = clamp(k, 0, 1);
    const esc = 0.94 + 0.06 * k;
    ctx.translate(x + w / 2, y + h / 2); ctx.scale(esc, esc); ctx.translate(-(x + w / 2), -(y + h / 2));
    ctx.fillStyle = cc.fundo || (tipo === 'alerta' ? '#b61b13' : '#f9f9f0');
    arredondado(ctx, x, y, w, h, raio); ctx.fill();
    ctx.lineWidth = borda; ctx.strokeStyle = this.corContorno;
    arredondado(ctx, x + borda / 2, y + borda / 2, w - borda, h - borda, Math.max(1, raio - borda / 2)); ctx.stroke();
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    if (tipo === 'alerta') {
      // triângulo de aviso branco com "!" na cor do cartão
      const tx = this.px(83), ty = y + this.px(40), tw = this.px(106), th = this.px(98);
      ctx.fillStyle = '#ffffff'; ctx.lineJoin = 'round'; ctx.lineWidth = this.px(10); ctx.strokeStyle = '#ffffff';
      ctx.beginPath(); ctx.moveTo(tx + tw / 2, ty + this.px(4)); ctx.lineTo(tx + tw - this.px(4), ty + th - this.px(4)); ctx.lineTo(tx + this.px(4), ty + th - this.px(4)); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = cc.fundo || '#b61b13'; ctx.textAlign = 'center'; ctx.font = this.fonteCss(this.px(64));
      ctx.fillText('!', tx + tw / 2, ty + th - this.px(14));
      ctx.textAlign = 'left';
      ctx.font = this.fonteCss(this.px(cc.tamanho_rotulo ?? 38));
      ctx.fillStyle = cc.rotulo || '#f6d9d6';
      ctx.fillText(String(c.dados.rotulo || c.dados.de || 'ALERTA').toUpperCase(), xTexto, y + this.px(64));
      ctx.font = this.fonteCss(tamTexto); ctx.fillStyle = cc.texto || '#ffffff';
      linhas.forEach((l, i) => ctx.fillText(l, xTexto, y + this.px(128) + i * this.px(62)));
    } else {
      ctx.font = this.fonteCss(this.px(cc.tamanho_remetente ?? 38));
      ctx.fillStyle = cc.remetente || '#39705c';
      ctx.fillText(String(c.dados.de || ''), xTexto, y + this.px(57));
      ctx.font = this.fonteCss(tamTexto); ctx.fillStyle = cc.texto || '#141414';
      linhas.forEach((l, i) => ctx.fillText(l, xTexto, y + this.px(126) + i * this.px(62)));
    }
    ctx.restore();
    layout.push({ tipo: 'cartao', subtipo: tipo, indice: c.indice, caixa: [Math.round(x), Math.round(y), Math.round(w), Math.round(h)], opaco: k >= 0.999 });
  }

  // ------------------------------------------------------------------ selo "PARTE N"
  selo(ctx, selo, t, layout) {
    const cfg = this.estilo.selo || {};
    const ini = selo.inicio + (cfg.inicio_s ?? 0.3), fim = selo.inicio + (cfg.fim_s ?? 3.0);
    if (t < ini || t >= fim) return;
    const k = Math.min(suave((t - ini) / 0.15), 1 - suave((t - (fim - 0.15)) / 0.15));
    if (k <= 0) return;
    const tam = this.px(cfg.tamanho || 58), h = this.px(cfg.altura_px || 88), margem = this.px(cfg.margem_px ?? 29);
    const borda = this.px(cfg.borda_px ?? 5), raio = this.px(cfg.raio_px ?? 14);
    ctx.save(); ctx.globalAlpha = k;
    ctx.font = this.fonteCss(tam); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    const texto = String(selo.texto).toUpperCase();
    const m = ctx.measureText(texto);
    const w = m.width + 2 * margem;
    const yc = (cfg.posicao === 'baixo' ? (cfg.y_baixo ?? 0.853) : (cfg.y_alto ?? 0.087)) * this.H;
    const x = this.W / 2 - w / 2, y = yc - h / 2;
    ctx.fillStyle = cfg.cor || '#b1241e'; arredondado(ctx, x, y, w, h, raio); ctx.fill();
    ctx.lineWidth = borda; ctx.strokeStyle = this.corContorno; arredondado(ctx, x + borda / 2, y + borda / 2, w - borda, h - borda, Math.max(1, raio - borda / 2)); ctx.stroke();
    const sobe = m.actualBoundingBoxAscent ?? tam * 0.73;
    ctx.fillStyle = cfg.cor_texto || '#ffffff'; ctx.fillText(texto, this.W / 2, yc + sobe / 2);
    ctx.restore();
    layout.push({ tipo: 'selo', caixa: [Math.round(x), Math.round(y), Math.round(w), Math.round(h)], opaco: k >= 0.999 });
  }

  // ------------------------------------------------------------------ pergunta final
  telaPergunta(ctx, p, t, layout) {
    const cfg = this.estilo.pergunta || {};
    const W = this.W, H = this.H;
    const k = suave((t - p.inicio_s) / (cfg.entrada_s ?? 0.15));
    ctx.save();
    // véu: a cena continua visível por baixo
    ctx.fillStyle = `rgba(0,0,0,${((cfg.veu ?? 0.32) * k).toFixed(3)})`; ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = k;
    // título
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    const tamT = this.px(cfg.titulo_px ?? 82);
    ctx.font = this.fonteCss(tamT);
    const titulo = String(p.pergunta || 'O que você faria?').toUpperCase();
    const linhasT = quebrarLinhas(ctx, titulo, 0.62 * W).slice(0, 2);
    const bases = (cfg.titulo_bases_y || [632, 732]).map((b) => this.px(b));
    const basesUsadas = linhasT.length === 1 ? [(bases[0] + bases[1]) / 2] : bases;
    linhasT.forEach((l, i) => this.textoContornado(ctx, l, W / 2, basesUsadas[i], '#ffffff', this.px(cfg.titulo_contorno ?? 12)));
    // botões
    const b = cfg.botao || {};
    const opcoes = [
      { texto: p.opcao_a, emoji: p.emoji_a, arriscada: (p.arriscada || 'a') === 'a' },
      { texto: p.opcao_b, emoji: p.emoji_b, arriscada: (p.arriscada || 'a') === 'b' },
    ];
    const botoes = [];
    opcoes.forEach((o, i) => {
      const bx = this.px(b.x ?? 95), by = this.px((b.y || [831, 1080])[i]), bw = this.px(b.w ?? 889), bh = this.px(b.h ?? 180);
      const borda = this.px(b.borda ?? 8), raio = this.px(b.raio ?? 24);
      const cor = o.arriscada ? (cfg.cor_arriscar || '#b1241d') : (cfg.cor_ficar || '#2d5a72');
      ctx.fillStyle = cor; arredondado(ctx, bx, by, bw, bh, raio); ctx.fill();
      ctx.lineWidth = borda; ctx.strokeStyle = this.corContorno; arredondado(ctx, bx + borda / 2, by + borda / 2, bw - borda, bh - borda, Math.max(1, raio - borda / 2)); ctx.stroke();
      if (o.emoji) this.desenharEmoji(ctx, o.emoji, this.px(cfg.emoji_x ?? 140), by + bh / 2, this.px(cfg.emoji_largura_px ?? 85));
      const tamB = this.px(cfg.texto_px ?? 62);
      ctx.font = this.fonteCss(tamB); ctx.textAlign = 'left';
      const xT = o.emoji ? this.px(cfg.texto_x ?? 250) : bx + this.px(40);
      const linhasB = this.duasLinhas(ctx, String(o.texto || '').toUpperCase(), bx + bw - this.px(30) - xT);
      const basesB = linhasB.length === 1 ? [by + this.px(112)] : [by + this.px(77), by + this.px(77) + this.px(cfg.texto_passo ?? 70)];
      linhasB.forEach((l, j) => this.textoContornado(ctx, l, xT, basesB[j], '#ffffff', this.px(cfg.texto_contorno ?? 0)));
      botoes.push({ caixa: [Math.round(bx), Math.round(by), Math.round(bw), Math.round(bh)], cor, arriscada: o.arriscada, linhas: linhasB });
    });
    // chamada "Comenta aqui 👇": texto com contorno + emoji sem contorno
    const chamada = String(cfg.chamada || 'Comenta aqui 👇');
    const m = /^(.*?)(\s*)(\p{Extended_Pictographic}[️‍\p{Extended_Pictographic}\p{Emoji_Modifier}]*)\s*$/u.exec(chamada);
    const textoCh = m ? m[1] : chamada, emojiCh = m ? m[3] : null;
    const tamC = this.px(cfg.chamada_px ?? 50);
    ctx.font = this.fonteCss(tamC); ctx.textAlign = 'left';
    const wTexto = ctx.measureText(textoCh).width;
    const wEmoji = emojiCh ? tamC * 1.05 : 0, espaco = emojiCh ? tamC * 0.3 : 0;
    const xIni = W / 2 - (wTexto + espaco + wEmoji) / 2;
    const baseC = this.px(cfg.chamada_base_y ?? 1348);
    this.textoContornado(ctx, textoCh, xIni, baseC, cfg.cor_chamada || '#f9d44f', this.px(cfg.chamada_contorno ?? 8));
    if (emojiCh) this.desenharEmoji(ctx, emojiCh, xIni + wTexto + espaco, baseC - tamC * 0.36, wEmoji);
    ctx.restore();
    layout.push({ tipo: 'pergunta', titulo: linhasT, botoes, opaco: k >= 0.999 });
  }

  /** Emoji colorido com largura alvo (px), centrado na vertical em yCentro, começando em x. */
  desenharEmoji(ctx, emoji, x, yCentro, largura) {
    ctx.save();
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    // a largura medida na referência é a da tinta (o desenho), não o avanço da fonte, que tem margens dos dois lados
    const tinta = (m) => { const t = (m.actualBoundingBoxLeft ?? 0) + (m.actualBoundingBoxRight ?? 0); return t > 0 ? t : (m.width || 0); };
    let tam = largura;
    ctx.font = `${Math.round(tam)}px ${FONTES_EMOJI}`;
    const w = tinta(ctx.measureText(emoji)) || tam;
    tam = tam * largura / w;
    ctx.font = `${Math.round(tam)}px ${FONTES_EMOJI}`;
    const m = ctx.measureText(emoji);
    ctx.globalAlpha = ctx.globalAlpha; ctx.fillStyle = '#ffffff';
    ctx.fillText(emoji, x + (m.actualBoundingBoxLeft ?? 0), yCentro); // a tinta começa em x
    ctx.restore();
  }

  /** Texto do botão em duas linhas: "|" força a quebra; senão, a divisão mais equilibrada sem deixar palavra curta no fim da 1ª linha. */
  duasLinhas(ctx, texto, largMax) {
    if (texto.includes('|')) return texto.split('|').map((s) => s.trim()).filter(Boolean).slice(0, 2);
    const p = texto.split(/\s+/).filter(Boolean);
    if (p.length <= 1) return [texto];
    let melhor = null;
    for (let i = 1; i < p.length; i++) {
      const a = p.slice(0, i).join(' '), b = p.slice(i).join(' ');
      const wa = ctx.measureText(a).width, wb = ctx.measureText(b).width;
      let custo = Math.max(wa, wb);
      if (PALAVRAS_CURTAS.has(p[i - 1].toLowerCase())) custo += 1e5; // não termina a 1ª linha com "NA", "A", "DO"...
      if (Math.max(wa, wb) > largMax) custo += 1e6;
      if (!melhor || custo < melhor.custo) melhor = { custo, linhas: [a, b] };
    }
    return melhor.linhas;
  }
}

// Textura da tela do celular (app de mensagens inventado). Mesma fonte da camada 2D.
export class TelaCelular {
  constructor(estiloCelular, mensagens, cores) {
    this.cfg = estiloCelular || {}; this.mensagens = mensagens || []; this.cores = cores || {};
    this.canvas = document.createElement('canvas'); this.canvas.width = 540; this.canvas.height = 1140;
    this.ctx = this.canvas.getContext('2d');
    this.textura = new THREE.CanvasTexture(this.canvas); this.textura.colorSpace = THREE.SRGBColorSpace; this.textura.minFilter = THREE.LinearMipmapLinearFilter; this.textura.generateMipmaps = true; this.textura.anisotropy = 4;
    this.chave = null;
    this.desenhar(null, 0);
  }
  desenhar(indice, t) {
    const chave = indice + ':' + Math.floor(t);
    if (chave === this.chave) return; this.chave = chave;
    const c = this.ctx, W = 540, H = 1140;
    const F = (peso, px) => `${peso} ${px}px "Verdana POV", Verdana, sans-serif`;
    c.fillStyle = this.cfg.tela || '#e9eef2'; c.fillRect(0, 0, W, H);
    const msg = indice !== null && this.mensagens[indice] ? this.mensagens[indice] : null;
    const hora = msg?.hora || '02:4' + (Math.floor(t / 60) % 10);
    c.fillStyle = '#111'; c.font = F(700, 34); c.textBaseline = 'middle'; c.textAlign = 'left';
    c.fillText(hora, 26, 42);
    c.textAlign = 'right'; c.fillText('▂▄', W - 130, 42);
    c.strokeStyle = '#111'; c.lineWidth = 4; c.strokeRect(W - 100, 24, 66, 34); c.fillStyle = '#c0392b'; c.fillRect(W - 96, 28, 11, 26); c.fillStyle = '#111'; c.fillRect(W - 32, 33, 6, 16);
    const alerta = msg?.tipo === 'alerta';
    c.fillStyle = alerta ? '#b61b13' : (this.cfg.cor_app || '#2f7d5a'); c.fillRect(0, 76, W, 138);
    // nome no topo da conversa: diminui a fonte até caber (ex.: "Sistema Serra Azul" cortava na borda)
    const nomeTopo = alerta ? (msg?.rotulo || 'ALERTA') : (msg?.de || 'Mãe');
    let tamTopo = 46; c.font = F(700, tamTopo);
    while (tamTopo > 28 && c.measureText(nomeTopo).width > W - 130 - 24) { tamTopo -= 2; c.font = F(700, tamTopo); }
    c.fillStyle = '#fff'; c.textAlign = 'left'; c.fillText(nomeTopo, 130, 138);
    c.font = F(400, 26); c.fillStyle = alerta ? '#f6d9d6' : '#d8f0e3'; c.fillText(alerta ? 'aviso do sistema' : (this.cfg.app_mensagens_nome || 'mensagens'), 130, 186);
    if (alerta) {
      c.fillStyle = '#fff'; c.beginPath(); c.moveTo(72, 106); c.lineTo(110, 176); c.lineTo(34, 176); c.closePath(); c.fill();
      c.fillStyle = '#b61b13'; c.font = F(700, 44); c.textAlign = 'center'; c.fillText('!', 72, 152); c.textAlign = 'left';
    } else {
      c.fillStyle = '#f3d9b1'; c.beginPath(); c.arc(72, 144, 40, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#5a3a2a'; c.beginPath(); c.arc(72, 128, 18, 0, Math.PI * 2); c.fill(); c.fillRect(45, 144, 54, 30);
    }
    let y = 270;
    c.font = F(700, 46);
    const ate = indice === null ? -1 : indice;
    for (let i = 0; i <= ate && i < this.mensagens.length; i++) {
      const m = this.mensagens[i];
      if (m.tipo === 'alerta' && i !== ate) continue; // alertas antigos não ficam na conversa
      const linhas = quebrarLinhas(c, m.tipo === 'alerta' ? String(m.texto).toUpperCase() : m.texto, 390);
      const h = linhas.length * 60 + 70;
      c.fillStyle = m.tipo === 'alerta' ? '#ffe3df' : (i === ate ? '#ffffff' : '#f4f6f8');
      arredondado(c, 24, y, 436, h, 28); c.fill();
      c.fillStyle = '#111';
      linhas.forEach((l, j) => c.fillText(l, 42, y + 46 + j * 60));
      c.fillStyle = '#8a8f94'; c.font = F(400, 24); c.textAlign = 'right'; c.fillText(m.hora || hora, 444, y + h - 24); c.textAlign = 'left'; c.font = F(700, 46);
      y += h + 24;
    }
    if (indice === null) { c.fillStyle = '#9aa0a6'; c.font = F(400, 30); c.textAlign = 'center'; c.fillText('sem mensagens novas', W / 2, 390); c.textAlign = 'left'; }
    c.fillStyle = '#fff'; arredondado(c, 20, H - 104, W - 40, 78, 39); c.fill(); c.fillStyle = '#9aa0a6'; c.font = F(400, 30); c.fillText('Mensagem', 54, H - 66);
    if (this.cfg.trincado) { c.strokeStyle = 'rgba(40,40,40,0.55)'; c.lineWidth = 3; c.beginPath(); c.moveTo(W - 6, 90); c.lineTo(W - 90, 195); c.lineTo(W - 45, 270); c.lineTo(W - 135, 360); c.stroke(); c.beginPath(); c.moveTo(W - 90, 195); c.lineTo(W - 165, 165); c.stroke(); }
    this.textura.needsUpdate = true;
  }
}
