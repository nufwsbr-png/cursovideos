// Patch do crítico visual: só mexe na DIREÇÃO (para onde olha, o que o corpo faz, clima, eventos de personagem e de
// câmera, ±1,5 s no tempo de uma linha, duração de um cartão). A história (falas, atos, celular, dilema, títulos) tem de
// sair idêntica: o hash da história antes e depois é conferido. Se a nota do roteiro cair abaixo do mínimo, reverte.
import { hashJson } from "../util/hash.js";
import { avaliarRoteiro } from "../roteiro/nota.js";

export const LIMITE_T_S = 1.5;
export const MAX_MUDANCAS = 10;
// eventos que o crítico pode pôr ou tirar: pose/expressão/posição/caminhada de personagem e a câmera numa transição
const EVENTO_PERMITIDO = /^(personagem\.[a-z0-9_]+\.(pose|expressao|posicao|andar)|camera\.(ir|postura))=[^\s=]+$/;

/** O que conta como "história": se isto muda, não é mais direção. */
export function hashHistoria(r) {
  return hashJson({
    titulo: r.titulo ?? null,
    frase_memoravel: r.frase_memoravel ?? null,
    cenario: r.cenario ?? null,
    falas: (r.falas ?? []).map((f) => ({ id: f.id, quem: f.quem, texto: f.texto })),
    linhas: (r.linhas ?? []).map((l) => ({ ato: l.ato, fala: l.fala ?? null })),
    celular: (r.celular ?? []).map((c) => ({ de: c.de ?? null, texto: c.texto, tipo: c.tipo, hora: c.hora ?? null, rotulo: c.rotulo ?? null })),
    dilema: r.dilema ?? null,
    proximo_episodio: r.proximo_episodio ?? null,
  });
}

function aplicarUma(novo, original, m, limites) {
  if (m.alvo === "celular") {
    const c = novo.celular?.[m.indice];
    if (!c) return `celular[${m.indice}] não existe`;
    if (m.campo !== "duracao_s") return `no celular só a duração do cartão pode mudar (pediu ${m.campo})`;
    const v = Number(m.valor);
    if (!Number.isFinite(v) || v < limites.cartao[0] || v > limites.cartao[1]) return `duracao_s ${m.valor} fora de ${limites.cartao[0]}–${limites.cartao[1]} s`;
    c.duracao_s = Math.round(v * 10) / 10;
    return null;
  }
  if (m.alvo !== "linha") return `alvo desconhecido "${m.alvo}"`;
  const l = novo.linhas?.[m.indice];
  if (!l) return `linha ${m.indice} não existe`;
  l.direcao ??= {};
  const valor = String(m.valor ?? "").trim();
  switch (m.campo) {
    case "olhar":
    case "acao":
    case "clima":
      if (!valor) return `${m.campo} vazio`;
      l.direcao[m.campo] = valor;
      return null;
    case "eventos_adicionar":
      if (!EVENTO_PERMITIDO.test(valor)) return `evento "${valor}" não é de direção (só personagem.<id>.pose|expressao|posicao|andar e camera.ir|postura)`;
      l.direcao.eventos = [...(l.direcao.eventos ?? []).filter((e) => e.split("=")[0] !== valor.split("=")[0]), valor];
      return null;
    case "eventos_remover": {
      if (!EVENTO_PERMITIDO.test(valor)) return `evento "${valor}" não é de direção`;
      const antes = (l.direcao.eventos ?? []).length;
      l.direcao.eventos = (l.direcao.eventos ?? []).filter((e) => e !== valor);
      return l.direcao.eventos.length === antes ? `evento "${valor}" não está na linha ${m.indice}` : null;
    }
    case "t": {
      const v = Number(valor);
      const t0 = Number(original.linhas[m.indice].t);
      if (m.indice === 0) return "a linha 0 começa sempre em 0 s";
      if (!Number.isFinite(v) || Math.abs(v - t0) > limites.t + 1e-9) return `t ${valor} muda mais de ${limites.t} s (era ${t0})`;
      const ant = novo.linhas[m.indice - 1]?.t ?? -Infinity, prox = novo.linhas[m.indice + 1]?.t ?? Infinity;
      if (!(v > ant && v < prox)) return `t ${valor} quebra a ordem das linhas (${ant} < t < ${prox})`;
      l.t = Math.round(v * 100) / 100;
      return null;
    }
    default:
      return `campo "${m.campo}" não pode ser mudado pelo crítico`;
  }
}

/**
 * Aplica o patch numa cópia do roteiro.
 * → { aplicado, roteiro (o novo, ou o original se reverteu), aplicadas, recusadas, motivo?, avaliacao?, hash_historia }
 */
export function aplicarPatch(roteiro, patch, canal, contexto = {}) {
  const limites = { t: LIMITE_T_S, cartao: canal.roteiro?.cartao_duracao_s ?? [2, 8] };
  const novo = structuredClone(roteiro);
  const aplicadas = [], recusadas = [];
  const mudancas = (patch?.mudancas ?? []).slice(0, MAX_MUDANCAS);
  for (const m of mudancas) {
    const erro = aplicarUma(novo, roteiro, m, limites);
    if (erro) recusadas.push({ ...m, recusa: erro }); else aplicadas.push({ ...m });
  }
  for (const m of (patch?.mudancas ?? []).slice(MAX_MUDANCAS)) recusadas.push({ ...m, recusa: `mais de ${MAX_MUDANCAS} mudanças num patch` });
  const hashAntes = hashHistoria(roteiro);
  const base = { aplicadas, recusadas, hash_historia: hashAntes };
  if (!aplicadas.length) return { ...base, aplicado: false, roteiro, motivo: "nenhuma mudança válida no patch" };
  const hashDepois = hashHistoria(novo);
  if (hashDepois !== hashAntes) return { ...base, aplicado: false, roteiro, motivo: "o patch mexeu na história (hash da história mudou): revertido" };
  const avaliacao = avaliarRoteiro(novo, canal, contexto);
  if (avaliacao.erros.length || !avaliacao.aprovado) {
    return { ...base, aplicado: false, roteiro, avaliacao, motivo: `o roteiro piorou com o patch (nota ${avaliacao.nota}, ${avaliacao.erros.length} erro(s): ${avaliacao.erros.slice(0, 3).join(" | ")}): revertido` };
  }
  return { ...base, aplicado: true, roteiro: novo, avaliacao };
}
