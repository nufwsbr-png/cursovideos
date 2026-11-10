// Etapa 5c — Crítico visual por IA (portão antes do render). Pela API quando há chave (ou com --ia falsa);
// sem chave, bloqueia se o canal exige o crítico e manda usar a skill critico-visual na sessão do Claude Code.
import { definirBloqueios, atualizarEstado, resolverEpisodio } from "../util/arquivos.js";
import { log } from "../util/log.js";
import { temClaude } from "../ia/claude.js";
import { configCritico, rodarCritico, lerCritico } from "../critico/critico.js";
import { CRITERIOS } from "../critico/esquema.js";

export const SEM_CRITICO = "crítico visual não rodou: sem ANTHROPIC_API_KEY (na sessão do Claude Code use a skill critico-visual: critico --preparar, olhar as folhas, critico --aplicar)";

export async function etapaCritico({ canal, ep, refazer }) {
  log.passo(`Etapa 5c — Crítico visual do episódio ${ep.roteiro.numero}`);
  const cfg = configCritico(canal);
  if (!temClaude()) {
    if (cfg.exigir) {
      definirBloqueios(ep.dir, "critico", [SEM_CRITICO]);
      log.aviso(SEM_CRITICO);
      return { parar: true, registrar: false, motivo: SEM_CRITICO };
    }
    log.aviso("crítico visual pulado (sem chave; o canal não exige)");
    definirBloqueios(ep.dir, "critico", []);
    return { pulou: true };
  }
  const contexto = { continuacao: ep.roteiro.parte_de ?? null, numero: ep.roteiro.numero ?? null };
  const r = await rodarCritico({ canal, ep, refazer, contexto, resolver: resolverEpisodio });
  const c = lerCritico(ep.dir);
  const ultima = c?.rodadas?.at(-1);
  atualizarEstado(ep.dir, { etapa: "critico" });
  if (c?.aprovado) log.ok(`Crítico visual aprovou na rodada ${ultima?.n}: ${CRITERIOS.map((k) => `${k} ${ultima?.notas?.[k]}`).join(" · ")}`);
  else log.aviso(`Crítico visual reprovou: ${c?.motivo}`);
  return { aprovado: Boolean(c?.aprovado), resultado: r };
}
