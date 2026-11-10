#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Vozes FALSAS de teste (provedor "falso"), para rodar a fábrica inteira sem chave de API.

Não é fala: é um som parecido com fala (pulsos glotais + formantes simples + sílabas),
com duração plausível, timbre por personagem e nível por volta de -20 dBFS.
Serve para medir, sincronizar boca, mixar e revisar quadros. Um episódio com voz falsa
NÃO pode ser publicado: a fábrica marca isso em audio/falas/origem.json.

Uso:
  python3 audio/voz_falsa.py --episodio episodios/ep01_x [--so f03,f04] [--forcar] [--semente 7]
"""
from __future__ import annotations

import argparse
import hashlib
import math
import re
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _comum import (agora_iso, carregar_canal, carregar_json, contar_palavras, enfatizar_banda,  # noqa: E402
                    envelope_adsr, escrever_wav, falar, filtrar_banda, normalizar_rms, resolver_episodio,
                    salvar_json)

TAXA = 24000

# Vozes pré-definidas do Gemini TTS (nome → sexo aproximado), só para escolher o registro.
VOZES_FEMININAS = {"kore", "leda", "aoede", "callirrhoe", "autonoe", "despina", "erinome", "laomedeia",
                   "achernar", "gacrux", "pulcherrima", "vindemiatrix", "sulafat", "zephyr"}
VOZES_MASCULINAS = {"puck", "charon", "fenrir", "orus", "enceladus", "iapetus", "umbriel", "algieba",
                    "algenib", "rasalgethi", "alnilam", "schedar", "achird", "zubenelgenubi", "sadachbia",
                    "sadaltager"}
# Vogais: (F1, F2, F3) em Hz, aproximação de português brasileiro
VOGAIS = {
    "a": (750, 1250, 2600), "e": (480, 1900, 2600), "i": (300, 2300, 3000),
    "o": (480, 900, 2500), "u": (330, 750, 2400),
}


def semente_da_voz(nome: str) -> int:
    return int.from_bytes(hashlib.sha256(nome.encode("utf-8")).digest()[:4], "little")


def perfil_da_voz(nome_voz: str, estilo: str = "") -> dict:
    """Define f0 e cor do timbre a partir do nome da voz (determinístico)."""
    chave = (nome_voz or "").strip().lower()
    rng = np.random.default_rng(semente_da_voz(chave or "voz"))
    if chave in VOZES_FEMININAS:
        f0 = 175 + 55 * rng.random()
        brilho = 0.9
    elif chave in VOZES_MASCULINAS:
        f0 = 95 + 40 * rng.random()
        brilho = 0.7
    else:
        f0 = 100 + 120 * rng.random()
        brilho = 0.8
    if chave == "algenib":          # o grave do elenco
        f0 = 82.0
        brilho = 0.55
    if chave == "erinome":          # anunciadora fria, mais plana
        brilho = 1.0
    est = (estilo or "").lower()
    if "whisper" in est or "sussur" in est:
        soprosidade = 0.75
    elif "shout" in est or "loud" in est:
        soprosidade = 0.1
    else:
        soprosidade = 0.3
    return {"f0": f0, "brilho": brilho, "soprosidade": soprosidade, "escala_formantes": 1.15 if chave in VOZES_FEMININAS else 1.0}


def silabas_do_texto(texto: str) -> list[dict]:
    """Quebra o texto em pseudo-sílabas com pausas por pontuação."""
    itens = []
    palavras = texto.replace("—", " ").split()
    for p in palavras:
        nucleo = p.strip(".,;:!?…\"'()")
        pausa = 0.0
        if p.endswith("...") or p.endswith("…"):
            pausa = 0.55
        elif p.endswith((".", "!", "?")):
            pausa = 0.28
        elif p.endswith((",", ";", ":")):
            pausa = 0.18
        if p.startswith("..."):
            itens.append({"pausa_antes": 0.5})
        # grupos de vogais seguidas contam como uma sílaba (ditongos: "quieto" → 2 sílabas)
        grupos = re.findall(r"[aeiouáàâãéêíóôõú]+", nucleo.lower())
        vogais = [g[-1] for g in grupos]
        n_sil = max(1, len(vogais))
        for i in range(n_sil):
            v = vogais[i] if i < len(vogais) else "a"
            v = {"á": "a", "à": "a", "â": "a", "ã": "a", "é": "e", "ê": "e", "í": "i", "ó": "o", "ô": "o", "õ": "o", "ú": "u"}.get(v, v)
            itens.append({"vogal": v, "ultima_da_palavra": i == n_sil - 1, "consoante": i == 0 and nucleo[:1].lower() not in "aeiou"})
        if pausa:
            itens.append({"pausa": pausa})
    return itens


def duracao_prevista(texto: str, palavras_por_segundo: float = 2.5) -> float:
    base = contar_palavras(texto) / palavras_por_segundo + 0.3
    base += 0.5 * texto.count("...") + 0.5 * texto.count("…") + 0.15 * texto.count(",")
    return base


def sintetizar_fala(texto: str, perfil: dict, rng: np.random.Generator, palavras_por_segundo: float = 2.5) -> np.ndarray:
    alvo = duracao_prevista(texto, palavras_por_segundo)
    itens = silabas_do_texto(texto)
    n_sil = sum(1 for i in itens if "vogal" in i)
    pausas = sum(i.get("pausa", 0) + i.get("pausa_antes", 0) for i in itens)
    # ritmo silábico entre 3,5 e 4,5 Hz, ajustado para fechar na duração alvo
    gaps = 0.12 + 0.18 + 0.03 * max(1, len(texto.split()))
    disponivel = max(0.25, alvo - gaps - pausas)
    taxa_sil = n_sil / disponivel if n_sil else 4.0
    taxa_sil = float(np.clip(taxa_sil, 3.5, 5.5))
    dur_sil = 1.0 / taxa_sil
    partes = [np.zeros(int(0.12 * TAXA), dtype=np.float32)]
    f0_base = perfil["f0"]
    contorno = 1.0
    for k, it in enumerate(itens):
        if "pausa" in it or "pausa_antes" in it:
            partes.append(np.zeros(int(it.get("pausa", it.get("pausa_antes", 0.2)) * TAXA), dtype=np.float32))
            continue
        d = dur_sil * (0.9 + 0.2 * rng.random())
        n = int(d * TAXA)
        t = np.arange(n) / TAXA
        # entonação: desce aos poucos na frase, sobe um pouco em interrogação
        contorno *= 0.995
        f0 = f0_base * contorno * (1.0 + 0.04 * np.sin(2 * math.pi * 5.5 * t) + 0.02 * (rng.random() - 0.5))
        if texto.strip().endswith("?") and k >= len(itens) - 3:
            f0 = f0 * (1.0 + 0.12 * np.linspace(0, 1, n))
        fase = np.cumsum(2 * math.pi * f0 / TAXA)
        # pulso glotal aproximado: soma de harmônicos com queda de 1/h^1.2
        pulso = np.zeros(n)
        for h in range(1, 28):
            if f0_base * h > TAXA * 0.45:
                break
            pulso += np.sin(h * fase) / (h ** 1.2)
        pulso /= np.max(np.abs(pulso)) + 1e-9
        ruido = rng.standard_normal(n).astype(np.float32)
        voz = pulso * (1.0 - perfil["soprosidade"]) + filtrar_banda(ruido, TAXA, 800, 6000) * perfil["soprosidade"] * 0.35
        F1, F2, F3 = (f * perfil["escala_formantes"] for f in VOGAIS[it["vogal"]])
        voz = enfatizar_banda(voz, TAXA, F1, 0.35, 10)
        voz = enfatizar_banda(voz, TAXA, F2, 0.3, 7)
        voz = enfatizar_banda(voz, TAXA, F3, 0.3, 4 * perfil["brilho"])
        voz = filtrar_banda(voz, TAXA, 70, 3800 + 3000 * perfil["brilho"])
        env = envelope_adsr(n, TAXA, 0.03, 0.08, 0.75, 0.06)
        voz = voz * env
        if it.get("consoante"):
            nc = int(0.035 * TAXA)
            cons = filtrar_banda(rng.standard_normal(nc).astype(np.float32), TAXA, 2500, 8000) * np.linspace(1, 0, nc) * 0.35
            partes.append(cons)
        partes.append(voz.astype(np.float32))
        if it.get("ultima_da_palavra"):
            partes.append(np.zeros(int(0.03 * TAXA), dtype=np.float32))
    partes.append(np.zeros(int(0.18 * TAXA), dtype=np.float32))
    y = np.concatenate(partes)
    y = normalizar_rms(y, -20.0, mascara=np.abs(y) > 1e-4, teto_pico_dbfs=-3.0)
    return y.astype(np.float32)


def main() -> None:
    ap = argparse.ArgumentParser(description="Gera vozes falsas de teste para um episódio.")
    ap.add_argument("--episodio", required=True)
    ap.add_argument("--so", default="", help="ids separados por vírgula (ex.: f03,f04)")
    ap.add_argument("--forcar", action="store_true", help="substitui até arquivos gerados pelo Gemini")
    ap.add_argument("--semente", type=int, default=None)
    args = ap.parse_args()

    ep = resolver_episodio(args.episodio)
    roteiro = carregar_json(ep / "roteiro.json")
    canal = carregar_canal(ep)
    pps = float(canal.get("vozes", {}).get("palavras_por_segundo_estimadas", 2.5))
    semente = args.semente if args.semente is not None else int(canal.get("estilo", {}).get("semente", 7))
    pasta = ep / "audio" / "falas"
    pasta.mkdir(parents=True, exist_ok=True)
    origem_path = pasta / "origem.json"
    origem = carregar_json(origem_path) if origem_path.exists() else {}
    so = {s.strip() for s in args.so.split(",") if s.strip()}

    gerados, pulados = [], []
    for fala in roteiro["falas"]:
        fid = fala["id"]
        if so and fid not in so:
            continue
        destino = pasta / f"{fid}.wav"
        if destino.exists() and origem.get(fid, {}).get("provedor") == "gemini" and not args.forcar:
            pulados.append(fid)
            continue
        rng = np.random.default_rng(semente * 1000 + int(fid.lstrip("f") or 0))
        perfil = perfil_da_voz(fala.get("voz", ""), fala.get("estilo", ""))
        y = sintetizar_fala(fala["texto"], perfil, rng, pps)
        escrever_wav(destino, y, TAXA)
        origem[fid] = {"provedor": "falso", "modelo": "voz_falsa.py", "voz": fala.get("voz"), "gerado_em": agora_iso(),
                       "duracao_s": round(y.size / TAXA, 3)}
        gerados.append(fid)
    salvar_json(origem_path, origem)
    falar(f"Vozes falsas geradas: {len(gerados)} ({', '.join(gerados)})")
    if pulados:
        falar(f"Mantidas (já são do Gemini): {', '.join(pulados)}")
    falar("AVISO: voz falsa não é publicável. Gere as vozes de verdade antes de publicar.")


if __name__ == "__main__":
    main()
