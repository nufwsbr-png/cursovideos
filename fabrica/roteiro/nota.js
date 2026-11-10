// Nota do roteiro (0–100): erros bloqueiam sempre; descontos tiram pontos; abaixo da nota mínima também bloqueia.
// As medidas saem da MESMA linha do tempo que o vídeo vai usar (motor/cena/linha_do_tempo.js + plano de câmera), com a
// voz estimada em palavras/s — a etapa 05 refaz tudo com as durações reais das vozes.
import { validarRoteiro } from "./validar.js";
import { regrasNumericas } from "./regras.js";
import { montarLinhaDoTempo, contarPalavras } from "../../motor/cena/linha_do_tempo.js";
import { planejarDuracoes } from "../../motor/cena/plano_camera.js";

// "b": regras de emoção (vilão em cena, escada da raiva, humor, compaixão, a primeira frase na boca do vilão), 2026-11-10.
export const VERSAO_REGRAS = "2026-11-10b";
const ACOES_DE_ACAO = /^(levantar|sentar|andar:|correr:|avancar:|transicao:|pegar_celular|guardar_celular|trabalhar|segurar:)/;
const mediana = (xs) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
const r1 = (v) => Math.round(v * 10) / 10;

/** Medidas do roteiro a partir da linha do tempo estimada. */
export function medirRoteiro(roteiro, canal, medidas = null) {
  const plano = planejarDuracoes(roteiro, canal);
  const lt = montarLinhaDoTempo(roteiro, medidas, canal, plano);
  const falas = [...lt.falas].sort((a, b) => a.inicio_s - b.inicio_s);
  const palavrasPorFala = (roteiro.falas ?? []).map((f) => contarPalavras(f.texto));
  const total = palavrasPorFala.reduce((a, b) => a + b, 0);
  const pEu = (roteiro.falas ?? []).filter((f) => f.quem === "eu").reduce((a, f) => a + contarPalavras(f.texto), 0);
  const ini = lt.pergunta?.inicio_s ?? lt.duracao_total_s;
  // trechos sem fala antes da pergunta (o último, até o cartão, é medido à parte)
  const trechos = [];
  let cursor = 0;
  for (const f of falas) { if (f.inicio_s - cursor > 0.05) trechos.push([cursor, f.inicio_s]); cursor = Math.max(cursor, f.fim_s); }
  const finalGap = ini - cursor;
  const maior = trechos.reduce((m, tr) => (tr[1] - tr[0] > (m ? m[1] - m[0] : -1) ? tr : m), null);
  const temAcao = maior ? lt.linhas.some((l) => l.inicio_s >= maior[0] - 0.05 && l.inicio_s < maior[1] && (ACOES_DE_ACAO.test(l.direcao?.acao ?? "") || (l.direcao?.eventos ?? []).length > 0)) : false;
  const iPerg = lt.linhas.findIndex((l) => Math.abs(l.inicio_s - ini) < 1e-6);
  const antes = iPerg > 0 ? lt.linhas[iPerg - 1] : null;
  return {
    linha: lt, plano,
    medidas: {
      duracao_estimada_s: lt.duracao_total_s, falas: (roteiro.falas ?? []).length, palavras: total,
      palavras_por_minuto: r1((total / Math.max(1, lt.duracao_total_s)) * 60),
      mediana_palavras_por_fala: mediana(palavrasPorFala), maior_fala_palavras: Math.max(0, ...palavrasPorFala),
      primeira_fala_s: falas.length ? r1(falas[0].inicio_s) : null,
      maior_trecho_sem_fala_s: maior ? r1(maior[1] - maior[0]) : 0, trecho_sem_fala: maior ? maior.map(r1) : null, trecho_com_acao: temAcao,
      ultima_fala_ate_pergunta_s: r1(finalGap),
      aproximacao_final: !!antes && /^(avancar|aproximar):/.test(antes.direcao?.acao ?? "") && !antes.fala,
      pct_protagonista: total ? Math.round((100 * pEu) / total) : 0,
      lugares: [...new Set(plano.ambientes.map((a) => a.modulo).filter(Boolean))],
    },
  };
}

/**
 * Regras de emoção (aprovadas pelo dono em 2026-11-10; memoria/roteiro_regras.md → "Emoção"). Usa a linha do tempo
 * estimada para saber em que segundo cada emoção marcada (`linhas[].emocao`) cai. Devolve erros e descontos.
 */
export function avaliarEmocao(roteiro, canal, lt) {
  const r = [];
  const linhas = roteiro.linhas ?? [];
  const normal = (s) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const viloes = (canal.elenco ?? []).filter((p) => p.papel === "vilao").map((p) => p.id);
  if (!viloes.length) r.push({ tipo: "erro", id: "emocao.vilao", mensagem: 'o elenco não tem vilão (papel "vilao"): todo episódio precisa de um personagem para o público odiar, em cena' });
  else {
    const falasV = (roteiro.falas ?? []).filter((f) => viloes.includes(f.quem));
    const re = new RegExp(`^personagem\\.(${viloes.join("|")})\\.(posicao|andar|visivel=true)`);
    const emCena = linhas.some((l) => (l.direcao?.eventos ?? []).some((e) => re.test(e)));
    if (falasV.length < 2 || !emCena) r.push({ tipo: "erro", id: "emocao.vilao", mensagem: `o vilão (${viloes.join(", ")}) tem de aparecer em cena (personagem.<id>.posicao/andar) e falar pelo menos 2 vezes: hoje ${falasV.length} fala(s), em cena: ${emCena ? "sim" : "não"}` });
    // a primeira frase volta na boca do vilão, com outro sentido (≥ 2 palavras de 4+ letras em comum)
    const chave = (s) => new Set(normal(s).split(/[^a-z0-9]+/).filter((w) => w.length >= 4));
    const inicio = chave(lt.falas.filter((f) => f.inicio_s <= 5).map((f) => f.texto).join(" "));
    const ultimaV = [...lt.falas].filter((f) => viloes.includes(f.quem)).sort((a, b) => a.inicio_s - b.inicio_s).at(-1);
    const comuns = ultimaV ? [...chave(ultimaV.texto)].filter((w) => inicio.has(w)) : [];
    if (falasV.length && comuns.length < 2) r.push({ tipo: "desconto", id: "emocao.virada_vilao", pontos: 4, mensagem: "a última fala do vilão não repete a primeira frase do episódio (2 palavras ou mais) com outro sentido" });
  }
  const tempo = (i) => (lt.linhas[i]?.indice === i ? lt.linhas[i].inicio_s : Number(linhas[i]?.t ?? 0));
  const com = (nomes, de = 0, ate = Infinity) => linhas.filter((l, i) => nomes.includes(l.emocao) && tempo(i) >= de && tempo(i) <= ate).length;
  if (!com(["riso"], 0, 10)) r.push({ tipo: "desconto", id: "emocao.humor", pontos: 4, mensagem: "nenhuma linha de riso nos primeiros 10 s (humor antes do susto faz gostar das pessoas)" });
  const golpes = com(["raiva", "indignacao"], 12, 55);
  if (golpes < 3) r.push({ tipo: "desconto", id: "emocao.raiva", pontos: 3 * (3 - golpes), mensagem: `${golpes} golpe(s) de raiva entre 15 e 50 s (a escada pede 3: a mentira, a ordem, a humilhação)` });
  if (!com(["compaixao"])) r.push({ tipo: "desconto", id: "emocao.compaixao", pontos: 3, mensagem: "ninguém para proteger: falta uma linha de compaixão (a mãe, um idoso, quem ficou de fora)" });
  return r;
}

/**
 * Avalia o roteiro: { nota, nota_minima, aprovado, itens, erros, avisos, medidas }.
 * @param contexto.continuacao  número do episódio anterior quando é uma continuação (antes de completarRoteiro)
 * @param contexto.numero       número deste episódio
 */
export function avaliarRoteiro(roteiro, canal, contexto = {}) {
  const n = regrasNumericas(canal);
  const { erros, avisos } = validarRoteiro(roteiro, canal, contexto);
  const itens = [];
  const desc = (id, pontos, mensagem, extra = {}) => itens.push({ id, tipo: "desconto", pontos: -Math.abs(pontos), mensagem, ...extra });
  const erro = (id, mensagem, extra = {}) => { itens.push({ id, tipo: "erro", pontos: 0, mensagem, ...extra }); erros.push(mensagem); };
  let m;
  try { m = medirRoteiro(roteiro, canal).medidas; } catch (e) { erros.push(`não consegui medir o roteiro: ${e.message}`); return { nota: 0, nota_minima: n.nota_minima, aprovado: false, itens, erros, avisos, medidas: null, versao_regras: VERSAO_REGRAS }; }

  // ritmo de fala
  if (m.palavras_por_minuto < 40 || m.palavras_por_minuto > 112) erro("ritmo.ppm", `${m.palavras_por_minuto} palavras por minuto (a referência fica entre ${n.ppm_min} e ${n.ppm_max}; abaixo de 40 ou acima de 112 não passa)`, { medido: m.palavras_por_minuto, alvo: [n.ppm_min, n.ppm_max] });
  else if (m.palavras_por_minuto < n.ppm_min || m.palavras_por_minuto > n.ppm_max) {
    const fora = m.palavras_por_minuto < n.ppm_min ? n.ppm_min - m.palavras_por_minuto : m.palavras_por_minuto - n.ppm_max;
    desc("ritmo.ppm", Math.min(20, 2 * Math.ceil(fora / 3)), `${m.palavras_por_minuto} palavras por minuto (alvo ${n.ppm_min}–${n.ppm_max})`, { medido: m.palavras_por_minuto, alvo: [n.ppm_min, n.ppm_max] });
  }
  // abertura
  if (m.primeira_fala_s === null) erro("abertura.sem_fala", "o roteiro não tem nenhuma fala");
  else if (m.primeira_fala_s > 2 * n.primeira_fala_ate_s) erro("abertura.primeira_fala", `primeira fala em ${m.primeira_fala_s} s (tem de começar em até ${n.primeira_fala_ate_s} s, no meio da conversa)`, { medido: m.primeira_fala_s });
  else if (m.primeira_fala_s > n.primeira_fala_ate_s) desc("abertura.primeira_fala", 8, `primeira fala em ${m.primeira_fala_s} s (alvo até ${n.primeira_fala_ate_s} s)`, { medido: m.primeira_fala_s });
  // trecho de ação sem fala
  if (m.maior_trecho_sem_fala_s < n.sem_fala_min_s) desc("silencio.trecho_acao", 10, `não há um trecho de ${n.sem_fala_min_s}–${n.sem_fala_max_s} s sem fala com ação (o maior tem ${m.maior_trecho_sem_fala_s} s)`, { medido: m.maior_trecho_sem_fala_s });
  else {
    if (!m.trecho_com_acao) desc("silencio.sem_acao", 4, `o trecho sem fala (${m.trecho_sem_fala?.join("–")} s) não tem ação na imagem: andar, correr, celular, porta`);
    if (m.maior_trecho_sem_fala_s > n.sem_fala_max_s) desc("silencio.trecho_morto", Math.min(9, 3 * Math.ceil((m.maior_trecho_sem_fala_s - n.sem_fala_max_s) / 2)), `trecho sem fala de ${m.maior_trecho_sem_fala_s} s (máximo ${n.sem_fala_max_s} s)`, { medido: m.maior_trecho_sem_fala_s });
  }
  // fechamento
  if (m.ultima_fala_ate_pergunta_s < n.final_min_s - 0.05 || m.ultima_fala_ate_pergunta_s > n.final_max_s + 0.05) desc("fechamento.intervalo", 6, `a última fala termina ${m.ultima_fala_ate_pergunta_s} s antes do cartão (alvo ${n.final_min_s}–${n.final_max_s} s)`, { medido: m.ultima_fala_ate_pergunta_s });
  if (!m.aproximacao_final) desc("fechamento.aproximacao", 3, "a linha antes da pergunta deveria ser avancar:<alvo> sem fala (a câmera chega devagar no objeto da decisão)");
  // falas
  if (m.mediana_palavras_por_fala > n.mediana_max) desc("falas.mediana", 5, `mediana de ${m.mediana_palavras_por_fala} palavras por fala (máximo ${n.mediana_max})`);
  const longas = (roteiro.falas ?? []).filter((f) => contarPalavras(f.texto) > n.fala_max);
  if (longas.length) desc("falas.longas", Math.min(5, longas.length), `${longas.length} fala(s) com mais de ${n.fala_max} palavras: ${longas.map((f) => f.id).join(", ")}`);
  const virg = (roteiro.falas ?? []).filter((f) => (f.texto.match(/,/g) || []).length >= 2);
  if (virg.length) desc("falas.virgulas", Math.min(3, virg.length), `${virg.length} fala(s) com várias vírgulas (talvez duas falas): ${virg.map((f) => f.id).join(", ")}`);
  if (m.pct_protagonista > n.protagonista_max_pct) desc("falas.protagonista", 6, `o protagonista fala ${m.pct_protagonista}% das palavras (máximo ${n.protagonista_max_pct}%)`);
  // dilema
  const d = roteiro.dilema ?? {};
  if (!d.emoji_a || !d.emoji_b) erro("dilema.emoji", "dilema sem emoji_a/emoji_b (os botões da pergunta levam um emoji cada)");
  if (!["a", "b"].includes(d.arriscada)) erro("dilema.arriscada", 'dilema sem "arriscada" ("a" ou "b": qual opção é agir/arriscar e vai no botão vermelho)');
  for (const k of ["opcao_a", "opcao_b"]) {
    const w = contarPalavras(d[k]);
    if (w > 8) erro("dilema.tamanho", `${k} com ${w} palavras (máximo 8; o botão tem 2 linhas)`);
    else if (w < n.dilema_palavras[0] || w > n.dilema_palavras[1]) desc("dilema.tamanho", 3, `${k} com ${w} palavras (alvo ${n.dilema_palavras.join("–")})`);
  }
  // celular / cartões
  for (const [i, c] of (roteiro.celular ?? []).entries()) {
    const w = contarPalavras(c.texto);
    if (c.tipo === "alerta") {
      if (!c.rotulo) desc("celular.alerta", 3, `celular[${i}] é alerta sem rótulo (ex.: SISTEMA SERRA AZUL)`);
      if (w > n.alerta_palavras_max) desc("celular.alerta", 3, `celular[${i}]: alerta com ${w} palavras (máximo ${n.alerta_palavras_max}, caixa alta)`);
    } else if (w > n.mensagem_palavras_max) desc("celular.mensagem", 2, `celular[${i}]: mensagem com ${w} palavras (máximo ${n.mensagem_palavras_max})`);
    if (c.duracao_s !== undefined && c.duracao_s !== null && (c.duracao_s < n.cartao_duracao_s[0] || c.duracao_s > n.cartao_duracao_s[1])) erro("celular.duracao", `celular[${i}]: duracao_s ${c.duracao_s} fora de ${n.cartao_duracao_s.join("–")} s`);
  }
  // duração estimada (com o tempo de andar/correr)
  if (m.duracao_estimada_s < n.duracao_min_s || m.duracao_estimada_s > n.duracao_max_s) erro("duracao", `duração estimada ${m.duracao_estimada_s} s fora de ${n.duracao_min_s}–${n.duracao_max_s} s`, { medido: m.duracao_estimada_s });
  // mudanças: avisos do validador viram desconto
  const semMudar = avisos.filter((a) => /sem nada mudar/.test(a));
  if (semMudar.length) desc("ritmo.mudanca", Math.min(12, 3 * semMudar.length), `${semMudar.length} trecho(s) longos sem nada mudar`);
  // virada do episódio 1: algo dos primeiros 5 s volta no fim
  if (!(contexto.continuacao ?? roteiro.parte_de)) {
    const lt = medirRoteiro(roteiro, canal).linha;
    const inicio = lt.falas.filter((f) => f.inicio_s <= 5).map((f) => f.texto).join(" ").toLowerCase();
    const fim = lt.falas.slice(-4).map((f) => f.texto).join(" ").toLowerCase();
    const chave = (s) => new Set(s.normalize("NFD").replace(/[̀-ͯ]/g, "").split(/[^a-z0-9]+/).filter((w) => w.length >= 5));
    const comum = [...chave(inicio)].filter((w) => chave(fim).has(w));
    if (!comum.length) desc("virada.ep1", 3, "nada dos primeiros 5 s volta no fim (virada preferida: a primeira cena volta com outro sentido)");
  }
  // emoção (aprovado pelo dono em 2026-11-10): um roteiro feito e aprovado antes disso pode dizer regras_emocao: false
  if (roteiro.regras_emocao === false) avisos.push("regras de emoção dispensadas neste roteiro (feito e aprovado antes de 2026-11-10)");
  else for (const it of avaliarEmocao(roteiro, canal, medirRoteiro(roteiro, canal).linha)) it.tipo === "erro" ? erro(it.id, it.mensagem) : desc(it.id, it.pontos, it.mensagem);
  // textos de publicação
  if (!/Epi\.?\s*\d+/i.test(roteiro.descricao ?? "")) desc("textos.descricao", 2, "a descrição deveria trazer 'Epi. NN'");
  const nh = (roteiro.hashtags ?? []).length;
  if (nh < 2 || nh > (canal.publicacao?.hashtags_max ?? 4)) desc("textos.hashtags", 2, `${nh} hashtags (2 a ${canal.publicacao?.hashtags_max ?? 4})`);
  if ((roteiro.titulos ?? []).length < 3) desc("textos.titulos", 2, "menos de 3 títulos");

  const nota = Math.max(0, 100 + itens.reduce((a, it) => a + it.pontos, 0));
  const aprovado = erros.length === 0 && nota >= n.nota_minima;
  return { versao_regras: VERSAO_REGRAS, nota, nota_minima: n.nota_minima, aprovado, itens, erros, avisos: avisos.filter((a) => !/sem nada mudar/.test(a)), medidas: m };
}
