// Etapa 11 — Memória: o cérebro aprende (capítulo 55). Atualiza o estado atual e o índice de episódios.
import fs from "node:fs";
import path from "node:path";
import { PASTA_MEMORIA, RAIZ } from "../config.js";
import { listarEpisodios, lerTexto, gravarTexto, anexarTexto, lerJson } from "../util/arquivos.js";
import { log } from "../util/log.js";

const INICIO = "<!-- auto:inicio (gerado pela fábrica; edite acima desta linha) -->";
const FIM = "<!-- auto:fim -->";

function blocoAutomatico({ resumoDoDia }) {
  const eps = listarEpisodios();
  const linhas = eps.map((e) => {
    const r = e.roteiro ?? {};
    const pub = e.publicacao?.publicado_em ? e.publicacao.publicado_em.slice(0, 10) : "—";
    const redes = Object.entries(e.publicacao?.plataformas ?? {}).filter(([, p]) => p?.ok).map(([n]) => n).join(", ") || "—";
    const votos = lerJson(path.join(e.dir, "votos.json"), null);
    return `| ${String(e.numero).padStart(2, "0")} | ${r.titulo ?? "?"} | ${e.estado?.etapa ?? "?"} | ${(e.estado?.bloqueios ?? []).join("; ") || "—"} | ${pub} | ${redes} | ${votos ? `${votos.opcao_vencedora?.toUpperCase()} (${votos.contagem?.a ?? 0}×${votos.contagem?.b ?? 0}, ${votos.metodo})` : "—"} |`;
  });
  const ultimo = eps[eps.length - 1];
  const proximo = ultimo ? (ultimo.estado?.etapa === "publicado" ? `produzir o episódio ${ultimo.numero + 1} (continuação de "${ultimo.roteiro?.titulo}", respeitando o voto)` : `terminar o episódio ${ultimo.numero} (está em "${ultimo.estado?.etapa}"${(ultimo.estado?.bloqueios ?? []).length ? `, bloqueado por: ${ultimo.estado.bloqueios.join("; ")}` : ""})`) : "escrever o piloto";
  return `${INICIO}
## Painel automático (${new Date().toISOString().replace("T", " ").slice(0, 16)} UTC)
| Ep | Título | Etapa | Bloqueios | Publicado | Redes | Voto |
|---|---|---|---|---|---|---|
${linhas.join("\n")}

**Próximo passo da fábrica:** ${proximo}.
${resumoDoDia ? `\n**Resumo da última rotina:** ${resumoDoDia}\n` : ""}
**Como outro chat continua:** leia CLAUDE.md, rode \`node fabrica/cli.js status\` e depois \`node fabrica/cli.js diario\` (ou \`episodio --novo\` para só produzir).
${FIM}`;
}

export function etapaMemoria({ resumoDoDia = "", aprendizados = [] } = {}) {
  log.passo("Etapa 11 — Memória");
  const arquivo = path.join(PASTA_MEMORIA, "estado_atual.md");
  let texto = lerTexto(arquivo, "# Estado atual\n\n");
  const bloco = blocoAutomatico({ resumoDoDia });
  if (texto.includes(INICIO) && texto.includes(FIM)) {
    texto = texto.slice(0, texto.indexOf(INICIO)) + bloco + texto.slice(texto.indexOf(FIM) + FIM.length);
  } else {
    texto = texto.trimEnd() + "\n\n" + bloco + "\n";
  }
  gravarTexto(arquivo, texto);
  const hoje = new Date().toISOString().slice(0, 10);
  for (const a of aprendizados) anexarTexto(path.join(PASTA_MEMORIA, "aprendizados.md"), `- [${hoje}] ${a}\n`);
  // índice de episódios
  const eps = listarEpisodios();
  const indice = ["# Episódios", "", "| Ep | Título | Frase memorável | Dilema | Cenário | Pasta |", "|---|---|---|---|---|---|", ...eps.map((e) => `| ${String(e.numero).padStart(2, "0")} | ${e.roteiro?.titulo ?? "?"} | ${e.roteiro?.frase_memoravel ?? ""} | ${e.roteiro?.dilema ? `${e.roteiro.dilema.opcao_a} × ${e.roteiro.dilema.opcao_b}` : ""} | ${e.roteiro?.cenario ?? ""} | \`${path.relative(RAIZ, e.dir)}\` |`)].join("\n") + "\n";
  gravarTexto(path.join(PASTA_MEMORIA, "episodios.md"), indice);
  log.ok("estado_atual.md, episodios.md e aprendizados.md atualizados.");
}
