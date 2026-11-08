// Sobreposição 2D (estilo da referência): legendas em fonte arredondada e pesada, caixa alta e baixa, cor da fala =
// cor do personagem, contorno escuro e sombra; selo vermelho arredondado ("PARTE 2"); cartão de notificação; tela da pergunta.
import * as THREE from 'three';
import { quebrarLinhas, clamp, suave, lerp } from './util.js';
import { arredondado } from './estilo.js';

// Área segura (capítulo 63): nada importante abaixo de 80 % da altura nem nos 15 % da direita.
export const AREA_SEGURA = { xMin: 0.06, xMax: 0.85, yMax: 0.80, yMin: 0.08 };

export class Sobreposicao {
  constructor(canal, estilo2d, W, H, escala) {
    this.canal = canal; this.cfg = estilo2d.legenda || {}; this.estilo = estilo2d; this.W = W; this.H = H; this.escala = escala;
    this.cores = estilo2d.cores || {};
    this.fonte = this.cfg.fonte || 'Baloo 2';
    this.peso = this.cfg.peso || 800;
    this.corContorno = this.cfg.contorno || estilo2d.traco?.cor || '#1a1410';
    this.coresPersonagem = { ...(this.cfg.cores_por_personagem || {}) };
    for (const pe of [canal.protagonista, ...(canal.elenco || [])]) if (pe?.id && pe.cor_legenda && !this.coresPersonagem[pe.id]) this.coresPersonagem[pe.id] = pe.cor_legenda;
  }
  fonteCss(tamanho, peso = this.peso) { return `${peso} ${Math.round(tamanho)}px "${this.fonte}", "Baloo 2", "Nunito", sans-serif`; }

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

  // Texto com sombra, contorno arredondado e preenchimento (o "look" das legendas da referência).
  textoDestacado(ctx, texto, x, y, cor, contorno, sombra = true) {
    ctx.lineJoin = 'round'; ctx.miterLimit = 2;
    if (sombra) { ctx.lineWidth = contorno; ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.strokeText(texto, x, y + contorno * 0.45); }
    ctx.lineWidth = contorno; ctx.strokeStyle = this.corContorno; ctx.strokeText(texto, x, y);
    ctx.fillStyle = cor; ctx.fillText(texto, x, y);
  }

  legendas(ctx, falas) {
    const W = this.W, H = this.H, esc = this.escala;
    const tamanho = (this.cfg.tamanho || 58) * esc;
    const contorno = (this.cfg.espessura_contorno || 9) * esc;
    const largMax = (this.cfg.largura_max || 0.78) * W;
    const xCentro = ((AREA_SEGURA.xMin + AREA_SEGURA.xMax) / 2) * W;
    const yCentro = (this.cfg.y_centro || 0.62) * H;
    ctx.font = this.fonteCss(tamanho);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const blocos = falas.map(f => ({ f, linhas: quebrarLinhas(ctx, f.texto, largMax) }));
    const entrelinha = tamanho * 1.08;
    const alturaTotal = blocos.reduce((a, b) => a + b.linhas.length * entrelinha, 0) + Math.max(0, blocos.length - 1) * tamanho * 0.45;
    let y = yCentro - alturaTotal / 2 + entrelinha / 2;
    const limiteBaixo = AREA_SEGURA.yMax * H - entrelinha / 2;
    if (y + alturaTotal - entrelinha / 2 > limiteBaixo) y -= (y + alturaTotal - entrelinha / 2) - limiteBaixo;
    const caixas = [];
    for (const b of blocos) {
      const cor = this.coresPersonagem[b.f.quem] || '#ffffff';
      for (const linha of b.linhas) {
        this.textoDestacado(ctx, linha, xCentro, y, cor, contorno, this.cfg.sombra !== false);
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
    ctx.fillStyle = 'rgba(24,26,30,0.94)'; arredondado(ctx, x, y, w, h, 28 * esc); ctx.fill();
    ctx.lineWidth = 4 * esc; ctx.strokeStyle = this.corContorno; arredondado(ctx, x, y, w, h, 28 * esc); ctx.stroke();
    ctx.fillStyle = this.estilo.celular?.cor_app || '#2f7d5a'; arredondado(ctx, x + 22 * esc, y + 30 * esc, 90 * esc, 90 * esc, 24 * esc); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = this.fonteCss(50 * esc); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('✉', x + 67 * esc, y + 77 * esc);
    ctx.textAlign = 'left';
    ctx.font = this.fonteCss(38 * esc); ctx.fillStyle = '#ffffff';
    ctx.fillText(n.de, x + 135 * esc, y + 48 * esc);
    ctx.font = this.fonteCss(32 * esc, 700); ctx.fillStyle = '#d7dbe0';
    const texto = quebrarLinhas(ctx, n.texto, w - 170 * esc)[0];
    ctx.fillText(texto, x + 135 * esc, y + 100 * esc);
    ctx.font = this.fonteCss(24 * esc, 700); ctx.fillStyle = '#9aa0a6'; ctx.textAlign = 'right';
    ctx.fillText('agora', x + w - 24 * esc, y + 40 * esc);
    ctx.restore();
  }

  // Selo no alto ("PARTE 2"): retângulo vermelho arredondado com borda escura e texto branco, como na referência.
  // Fica até o fim do vídeo (ou `duracao_s` do estilo), com entrada suave.
  selo(ctx, selo, t) {
    const dt = t - selo.inicio; if (dt < 0) return;
    const dur = this.estilo.selo?.duracao_s ?? null;
    if (dur !== null && dt > dur) return;
    const esc = this.escala, W = this.W, H = this.H;
    const k = dur === null ? suave(dt / 0.3) : Math.min(suave(dt / 0.3), 1 - suave((dt - dur + 0.5) / 0.5));
    if (k <= 0) return;
    ctx.save(); ctx.globalAlpha = k;
    const tam = (this.estilo.selo?.tamanho || 56) * esc;
    ctx.font = this.fonteCss(tam); ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    const texto = String(selo.texto).toUpperCase(); const w = ctx.measureText(texto).width + 70 * esc, h = tam * 1.5;
    const x = 0.5 * W - w / 2, y = (this.estilo.selo?.y || 0.08) * H;
    const pop = 1 + (1 - k) * 0.15;
    ctx.translate(0.5 * W, y); ctx.scale(pop, pop); ctx.translate(-0.5 * W, -y);
    ctx.fillStyle = this.estilo.selo?.cor || this.cores.alerta_forte || '#c0392b'; arredondado(ctx, x, y - h / 2, w, h, 18 * esc); ctx.fill();
    ctx.lineWidth = 6 * esc; ctx.strokeStyle = this.corContorno; arredondado(ctx, x, y - h / 2, w, h, 18 * esc); ctx.stroke();
    ctx.fillStyle = this.estilo.selo?.cor_texto || '#ffffff'; ctx.fillText(texto, 0.5 * W, y + 3 * esc);
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
    const xC = ((AREA_SEGURA.xMin + AREA_SEGURA.xMax) / 2) * W;
    ctx.font = this.fonteCss(88 * esc);
    const perg = (p.pergunta || 'O que você faria?');
    const linhasP = quebrarLinhas(ctx, perg, 0.76 * W);
    let y = 0.34 * H - (linhasP.length - 1) * 52 * esc;
    for (const l of linhasP) { this.textoDestacado(ctx, l, xC, y, '#ffffff', 12 * esc); y += 104 * esc; }
    const opcoes = [['A', p.opcao_a, this.cores.c3 || '#e07b2a'], ['B', p.opcao_b, this.cores.c1 || '#1f5f8a']];
    const k2 = suave((dt - 1.1) / 0.6);
    ctx.globalAlpha = k * k2;
    let yo = 0.50 * H;
    for (const [letra, texto, cor] of opcoes) {
      const w = 0.76 * W, h = 150 * esc, x = xC - w / 2;
      ctx.fillStyle = cor; arredondado(ctx, x, yo - h / 2, w, h, 30 * esc); ctx.fill();
      ctx.strokeStyle = this.corContorno; ctx.lineWidth = 7 * esc; arredondado(ctx, x, yo - h / 2, w, h, 30 * esc); ctx.stroke();
      ctx.font = this.fonteCss(74 * esc); ctx.textAlign = 'left';
      this.textoDestacado(ctx, letra, x + 40 * esc, yo + 3 * esc, '#ffffff', 9 * esc, false);
      ctx.font = this.fonteCss(50 * esc);
      const tx = quebrarLinhas(ctx, texto, w - 160 * esc)[0];
      this.textoDestacado(ctx, tx, x + 128 * esc, yo + 3 * esc, '#ffffff', 8 * esc, false);
      ctx.textAlign = 'center';
      yo += 200 * esc;
    }
    ctx.globalAlpha = k * suave((dt - 1.6) / 0.6);
    ctx.font = this.fonteCss(40 * esc, 700);
    this.textoDestacado(ctx, 'Responde nos comentários: A ou B', xC, 0.73 * H, '#e8e8e8', 7 * esc, false);
    ctx.restore();
  }
}

// Textura da tela do celular (app de mensagens inventado).
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
    c.fillStyle = this.cfg.tela || '#e9eef2'; c.fillRect(0, 0, W, H);
    const msg = indice !== null && this.mensagens[indice] ? this.mensagens[indice] : null;
    const hora = msg?.hora || '02:4' + (Math.floor(t / 60) % 10);
    c.fillStyle = '#111'; c.font = '800 38px "Baloo 2", Nunito, sans-serif'; c.textBaseline = 'middle'; c.textAlign = 'left';
    c.fillText(hora, 26, 42);
    c.textAlign = 'right'; c.fillText('▂▄', W - 130, 42);
    c.strokeStyle = '#111'; c.lineWidth = 4; c.strokeRect(W - 100, 24, 66, 34); c.fillStyle = '#c0392b'; c.fillRect(W - 96, 28, 11, 26); c.fillStyle = '#111'; c.fillRect(W - 32, 33, 6, 16);
    c.fillStyle = this.cfg.cor_app || '#2f7d5a'; c.fillRect(0, 76, W, 138);
    c.fillStyle = '#fff'; c.textAlign = 'left'; c.font = '800 52px "Baloo 2", Nunito, sans-serif'; c.fillText(msg?.de || 'Mãe', 130, 138);
    c.font = '700 30px "Baloo 2", Nunito, sans-serif'; c.fillStyle = '#d8f0e3'; c.fillText(this.cfg.app_mensagens_nome || 'mensagens', 130, 186);
    c.fillStyle = '#f3d9b1'; c.beginPath(); c.arc(72, 144, 40, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#5a3a2a'; c.beginPath(); c.arc(72, 128, 18, 0, Math.PI * 2); c.fill(); c.fillRect(45, 144, 54, 30);
    let y = 270;
    c.font = '700 54px "Baloo 2", Nunito, sans-serif';
    const ate = indice === null ? -1 : indice;
    for (let i = 0; i <= ate && i < this.mensagens.length; i++) {
      const m = this.mensagens[i];
      const linhas = quebrarLinhas(c, m.texto, 390);
      const h = linhas.length * 68 + 70;
      c.fillStyle = i === ate ? '#ffffff' : '#f4f6f8';
      arredondado(c, 24, y, 436, h, 28); c.fill();
      c.fillStyle = '#111';
      linhas.forEach((l, j) => c.fillText(l, 42, y + 46 + j * 68));
      c.fillStyle = '#8a8f94'; c.font = '700 28px "Baloo 2", Nunito, sans-serif'; c.textAlign = 'right'; c.fillText(m.hora || hora, 444, y + h - 24); c.textAlign = 'left'; c.font = '700 54px "Baloo 2", Nunito, sans-serif';
      y += h + 24;
    }
    if (indice === null) { c.fillStyle = '#9aa0a6'; c.font = '700 34px "Baloo 2", Nunito, sans-serif'; c.textAlign = 'center'; c.fillText('sem mensagens novas', W / 2, 390); c.textAlign = 'left'; }
    c.fillStyle = '#fff'; arredondado(c, 20, H - 104, W - 40, 78, 39); c.fill(); c.fillStyle = '#9aa0a6'; c.font = '700 34px "Baloo 2", Nunito, sans-serif'; c.fillText('Mensagem', 54, H - 66);
    if (this.cfg.trincado) { c.strokeStyle = 'rgba(40,40,40,0.55)'; c.lineWidth = 3; c.beginPath(); c.moveTo(W - 6, 90); c.lineTo(W - 90, 195); c.lineTo(W - 45, 270); c.lineTo(W - 135, 360); c.stroke(); c.beginPath(); c.moveTo(W - 90, 195); c.lineTo(W - 165, 165); c.stroke(); }
    this.textura.needsUpdate = true;
  }
}
