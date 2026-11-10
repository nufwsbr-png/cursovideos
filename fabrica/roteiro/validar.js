// Validação do roteiro contra o contrato, o canal e as regras do livro. Devolve erros (bloqueiam) e avisos.
import { montarMundo } from "../../motor/cena/mundo.js";
import { planejar, planejarDuracoes } from "../../motor/cena/plano_camera.js";
import { montarLinhaDoTempo } from "../../motor/cena/linha_do_tempo.js";
import { EMOCOES } from "./esquema.js";

const ATOS = ["rotina", "sinal", "negacao", "escalada", "autoridade", "desobediencia", "dilema", "pergunta"];
const CLIMAS = ["rotina", "sinal", "escalada", "climax", "pergunta"];
const ACAO_RE = /^(trabalhar|parar|pegar_celular|guardar_celular|fade|voltar|levantar|sentar|transicao:preto(:\d+(\.\d+)?)?|(andar|correr|avancar|aproximar):[\w]+|segurar:[\w]+|tremor:(0(\.\d+)?|1(\.0+)?))$/;
const EVENTO_RE = /^(prop\.[\w]+\.(estado|texto)=.+|personagem\.[\w]+\.(visivel|posicao|pose|expressao|andar)=.+|celular\.(tela|notificacao)=(\d+|null)|tela\.selo=.+|camera\.ir=[\w]+|camera\.postura=(sentado|em_pe))$/;
const LUGAR_COMUM = ["algo está errado", "algo esta errado", "precisamos sair daqui", "isso não é normal", "isso nao e normal", "você não vai acreditar", "voce nao vai acreditar", "alguma coisa está errada"];
const PALAVRAS_PROIBIDAS = ["sangue", "pistola", "revólver", "revolver", "espingarda", "faca no", "esfaque", "suicíd", "suicid", "se matar", "automutil", "estupr", "pedofil"];

const palavras = (s) => String(s ?? "").trim().split(/\s+/).filter(Boolean).length;

/**
 * @param contexto.continuacao  número do episódio anterior (continuação) — antes de completarRoteiro preencher parte_de
 * @param contexto.numero       número deste episódio
 */
export function validarRoteiro(roteiro, canal, contexto = {}) {
  const erros = [];
  const avisos = [];
  const cfg = canal.roteiro ?? {};
  const parte = contexto.continuacao ?? roteiro.parte_de ?? null;
  const numero = contexto.numero ?? roteiro.numero ?? null;
  const atosInicio = cfg.atos_inicio_continuacao ?? ["escalada", "autoridade", "desobediencia"];
  const cenario = (canal.cenarios ?? []).find((c) => c.id === roteiro.cenario);
  if (!cenario) erros.push(`cenario "${roteiro.cenario}" não existe em canal.cenarios (${(canal.cenarios ?? []).map((c) => c.id).join(", ")})`);
  // o mundo do cenário inicial: props, marcas e nós de todos os lugares conectados a ele
  const mundo = cenario ? montarMundo(canal, cenario.id) : { props: {}, marcas: {}, nos: {}, modulos: [] };
  const props = new Set(Object.keys(mundo.props));
  const marcas = new Set(Object.keys(mundo.marcas));
  const nos = new Set(Object.keys(mundo.nos));
  const personagens = new Map((canal.elenco ?? []).map((p) => [p.id, p]));
  personagens.set("eu", { id: "eu", voz: canal.protagonista?.voz, visivel: true });
  const alvosOlhar = new Set([...props, ...marcas, ...nos, ...personagens.keys(), "maos", "celular", "frente", "chao", "teto", "caminho"]);

  const linhas = roteiro.linhas ?? [];
  if (!linhas.length) erros.push("roteiro sem linhas");
  for (let i = 1; i < linhas.length; i++) if (linhas[i].t < linhas[i - 1].t) erros.push(`linha ${i} tem t ${linhas[i].t} menor que a anterior`);
  if (linhas.length && linhas[0].t !== 0) erros.push("a primeira linha precisa começar em t=0 com as mãos já fazendo algo");
  if (linhas.length && !parte && linhas[0].ato !== "rotina") erros.push("a primeira linha do episódio 1 precisa ser do ato rotina");
  if (linhas.length && parte && linhas[0].ato !== "rotina" && !atosInicio.includes(linhas[0].ato)) erros.push(`a continuação começa no perigo: primeiro ato entre ${atosInicio.join(", ")} (veio "${linhas[0].ato}")`);
  // selo "PARTE N": obrigatório na primeira linha da continuação; proibido no episódio 1
  const selos = linhas.flatMap((l, i) => (l.direcao?.eventos ?? []).filter((e) => /^tela\.selo=/.test(e)).map((e) => ({ i, e })));
  if (parte) {
    const s0 = selos.find((x) => x.i === 0);
    if (!s0) erros.push(`a continuação precisa do evento tela.selo=PARTE ${numero ?? "N"} na primeira linha`);
    else if (numero && !new RegExp(`^tela\\.selo=PARTE 0?${numero}$`, "i").test(s0.e)) avisos.push(`selo "${s0.e}" diferente de PARTE ${numero}`);
  } else if (selos.length) erros.push("o episódio 1 não leva selo de parte (tela.selo)");

  // Ordem dos atos e presença de todos
  let indiceAto = 0;
  for (const [i, l] of linhas.entries()) {
    const idx = ATOS.indexOf(l.ato);
    if (idx < 0) { erros.push(`linha ${i}: ato desconhecido "${l.ato}"`); continue; }
    if (idx < indiceAto) erros.push(`linha ${i} (t=${l.t}): ato "${l.ato}" aparece depois de "${ATOS[indiceAto]}" — os 8 atos têm ordem fixa`);
    indiceAto = Math.max(indiceAto, idx);
  }
  const exigidos = parte ? ATOS.slice(Math.max(3, ATOS.indexOf(linhas[0]?.ato ?? "escalada"))) : ATOS;
  for (const ato of exigidos) if (!linhas.some((l) => l.ato === ato)) erros.push(`falta o ato "${ato}"`);
  for (const [i, l] of linhas.entries()) if (l.emocao !== undefined && l.emocao !== null && !EMOCOES.includes(l.emocao)) avisos.push(`linha ${i}: emoção desconhecida "${l.emocao}" (use ${EMOCOES.join(", ")} ou null)`);
  const primeiroSinal = linhas.find((l) => l.ato === "sinal");
  const limiteSinal = cfg.sinal_ate_s ?? 7;
  if (!parte && primeiroSinal && primeiroSinal.t > limiteSinal) erros.push(`o primeiro sinal está em ${primeiroSinal.t}s; precisa aparecer até ${limiteSinal}s`);
  const ultima = linhas[linhas.length - 1];
  if (ultima && (ultima.ato !== "pergunta" || ultima.direcao?.clima !== "pergunta")) erros.push("a última linha precisa ser o ato pergunta com clima pergunta (tela escura com as duas opções)");

  // Mudança a cada N segundos
  const passo = cfg.mudanca_a_cada_s ?? 10;
  for (let i = 1; i < linhas.length; i++) {
    const salto = linhas[i].t - linhas[i - 1].t;
    if (salto > passo + 2) avisos.push(`entre ${linhas[i - 1].t}s e ${linhas[i].t}s passam ${salto.toFixed(1)}s sem nada mudar (o livro pede algo a cada ${passo}s)`);
  }

  // Direção (o plano de câmera confere caminhos: alvo inexistente ou sem rota é erro; o resto é aviso)
  let planoCam = null;
  if (cenario) {
    try {
      planoCam = planejar(roteiro, canal);
      for (const a of planoCam.avisos) (/não existe|sem caminho|sem posição/.test(a) ? erros : avisos).push(`câmera: ${a}`);
    } catch (e) { avisos.push(`plano de câmera não rodou: ${e.message}`); }
  }
  for (const [i, l] of linhas.entries()) {
    const d = l.direcao ?? {};
    if (!alvosOlhar.has(d.olhar)) erros.push(`linha ${i} (t=${l.t}): olhar "${d.olhar}" não existe (props, marcas, personagens, maos, celular, frente, chao, teto)`);
    if (!ACAO_RE.test(d.acao ?? "")) erros.push(`linha ${i} (t=${l.t}): acao "${d.acao}" fora do vocabulário`);
    else {
      const alvo = /^(andar|correr|avancar|aproximar):(\w+)$/.exec(d.acao)?.[2];
      if (alvo && !alvosOlhar.has(alvo)) erros.push(`linha ${i}: alvo "${alvo}" da ação ${d.acao} não existe`);
      if (/^(trabalhar|segurar:(telefone|bloco_passagens))$/.test(d.acao) && planoCam?.linhas?.[i] && planoCam.linhas[i].ini.postura !== "sentado") erros.push(`linha ${i}: "${d.acao}" só dá para fazer sentado no guichê`);
    }
    if (!CLIMAS.includes(d.clima)) erros.push(`linha ${i}: clima "${d.clima}" inválido`);
    for (const ev of d.eventos ?? []) {
      if (!EVENTO_RE.test(ev)) { erros.push(`linha ${i} (t=${l.t}): evento "${ev}" fora do vocabulário`); continue; }
      if (/^camera\./.test(ev) && !String(d.acao ?? "").startsWith("transicao:")) erros.push(`linha ${i}: "${ev}" só vale numa linha com transicao:preto (a câmera só muda de lugar no escuro)`);
      const ci = /^camera\.ir=(\w+)$/.exec(ev);
      if (ci && !nos.has(ci[1]) && !marcas.has(ci[1])) erros.push(`linha ${i}: camera.ir=${ci[1]} — nó ou marca inexistente`);
      const m = /^prop\.(\w+)\./.exec(ev);
      if (m && !props.has(m[1])) erros.push(`linha ${i}: prop "${m[1]}" não existe no cenário ${roteiro.cenario}`);
      const p = /^personagem\.(\w+)\.(\w+)=(.+)$/.exec(ev);
      if (p) {
        if (!personagens.has(p[1])) erros.push(`linha ${i}: personagem "${p[1]}" não existe no elenco`);
        else if (personagens.get(p[1]).visivel === false && ["visivel", "posicao", "pose", "andar"].includes(p[2]) && p[3] !== "false") erros.push(`linha ${i}: "${p[1]}" nunca aparece em cena (visivel=false na ficha); use a voz dele (telefone/rádio/alto-falante)`);
        if ((p[2] === "posicao" || p[2] === "andar") && !marcas.has(p[3])) erros.push(`linha ${i}: marca "${p[3]}" não existe no cenário`);
      }
      const c = /^celular\.(tela|notificacao)=(\d+)$/.exec(ev);
      if (/=null$/.test(ev) && /^celular\.notificacao/.test(ev)) erros.push(`linha ${i}: celular.notificacao precisa de um índice`);
      if (c && !(roteiro.celular ?? [])[Number(c[2])]) erros.push(`linha ${i}: celular[${c[2]}] não existe`);
    }
  }

  // Falas
  const falas = roteiro.falas ?? [];
  const minF = cfg.falas_min ?? 9, maxF = cfg.falas_max ?? 34;
  if (falas.length < minF || falas.length > maxF) erros.push(`${falas.length} falas; o canal pede entre ${minF} e ${maxF}`);
  const ids = new Map();
  for (const f of falas) {
    if (ids.has(f.id)) erros.push(`fala ${f.id} repetida`);
    ids.set(f.id, f);
    const pers = personagens.get(f.quem);
    if (!pers) erros.push(`fala ${f.id}: quem="${f.quem}" não existe`);
    else if (!pers.voz) erros.push(`fala ${f.id}: "${f.quem}" não tem voz (só aparece por mensagem)`);
    if (palavras(f.texto) > 16) avisos.push(`fala ${f.id} tem ${palavras(f.texto)} palavras; frases curtas (talvez duas falas)`);
    if ((f.texto.match(/,/g) || []).length >= 2) avisos.push(`fala ${f.id} tem várias vírgulas; o livro sugere dividir`);
    if (/como você sabe|como voce sabe/i.test(f.texto)) erros.push(`fala ${f.id}: "como você sabe..." é proibido (ninguém explica o que o outro já sabe)`);
    for (const lc of LUGAR_COMUM) if (f.texto.toLowerCase().includes(lc)) erros.push(`fala ${f.id} usa lugar-comum "${lc}"; troque por algo que a pessoa diria de verdade`);
    if (!/^[A-Za-z]/.test(f.estilo ?? "")) avisos.push(`fala ${f.id}: estilo deve ser em inglês (quem é, como está, como fala)`);
  }
  const usadas = new Map();
  for (const [i, l] of linhas.entries()) {
    if (!l.fala) continue;
    if (!ids.has(l.fala)) erros.push(`linha ${i} aponta para fala "${l.fala}" que não existe`);
    usadas.set(l.fala, (usadas.get(l.fala) ?? 0) + 1);
  }
  for (const id of ids.keys()) {
    const n = usadas.get(id) ?? 0;
    if (n === 0) erros.push(`fala ${id} não aparece em nenhuma linha`);
    if (n > 1) erros.push(`fala ${id} aparece em ${n} linhas`);
  }
  const palavrasTotal = falas.reduce((a, f) => a + palavras(f.texto), 0);
  const palavrasEu = falas.filter((f) => f.quem === "eu").reduce((a, f) => a + palavras(f.texto), 0);
  if (palavrasTotal && palavrasEu / palavrasTotal > 0.35) avisos.push(`o protagonista fala ${Math.round((100 * palavrasEu) / palavrasTotal)}% das palavras; ele deveria falar pouco`);

  // Duração: estimada pela mesma linha do tempo do vídeo (falas a ~2,5 palavras/s + tempo de andar/correr + pergunta)
  let fim = (ultima?.t ?? 0) + (cfg.pergunta_duracao_s ?? 4);
  try { fim = montarLinhaDoTempo(roteiro, null, canal, planejarDuracoes(roteiro, canal)).duracao_total_s; } catch { /* usa o nominal */ }
  const minD = canal.formato?.duracao_min_s ?? 65, maxD = canal.formato?.duracao_max_s ?? 130;
  if (fim < minD || fim > maxD) erros.push(`duração estimada ${fim.toFixed(0)}s fora de ${minD}–${maxD}s`);
  const pps = canal.vozes?.palavras_por_segundo_estimadas ?? 2.5;
  const segundosFala = palavrasTotal / pps;
  if (segundosFala > fim * 0.75) erros.push(`${palavrasTotal} palavras (~${segundosFala.toFixed(0)}s de fala) em ${fim.toFixed(0)}s: falta silêncio e tensão; corte falas`);
  const lugares = new Set(roteiro.lugares ?? []);
  if (lugares.size > (cfg.lugares_max ?? 4)) erros.push(`${lugares.size} lugares; máximo ${cfg.lugares_max ?? 4}`);
  const modulos = new Set((mundo.modulos ?? []).map((m) => m.id));
  for (const lg of lugares) if (modulos.size && !modulos.has(lg)) erros.push(`lugar "${lg}" não faz parte do mundo do cenário ${roteiro.cenario} (${[...modulos].join(", ")})`);

  // Dilema e textos
  const d = roteiro.dilema ?? {};
  if (!d.opcao_a || !d.opcao_b) erros.push("dilema precisa de duas opções");
  if (palavras(d.opcao_a) > 8 || palavras(d.opcao_b) > 8) avisos.push("opções do dilema longas; a pessoa precisa responder num comentário");
  if (!/Epi\.?\s*\d+/i.test(roteiro.descricao ?? "")) avisos.push("a descrição deveria trazer 'Epi. NN'");
  const nh = (roteiro.hashtags ?? []).length;
  if (nh < 2 || nh > (canal.publicacao?.hashtags_max ?? 4)) avisos.push(`${nh} hashtags; o livro pede de 2 a ${canal.publicacao?.hashtags_max ?? 4}`);
  if (palavras(roteiro.capa?.frase_gancho) > 5) erros.push("frase de gancho da capa tem mais de 5 palavras");
  if (/parte 2|parte 02/i.test((roteiro.titulos ?? []).join(" ") + roteiro.descricao) && !roteiro.parte_de) avisos.push("'parte 2' no título antes de a parte 2 existir");

  // Temas proibidos (varredura simples; a decisão final é humana)
  const tudo = JSON.stringify(roteiro).toLowerCase();
  for (const p of PALAVRAS_PROIBIDAS) if (tudo.includes(p)) erros.push(`palavra de risco "${p}" encontrada; o medo vem do que não se vê (capítulo 23)`);

  return { erros, avisos };
}
