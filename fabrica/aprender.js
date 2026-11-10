// Aprender com o que se repete (o mínimo, e medido): quando a mesma correção aparece em 3 ou mais dos últimos 5
// episódios, ela vira regra escrita em memoria/roteiro_regras.md → "Regras aprendidas (automáticas)" — que entra no
// pedido do roteiro — e uma linha MEDIDO em aprendizados.md. Fontes: os descontos do linter (validacao.json, inclusive
// das rodadas de correção) e as notas baixas do crítico visual (critico.json, também dos episódios descartados).
// Nunca apaga regra e não repete regra já escrita (marcador <!-- auto:id -->).
import fs from "node:fs";
import path from "node:path";
import { PASTA_MEMORIA, PASTA_EPISODIOS } from "./config.js";
import { lerJson, lerTexto, gravarTexto, anexarTexto, listarEpisodios } from "./util/arquivos.js";
import { log } from "./util/log.js";

const REGRAS = {
  "ritmo.ppm": "Ajuste o número de palavras ao tempo: fique entre o mínimo e o máximo de palavras por minuto do canal.",
  "abertura.primeira_fala": "A primeira fala entra no primeiro segundo; nada de abrir em silêncio.",
  "abertura.sem_fala": "O episódio abre com fala, nunca só com imagem.",
  "silencio.trecho_acao": "Inclua um trecho de ação sem fala (andar ou correr para outro lugar) dentro da faixa de segundos do canal.",
  "silencio.sem_acao": "Trecho sem fala precisa de movimento ou de novidade na tela.",
  "silencio.trecho_morto": "Nenhum trecho sem fala longo demais: quebre com um som, um cartão ou uma fala curta.",
  "fechamento.intervalo": "A última fala termina entre 1 e 4 s antes do cartão da pergunta.",
  "fechamento.aproximacao": "A linha antes da pergunta tem avancar:<objeto do dilema>.",
  "falas.mediana": "Falas curtas: a mediana de palavras por fala fica no limite do canal.",
  "falas.longas": "Quebre as falas longas em duas.",
  "falas.virgulas": "Menos vírgulas: fala dita, não escrita.",
  "falas.protagonista": "O protagonista fala pouco (no máximo a porcentagem do canal).",
  "dilema.emoji": "Os dois botões do dilema têm emoji.",
  "dilema.arriscada": "Marque qual opção do dilema é a arriscada (botão vermelho).",
  "dilema.tamanho": "Cada opção do dilema cabe em 2 a 6 palavras.",
  "celular.alerta": "Alerta no celular com até 4 palavras.",
  "celular.mensagem": "Mensagem no celular com até 10 palavras.",
  "celular.duracao": "Cada cartão do celular fica na tela pelo tempo da faixa do canal.",
  duracao: "Respeite a duração do canal (mínimo e máximo).",
  "ritmo.mudanca": "Algo muda na tela a cada 10 s, no máximo.",
  "textos.descricao": "A descrição segue o formato \"[Situação em uma frase]. Epi. NN\".",
  "textos.hashtags": "De 2 a 4 hashtags, sem #.",
  "textos.titulos": "Três títulos: lugar+situação, frase memorável, escolha do público.",
  "critico.gancho": "Crítico visual: o primeiro quadro mostra o lugar e as mãos já fazendo algo.",
  "critico.legibilidade": "Crítico visual: legendas e cartões não cobrem rosto nem saem da área segura (falas curtas, cartões no tempo).",
  "critico.clareza_acao": "Crítico visual: em cada linha, a câmera olha para quem fala ou para o que importa.",
  "critico.continuidade": "Crítico visual: troca de lugar só com transicao:preto; personagens e objetos mantêm posição entre linhas.",
  "critico.acabamento": "Crítico visual: evite enquadramento vazio (olhar para parede, chão ou teto sem motivo).",
  "critico.dilema_final": "Crítico visual: o fim chega perto do objeto do dilema antes do cartão.",
};

function descartados() {
  const base = path.join(PASTA_EPISODIOS, "_descartados");
  if (!fs.existsSync(base)) return [];
  return fs.readdirSync(base).map((n) => path.join(base, n)).filter((p) => fs.statSync(p).isDirectory());
}

/** As correções de um episódio (um conjunto de ids: cada id conta uma vez por episódio). */
export function correcoesDe(dir) {
  const ids = new Set();
  const val = lerJson(path.join(dir, "validacao.json"), null);
  for (const it of val?.itens ?? []) if (it.tipo === "desconto" || it.tipo === "erro") ids.add(it.id);
  for (const r of val?.rodadas ?? []) for (const id of r.itens ?? []) ids.add(id); // correções pedidas durante a escrita
  const crit = lerJson(path.join(dir, "critico.json"), null);
  const minima = crit?.nota_minima ?? 7;
  for (const ciclo of [...(crit?.ciclos_anteriores ?? []), { rodadas: crit?.rodadas ?? [] }]) {
    const primeira = ciclo.rodadas?.[0];
    for (const [c, n] of Object.entries(primeira?.notas ?? {})) if (n < minima) ids.add(`critico.${c}`);
  }
  return ids;
}

/**
 * Conta as correções nos últimos `janela` episódios (por número, inclui descartados) e promove para regra as que
 * aparecem em `minimo` ou mais. → { novas: [{id, vezes, regra}], contagem }
 */
export function aprender({ janela = 5, minimo = 3, escrever = true } = {}) {
  const dirs = [...listarEpisodios().map((e) => ({ dir: e.dir, numero: e.numero })), ...descartados().map((d) => ({ dir: d, numero: lerJson(path.join(d, "roteiro.json"), {}).numero ?? 0 }))]
    .sort((a, b) => a.numero - b.numero || a.dir.localeCompare(b.dir)).slice(-janela);
  const contagem = {};
  for (const { dir } of dirs) for (const id of correcoesDe(dir)) contagem[id] = (contagem[id] ?? 0) + 1;
  const arqRegras = path.join(PASTA_MEMORIA, "roteiro_regras.md");
  let texto = lerTexto(arqRegras);
  const novas = [];
  for (const [id, vezes] of Object.entries(contagem).sort()) {
    if (vezes < minimo || texto.includes(`<!-- auto:${id} -->`)) continue;
    novas.push({ id, vezes, regra: REGRAS[id] ?? `Evite a correção "${id}", que se repetiu.` });
  }
  if (escrever && novas.length) {
    const hoje = new Date().toISOString().slice(0, 10);
    const linhas = novas.map((n) => `- (${hoje}) ${n.regra} <!-- auto:${n.id} --> _[MEDIDO: "${n.id}" em ${n.vezes} dos últimos ${dirs.length} episódios]_`).join("\n");
    const marca = "## Regras aprendidas (automáticas)";
    if (texto.includes(marca)) {
      const i = texto.indexOf(marca);
      const fimSecao = texto.indexOf("\n## ", i + marca.length);
      const fim = fimSecao < 0 ? texto.length : fimSecao;
      texto = texto.slice(0, fim).trimEnd() + "\n" + linhas + "\n" + texto.slice(fim);
    } else texto = texto.trimEnd() + `\n\n${marca}\n${linhas}\n`;
    gravarTexto(arqRegras, texto);
    for (const n of novas) anexarTexto(path.join(PASTA_MEMORIA, "aprendizados.md"), `- [${hoje}] [MEDIDO] Correção "${n.id}" repetida em ${n.vezes} dos últimos ${dirs.length} episódios → virou regra em roteiro_regras.md: ${n.regra}\n`);
    log.ok(`aprender: ${novas.length} regra(s) nova(s) em roteiro_regras.md`);
  }
  return { novas, contagem, episodios: dirs.length };
}
