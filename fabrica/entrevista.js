// Entrevista para criar o SEU canal (capítulo 54): uma pergunta por vez, respostas viram o cérebro e o canal.json.
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { ARQUIVO_CANAL, PASTA_MEMORIA, PASTA_CANAL } from "./config.js";
import { lerJson, gravarJson, gravarTexto, lerTexto } from "./util/arquivos.js";
import { log } from "./util/log.js";
import { pedir, temClaude } from "./ia/claude.js";

export const PERGUNTAS = [
  ["combinado", "Você assina o combinado: 'Vou usar a fórmula, nunca a identidade de outro criador. Meu canal terá nome, personagens, histórias e visual meus.'? (sim/não)"],
  ["frase_do_canal", "A frase do seu canal (capítulo 14): 'Você é [PAPEL] em [LUGAR] quando acontece [CRISE], e a regra é [REGRA].'"],
  ["lugar", "Lugar principal (reconhecível em 2 segundos) e como ele é por dentro: estrutura, objetos, sinais de vida."],
  ["papel", "Papel do protagonista: emprego/idade/função, motivo para estar ali, pouco poder."],
  ["crise", "A crise (começa pequena, nunca explicada por inteiro)."],
  ["regra", "A regra do mundo (cabe num comentário)."],
  ["publico", "Público que você imagina (idade, interesses)."],
  ["diferenca", "O que diferencia o seu canal dos que você viu na investigação (tabela do detetive)."],
  ["nunca", "O que você nunca vai fazer no canal."],
  ["canais_estudo", "3 canais que você vai estudar (não copiar) — só para a sua memória."],
  ["nome", "Nome de exibição e @ (passaram no teste dos 5 'sim'?)."],
  ["pistas", "As 6 pistas do protagonista: mãos, manga/roupa, objeto de trabalho, celular (quem manda mensagem), como os outros te chamam, jeito de falar."],
  ["colega", "O colega (nega, faz piada): nome, idade, função, o que quer, o que esconde, visual de longe, frase típica."],
  ["autoridade", "A autoridade (ordens que ninguém entende): nome, função, aparece em cena ou só por telefone/rádio?, frase típica."],
  ["voz_distante", "A voz distante (rádio, alto-falante, celular): o que é e como fala."],
  ["ameaca", "A ameaça calma (fala baixo, pede coisas simples): como aparece, o que pede, frase típica."],
  ["quem_ama", "Quem você ama (dá motivo e cria o dilema): quem é e como aparece (mensagem, ligação)."],
  ["biblia", "A bíblia: o que está acontecendo de verdade? Quais são as regras? Como mudam? Qual o grande mistério? Para onde o protagonista quer ir?"],
  ["mapa", "Mapa da série em blocos (4 a 6 episódios por lugar): bloco 1, 2, 3, 4 e final."],
  ["frases", "3 frases memoráveis (curtas, comuns mas fora de lugar, ditas com calma)."],
  ["visual", "Estilo visual: 2 referências de fora do TikTok, uma frase que resume, traço, 3 cores + cor de alerta, sombra/textura, lente, proporção dos bonecos, fonte da legenda."],
  ["vozes", "Vozes já escolhidas no casting (voz por personagem) ou 'A DECIDIR'."],
  ["ritmo", "Ritmo: quantos episódios por semana e horário de publicação (fuso)."],
];

const ESQUEMA_SAIDA = {
  type: "object", additionalProperties: false,
  properties: {
    canal_json: { type: "object", additionalProperties: true },
    memoria: {
      type: "object", additionalProperties: false,
      properties: { canal_e_nicho: { type: "string" }, personagens: { type: "string" }, biblia_e_mapa: { type: "string" }, estilo_visual: { type: "string" }, vozes: { type: "string" } },
      required: ["canal_e_nicho", "personagens", "biblia_e_mapa", "estilo_visual", "vozes"],
    },
    perguntas_pendentes: { type: "array", items: { type: "string" } },
    avisos: { type: "array", items: { type: "string" } },
  },
  required: ["canal_json", "memoria", "perguntas_pendentes", "avisos"],
};

export async function entrevista({ arquivoRespostas = null } = {}) {
  log.passo("Entrevista para criar o seu canal");
  let respostas = {};
  if (arquivoRespostas) {
    respostas = JSON.parse(fs.readFileSync(arquivoRespostas, "utf8"));
  } else {
    const rl = readline.createInterface({ input, output });
    console.log("\nResponda uma pergunta por vez. Enter vazio = 'A DECIDIR'. Digite 'sair' para parar.\n");
    for (const [chave, pergunta] of PERGUNTAS) {
      const r = (await rl.question(`\n${pergunta}\n> `)).trim();
      if (r.toLowerCase() === "sair") break;
      respostas[chave] = r || "A DECIDIR";
    }
    rl.close();
  }
  if (respostas.combinado && !/^s/i.test(respostas.combinado)) {
    log.erro("Sem o combinado assinado, a fábrica não cria canal. Leia a página 9 do livro.");
    return;
  }
  const md = ["# Respostas da entrevista", "", `_${new Date().toISOString().slice(0, 10)}_`, "", ...PERGUNTAS.map(([k, p]) => `## ${p}\n${respostas[k] ?? "A DECIDIR"}\n`)].join("\n");
  gravarTexto(path.join(PASTA_MEMORIA, "entrevista_respostas.md"), md);
  gravarJson(path.join(PASTA_MEMORIA, "entrevista_respostas.json"), respostas);
  log.ok("Respostas gravadas em memoria/entrevista_respostas.md");

  if (!temClaude()) {
    log.aviso("Sem ANTHROPIC_API_KEY: não consigo montar o canal.json automaticamente. Edite canal/canal.json à mão usando as respostas (ou rode de novo com a chave).");
    return;
  }
  const atual = lerJson(ARQUIVO_CANAL);
  const contratos = lerTexto(path.join(PASTA_CANAL, "..", "docs", "CONTRATOS.md")).slice(0, 12000);
  const saida = await pedir({
    sistema: `Você monta o cérebro e a configuração de um canal POV em primeira pessoa a partir das respostas do dono, seguindo o livro POV Viral. Nunca invente decisões do dono: o que ele não respondeu vira "A DECIDIR". Nunca copie o canal-exemplo nem o canal do livro. Mantenha EXATAMENTE a estrutura do canal.json atual (mesmas chaves e tipos; cenários com props de tipos conhecidos do motor: sala, guiche, bilhete, telefone_fixo, bloco_passagens, caneca, lampada, placa, painel, porta, relogio, bancos, lanchonete, mural, alto_falante, ventilador_teto, bebedouro, lixeira, planta, extintor, onibus, exterior, caixa, mesa, cadeira, prateleira, poster, janela, carro, radio, computador; marcas com posições em metros; câmera sentada ou em pé olhando para -z). Separe medido de hipótese nos arquivos de memória. Escreva tudo em português do Brasil; estilos de voz em inglês com o prefixo de sotaque.\n\nCONTRATO:\n${contratos}`,
    usuario: `canal.json ATUAL (modelo de estrutura; troque o conteúdo pelo canal do dono):\n${JSON.stringify(atual)}\n\nRESPOSTAS DO DONO:\n${JSON.stringify(respostas, null, 1)}\n\nDevolva: canal_json completo; os 5 arquivos de memória em markdown (canal_e_nicho, personagens, biblia_e_mapa, estilo_visual, vozes) no mesmo espírito dos atuais; perguntas que ainda faltam; avisos (temas de risco, nomes parecidos com canais conhecidos, etc.).`,
    esquema: ESQUEMA_SAIDA, esforco: "high", maxTokens: 48000, rotulo: "entrevista",
  });
  fs.copyFileSync(ARQUIVO_CANAL, path.join(PASTA_CANAL, `canal.anterior.${Date.now()}.json`));
  gravarJson(ARQUIVO_CANAL, saida.canal_json);
  for (const [nome, texto] of Object.entries(saida.memoria)) gravarTexto(path.join(PASTA_MEMORIA, `${nome}.md`), texto);
  log.ok("canal/canal.json e memoria/* substituídos (o anterior ficou em canal/canal.anterior.*.json).");
  for (const p of saida.perguntas_pendentes) log.aviso("Ainda falta: " + p);
  for (const a of saida.avisos) log.aviso(a);
  log.info("Próximos passos: casting de vozes, teste dos 3 estilos (node fabrica/cli.js estilos) e primeiro episódio (node fabrica/cli.js episodio --novo).");
}
