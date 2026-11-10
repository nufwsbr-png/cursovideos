#!/usr/bin/env node
// A fábrica, linha de comando. Tudo em português. `node fabrica/cli.js ajuda`.
// É um invólucro fino: a ordem das etapas, o que pular e onde parar ficam no orquestrador (fabrica/orquestrador.js).
import path from "node:path";
import fs from "node:fs";
import { RAIZ, ETAPAS, lerCanal, PASTA_MOTOR, hojeNoFuso } from "./config.js";
import { carregarEnv } from "./util/ambiente.js";
import { log } from "./util/log.js";
import { listarEpisodios, resolverEpisodio, proximoNumero, lerJson, atualizarEstado, relativo } from "./util/arquivos.js";
import { executar } from "./util/exec.js";
import { garantirFfmpegNoPath } from "./util/binarios.js";
import { configurarIA, provedorIA } from "./ia/claude.js";
import { produzir, carregarEtapas, explicarVersoes, adotarVersoes } from "./orquestrador.js";

garantirFfmpegNoPath();

function lerArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const nome = a.slice(2);
      const prox = argv[i + 1];
      if (prox !== undefined && !prox.startsWith("--")) { args[nome] = prox; i++; } else args[nome] = true;
    } else args._.push(a);
  }
  return args;
}

const AJUDA = `
Fábrica POV Viral — comandos

  status                         onde paramos (episódios, etapa, publicável, bloqueios)
  doctor [--rapido] [--json]     confere o ambiente (node, python, ffmpeg, chromium, fontes, chaves, canal)
  diario [--simular]             a rotina de um dia: público → produzir → publicar → memória (saída 3 = precisa do dono)
  episodio --novo                escreve o próximo roteiro e produz até a entrega (sem publicar)
  episodio --episodio N          produz o episódio N até a entrega, pulando o que está em dia
     --de etapa --ate etapa      limita as etapas (${ETAPAS.join(", ")})
     --refazer etapa[,etapa]     refaz mesmo em dia     --provedor-voz gemini|falso   --escala 0.5   --rapido
  versoes --episodio N --explicar          o que está em dia e por quê
  versoes --episodio N --adotar [--ate X]  marca como em dia as saídas que já existem (episódios antigos)
  critico --episodio N           crítico visual pela API (ou --ia falsa)
  critico --episodio N --preparar | --aplicar    crítico na sessão do Claude Code (skill critico-visual)
  roteiro --numero N             só escreve o roteiro N com a IA   ·   roteiro --validar --episodio N   ·   roteiro --regras
  vozes | conferir | tempo | quadros | render | som | prova | capa | entrega     uma etapa isolada (--episodio N)
  publicar --episodio N [--simular] [--plataformas tiktok,youtube] [--republicar] [--forcar = decisão humana, registrada]
  metricas [--simular]           lê números e comentários dos episódios publicados e conta os votos
  memoria                        atualiza o painel em memoria/estado_atual.md
  aprender                       promove a regra as correções que se repetem (roteiro_regras.md)
  midia --empacotar | --restaurar   mídia fora do git entre execuções do CI (.cache/midia, com hashes)
  estilos                        teste dos 3 estilos (capítulo 35/57) → padrao_aprovado/estilos
  aprovar --episodio N           marca o episódio como aprovado pelo dono (cria APROVADO)
  entrevista                     cria o SEU canal (substitui o canal-exemplo)
  conectar youtube|tiktok|meta|kwai   obtém credenciais uma vez (na sua máquina)

  Em qualquer comando: --ia falsa (respostas fixas, sem chave e sem gasto; nada do que ela aprova vale para publicar)
`;

function opcoesProducao(args) {
  const refazer = args.refazer === true ? true : args.refazer ? String(args.refazer).split(",").map((s) => s.trim()) : [];
  return { refazer, provedorVoz: args["provedor-voz"] || undefined, escala: args.escala ? Number(args.escala) : 1, rapido: Boolean(args.rapido) };
}

function imprimirRelatorio(r) {
  log.tabela(r.relatorio.map((x) => ({ etapa: x.etapa, acao: x.acao, motivo: String(x.motivo ?? "").slice(0, 100) })));
  if (r.parou_em) log.aviso(`parou em "${r.parou_em}": ${r.motivo}`);
  const entrega = lerJson(path.join(r.ep.dir, "entrega.json"), null);
  if (entrega && !r.parou_em) {
    if (entrega.publicavel) log.ok("publicável: sim");
    else log.aviso(`publicável: não — ${entrega.motivos.join(" · ")}`);
  }
}

function status(canal) {
  const eps = listarEpisodios();
  console.log(`\nCanal: ${canal.nome_exibicao} (@${canal.arroba}) — ${canal.frase_do_canal}\n`);
  if (!eps.length) { console.log("Nenhum episódio ainda. Rode: node fabrica/cli.js episodio --novo"); return; }
  log.tabela(eps.map((e) => {
    const entrega = lerJson(path.join(e.dir, "entrega.json"), null);
    return { ep: e.numero, titulo: e.roteiro?.titulo ?? "?", etapa: e.estado?.etapa ?? "?", publicavel: entrega ? (entrega.publicavel ? "sim" : `não (${entrega.motivos.map((m) => m.split(":")[0]).join(", ")})`) : "—", bloqueios: (e.estado?.bloqueios ?? []).join("; ").slice(0, 120) || "—", publicado: e.publicacao?.publicado_em?.slice(0, 10) ?? "—" };
  }));
  const hoje = hojeNoFuso(canal);
  console.log(`Hoje (${canal.publicacao?.fuso}): ${hoje}. Próximo número: ${proximoNumero()}. IA: ${provedorIA()}.`);
  if (fs.existsSync(path.join(RAIZ, "BLOQUEADO.md"))) console.log("Há episódio travado: veja BLOQUEADO.md.");
  carregarEnv();
  const chaves = ["ANTHROPIC_API_KEY", "GEMINI_API_KEY", "TIKTOK_CLIENT_KEY", "META_PAGE_ACCESS_TOKEN", "YOUTUBE_REFRESH_TOKEN", "SUPABASE_URL"];
  console.log("Credenciais: " + chaves.map((c) => `${c}=${process.env[c] ? "ok" : "falta"}`).join("  "));
}

async function registrarCritico(canal, alvo, args) {
  const { registrar } = await import("./etapas/registro.js");
  const e = resolverEpisodio(alvo.dir);
  registrar("critico", { canal, ep: e, dir: e.dir, roteiro: e.roteiro, opcoes: opcoesProducao(args) });
}

async function comandoCritico({ canal, args, E }) {
  const alvo = resolverEpisodio(args.episodio);
  const { prepararSessao, aplicarSessao } = await import("./critico/critico.js");
  const refazer = async () => { const r = await produzir({ canal, ep: alvo, de: "roteiro", ate: "quadros", opcoes: { ...opcoesProducao(args), refazer: [] }, E }); imprimirRelatorio(r); };
  if (args.preparar) {
    // tudo antes do crítico precisa estar em dia
    const r = await produzir({ canal, ep: alvo, de: "roteiro", ate: "quadros", opcoes: { ...opcoesProducao(args), refazer: [] }, E });
    if (r.parou_em) { imprimirRelatorio(r); process.exitCode = 1; return; }
    const p = await prepararSessao({ canal, ep: resolverEpisodio(alvo.dir) });
    log.ok(`rodada ${p.n} preparada: leia ${relativo(p.pedido)}`);
    for (const im of p.imagens) log.info(`  ${relativo(im)}`);
    log.info(`depois escreva olhar.json e julgar.json em ${relativo(p.pasta)} e rode: node fabrica/cli.js critico --aplicar --episodio ${alvo.numero}`);
    return;
  }
  if (args.aplicar) {
    const contexto = { continuacao: alvo.roteiro.parte_de ?? null, numero: alvo.roteiro.numero ?? null };
    const r = await aplicarSessao({ canal, ep: alvo, refazer, contexto });
    if (!r.ok) { for (const e of r.erros) log.erro(e); process.exitCode = 1; return; }
    const c = r.critico, u = c.rodadas.at(-1);
    log.info(`notas: ${Object.entries(u.notas).map(([k, v]) => `${k} ${v}`).join(" · ")}`);
    if (r.fim) await registrarCritico(canal, alvo, args);
    if (c.aprovado) log.ok(`APROVADO na rodada ${u.n}. Próximo: node fabrica/cli.js episodio --episodio ${alvo.numero} (render → entrega)`);
    else if (r.fim) log.aviso(`REPROVADO: ${c.motivo}`);
    else log.info(`patch aplicado; prepare a rodada ${u.n + 1}: node fabrica/cli.js critico --preparar --episodio ${alvo.numero}`);
    return;
  }
  const r = await produzir({ canal, ep: alvo, de: "roteiro", ate: "critico", opcoes: { ...opcoesProducao(args), refazer: args.refazer ? opcoesProducao(args).refazer : ["critico"] }, E });
  imprimirRelatorio(r);
}

async function main() {
  const args = lerArgs(process.argv.slice(2));
  const comando = args._[0] ?? "ajuda";
  carregarEnv();
  const canal = lerCanal();
  configurarIA({ provedor: typeof args.ia === "string" ? args.ia : null, maxChamadas: canal.ia?.max_chamadas_por_execucao ?? 25 });
  if (comando === "ajuda" || comando === "--help" || comando === "-h") { console.log(AJUDA); return; }
  if (comando === "status") return status(canal);
  if (comando === "doctor") return (await import("./doctor.js")).doctor({ rapido: Boolean(args.rapido), json: Boolean(args.json) });
  const E = await carregarEtapas();
  const ep = () => resolverEpisodio(args.episodio);
  switch (comando) {
    case "diario": {
      const r = await (await import("./diario.js")).diario({ canal, args, E });
      process.exitCode = r.saida;
      return;
    }
    case "episodio": {
      let alvo;
      if (args.novo) {
        const { dir } = await E.roteiro.etapaRoteiro({ canal, numero: Number(args.numero ?? proximoNumero()), opcoes: { semContinuacao: Boolean(args["sem-continuacao"]) } });
        alvo = resolverEpisodio(dir);
      } else alvo = ep();
      const r = await produzir({ canal, ep: alvo, de: args.de ?? "roteiro", ate: args.ate ?? "entrega", opcoes: opcoesProducao(args), E });
      imprimirRelatorio(r);
      return;
    }
    case "versoes": {
      const alvo = ep();
      if (args.adotar) {
        const adotadas = adotarVersoes({ canal, ep: alvo, ate: args.ate ?? "capa", opcoes: opcoesProducao(args) });
        log.ok(`adotadas (marcadas como em dia, sem rodar): ${adotadas.join(", ") || "nenhuma"}`);
      }
      log.tabela(explicarVersoes({ canal, ep: alvo, opcoes: opcoesProducao(args) }));
      return;
    }
    case "critico": return comandoCritico({ canal, args, E });
    case "roteiro": {
      if (args.regras) { console.log((await import("./roteiro/regras.js")).textoRegras(canal, { continuacao: Boolean(args.continuacao), numero: args.numero ?? "N" })); return; }
      if (args.validar) {
        const alvo = ep();
        const r = E.roteiro.validarEpisodio({ canal, dir: alvo.dir });
        for (const e of r.erros) log.erro(e);
        for (const it of (r.itens ?? []).filter((i) => i.tipo === "desconto")) log.aviso(`${it.pontos} ${it.mensagem}`);
        for (const a of r.avisos) log.aviso(a);
        if (r.medidas) log.info(`medidas: ${r.medidas.duracao_estimada_s} s · ${r.medidas.palavras_por_minuto} palavras/min · 1ª fala ${r.medidas.primeira_fala_s} s · trecho sem fala ${r.medidas.maior_trecho_sem_fala_s} s · última fala → cartão ${r.medidas.ultima_fala_ate_pergunta_s} s · lugares ${r.medidas.lugares.join(", ")}`);
        log.ok(`nota ${r.nota}/100 (mínimo ${r.nota_minima}) · ${r.erros.length} erro(s) → ${r.aprovado ? "aprovado" : "NÃO aprovado"}`);
        process.exitCode = r.aprovado ? 0 : 1;
        return;
      }
      return E.roteiro.etapaRoteiro({ canal, numero: Number(args.numero ?? proximoNumero()), opcoes: { semContinuacao: Boolean(args["sem-continuacao"]) } });
    }
    case "vozes": return E.vozes({ canal, ep: ep(), provedor: args["provedor-voz"], so: args.so ? String(args.so).split(",") : null, forcar: Boolean(args.forcar) });
    case "conferir": return E.conferir({ canal, ep: ep() });
    case "tempo": return E.tempo({ canal, ep: ep() });
    case "quadros": return E.quadros({ canal, ep: ep(), escala: Number(args.escala ?? 1) });
    case "render": return E.render({ canal, ep: ep(), escala: Number(args.escala ?? 1), semStills: !args["com-stills"], semVideo: Boolean(args["sem-video"]), inicio: args.inicio ?? null, fim: args.fim ?? null, rapido: Boolean(args.rapido) });
    case "som": return E.som({ canal, ep: ep() });
    case "prova": return E.prova({ canal, ep: ep() });
    case "capa": return E.capa({ canal, ep: ep() });
    case "entrega": return E.entrega({ canal, ep: ep() });
    case "publicar": {
      const r = await E.publicar.etapaPublicar({ canal, ep: ep(), simular: Boolean(args.simular), plataformas: args.plataformas ? String(args.plataformas).split(",") : null, forcar: Boolean(args.forcar), republicar: Boolean(args.republicar) });
      if (!r.ok) process.exitCode = 1;
      return;
    }
    case "metricas": return E.publico({ canal, simular: Boolean(args.simular), horasEntreLeituras: 0 });
    case "memoria": return E.memoria({});
    case "aprender": {
      const r = (await import("./aprender.js")).aprender({});
      log.tabela(Object.entries(r.contagem).sort((a, b) => b[1] - a[1]).map(([id, vezes]) => ({ correcao: id, episodios: `${vezes}/${r.episodios}` })));
      log.ok(r.novas.length ? `regras novas: ${r.novas.map((n) => n.id).join(", ")}` : "nenhuma regra nova (precisa se repetir em 3 dos últimos 5 episódios)");
      return;
    }
    case "midia": {
      const m = await import("./midia.js");
      if (args.empacotar) { const r = m.empacotar(); log.ok(`mídia empacotada: ${Object.values(r.episodios).reduce((s, a) => s + Object.keys(a).length, 0)} arquivo(s) de ${Object.keys(r.episodios).length} episódio(s)`); return; }
      if (args.restaurar) { const r = m.restaurar(); log.ok(`mídia restaurada: ${r.restaurados} arquivo(s), ${r.iguais} já iguais${r.motivo ? ` (${r.motivo})` : ""}`); for (const x of r.recusados) log.aviso(`recusado: ${x}`); return; }
      throw new Error("use midia --empacotar ou midia --restaurar");
    }
    case "aprovar": {
      const alvo = ep();
      fs.writeFileSync(path.join(alvo.dir, "APROVADO"), `Aprovado pelo dono em ${new Date().toISOString()}\n`);
      atualizarEstado(alvo.dir, { aprovado: true });
      log.ok(`${alvo.nome} aprovado.`);
      return;
    }
    case "estilos": {
      const cenario = args.cenario ?? canal.cenarios?.[0]?.id;
      const saida = args.saida ?? path.join(RAIZ, "padrao_aprovado", "estilos");
      await executar("node", [path.join(PASTA_MOTOR, "renderizar.js"), "--teste-estilos", "--cenario", cenario, "--saida", saida]);
      log.ok(`Compare as 3 versões em ${relativo(saida)} e anote a escolhida em memoria/estilo_visual.md.`);
      return;
    }
    case "entrevista": return (await import("./entrevista.js")).entrevista({ arquivoRespostas: args.respostas ?? null });
    case "conectar": return executar("node", [path.join(RAIZ, "fabrica", "publicar", "conectar.js"), ...(args._.slice(1))]);
    default:
      console.log(AJUDA);
      throw new Error(`Comando desconhecido: ${comando}`);
  }
}

main().catch((e) => {
  log.erro(e.message);
  if (process.env.DEPURAR) console.error(e);
  process.exitCode = process.exitCode || 1;
});
