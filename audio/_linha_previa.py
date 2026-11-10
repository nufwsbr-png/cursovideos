#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Linha do tempo PROVISÓRIA a partir de roteiro.json + medidas.json (seções 5 e 11 do contrato).

A regra "a voz manda": cada linha começa no `t` nominal deslocado pelo atraso acumulado
das falas anteriores. Se uma voz dura mais que o roteiro previa, tudo depois dela desliza.
Folga mínima entre o fim de uma fala e o começo da próxima linha: 0,35 s.

Este módulo também exporta `derivar_efeitos(roteiro, linhas_resolvidas)`, que converte os
eventos/ações/sons das linhas em efeitos sonoros tipados (a CLI reutiliza esta regra).

Uso:
  python3 audio/_linha_previa.py --episodio episodios/ep01_x --saida /tmp/linha.json
  (sem --saida, imprime o JSON no terminal)
"""
from __future__ import annotations

import argparse
import json
import math
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _comum import carregar_canal, carregar_json, contar_palavras, falar, resolver_episodio, salvar_json  # noqa: E402

FOLGA_S = 0.35
DURACAO_PERGUNTA_S = 5.0
AMBIENTE_POR_CENARIO = {"saguao": "saguao_noite", "rodoviaria": "saguao_noite", "rua": "rua_noite", "estrada": "rua_noite"}

# Palavras no campo livre `som` que viram efeitos quando nenhum evento já os criou.
DICAS_SOM = [
    (r"passos (param|cessam|somem)", None),          # None = não gera nada
    (r"campainha|telefone toca|toca de novo", "campainha"),
    (r"vibra", "celular_vibrar"),
    (r"pancada", "pancada"),
    (r"estalo", "lampada_estalo"),
    (r"clique triplo", "clique_triplo"),
    (r"clique", "clique"),
    (r"passos", "passos"),
    (r"rangendo|porta.*abr", "porta_abrir"),
    (r"porta.*fech", "porta_fechar"),
    (r"freio", "freio_onibus"),
    (r"motor", "motor_onibus"),
    (r"papel", "papel"),
    (r"carimbo", "carimbo"),
    (r"est[áa]tica", "estatica_radio"),
    (r"vidro", "vidro"),
    (r"sino", "sino"),
    (r"batida", "batida"),
    (r"notifica", "notificacao"),
    (r"grave", "grave_crescente"),
]


def _parse_evento(ev: str):
    """'prop.porta.estado=aberta' → ('prop', 'porta', 'estado', 'aberta')."""
    if "=" not in ev:
        return None
    chave, valor = ev.split("=", 1)
    partes = chave.split(".")
    if len(partes) == 3:
        return partes[0], partes[1], partes[2], valor
    if len(partes) == 2:
        return partes[0], None, partes[1], valor
    return None


def _distancia_marcas(canal: dict, cenario_id: str, origem: str | None, destino: str | None) -> float | None:
    cen = next((c for c in canal.get("cenarios", []) if c["id"] == cenario_id), None)
    if not cen:
        return None
    marcas = cen.get("marcas", {})
    pos = {}
    for nome in (origem, destino):
        if nome in marcas:
            pos[nome] = marcas[nome]
        else:
            prop = next((p for p in cen.get("props", []) if p["id"] == nome), None)
            if prop and "pos" in prop:
                pos[nome] = prop["pos"]
    if origem in pos and destino in pos:
        a, b = pos[origem], pos[destino]
        return math.dist((a[0], a[2]), (b[0], b[2]))
    return None


def derivar_efeitos(roteiro: dict, linhas_resolvidas: list[dict], canal: dict | None = None) -> list[dict]:
    """Converte eventos, ações e o campo `som` das linhas em efeitos tipados e posicionados.

    linhas_resolvidas: lista com ao menos `inicio_s`, `fim_s`, `direcao`, `som`, `fala`.
    Regras (resumo):
      prop.*.estado=tocando → campainha (até o estado mudar; máx. 6 s)
      prop.*.estado=na_mao  → clique            prop.*.estado=parado (depois de tocando) → clique
      prop.porta.estado=aberta → porta_abrir     fechada → porta_fechar
      prop.onibus.estado=chegando → motor_onibus (até o próximo estado do ônibus; máx. 10 s)
      prop.onibus.estado=parado   → freio_onibus
      celular.notificacao=i → celular_vibrar + notificacao
      prop.painel.estado=alerta → clique_triplo   alerta_forte → lampada_estalo
      prop.luz*.estado=fraca|apagada → lampada_estalo   piscar → lampada_piscar
      prop.lanchonete.estado=acesa → lampada_estalo
      personagem.X.andar=marca → passos (duração = distância ÷ 1,1 m/s, ritmo lento)
      acao trabalhar → carimbo ocasional (a cada ~2,2 s, máx. 3 por linha)
      acao segurar:* / pegar_celular / guardar_celular → clique curto
      campo `som` (texto livre) → dica só quando nenhum efeito igual existir em ±1 s
    """
    canal = canal or {}
    cenario_id = roteiro.get("cenario")
    efeitos: list[dict] = []
    posicao_personagem: dict[str, str] = {}
    estado_prop: dict[str, str] = {}

    def add(t, tipo, **extra):
        e = {"t": round(max(0.0, t), 3), "tipo": tipo}
        e.update(extra)
        efeitos.append(e)

    def proximo_estado(prop_id: str, a_partir_idx: int) -> float | None:
        for j in range(a_partir_idx + 1, len(linhas_resolvidas)):
            for ev in linhas_resolvidas[j].get("direcao", {}).get("eventos", []) or []:
                p = _parse_evento(ev)
                if p and p[0] == "prop" and p[1] == prop_id and p[2] == "estado":
                    return linhas_resolvidas[j]["inicio_s"]
        return None

    for i, ln in enumerate(linhas_resolvidas):
        # numa transição pelo preto, os eventos (e os sons deles) valem no meio do escuro
        t0 = ln.get("t_eventos", ln["inicio_s"])
        t1 = ln.get("fim_s") or (t0 + 2.0)
        d = ln.get("direcao", {}) or {}
        for ev in d.get("eventos", []) or []:
            p = _parse_evento(ev)
            if not p:
                continue
            alvo, ident, campo, valor = p
            if alvo == "prop" and campo == "estado":
                anterior = estado_prop.get(ident)
                estado_prop[ident] = valor
                if valor == "tocando":
                    fim = proximo_estado(ident, i)
                    dur = min(6.0, (fim - t0) if fim else 2.5)
                    add(t0, "campainha", duracao_s=round(max(1.0, dur), 2))
                elif valor == "na_mao":
                    add(t0, "clique")
                elif valor == "parado" and anterior in ("tocando", "na_mao"):
                    add(t0, "clique")
                elif ident == "porta" or ident.startswith("porta"):
                    if valor == "aberta":
                        add(t0, "porta_abrir")
                    elif valor == "fechada":
                        add(t0, "porta_fechar")
                elif ident == "onibus":
                    if valor == "chegando":
                        fim = proximo_estado(ident, i)
                        dur = min(10.0, (fim - t0) if fim else 6.0)
                        add(t0, "motor_onibus", duracao_s=round(max(2.0, dur), 2))
                    elif valor == "parado":
                        add(t0, "freio_onibus")
                    elif valor == "portas_abertas":
                        add(t0, "porta_abrir")
                elif ident == "painel":
                    if valor == "alerta":
                        add(t0, "clique_triplo")
                    elif valor == "alerta_forte":
                        add(t0, "lampada_estalo")
                elif ident.startswith("luz"):
                    if valor in ("fraca", "apagada", "normal"):
                        add(t0, "lampada_estalo")
                    elif valor == "piscar":
                        add(t0, "lampada_piscar")
                elif ident == "lanchonete" and valor == "acesa":
                    add(t0, "lampada_estalo")
            elif alvo == "celular" and campo == "notificacao":
                try:
                    msg = (roteiro.get("celular") or [])[int(valor)]
                except (ValueError, IndexError):
                    msg = {}
                if (msg or {}).get("tipo") == "alerta":
                    add(t0 + 0.3, "alerta_bipe")      # alerta do sistema: bipe triplo junto com o cartão vermelho
                    add(t0, "celular_vibrar")
                else:
                    add(t0, "celular_vibrar")
                    add(t0 + 0.15, "notificacao")
            elif alvo == "personagem":
                if campo == "posicao":
                    posicao_personagem[ident] = valor
                elif campo == "andar":
                    origem = posicao_personagem.get(ident)
                    dist = _distancia_marcas(canal, cenario_id, origem, valor) if origem else None
                    dur = (dist / 1.1) if dist else 4.0
                    dur = float(min(max(dur, 1.5), 12.0))
                    add(t0, "passos", duracao_s=round(dur, 2), ritmo="lento")
                    posicao_personagem[ident] = valor
        acao = str(d.get("acao") or "")
        # o corpo do protagonista: passos no ritmo do balanço da câmera, portas que abrem no caminho, corrida
        mov = ln.get("movimento") or {}
        if mov.get("tipo") in ("andar", "correr") and float(mov.get("duracao_s") or 0) > 0:
            ini_mov = float(ln["inicio_s"]) + float(mov.get("atraso_s") or 0)
            passo_hz = float(mov.get("passo_hz") or 2.9)
            # primeiro passo no primeiro vale do balanço (cos 2φ = -1 → t = (k + 0,5) / f)
            k0 = math.ceil(ini_mov * passo_hz - 0.5)
            primeiro = (k0 + 0.5) / passo_hz
            corrida = mov.get("tipo") == "correr"
            piso = "ladrilho"
            add(primeiro, "passos_camera", duracao_s=round(max(0.3, float(mov["duracao_s"]) - (primeiro - ini_mov) - 0.15), 3),
                intervalo_s=round(1 / passo_hz, 5), piso=piso, corrida=corrida)
            if corrida:
                add(ini_mov, "ruido_corrida", duracao_s=round(float(mov["duracao_s"]), 2))
            for pt in mov.get("portas") or []:  # t_rel já conta desde o início da linha (inclui o levantar)
                add(float(ln["inicio_s"]) + float(pt.get("t_rel", 0)) - 0.6, "porta_abrir", ganho_db=-4)
        if acao == "trabalhar":
            n = 0
            t = t0 + 0.3
            while t < t1 - 0.2 and n < 3:
                add(t, "carimbo")
                t += 2.2
                n += 1
        elif acao.startswith("segurar:") or acao in ("pegar_celular", "guardar_celular"):
            acao_anterior = str((linhas_resolvidas[i - 1].get("direcao") or {}).get("acao") or "") if i > 0 else ""
            if acao != acao_anterior:      # pegar o objeto faz barulho uma vez, não a cada linha
                add(t0 + 0.1, "clique", ganho_db=-8)
        # dicas do campo livre `som`
        som = (ln.get("som") or "").lower()
        for padrao, tipo in DICAS_SOM:
            if re.search(padrao, som):
                if tipo is None:
                    break
                # já existe um efeito igual perto, ou um efeito longo que ainda cobre este instante?
                ja = any(e["tipo"] == tipo and (abs(e["t"] - t0) <= 1.0 or (e["t"] <= t0 <= e["t"] + float(e.get("duracao_s", 0)) + 0.5))
                         for e in efeitos)
                if not ja and tipo not in ("grave_crescente", "pancada"):
                    extra = {"duracao_s": round(max(1.5, min(t1 - t0, 6.0)), 2)} if tipo in ("passos", "motor_onibus", "campainha") else {}
                    add(t0 + 0.05, tipo, **extra)
                break
    # remove duplicados (mesmo tipo em ±0,1 s)
    unicos = []
    for e in sorted(efeitos, key=lambda e: e["t"]):
        if not any(u["tipo"] == e["tipo"] and abs(u["t"] - e["t"]) < 0.1 for u in unicos):
            unicos.append(e)
    return unicos


def montar_linha_previa(roteiro: dict, medidas: dict | None, canal: dict | None = None, pps: float = 2.5) -> dict:
    canal = canal or {}
    fps = int(canal.get("formato", {}).get("fps", 30))
    medidas = medidas or {}
    falas_por_id = {f["id"]: f for f in roteiro["falas"]}

    def duracao_fala(fid: str) -> float:
        m = medidas.get(fid)
        if isinstance(m, dict) and m.get("duracao_s"):
            return float(m["duracao_s"])
        texto = falas_por_id[fid]["texto"]
        return contar_palavras(texto) / pps + 0.3

    linhas = roteiro["linhas"]
    desloc = 0.0
    deslocamentos = []  # deslocamento vigente em cada linha (para efeitos_extra/silêncios)
    resolvidas = []
    falas_tl = []
    for i, ln in enumerate(linhas):
        inicio = float(ln["t"]) + desloc
        item = {"indice": i, "t_nominal": ln["t"], "inicio_s": round(inicio, 3), "ato": ln.get("ato"),
                "fala": ln.get("fala"), "direcao": ln.get("direcao", {}), "som": ln.get("som"), "imagem": ln.get("imagem")}
        deslocamentos.append((float(ln["t"]), desloc))
        if ln.get("fala"):
            fid = ln["fala"]
            dur = duracao_fala(fid)
            fim_fala = inicio + dur
            f = falas_por_id[fid]
            falas_tl.append({"id": fid, "quem": f["quem"], "inicio_s": round(inicio, 3), "fim_s": round(fim_fala, 3),
                             "filtro": f.get("filtro")})
            if i + 1 < len(linhas):
                prox_nominal = float(linhas[i + 1]["t"]) + desloc
                if fim_fala + FOLGA_S > prox_nominal:
                    desloc += (fim_fala + FOLGA_S) - prox_nominal
        resolvidas.append(item)
    # fim de cada linha = início da próxima
    for i, item in enumerate(resolvidas):
        if i + 1 < len(resolvidas):
            item["fim_s"] = resolvidas[i + 1]["inicio_s"]
    ultima = resolvidas[-1]
    fim_ultima_fala = max([f["fim_s"] for f in falas_tl], default=0.0)
    total = max(ultima["inicio_s"] + DURACAO_PERGUNTA_S, fim_ultima_fala + 1.0)
    ultima["fim_s"] = round(total, 3)

    def deslocar(t_nominal: float) -> float:
        d = 0.0
        for tn, dd in deslocamentos:
            if tn <= t_nominal:
                d = dd
        return t_nominal + d

    climas = []
    for item in resolvidas:
        c = (item.get("direcao") or {}).get("clima")
        if c and (not climas or climas[-1]["clima"] != c):
            climas.append({"inicio_s": item["inicio_s"], "clima": c})

    celular = []
    for item in resolvidas:
        for ev in (item.get("direcao") or {}).get("eventos", []) or []:
            p = _parse_evento(ev)
            if p and p[0] == "celular":
                try:
                    idx = int(p[3])
                except ValueError:
                    continue
                msg = roteiro.get("celular", [])[idx] if idx < len(roteiro.get("celular", [])) else {}
                celular.append({"inicio_s": item["inicio_s"], "evento": p[2], "indice": idx, "de": msg.get("de"),
                                "texto": msg.get("texto"), "tipo": msg.get("tipo", "mensagem"), "hora": msg.get("hora")})

    efeitos = derivar_efeitos(roteiro, resolvidas, canal)
    for ex in roteiro.get("efeitos_extra", []) or []:
        e = dict(ex)
        e["t"] = round(deslocar(float(ex["t"])), 3)
        efeitos.append(e)
    efeitos.sort(key=lambda e: e["t"])

    silencios = [{"inicio_s": round(deslocar(float(s["inicio_s"])), 3), "fim_s": round(deslocar(float(s["fim_s"])), 3)}
                 for s in roteiro.get("silencios", []) or []]

    cen = roteiro.get("cenario", "")
    tipo_amb = roteiro.get("ambiente") or next((v for k, v in AMBIENTE_POR_CENARIO.items() if k in cen), "saguao_noite")
    ambiente = [{"inicio_s": 0.0, "fim_s": round(total, 3), "tipo": tipo_amb, "ganho_db": -26}]

    perg_linha = next((it for it in resolvidas if it.get("ato") == "pergunta" or (it.get("direcao") or {}).get("clima") == "pergunta"), None)
    dil = roteiro.get("dilema", {})
    pergunta = {"inicio_s": perg_linha["inicio_s"] if perg_linha else round(total - DURACAO_PERGUNTA_S, 3), "fim_s": round(total, 3),
                "pergunta": dil.get("pergunta"), "opcao_a": dil.get("opcao_a"), "opcao_b": dil.get("opcao_b")}

    return {"fps": fps, "duracao_total_s": round(total, 3), "deslocamento_final_s": round(desloc, 3), "origem": "linha_previa",
            "falas": falas_tl, "linhas": resolvidas, "climas": climas, "celular": celular, "efeitos": efeitos,
            "ambiente": ambiente, "silencios": silencios, "pergunta": pergunta}


def main() -> None:
    ap = argparse.ArgumentParser(description="Monta uma linha do tempo provisória (as falas mandam).")
    ap.add_argument("--episodio", required=True)
    ap.add_argument("--saida", default=None)
    ap.add_argument("--efeitos-de", default=None,
                    help="linha do tempo já montada (motor/montar_linha.js): só acrescenta os efeitos de som")
    args = ap.parse_args()
    ep = resolver_episodio(args.episodio)
    roteiro = carregar_json(ep / "roteiro.json")
    medidas = carregar_json(ep / "medidas.json") if (ep / "medidas.json").exists() else None
    canal = carregar_canal(ep)
    if args.efeitos_de:
        linha = carregar_json(args.efeitos_de)
        extras = list(linha.get("efeitos") or [])  # efeitos_extra do roteiro, já deslocados pelo montador
        efeitos = derivar_efeitos(roteiro, linha["linhas"], canal) + extras
        efeitos.sort(key=lambda e: e["t"])
        linha["efeitos"] = efeitos
        linha["efeitos_por"] = "audio/_linha_previa.py"
        destino = args.saida or args.efeitos_de
        salvar_json(destino, linha)
        falar(f"Efeitos de som: {len(efeitos)} → {destino}")
        return
    pps = float(canal.get("vozes", {}).get("palavras_por_segundo_estimadas", 2.5))
    linha = montar_linha_previa(roteiro, medidas, canal, pps)
    if args.saida:
        salvar_json(args.saida, linha)
        falar(f"Linha provisória: {linha['duracao_total_s']} s, {len(linha['falas'])} falas, {len(linha['efeitos'])} efeitos, "
              f"deslocamento final {linha['deslocamento_final_s']} s → {args.saida}")
    else:
        print(json.dumps(linha, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
