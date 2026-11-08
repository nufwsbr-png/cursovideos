// Publicador Kwai — o Kwai NÃO tem API pública de publicação para criadores.
// Dois modos (canal.plataformas.kwai.modo ou KWAI_MODO):
//   • fila_manual: copia mp4, capa e textos para fila_manual/kwai/<slug>/ com um LEIA-ME.txt.
//   • navegador: usa o Playwright com um perfil persistente (~/.fabrica/kwai-perfil) em que VOCÊ fez login uma vez
//     (`node fabrica/publicar/conectar.js kwai`), envia o arquivo pela página de upload e cai para a fila manual se algo falhar.
// ⚠️ Antes de usar o modo navegador, leia os Termos de Uso do Kwai: automação de conta pode ser restrita e a
//    responsabilidade é sua. O modo só roda na sua máquina (precisa de sessão sua). Nada de várias contas.
// NÃO CONFERIDO NA DOC: a URL de upload e os seletores estão em kwai_seletores.json e podem precisar de ajuste.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { infoVideo, lerJson, raizRepo, slugDe, agoraISO } from './_util.js';
import { validarArquivo } from './limites.js';
import { textoPara } from './textos.js';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
export const PERFIL_KWAI = path.join(os.homedir(), '.fabrica', 'kwai-perfil');

export function lerSeletores() {
  return lerJson(path.join(AQUI, 'kwai_seletores.json'), {});
}

function modoDe(canal, env) {
  return String(env.KWAI_MODO || canal?.plataformas?.kwai?.modo || 'fila_manual').toLowerCase();
}

/** Deixa tudo pronto para publicar à mão: é a rede de segurança do Kwai. */
export function filaManual({ arquivo, capa, textos, canal, roteiro, motivo, simular }) {
  const slug = roteiro?.slug ? `ep${String(roteiro.numero || 0).padStart(2, '0')}_${roteiro.slug}` : slugDe(textos?.titulo || 'episodio');
  const pasta = path.join(raizRepo(), 'fila_manual', 'kwai', slug);
  const t = textoPara('kwai', textos, canal);
  const leiaMe = [
    'KWAI · PUBLICAÇÃO MANUAL',
    '',
    `Episódio: ${textos?.titulo || slug}`,
    motivo ? `Motivo da fila manual: ${motivo}` : '',
    '',
    '1. Abra o aplicativo do Kwai no celular (ou o site) com a conta do canal.',
    '2. Toque em + e escolha o arquivo video.mp4 desta pasta (envie para o celular pelo cabo, nuvem ou mensagem para você mesmo).',
    '3. Capa: use capa.png (ou escolha um quadro sem legenda).',
    '4. Legenda (cole exatamente):',
    '',
    t.legenda,
    '',
    '5. Comentários: deixe ATIVADOS. Se houver opção de marcar conteúdo gerado por IA, marque.',
    '6. Publique e fixe este comentário:',
    '',
    t.comentario_fixado || '(sem comentário fixado neste episódio)',
    '',
    '7. Depois, anote views/comentários em memoria/aprendizados.md (medido, com data).',
    '',
    `Gerado em ${agoraISO()} pela fábrica.`,
  ].filter((l) => l !== null && l !== undefined).join('\n');
  if (!simular) {
    fs.mkdirSync(pasta, { recursive: true });
    if (arquivo && fs.existsSync(arquivo)) fs.copyFileSync(arquivo, path.join(pasta, 'video.mp4'));
    if (capa && fs.existsSync(capa)) fs.copyFileSync(capa, path.join(pasta, 'capa.png'));
    fs.writeFileSync(path.join(pasta, 'LEIA-ME.txt'), leiaMe, 'utf8');
    fs.writeFileSync(path.join(pasta, 'textos.json'), JSON.stringify({ legenda: t.legenda, comentario_fixado: t.comentario_fixado, hashtags: t.hashtags }, null, 2), 'utf8');
  }
  return { pasta, legenda: t.legenda, comentario_fixado: t.comentario_fixado };
}

async function publicarPeloNavegador({ arquivo, textos, canal, registro }) {
  const seletores = lerSeletores();
  const t = textoPara('kwai', textos, canal);
  if (!fs.existsSync(PERFIL_KWAI)) throw new Error(`perfil do Kwai não existe em ${PERFIL_KWAI}; rode "node fabrica/publicar/conectar.js kwai" na sua máquina e faça login uma vez`);
  const { chromium } = await import('playwright');
  const executablePath = process.env.CHROME_PATH || process.env.PUPPETEER_EXECUTABLE_PATH || undefined;
  const contexto = await chromium.launchPersistentContext(PERFIL_KWAI, { headless: true, executablePath, viewport: { width: 1280, height: 900 }, locale: 'pt-BR' });
  try {
    const pagina = await contexto.newPage();
    registro?.anotar({ plataforma: 'kwai', metodo: 'NAVEGADOR', url: seletores.url_upload, descricao: 'abrir página de upload com a sessão do usuário' });
    await pagina.goto(seletores.url_upload, { waitUntil: 'domcontentloaded', timeout: 60000 });
    const logado = await pagina.locator(seletores.indicador_logado).first().isVisible({ timeout: 15000 }).catch(() => false);
    if (!logado) throw new Error('sessão do Kwai expirada ou não encontrada; refaça o login com conectar.js kwai');
    const campoArquivo = pagina.locator(seletores.campo_arquivo).first();
    await campoArquivo.setInputFiles(arquivo, { timeout: 30000 });
    const campoLegenda = pagina.locator(seletores.campo_legenda).first();
    await campoLegenda.waitFor({ state: 'visible', timeout: seletores.espera_processamento_ms || 180000 });
    await campoLegenda.fill(t.legenda);
    const botao = pagina.locator(seletores.botao_publicar).first();
    await botao.waitFor({ state: 'visible', timeout: seletores.espera_processamento_ms || 180000 });
    await botao.click();
    await pagina.locator(seletores.texto_sucesso).first().waitFor({ state: 'visible', timeout: seletores.espera_sucesso_ms || 120000 });
    const url = pagina.url();
    return { ok: true, url };
  } finally {
    await contexto.close().catch(() => {});
  }
}

export async function publicar({ arquivo, capa, textos, canal, env = process.env, simular = false, registro, roteiro }) {
  const avisos = [];
  const info = infoVideo(arquivo);
  const validacao = validarArquivo('kwai', info);
  avisos.push(...validacao.avisos);
  const modo = modoDe(canal, env);
  const pendencias = [];

  if (!validacao.ok) {
    return { plataforma: 'kwai', ok: false, id: null, url: null, erro: `Kwai: arquivo recusado: ${validacao.erros.join('; ')}`, detalhes: { avisos } };
  }

  if (modo === 'navegador') {
    if (simular) {
      registro?.anotar({ plataforma: 'kwai', metodo: 'NAVEGADOR', url: lerSeletores().url_upload || 'https://www.kwai.com/upload', descricao: 'abriria o Chromium com o perfil persistente, enviaria o arquivo, preencheria a legenda e clicaria em Publicar' });
      return { plataforma: 'kwai', ok: true, id: 'kwai_simulado', url: null, detalhes: { modo, avisos, simulado: true, pendencias_manuais: ['Kwai: fixar o comentário da votação no app', 'Kwai: conferir se o vídeo apareceu no perfil'], comentario_fixado: { postado: false, fixado: false, texto: textoPara('kwai', textos, canal).comentario_fixado } } };
    }
    try {
      const r = await publicarPeloNavegador({ arquivo, textos, canal, registro });
      pendencias.push('Kwai: fixar o comentário da votação no app', 'Kwai: conferir se o vídeo apareceu no perfil e marcar conteúdo de IA se houver a opção');
      return { plataforma: 'kwai', ok: true, id: `kwai_${Date.now()}`, url: r.url || null, detalhes: { modo, avisos, pendencias_manuais: pendencias } };
    } catch (e) {
      avisos.push(`modo navegador falhou (${e.message}); caiu para a fila manual`);
      const fila = filaManual({ arquivo, capa, textos, canal, roteiro, motivo: e.message, simular });
      return { plataforma: 'kwai', ok: false, id: null, url: null, erro: `Kwai: publicação automática falhou; pacote pronto em ${fila.pasta}`, detalhes: { modo: 'fila_manual', avisos, pasta: fila.pasta, pendencias_manuais: [`Kwai: publicar manualmente a partir de ${fila.pasta}`] } };
    }
  }

  const fila = filaManual({ arquivo, capa, textos, canal, roteiro, motivo: 'modo fila_manual (sem API pública do Kwai)', simular });
  return { plataforma: 'kwai', ok: true, id: `fila_manual_${path.basename(fila.pasta)}`, url: null, detalhes: { modo: 'fila_manual', avisos, pasta: fila.pasta, simulado: simular, pendencias_manuais: [`Kwai: publicar manualmente a partir de ${fila.pasta} (siga o LEIA-ME.txt)`] } };
}

export async function lerMetricas() {
  return { views: null, curtidas: null, comentarios: null, compartilhamentos: null, salvamentos: null, tempo_medio_s: null, origem: null, observacao: 'Kwai não tem API pública: anote os números do app em memoria/aprendizados.md' };
}

export async function lerComentarios() {
  return Object.assign([], { observacao: 'Kwai não tem API pública de comentários' });
}
