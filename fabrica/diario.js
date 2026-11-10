// A rotina de um dia (GitHub Actions ou à mão): ler o público → escolher o episódio de hoje → produzir até a entrega →
// publicar se for publicável → adiantar o próximo → memória (sempre, mesmo com erro: try/finally).
// Episódio travado vira um aviso em BLOQUEADO.md. Travado 2 vezes pelo mesmo motivo que a IA corrige (roteiro, duração,
// revisor, crítico visual) → descartado e refeito uma vez. O resto (chave, voz falsa, ambiente, código) precisa do dono.
// Código de saída: 0 ok · 1 erro · 3 precisa do dono (só no 1º dia de cada bloqueio novo, para não avisar todo dia).
import fs from "node:fs";
import path from "node:path";
import { RAIZ, PASTA_EPISODIOS } from "./config.js";
import { log } from "./util/log.js";
import { listarEpisodios, resolverEpisodio, proximoNumero, lerJson, atualizarEstado, gravarTexto, relativo } from "./util/arquivos.js";
import { hashJson } from "./util/hash.js";
import { produzir } from "./orquestrador.js";
import { temClaude } from "./ia/claude.js";

export const SAIDA_PRECISA_DO_DONO = 3;
export const ARQ_BLOQUEADO = path.join(RAIZ, "BLOQUEADO.md");

// o que a IA corrige refazendo o episódio (história ou direção)
const CORRIGIVEL = [/roteiro reprovado/, /^linter:/, /^duração/, /revisor/, /crítico visual reprovou/, /crítico visual não aprovou/, /^critico: não aprovado/];
export const corrigivelPelaIA = (causa) => CORRIGIVEL.some((re) => re.test(String(causa)));

// sintoma → o que fazer (a mesma tabela do CLAUDE.md)
const O_QUE_FAZER = [
  [/voz falsa|voz_real/, "coloque GEMINI_API_KEY no .env (ou nos segredos do GitHub) e rode `node fabrica/cli.js episodio --episodio N`: só as falas falsas são refeitas, mais o que depende da duração delas (tempo, quadros, crítico visual e render: ≈ 2,5 h em CPU); sem ANTHROPIC_API_KEY o crítico para e pede a sessão (skill critico-visual)"],
  [/ANTHROPIC_API_KEY|crítico visual não rodou/, "coloque ANTHROPIC_API_KEY no .env/segredos, ou rode o crítico pela skill critico-visual numa sessão do Claude Code (critico --preparar / --aplicar)"],
  [/aprovação|aprovacao|APROVADO/, "assista ao episódio e rode `node fabrica/cli.js aprovar --episodio N`"],
  [/fonte|fontes/, "instale a Verdana (ttf-mscorefonts-installer no Linux) e o emoji colorido; confira com `node fabrica/cli.js doctor`"],
  [/publicação|credencia|TOKEN|token|CLIENT/, "confira as credenciais da rede que falhou (`node fabrica/cli.js conectar ...`); a próxima rotina tenta só as que faltam"],
  [/prova:|volume|pico|zumbido|silêncio/, "problema no som ou no vídeo final (código, não história): rode `node fabrica/cli.js prova --episodio N` e veja prova.json"],
  [/roteiro reprovado|linter/, "a IA reescreve o roteiro na próxima rotina (descarta e refaz uma vez)"],
  [/crítico visual|critico:/, "veja revisoes.md do episódio; a IA descarta e refaz uma vez se travar de novo"],
  [/revisor/, "veja revisao.json do episódio (quadro com problema grave)"],
];
export function oQueFazer(causa) {
  for (const [re, txt] of O_QUE_FAZER) if (re.test(causa)) return txt;
  return "rode `node fabrica/cli.js versoes --explicar --episodio N` e `doctor` para ver o que falta";
}

/** As causas atômicas de um episódio não ter publicado: o portão em que parou, ou as checagens da entrega. */
export function causasDe(resultado, dir) {
  if (resultado?.parou_em) return [resultado.motivo || `parou em ${resultado.parou_em}`];
  const entrega = lerJson(path.join(dir, "entrega.json"), null);
  if (!entrega) return ["sem entrega.json"];
  if (entrega.publicavel) return [];
  const causas = [];
  for (const [k, c] of Object.entries(entrega.checagens)) {
    if (c.ok || k === "bloqueios" || k === "versoes") continue;
    // cada bloqueio da prova é uma causa (voz falsa e volume fora pedem ações diferentes)
    if (k === "prova" && Array.isArray(c.bloqueios) && c.bloqueios.length) causas.push(...c.bloqueios.map((b) => `prova: ${b}`));
    else causas.push(`${k}: ${c.detalhe}`);
  }
  if (entrega.checagens.versoes && !entrega.checagens.versoes.ok) causas.push(`versoes: ${entrega.checagens.versoes.detalhe}`);
  // a mesma causa aparece em mais de uma checagem (voz falsa: em voz_real e na prova): fica uma por ação a fazer
  // (o Epi. 01 de 2026-11-10 mandava o dono "ver o som" por causa da voz falsa)
  const padrao = oQueFazer("");
  const vistas = new Set();
  return causas.filter((c) => {
    const o = oQueFazer(c);
    if (o === padrao) return true;
    if (vistas.has(o)) return false;
    vistas.add(o);
    return true;
  });
}

function descartar(ep, motivo) {
  const base = path.join(PASTA_EPISODIOS, "_descartados");
  fs.mkdirSync(base, { recursive: true });
  const carimbo = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 12);
  const destino = path.join(base, `${ep.nome}_${carimbo}`);
  fs.renameSync(ep.dir, destino);
  fs.writeFileSync(path.join(destino, "DESCARTADO.md"), `# Descartado em ${new Date().toISOString()}\n\nMotivo: ${motivo}\n\nA rotina diária escreve um episódio novo com o mesmo número.\n`, "utf8");
  log.aviso(`descartado: ${ep.nome} → ${relativo(destino)} (${motivo})`);
  return destino;
}

async function escreverNovo({ canal, E, numero, refeitoDe = null, resumo }) {
  if (!temClaude()) {
    resumo.push(`sem ANTHROPIC_API_KEY para escrever o episódio ${numero}`);
    return { ep: null, causa: "sem ANTHROPIC_API_KEY: não dá para escrever o próximo roteiro" };
  }
  try {
    const { dir } = await E.roteiro.etapaRoteiro({ canal, numero });
    if (refeitoDe) atualizarEstado(dir, { refeito_de: relativo(refeitoDe) });
    resumo.push(`roteiro novo: ${path.basename(dir)}`);
    return { ep: resolverEpisodio(dir), causa: null };
  } catch (e) {
    resumo.push(`roteiro ${numero} falhou: ${e.message.split("\n")[0]}`);
    return { ep: null, causa: `roteiro reprovado na escrita: ${e.message.split("\n")[0]}` };
  }
}

/** O voto mudou desde que a continuação foi escrita? (só com comentários contados de verdade) */
export function votoVirou(ep) {
  const r = ep.roteiro;
  if (!r?.parte_de || !r.opcao_vencedora_anterior) return null;
  const anterior = listarEpisodios().find((e) => e.numero === r.parte_de);
  const votos = anterior ? lerJson(path.join(anterior.dir, "votos.json"), null) : null;
  if (!votos || !votos.opcao_vencedora || /sem comentários/.test(votos.metodo ?? "")) return null;
  if ((votos.contagem?.a ?? 0) + (votos.contagem?.b ?? 0) === 0) return null;
  return votos.opcao_vencedora !== r.opcao_vencedora_anterior ? votos.opcao_vencedora : null;
}

function escreverBloqueado(bloqueados) {
  if (!bloqueados.length) { fs.rmSync(ARQ_BLOQUEADO, { force: true }); return; }
  const partes = [`# A fábrica precisa de você\n\nAtualizado em ${new Date().toISOString().replace("T", " ").slice(0, 16)} UTC pela rotina diária. Este arquivo some sozinho quando nada estiver travado.\n`];
  for (const b of bloqueados) {
    partes.push(`\n## Epi. ${String(b.numero).padStart(2, "0")} — ${b.titulo ?? "?"} (\`${String(b.pasta).replace(/\\/g, "/")}\`)\n`);
    for (const c of b.causas) partes.push(`- **${c}**\n  → ${oQueFazer(c).replace(/episodio N/g, `episodio ${b.numero}`).replace(/--episodio N/g, `--episodio ${b.numero}`)}\n`);
    partes.push(`\nQuem resolve: ${b.precisaDono ? "**o dono**" : "a IA (na próxima rotina)"} · travado desde ${b.desde} · ${b.vezes} tentativa(s).\n`);
  }
  gravarTexto(ARQ_BLOQUEADO, partes.join(""));
}

/** Registra o travamento no estado do episódio e decide se avisa o dono hoje (saída 3 só no 1º dia). */
function registrarTravado(ep, causas) {
  const assinatura = hashJson([...causas].map((c) => c.replace(/\d+(\.\d+)?/g, "#")).sort());
  const estado = lerJson(path.join(ep.dir, "estado.json"), {});
  const ant = estado.travado;
  const travado = ant?.assinatura === assinatura ? { ...ant, vezes: (ant.vezes ?? 1) + 1, ultima: new Date().toISOString() } : { assinatura, vezes: 1, desde: new Date().toISOString().slice(0, 10), ultima: new Date().toISOString(), causas };
  const precisaDono = causas.some((c) => !corrigivelPelaIA(c)) || Boolean(estado.refeito_de && travado.vezes >= 2);
  const avisar = precisaDono && estado.aviso_dono?.assinatura !== assinatura;
  atualizarEstado(ep.dir, { travado, ...(avisar ? { aviso_dono: { assinatura, em: new Date().toISOString() } } : {}) });
  return { travado, precisaDono, avisar, refeito: Boolean(estado.refeito_de) };
}

function opcoesDe(args) {
  return { refazer: [], provedorVoz: args["provedor-voz"] || undefined, escala: args.escala ? Number(args.escala) : 1, rapido: Boolean(args.rapido) };
}

/** Produz (até a entrega) e publica um episódio; devolve as causas se travou. */
async function produzirEPublicar({ canal, ep, E, args, resumo }) {
  const r = await produzir({ canal, ep, de: "roteiro", ate: "entrega", opcoes: opcoesDe(args), E });
  let causas = causasDe(r, r.ep.dir);
  if (!causas.length) {
    const p = await E.publicar.etapaPublicar({ canal, ep: r.ep, simular: Boolean(args.simular) });
    if (p.ok) { resumo.push(`publicado: ${r.ep.nome}${args.simular ? " (simulação)" : ""}${p.completo === false ? " (parcial)" : ""}`); return { ep: r.ep, causas: [] }; }
    causas = [`publicação: ${p.motivo ?? "falhou em plataforma obrigatória"}`];
  }
  return { ep: r.ep, causas };
}

export async function diario({ canal, args = {}, E }) {
  log.passo(`Rotina diária — ${new Date().toISOString()}`);
  const resumo = [];
  const bloqueados = [];
  let codigo = 0;
  const simular = Boolean(args.simular);
  try {
    // 1. público
    try { const r = await E.publico({ canal, simular }); resumo.push(`público: ${r.lidos} episódio(s) lidos`); }
    catch (e) { log.erro(`público: ${e.message}`); resumo.push(`público falhou: ${e.message.split("\n")[0]}`); }

    // 2. o episódio de hoje: o primeiro que ainda não foi publicado por completo; senão, um novo
    const jaHoje = E.publicar.jaPublicouHoje(canal);
    if (jaHoje && canal.publicacao?.um_por_dia && !args.forcar) {
      log.info(`Já publicamos hoje (${jaHoje.nome}).`);
      resumo.push(`já publicado hoje: ${jaHoje.nome}`);
    } else {
      let alvo = listarEpisodios().find((e) => e.roteiro && e.estado?.etapa !== "publicado") ?? null;
      const virou = alvo && !alvo.publicacao?.publicado_em ? votoVirou(alvo) : null;
      if (virou) {
        const destino = descartar(alvo, `o voto do episódio ${alvo.roteiro.parte_de} virou para ${virou.toUpperCase()} depois que a continuação foi escrita`);
        resumo.push(`continuação descartada (voto virou para ${virou.toUpperCase()})`);
        alvo = (await escreverNovo({ canal, E, numero: alvo.numero, refeitoDe: destino, resumo })).ep;
      }
      let causaSemAlvo = null;
      if (!alvo) ({ ep: alvo, causa: causaSemAlvo } = await escreverNovo({ canal, E, numero: proximoNumero(), resumo }));
      if (!alvo && causaSemAlvo) {
        bloqueados.push({ numero: proximoNumero(), titulo: "(ainda sem roteiro)", pasta: "episodios/", causas: [causaSemAlvo], precisaDono: !corrigivelPelaIA(causaSemAlvo), desde: new Date().toISOString().slice(0, 10), vezes: 1, avisar: !corrigivelPelaIA(causaSemAlvo) });
      }
      if (alvo) {
        let { ep, causas } = await produzirEPublicar({ canal, ep: alvo, E, args, resumo });
        if (causas.length) {
          let t = registrarTravado(ep, causas);
          // travou 2 vezes por motivo que a IA corrige: descarta e refaz uma vez
          if (!t.precisaDono && t.travado.vezes >= 2 && !t.refeito) {
            const destino = descartar(ep, `travou ${t.travado.vezes} vezes: ${causas.join("; ")}`);
            const novo = await escreverNovo({ canal, E, numero: ep.numero, refeitoDe: destino, resumo });
            if (novo.ep) {
              ({ ep, causas } = await produzirEPublicar({ canal, ep: novo.ep, E, args, resumo }));
              t = causas.length ? registrarTravado(ep, causas) : null;
            } else { causas = [novo.causa]; t = { precisaDono: true, avisar: true, travado: { vezes: 1, desde: new Date().toISOString().slice(0, 10) } }; ep = null; }
          }
          if (causas.length) {
            resumo.push(`não publicado: ${ep?.nome ?? "?"} — ${causas.join("; ")}`);
            bloqueados.push({ numero: ep?.numero ?? "?", titulo: ep?.roteiro?.titulo, pasta: ep ? relativo(ep.dir) : "episodios/_descartados", causas, precisaDono: t.precisaDono, desde: t.travado?.desde, vezes: t.travado?.vezes ?? 1, avisar: t.avisar });
          }
        } else if (ep) atualizarEstado(ep.dir, { travado: null });
      }
    }

    // 3. adiantar a continuação (o livro: tenha o próximo pronto), só se nada travou hoje
    if (!bloqueados.length && !simular && (args.adiantar || canal.publicacao?.episodios_adiantados > 0)) {
      const eps = listarEpisodios();
      const ultimo = eps[eps.length - 1];
      const temAdiantado = eps.some((e) => e.roteiro && !e.publicacao?.publicado_em);
      if (!temAdiantado && ultimo?.publicacao?.publicado_em) {
        try {
          const novo = await escreverNovo({ canal, E, numero: proximoNumero(), resumo });
          if (novo.ep) {
            const r = await produzir({ canal, ep: novo.ep, de: "roteiro", ate: "entrega", opcoes: opcoesDe(args), E });
            resumo.push(`próximo episódio adiantado: ${novo.ep.nome}${r.parou_em ? ` (parou em ${r.parou_em})` : ""}`);
          }
        } catch (e) { log.erro(`adiantar: ${e.message}`); resumo.push(`adiantar falhou: ${e.message.split("\n")[0]}`); }
      }
    }
  } catch (e) {
    codigo = 1;
    log.erro(`rotina: ${e.message}`);
    if (process.env.DEPURAR) console.error(e);
    resumo.push(`erro: ${e.message.split("\n")[0]}`);
  } finally {
    try { escreverBloqueado(bloqueados); } catch (e) { log.erro(`BLOQUEADO.md: ${e.message}`); }
    try { E.memoria({ resumoDoDia: resumo.join(" · ") }); } catch (e) { log.erro(`memória: ${e.message}`); }
    try { (await import("./aprender.js")).aprender({}); } catch (e) { log.erro(`aprender: ${e.message}`); }
  }
  log.passo("Resumo do dia");
  for (const r of resumo) log.info(r);
  const avisar = bloqueados.some((b) => b.avisar);
  if (bloqueados.length) log.aviso(`${bloqueados.length} episódio(s) travado(s): veja BLOQUEADO.md${avisar ? " (precisa do dono: saída 3)" : " (já avisado antes)"}`);
  const saida = codigo || (avisar ? SAIDA_PRECISA_DO_DONO : 0);
  process.exitCode = saida;
  return { resumo, bloqueados, saida };
}
