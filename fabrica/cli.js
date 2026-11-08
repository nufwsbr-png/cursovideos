#!/usr/bin/env node
// A fábrica, linha de comando. Tudo em português. `node fabrica/cli.js ajuda`.
import path from "node:path";
import fs from "node:fs";
import { RAIZ, ETAPAS, lerCanal, PASTA_MOTOR, hojeNoFuso } from "./config.js";
import { carregarEnv } from "./util/ambiente.js";
import { log } from "./util/log.js";
import { listarEpisodios, resolverEpisodio, proximoNumero, lerJson, atualizarEstado, relativo } from "./util/arquivos.js";
import { executar } from "./util/exec.js";

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

  status                         onde paramos (episódios, etapas, bloqueios)
  diario [--simular]             a rotina de um dia: público → produzir o próximo → publicar → memória
  episodio --novo                escreve e produz o próximo episódio (sem publicar)
  episodio --episodio N          (re)produz o episódio N a partir do roteiro existente
     --de etapa --ate etapa      limita as etapas (${ETAPAS.join(", ")})
     --provedor-voz gemini|falso   --escala 0.5   --rapido   --sem-video
  roteiro --numero N             só escreve o roteiro N com a IA (ou valida: roteiro --validar --episodio N)
  vozes | conferir | tempo | render | som | prova | capa     etapas isoladas (--episodio N)
  publicar --episodio N [--simular] [--plataformas tiktok,youtube] [--forcar]
  metricas [--simular]           lê números e comentários dos episódios publicados e conta os votos
  memoria                        atualiza o painel em memoria/estado_atual.md
  estilos                        teste dos 3 estilos (capítulo 35/57) → padrao_aprovado/estilos
  aprovar --episodio N           marca o episódio como aprovado pelo dono (cria APROVADO)
  entrevista                     cria o SEU canal (substitui o canal-exemplo)
  conectar youtube|tiktok|meta|kwai   obtém credenciais uma vez (na sua máquina)
`;

async function etapas() {
  return {
    publico: (await import("./etapas/01_publico.js")).etapaPublico,
    roteiro: (await import("./etapas/02_roteiro.js")),
    vozes: (await import("./etapas/03_vozes.js")).etapaVozes,
    conferir: (await import("./etapas/04_conferir.js")).etapaConferir,
    tempo: (await import("./etapas/05_tempo.js")).etapaTempo,
    render: (await import("./etapas/06_render.js")).etapaRender,
    som: (await import("./etapas/07_som.js")).etapaSom,
    prova: (await import("./etapas/08_prova.js")).etapaProva,
    capa: (await import("./etapas/09_capa_textos.js")).etapaCapaTextos,
    publicar: (await import("./etapas/10_publicar.js")),
    memoria: (await import("./etapas/11_memoria.js")).etapaMemoria,
  };
}

/** Produz um episódio (do roteiro existente) passando pelas etapas pedidas. */
async function produzir({ canal, ep, args, E }) {
  const de = ETAPAS.indexOf(args.de ?? "vozes");
  const ate = ETAPAS.indexOf(args.ate ?? "capa");
  if (de < 0 || ate < 0) throw new Error(`Etapa desconhecida. Use: ${ETAPAS.join(", ")}`);
  const roda = (nome) => { const i = ETAPAS.indexOf(nome); return i >= de && i <= ate; };
  const escala = Number(args.escala ?? 1);
  if (roda("vozes")) await E.vozes({ canal, ep, provedor: args["provedor-voz"], forcar: Boolean(args.forcar) });
  if (roda("conferir")) await E.conferir({ canal, ep });
  if (roda("tempo")) await E.tempo({ canal, ep });
  if (roda("render")) await E.render({ canal, ep, escala, semVideo: Boolean(args["sem-video"]), semStills: Boolean(args["sem-stills"]), rapido: Boolean(args.rapido) });
  if (roda("som")) await E.som({ canal, ep });
  if (roda("prova")) await E.prova({ canal, ep });
  if (roda("capa")) await E.capa({ canal, ep });
  if (roda("publicar")) await E.publicar.etapaPublicar({ canal, ep, simular: Boolean(args.simular), forcar: Boolean(args.forcar) });
  if (roda("memoria")) E.memoria({});
  return resolverEpisodio(ep.dir);
}

function status(canal) {
  const eps = listarEpisodios();
  console.log(`\nCanal: ${canal.nome_exibicao} (@${canal.arroba}) — ${canal.frase_do_canal}\n`);
  if (!eps.length) { console.log("Nenhum episódio ainda. Rode: node fabrica/cli.js episodio --novo"); return; }
  log.tabela(eps.map((e) => ({ ep: e.numero, titulo: e.roteiro?.titulo ?? "?", etapa: e.estado?.etapa ?? "?", bloqueios: (e.estado?.bloqueios ?? []).join("; ") || "—", publicado: e.publicacao?.publicado_em?.slice(0, 10) ?? "—" })));
  const hoje = hojeNoFuso(canal);
  console.log(`Hoje (${canal.publicacao?.fuso}): ${hoje}. Próximo número: ${proximoNumero()}.`);
  carregarEnv();
  const chaves = ["ANTHROPIC_API_KEY", "GEMINI_API_KEY", "TIKTOK_CLIENT_KEY", "META_PAGE_ACCESS_TOKEN", "YOUTUBE_REFRESH_TOKEN", "SUPABASE_URL"];
  console.log("Credenciais: " + chaves.map((c) => `${c}=${process.env[c] ? "ok" : "falta"}`).join("  "));
}

async function diario({ canal, args, E }) {
  log.passo(`Rotina diária — ${new Date().toISOString()}`);
  const resumo = [];
  const simular = Boolean(args.simular);
  // 1. público
  try { const r = await E.publico({ canal, simular }); resumo.push(`público: ${r.lidos} episódio(s) lidos`); } catch (e) { log.erro(`público: ${e.message}`); resumo.push(`público falhou: ${e.message.split("\n")[0]}`); }
  // 2. escolher o que publicar hoje: um episódio pronto (capa feita, sem bloqueios) ou produzir um novo
  const eps = listarEpisodios();
  const prontos = eps.filter((e) => e.estado?.etapa === "capa" && !(e.estado?.bloqueios ?? []).length && !e.publicacao);
  let alvo = prontos[0] ?? null;
  const jaHoje = E.publicar.jaPublicouHoje(canal);
  if (jaHoje && canal.publicacao?.um_por_dia && !args.forcar) {
    log.info(`Já publicamos hoje (${jaHoje.nome}).`);
    resumo.push(`já publicado hoje: ${jaHoje.nome}`);
  } else {
    if (!alvo) {
      const emAndamento = eps.find((e) => !e.publicacao && e.roteiro && e.estado?.etapa !== "publicado");
      if (emAndamento) {
        log.info(`Retomando ${emAndamento.nome} (está em "${emAndamento.estado?.etapa}").`);
        const de = emAndamento.estado?.etapa === "roteiro" ? "vozes" : ETAPAS[Math.min(ETAPAS.indexOf(emAndamento.estado?.etapa === "conferido" ? "tempo" : emAndamento.estado?.etapa) + 1, ETAPAS.length - 1)] || "vozes";
        alvo = await produzir({ canal, ep: emAndamento, args: { ...args, de, ate: "capa" }, E });
      } else {
        const numero = proximoNumero();
        const { dir } = await E.roteiro.etapaRoteiro({ canal, numero });
        alvo = await produzir({ canal, ep: resolverEpisodio(dir), args: { ...args, de: "vozes", ate: "capa" }, E });
      }
    }
    const r = await E.publicar.etapaPublicar({ canal, ep: alvo, simular, forcar: Boolean(args.forcar) });
    resumo.push(r.ok ? `publicado: ${alvo.nome}${simular ? " (simulação)" : ""}` : `não publicado (${r.motivo ?? "erro"}): ${alvo.nome}`);
  }
  // 3. adiantar o próximo (o livro: tenha a continuação pronta)
  if (args.adiantar || canal.publicacao?.episodios_adiantados > 0) {
    const depois = listarEpisodios();
    const ultimo = depois[depois.length - 1];
    const temAdiantado = depois.some((e) => !e.publicacao && e.estado?.etapa === "capa" && !(e.estado?.bloqueios ?? []).length);
    if (!temAdiantado && ultimo?.publicacao && !simular) {
      try {
        const { dir } = await E.roteiro.etapaRoteiro({ canal, numero: proximoNumero() });
        await produzir({ canal, ep: resolverEpisodio(dir), args: { ...args, de: "vozes", ate: "capa" }, E });
        resumo.push(`próximo episódio adiantado: ${path.basename(dir)}`);
      } catch (e) { log.erro(`adiantar: ${e.message}`); resumo.push(`adiantar falhou: ${e.message.split("\n")[0]}`); }
    }
  }
  E.memoria({ resumoDoDia: resumo.join(" · ") });
  log.passo("Resumo do dia");
  for (const r of resumo) log.info(r);
}

async function main() {
  const args = lerArgs(process.argv.slice(2));
  const comando = args._[0] ?? "ajuda";
  carregarEnv();
  const canal = lerCanal();
  if (comando === "ajuda" || comando === "--help" || comando === "-h") { console.log(AJUDA); return; }
  if (comando === "status") return status(canal);
  const E = await etapas();
  switch (comando) {
    case "diario": return diario({ canal, args, E });
    case "episodio": {
      if (args.novo) {
        const { dir } = await E.roteiro.etapaRoteiro({ canal, numero: Number(args.numero ?? proximoNumero()), opcoes: { semContinuacao: Boolean(args["sem-continuacao"]) } });
        return produzir({ canal, ep: resolverEpisodio(dir), args, E });
      }
      return produzir({ canal, ep: resolverEpisodio(args.episodio), args, E });
    }
    case "roteiro": {
      if (args.validar) {
        const ep = resolverEpisodio(args.episodio);
        const r = E.roteiro.validarEpisodio({ canal, dir: ep.dir });
        for (const e of r.erros) log.erro(e);
        for (const a of r.avisos) log.aviso(a);
        log.ok(r.erros.length ? `${r.erros.length} erro(s)` : "roteiro válido");
        process.exitCode = r.erros.length ? 1 : 0;
        return;
      }
      return E.roteiro.etapaRoteiro({ canal, numero: Number(args.numero ?? proximoNumero()), opcoes: { semContinuacao: Boolean(args["sem-continuacao"]) } });
    }
    case "vozes": return E.vozes({ canal, ep: resolverEpisodio(args.episodio), provedor: args["provedor-voz"], so: args.so ? String(args.so).split(",") : null, forcar: Boolean(args.forcar) });
    case "conferir": return E.conferir({ canal, ep: resolverEpisodio(args.episodio) });
    case "tempo": return E.tempo({ canal, ep: resolverEpisodio(args.episodio) });
    case "render": return E.render({ canal, ep: resolverEpisodio(args.episodio), escala: Number(args.escala ?? 1), semVideo: Boolean(args["sem-video"]), semStills: Boolean(args["sem-stills"]), inicio: args.inicio ?? null, fim: args.fim ?? null, rapido: Boolean(args.rapido) });
    case "som": return E.som({ canal, ep: resolverEpisodio(args.episodio) });
    case "prova": return E.prova({ canal, ep: resolverEpisodio(args.episodio) });
    case "capa": return E.capa({ canal, ep: resolverEpisodio(args.episodio) });
    case "publicar": return E.publicar.etapaPublicar({ canal, ep: resolverEpisodio(args.episodio), simular: Boolean(args.simular), plataformas: args.plataformas ? String(args.plataformas).split(",") : null, forcar: Boolean(args.forcar) });
    case "metricas": return E.publico({ canal, simular: Boolean(args.simular), horasEntreLeituras: 0 });
    case "memoria": return E.memoria({});
    case "aprovar": {
      const ep = resolverEpisodio(args.episodio);
      fs.writeFileSync(path.join(ep.dir, "APROVADO"), `Aprovado pelo dono em ${new Date().toISOString()}\n`);
      atualizarEstado(ep.dir, { aprovado: true });
      log.ok(`${ep.nome} aprovado.`);
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
  process.exitCode = 1;
});
