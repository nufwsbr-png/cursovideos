// Sobreposição 2D: legendas, cartão de notificação, selo, tela da pergunta, escurecimento; e a tela do celular.
import * as THREE from 'three';
import { quebrarLinhas, clamp, suave, lerp } from './util.js';
import { arredondado } from './estilo.js';

// Área segura (capítulo 63): nada importante abaixo de 80 % da altura nem nos 15 % da direita.
export const AREA_SEGURA = { xMin: 0.06, xMax: 0.85, yMax: 0.80, yMin: 0.08 };

export class Sobreposicao {
  constructor(canal, estilo2d, W, H, escala) {
    this.canal = canal; this.cfg = estilo2d.legenda || {}; this.estilo = estilo2d; this.W = W; this.H = H; this.escala = escala;
    this.cores = estilo2d.cores || {};
    this.fonte = this.cfg.fonte || 'Anton';
  }

  // Desenha tudo o que fica por cima da imagem 3D. Devolve a lista de caixas de legenda desenhadas.
  desenhar(ctx, t, info) {
    const caixas = [];
    const { falasAtivas, notificacao, selo, pergunta, fade, clima } = info;
    if (fade < 1 && clima !== 'pergunta') {
      caixas.push(...this.legendas(ctx, falasAtivas));
      if (notificacao) this.cartaoNotificacao(ctx, notificacao, t);
      if (selo) this.selo(ctx, selo, t);
    }
    if (fade > 0) { ctx.fillStyle = `rgba(0,0,0,${clamp(fade, 0, 1).toFixed(3)})`; ctx.fillRect(0, 0, this.W, this.H); }
    if (pergunta && pergunta.ativa) this.telaPergunta(ctx, pergunta, t);
    return caixas;
  }

  legendas(ctx, falas) {
    const W = this.W, H = this.H, esc = this.escala;
    const tamanho = (this.cfg.tamanho || 64) * esc;
    const contorno = (this.cfg.espessura_contorno || 10) * esc;
    const largMax = (this.cfg.largura_max || 0.76) * W;
    const xCentro = ((AREA_SEGURA.xMin + AREA_SEGURA.xMax) / 2) * W;
    const yCentro = (this.cfg.y_centro || 0.62) * H;
    const cores = this.cfg.cores_por_personagem || {};
    ctx.font = `${Math.round(tamanho)}px ${this.fonte}, Impact, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round'; ctx.miterLimit = 2;
    const blocos = falas.map(f => ({ f, linhas: quebrarLinhas(ctx, f.texto, largMax) }));
    const entrelinha = tamanho * 1.12;
    const alturaTotal = blocos.reduce((a, b) => a + b.linhas.length * entrelinha, 0) + Math.max(0, blocos.length - 1) * tamanho * 0.45;
    let y = yCentro - alturaTotal / 2 + entrelinha / 2;
    // garante que o bloco todo fique acima da área dos botões
    const limiteBaixo = AREA_SEGURA.yMax * H - entrelinha / 2;
    if (y + alturaTotal - entrelinha / 2 > limiteBaixo) y -= (y + alturaTotal - entrelinha / 2) - limiteBaixo;
    const caixas = [];
    for (const b of blocos) {
      const cor = cores[b.f.quem] || '#ffffff';
      for (const linha of b.linhas) {
        ctx.lineWidth = contorno; ctx.strokeStyle = this.cfg.contorno || '#0b0b0b';
        ctx.strokeText(linha, xCentro, y);
        ctx.fillStyle = cor; ctx.fillText(linha, xCentro, y);
        const w = ctx.measureText(linha).width + contorno;
        caixas.push({ quem: b.f.quem, id: b.f.id, texto: linha, caixa: [Math.round(xCentro - w / 2), Math.round(y - entrelinha / 2), Math.round(w), Math.round(entrelinha)] });
        y += entrelinha;
      }
      y += tamanho * 0.45;
    }
    return caixas;
  }

  cartaoNotificacao(ctx, n, t) {
    const W = this.W, H = this.H, esc = this.escala;
    const dt = t - n.inicio;
    if (dt < 0 || dt > 3.2) return;
    const entra = suave(dt / 0.35), sai = 1 - suave((dt - 2.7) / 0.5);
    const k = Math.min(entra, sai);
    const x = AREA_SEGURA.xMin * W, w = (AREA_SEGURA.xMax - AREA_SEGURA.xMin) * W;
    const h = 150 * esc, yFinal = 0.09 * H, y = yFinal - (1 - k) * (h + 20 * esc);
    ctx.save();
    ctx.globalAlpha = clamp(k, 0, 1);
    ctx.fillStyle = 'rgba(20,22,26,0.92)'; arredondado(ctx, x, y, w, h, 26 * esc); ctx.fill();
    ctx.fillStyle = this.estilo.celular?.cor_app || '#2f7d5a'; arredondado(ctx, x + 22 * esc, y + 30 * esc, 90 * esc, 90 * esc, 22 * esc); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = `${Math.round(44 * esc)}px ${this.fonte}, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('✉', x + 67 * esc, y + 77 * esc);
    ctx.textAlign = 'left';
    ctx.font = `bold ${Math.round(36 * esc)}px Nunito, sans-serif`; ctx.fillStyle = '#ffffff';
    ctx.fillText(n.de, x + 135 * esc, y + 48 * esc);
    ctx.font = `${Math.round(30 * esc)}px Nunito, sans-serif`; ctx.fillStyle = '#d7dbe0';
    const texto = quebrarLinhas(ctx, n.texto, w - 170 * esc)[0];
    ctx.fillText(texto, x + 135 * esc, y + 100 * esc);
    ctx.font = `${Math.round(24 * esc)}px Nunito, sans-serif`; ctx.fillStyle = '#9aa0a6'; ctx.textAlign = 'right';
    ctx.fillText('agora', x + w - 24 * esc, y + 40 * esc);
    ctx.restore();
  }

  selo(ctx, selo, t) {
    const dt = t - selo.inicio; if (dt < 0 || dt > 4.5) return;
    const esc = this.escala, W = this.W, H = this.H;
    const k = Math.min(suave(dt / 0.3), 1 - suave((dt - 4) / 0.5));
    ctx.save(); ctx.globalAlpha = k;
    ctx.font = `${Math.round(70 * esc)}px ${this.fonte}, sans-serif`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    const texto = selo.texto; const w = ctx.measureText(texto).width + 60 * esc;
    const x = AREA_SEGURA.xMin * W, y = 0.17 * H;
    ctx.fillStyle = this.cores.alerta || '#ffb000'; arredondado(ctx, x, y - 50 * esc, w, 100 * esc, 16 * esc); ctx.fill();
    ctx.fillStyle = '#111'; ctx.fillText(texto, x + 30 * esc, y + 4 * esc);
    ctx.restore();
  }

  telaPergunta(ctx, p, t) {
    const W = this.W, H = this.H, esc = this.escala;
    const dt = t - p.inicio_s;
    const k = suave((dt - 0.5) / 0.7);
    if (k <= 0) return;
    ctx.save();
    ctx.globalAlpha = k;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.font = `${Math.round(92 * esc)}px ${this.fonte}, sans-serif`;
    const xC = ((AREA_SEGURA.xMin + AREA_SEGURA.xMax) / 2) * W;
    ctx.lineWidth = 14 * esc; ctx.strokeStyle = '#000'; ctx.fillStyle = '#ffffff';
    const perg = (p.pergunta || 'O que você faria?').toUpperCase();
    const linhasP = quebrarLinhas(ctx, perg, 0.74 * W);
    let y = 0.36 * H - (linhasP.length - 1) * 55 * esc;
    for (const l of linhasP) { ctx.strokeText(l, xC, y); ctx.fillText(l, xC, y); y += 110 * esc; }
    const opcoes = [['A', p.opcao_a, this.cores.c3 || '#d9772b'], ['B', p.opcao_b, this.cores.c1 || '#1f4e5f']];
    const k2 = suave((dt - 1.1) / 0.6);
    ctx.globalAlpha = k * k2;
    let yo = 0.50 * H;
    for (const [letra, texto, cor] of opcoes) {
      const w = 0.74 * W, h = 150 * esc, x = xC - w / 2;
      ctx.fillStyle = cor; arredondado(ctx, x, yo - h / 2, w, h, 28 * esc); ctx.fill();
      ctx.strokeStyle = '#000'; ctx.lineWidth = 6 * esc; arredondado(ctx, x, yo - h / 2, w, h, 28 * esc); ctx.stroke();
      ctx.font = `${Math.round(72 * esc)}px ${this.fonte}, sans-serif`;
      ctx.fillStyle = '#111'; ctx.textAlign = 'left'; ctx.fillText(letra, x + 40 * esc, yo + 4 * esc);
      ctx.font = `${Math.round(54 * esc)}px ${this.fonte}, sans-serif`; ctx.fillStyle = '#fff'; ctx.lineWidth = 8 * esc; ctx.strokeStyle = '#000';
      const tx = quebrarLinhas(ctx, texto, w - 160 * esc)[0];
      ctx.strokeText(tx, x + 130 * esc, yo + 4 * esc); ctx.fillText(tx, x + 130 * esc, yo + 4 * esc);
      ctx.textAlign = 'center';
      yo += 200 * esc;
    }
    ctx.globalAlpha = k * suave((dt - 1.6) / 0.6);
    ctx.font = `${Math.round(40 * esc)}px Nunito, sans-serif`; ctx.fillStyle = '#cfcfcf';
    ctx.fillText('Responde nos comentários: A ou B', xC, 0.73 * H);
    ctx.restore();
  }
}

// Textura da tela do celular (app de mensagens inventado).
export class TelaCelular {
  constructor(estiloCelular, mensagens, cores) {
    this.cfg = estiloCelular || {}; this.mensagens = mensagens || []; this.cores = cores || {};
    this.canvas = document.createElement('canvas'); this.canvas.width = 360; this.canvas.height = 760;
    this.ctx = this.canvas.getContext('2d');
    this.textura = new THREE.CanvasTexture(this.canvas); this.textura.colorSpace = THREE.SRGBColorSpace; this.textura.minFilter = THREE.LinearFilter; this.textura.generateMipmaps = false;
    this.chave = null;
    this.desenhar(null, 0);
  }
  desenhar(indice, t) {
    const chave = indice + ':' + Math.floor(t);
    if (chave === this.chave) return; this.chave = chave;
    const c = this.ctx, W = 360, H = 760;
    c.fillStyle = this.cfg.tela || '#e9eef2'; c.fillRect(0, 0, W, H);
    // barra de status: hora, sinal fraco, bateria baixa (capítulo 63: contagem regressiva sem relógio)
    const msg = indice !== null && this.mensagens[indice] ? this.mensagens[indice] : null;
    const hora = msg?.hora || '02:4' + (Math.floor(t / 60) % 10);
    c.fillStyle = '#111'; c.font = 'bold 26px Nunito, sans-serif'; c.textBaseline = 'middle'; c.textAlign = 'left';
    c.fillText(hora, 18, 28);
    c.textAlign = 'right'; c.fillText('▂▄', W - 86, 28);
    c.strokeStyle = '#111'; c.lineWidth = 3; c.strokeRect(W - 66, 16, 44, 22); c.fillStyle = '#c0392b'; c.fillRect(W - 63, 19, 7, 16); c.fillStyle = '#111'; c.fillRect(W - 21, 22, 4, 10);
    // cabeçalho do app
    c.fillStyle = this.cfg.cor_app || '#2f7d5a'; c.fillRect(0, 50, W, 92);
    c.fillStyle = '#fff'; c.textAlign = 'left'; c.font = 'bold 30px Nunito, sans-serif'; c.fillText(msg?.de || 'Mãe', 86, 96);
    c.font = '20px Nunito, sans-serif'; c.fillStyle = '#d8f0e3'; c.fillText(this.cfg.app_mensagens_nome || 'mensagens', 86, 124);
    c.fillStyle = '#f3d9b1'; c.beginPath(); c.arc(48, 96, 26, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#5a3a2a'; c.beginPath(); c.arc(48, 86, 12, 0, Math.PI * 2); c.fill(); c.fillRect(30, 96, 36, 20);
    // balões: mensagens anteriores (apagadas) e a atual
    let y = 180;
    c.font = '27px Nunito, sans-serif';
    const ate = indice === null ? -1 : indice;
    for (let i = 0; i <= ate && i < this.mensagens.length; i++) {
      const m = this.mensagens[i];
      const linhas = quebrarLinhas(c, m.texto, 240);
      const h = linhas.length * 34 + 40;
      c.fillStyle = i === ate ? '#ffffff' : '#f4f6f8';
      arredondado(c, 16, y, 290, h, 18); c.fill();
      c.fillStyle = '#111';
      linhas.forEach((l, j) => c.fillText(l, 32, y + 28 + j * 34));
      c.fillStyle = '#8a8f94'; c.font = '18px Nunito, sans-serif'; c.textAlign = 'right'; c.fillText(m.hora || hora, 296, y + h - 14); c.textAlign = 'left'; c.font = '27px Nunito, sans-serif';
      y += h + 16;
    }
    if (indice === null) { c.fillStyle = '#9aa0a6'; c.font = '24px Nunito, sans-serif'; c.textAlign = 'center'; c.fillText('sem mensagens novas', W / 2, 260); c.textAlign = 'left'; }
    // caixa de digitar
    c.fillStyle = '#fff'; arredondado(c, 14, H - 70, W - 28, 52, 26); c.fill(); c.fillStyle = '#9aa0a6'; c.font = '24px Nunito, sans-serif'; c.fillText('Mensagem', 36, H - 44);
    // trinca no canto
    if (this.cfg.trincado) { c.strokeStyle = 'rgba(40,40,40,0.55)'; c.lineWidth = 2; c.beginPath(); c.moveTo(W - 4, 60); c.lineTo(W - 60, 130); c.lineTo(W - 30, 180); c.lineTo(W - 90, 240); c.stroke(); c.beginPath(); c.moveTo(W - 60, 130); c.lineTo(W - 110, 110); c.stroke(); }
    this.textura.needsUpdate = true;
  }
}
