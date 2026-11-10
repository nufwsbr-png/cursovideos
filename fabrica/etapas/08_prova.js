// Etapa 8 — A prova do vídeo pronto (capítulo 66): formato, duração, volume, pico, banda de voz,
// transcrição do vídeo final, folha de quadros do vídeo pronto e a lista do revisor.
import fs from "node:fs";
import path from "node:path";
import { PASTA_AUDIO, PASTA_MEMORIA } from "../config.js";
import { lerJson, gravarJson, atualizarEstado, anexarTexto, definirBloqueios } from "../util/arquivos.js";
import { executar, executarJson, PYTHON } from "../util/exec.js";
import { log } from "../util/log.js";
import { nomeMp4 } from "./07_som.js";
import { problemasGraves } from "./06_render.js";

async function sondar(arquivo) {
  const { saida } = await executar("ffprobe", ["-v", "error", "-print_format", "json", "-show_streams", "-show_format", arquivo], { capturar: true });
  const j = JSON.parse(saida);
  const v = j.streams.find((s) => s.codec_type === "video") ?? {};
  const a = j.streams.find((s) => s.codec_type === "audio") ?? {};
  const [n, d] = String(v.r_frame_rate ?? "0/1").split("/").map(Number);
  return { largura: v.width, altura: v.height, fps: d ? n / d : null, codec_video: v.codec_name, pix_fmt: v.pix_fmt, codec_audio: a.codec_name, taxa_audio: a.sample_rate ? Number(a.sample_rate) : null, duracao_s: Number(j.format.duration), tamanho_mb: Number(j.format.size) / 1e6 };
}

async function folhaDoVideoPronto(arquivo, destino) {
  const filtro = "fps=1/2,drawtext=text='%{pts\\:hms}':fontsize=42:fontcolor=white:box=1:boxcolor=black@0.6:boxborderw=8:x=12:y=12,scale=240:-1,tile=6x8:padding=4:margin=6:color=0x202020";
  await executar("ffmpeg", ["-y", "-v", "error", "-i", arquivo, "-vf", filtro, "-frames:v", "1", destino]);
}

export async function etapaProva({ canal, ep }) {
  log.passo(`Etapa 8 — Prova do episódio ${ep.roteiro.numero}`);
  const arquivo = path.join(ep.dir, nomeMp4(ep.roteiro.numero));
  if (!fs.existsSync(arquivo)) throw new Error(`Não existe ${arquivo}. Rode a etapa de som antes.`);
  const lt = lerJson(path.join(ep.dir, "linha_do_tempo.json"));
  const origem = lerJson(path.join(ep.dir, "audio", "falas", "origem.json"), {});
  const revisao = lerJson(path.join(ep.dir, "revisao.json"), null);
  const f = canal.formato;
  const bloqueios = [];
  const avisos = [];

  const formato = await sondar(arquivo);
  if (formato.largura !== f.largura || formato.altura !== f.altura) bloqueios.push(`formato ${formato.largura}x${formato.altura} (esperado ${f.largura}x${f.altura})`);
  if (formato.fps && Math.abs(formato.fps - f.fps) > 0.5) bloqueios.push(`fps ${formato.fps.toFixed(2)} (esperado ${f.fps})`);
  if (formato.duracao_s < f.duracao_min_s || formato.duracao_s > f.duracao_max_s) bloqueios.push(`duração ${formato.duracao_s.toFixed(1)}s fora de ${f.duracao_min_s}–${f.duracao_max_s}s`);
  if (Math.abs(formato.duracao_s - lt.duracao_total_s) > 0.6) avisos.push(`duração do MP4 (${formato.duracao_s.toFixed(1)}s) difere da linha do tempo (${lt.duracao_total_s.toFixed(1)}s)`);
  if (!formato.codec_audio) bloqueios.push("MP4 sem trilha de áudio");

  let som = null;
  try {
    som = await executarJson(PYTHON, [path.join(PASTA_AUDIO, "medir.py"), "--arquivo", arquivo, "--linha-do-tempo", path.join(ep.dir, "linha_do_tempo.json"), "--json"]);
    const lufs = som.lufs_integrado ?? som.lufs;
    const pico = som.pico_verdadeiro_dbtp ?? som.pico_dbtp ?? som.pico;
    const aud = canal.audio ?? {};
    const alvo = aud.lufs_alvo ?? -14, tol = (aud.lufs_tolerancia ?? 1) + 0.5, teto = (aud.pico_max_dbtp ?? -1) + 0.1;
    if (typeof lufs === "number" && Math.abs(lufs - alvo) > tol) bloqueios.push(`volume ${lufs.toFixed(1)} LUFS fora de ${alvo}±${tol}`);
    if (typeof pico === "number" && pico > teto) bloqueios.push(`pico ${pico.toFixed(2)} dBTP acima de ${teto.toFixed(1)}`);
    // assinatura do som da referência: zumbido grave contínuo, nunca silêncio de verdade
    const bd = som.bandas ?? {};
    if (typeof bd.fracao_20_80 === "number") {
      const [lo, hi] = aud.drone?.fracao_20_80_faixa ?? [0.8, 0.88];
      if (bd.fracao_20_80 < 0.6) bloqueios.push(`zumbido grave ausente: 20–80 Hz com ${(100 * bd.fracao_20_80).toFixed(0)} % da energia (referência 83–87 %)`);
      else if (bd.fracao_20_80 < lo || bd.fracao_20_80 > hi) avisos.push(`20–80 Hz com ${(100 * bd.fracao_20_80).toFixed(0)} % da energia (alvo ${lo * 100}–${hi * 100} %)`);
      // o fim do arquivo pode ter silêncio de propósito depois do cartão; só conta antes da pergunta acabar
      const fimUtil = (lt.pergunta?.fim_s ?? lt.duracao_total_s) - 0.3;
      const buracos = (bd.trechos_abaixo_40db ?? []).filter(([a]) => a < fimUtil);
      if (buracos.length) bloqueios.push(`silêncio de verdade em ${buracos.map(([a, b]) => `${a}–${b}s`).join(", ")} (a referência nunca cai abaixo de -40 dB)`);
      if (typeof bd.nivel_1s_p90_db === "number" && bd.nivel_1s_p90_db - bd.nivel_1s_p10_db > 10) avisos.push(`nível varia ${(bd.nivel_1s_p90_db - bd.nivel_1s_p10_db).toFixed(1)} dB entre trechos (referência ≈ 8 dB)`);
    }
    const veredito = som.banda_de_voz?.veredito ?? som.veredito;
    if (veredito && !/destaca/i.test(veredito)) avisos.push(`banda de voz: ${veredito}`);
    const encobertas = som.banda_de_voz?.falas_possivelmente_encobertas ?? [];
    if (encobertas.length) avisos.push(`falas possivelmente encobertas (vá ouvir): ${encobertas.join(", ")}`);
  } catch (e) {
    avisos.push(`não consegui medir o som: ${e.message.split("\n")[0]}`);
  }

  let transcricao = null;
  try {
    transcricao = await executarJson(PYTHON, [path.join(PASTA_AUDIO, "transcrever.py"), "--arquivo", arquivo, "--roteiro", path.join(ep.dir, "roteiro.json"), "--json"]);
    if (transcricao.conferido_por && transcricao.conferido_por !== "nao_conferido") {
      const faltando = transcricao.faltando ?? [];
      if (faltando.length) bloqueios.push(`falas não encontradas no vídeo pronto: ${faltando.map((x) => x.id ?? x).join(", ")}`);
    } else avisos.push("transcrição do vídeo pronto não conferida (Whisper indisponível): ouvir inteiro no celular");
  } catch (e) {
    avisos.push(`transcrição falhou: ${e.message.split("\n")[0]}`);
  }

  const folha = path.join(ep.dir, "folha_video_pronto.png");
  try { await folhaDoVideoPronto(arquivo, folha); } catch (e) { avisos.push(`folha do vídeo pronto falhou: ${e.message.split("\n")[0]}`); }

  const vozFalsa = ep.roteiro.falas.some((x) => origem[x.id]?.provedor === "falso");
  if (vozFalsa) bloqueios.push("voz falsa: gere as vozes de verdade antes de publicar");
  const graves = problemasGraves(revisao);
  if (graves.length) bloqueios.push(`revisor: ${graves.length} problema(s) grave(s) nos quadros`);
  // fonte: a camada 2D tem de sair em Verdana Bold (medida no render); fonte trocada = vídeo fora do padrão
  const render = lerJson(path.join(ep.dir, "render.json"), null);
  if (render?.fontes && render.fontes.ok === false) bloqueios.push(`fontes diferentes da referência (Verdana ${render.fontes.verdana?.largura_px ?? "?"} px; alvo 909 ±2 %; emoji ${render.fontes.emoji?.ok ? "ok" : "sem cor"})`);
  else if (!render?.fontes) avisos.push("fontes não conferidas no render (render feito antes do autoteste de fontes)");

  const lista = {
    "Formato 1080x1920, fps e duração": bloqueios.every((b) => !/formato|fps|duração/.test(b)),
    [`Volume ${canal.audio?.lufs_alvo ?? -14} LUFS e pico abaixo de -1 dB`]: bloqueios.every((b) => !/volume|pico/.test(b)),
    "Zumbido grave contínuo, sem silêncio (como a referência)": bloqueios.every((b) => !/zumbido|silêncio de verdade/.test(b)),
    "Voz se destaca do fundo": !avisos.some((a) => /banda de voz/.test(a)),
    "Todas as falas no vídeo pronto (transcrição)": transcricao?.conferido_por && transcricao.conferido_por !== "nao_conferido" ? !(transcricao.faltando ?? []).length : "não conferido",
    "Quadros revisados (revisor automático)": graves.length === 0,
    "Vozes de verdade": !vozFalsa,
    "Assistido inteiro no celular, com e sem som": "só o dono confere",
    "Ouvido com fones (sotaque, interpretação, efeitos)": "só o dono confere",
  };
  const prova = { arquivo: path.basename(arquivo), medido_em: new Date().toISOString(), formato, som, transcricao, revisao_quadros: revisao ? { graves: graves.length, avisos: (revisao.avisos ?? []).length } : null, lista, bloqueios, avisos, nao_conferido: ["sotaque", "interpretação", "som ouvido de verdade", "movimento entre quadros"] };
  gravarJson(path.join(ep.dir, "prova.json"), prova);
  definirBloqueios(ep.dir, "prova", bloqueios);
  atualizarEstado(ep.dir, { etapa: "prova", avisos_prova: avisos });
  anexarTexto(path.join(PASTA_MEMORIA, "aprendizados.md"), `- [${new Date().toISOString().slice(0, 10)}] [MEDIDO] ep${String(ep.roteiro.numero).padStart(2, "0")}: ${formato.duracao_s.toFixed(1)} s, ${formato.largura}x${formato.altura}, ${som?.lufs_integrado ?? "?"} LUFS, pico ${som?.pico_verdadeiro_dbtp ?? "?"} dBTP, ${formato.tamanho_mb.toFixed(1)} MB.\n`);
  log.tabela(Object.entries(lista).map(([item, ok]) => ({ item, resultado: ok === true ? "✔" : ok === false ? "✖" : ok })));
  for (const b of bloqueios) log.erro("bloqueio: " + b);
  for (const a of avisos) log.aviso(a);
  log.ok(bloqueios.length ? `Prova com ${bloqueios.length} bloqueio(s): o episódio NÃO será publicado.` : "Prova sem bloqueios.");
  return prova;
}
