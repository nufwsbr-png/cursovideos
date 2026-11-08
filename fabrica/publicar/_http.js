// Cliente HTTP único dos publicadores. Em modo `simular`, nada sai para a rede:
// cada requisição é anotada no registro (com segredos escondidos) e a resposta vem de `simulado`.
import { ErroPublicacao, redigirHeaders, redigirUrl, dormir } from './_util.js';

export function criarRegistro() {
  const itens = [];
  return {
    itens,
    anotar(item) { itens.push({ ordem: itens.length + 1, ...item }); },
    resumo() {
      return itens.map((i) => `${String(i.ordem).padStart(2, ' ')}. [${i.plataforma}] ${i.metodo} ${i.url}${i.descricao ? ' · ' + i.descricao : ''}`).join('\n');
    },
  };
}

function resumirCorpo(corpo, tipo) {
  if (corpo === undefined || corpo === null) return null;
  if (tipo === 'binario') return `<binário ${corpo.length ?? corpo.byteLength ?? '?'} bytes>`;
  if (tipo === 'multipart') {
    const resumo = {};
    for (const [k, v] of Object.entries(corpo)) resumo[k] = v && typeof v === 'object' && v.arquivo ? `<arquivo ${v.arquivo}>` : v;
    return resumo;
  }
  if (tipo === 'form' || tipo === 'json') {
    if (typeof corpo === 'string') return corpo.slice(0, 500);
    const copia = {};
    for (const [k, v] of Object.entries(corpo)) {
      const chave = k.toLowerCase();
      copia[k] = (chave.includes('token') || chave.includes('secret') || chave === 'code') ? '****' : v;
    }
    return copia;
  }
  return String(corpo).slice(0, 500);
}

/**
 * chamar({ metodo, url, headers, corpo, tipo, resposta, simular, registro, plataforma, simulado, descricao })
 *  tipo: 'json' | 'form' | 'binario' | 'multipart' | 'nenhum'
 *  resposta: 'json' | 'texto' | 'completa' | 'nenhuma'
 */
export async function chamar(opcoes) {
  const {
    metodo = 'GET', url, headers = {}, corpo, tipo = 'json', resposta = 'json',
    simular = false, registro, plataforma = '?', simulado, descricao, timeout_ms = 180000, tentativas = 1,
  } = opcoes;

  if (simular) {
    registro?.anotar({ plataforma, descricao, metodo, url: redigirUrl(url), headers: redigirHeaders(headers), corpo: resumirCorpo(corpo, tipo) });
    const valor = typeof simulado === 'function' ? simulado() : (simulado ?? {});
    return valor;
  }

  const cabecalhos = { ...headers };
  let body;
  if (tipo === 'json' && corpo !== undefined) {
    body = typeof corpo === 'string' ? corpo : JSON.stringify(corpo);
    if (!cabecalhos['Content-Type']) cabecalhos['Content-Type'] = 'application/json; charset=UTF-8';
  } else if (tipo === 'form' && corpo !== undefined) {
    body = new URLSearchParams(corpo).toString();
    cabecalhos['Content-Type'] = 'application/x-www-form-urlencoded';
  } else if (tipo === 'binario') {
    body = corpo;
    if (!cabecalhos['Content-Type']) cabecalhos['Content-Type'] = 'application/octet-stream';
  } else if (tipo === 'multipart') {
    const form = new FormData();
    for (const [k, v] of Object.entries(corpo)) {
      if (v && typeof v === 'object' && v.arquivo) {
        form.append(k, new Blob([v.dados], { type: v.tipo || 'application/octet-stream' }), v.arquivo);
      } else {
        form.append(k, String(v));
      }
    }
    body = form;
  }

  let ultimoErro;
  for (let tentativa = 1; tentativa <= tentativas; tentativa++) {
    const controlador = new AbortController();
    const temporizador = setTimeout(() => controlador.abort(), timeout_ms);
    try {
      const r = await fetch(url, { method: metodo, headers: cabecalhos, body, signal: controlador.signal });
      clearTimeout(temporizador);
      if (resposta === 'completa') {
        const texto = await r.text();
        let json = null;
        try { json = texto ? JSON.parse(texto) : null; } catch { /* não é JSON */ }
        return { status: r.status, ok: r.ok, headers: Object.fromEntries(r.headers.entries()), texto, json };
      }
      if (!r.ok) {
        const texto = (await r.text()).slice(0, 2000);
        const erro = new ErroPublicacao(`${plataforma}: HTTP ${r.status} em ${metodo} ${redigirUrl(url)} — ${texto}`, { status: r.status, corpo: texto });
        if (r.status >= 500 || r.status === 429) { ultimoErro = erro; await dormir(1500 * tentativa); continue; }
        throw erro;
      }
      if (resposta === 'nenhuma') return { status: r.status };
      if (resposta === 'texto') return await r.text();
      const texto = await r.text();
      if (!texto) return {};
      try { return JSON.parse(texto); } catch { return { _texto: texto }; }
    } catch (e) {
      clearTimeout(temporizador);
      if (e instanceof ErroPublicacao && !(e.detalhes.status >= 500 || e.detalhes.status === 429)) throw e;
      ultimoErro = e instanceof ErroPublicacao ? e : new ErroPublicacao(`${plataforma}: falha de rede em ${metodo} ${redigirUrl(url)} — ${e.message}`, { causa: e.message });
      if (tentativa < tentativas) await dormir(1500 * tentativa);
    }
  }
  throw ultimoErro;
}

/** Repete uma leitura de status até a condição ser satisfeita ou o tempo acabar. */
export async function esperarAte({ ler, pronto, falhou, intervalo_ms = 5000, limite_ms = 10 * 60 * 1000, simular = false }) {
  const inicio = Date.now();
  let ultimo = null;
  while (Date.now() - inicio <= limite_ms) {
    ultimo = await ler();
    if (pronto(ultimo)) return { ok: true, estado: ultimo };
    if (falhou && falhou(ultimo)) return { ok: false, estado: ultimo };
    if (simular) return { ok: true, estado: ultimo, simulado: true };
    await dormir(intervalo_ms);
  }
  return { ok: false, estado: ultimo, tempo_esgotado: true };
}
