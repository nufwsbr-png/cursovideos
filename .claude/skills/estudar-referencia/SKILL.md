---
name: estudar-referencia
description: Estuda vídeos de um canal de referência para copiar só a técnica e o acabamento (cortes, legendas, tempo de fala, som, câmera), medindo com ffmpeg e Whisper e separando MEDIDO de HIPÓTESE. Use quando o dono mandar um perfil ou vídeos de referência, ou pedir para "deixar igual" ao estilo de outro canal.
---

# Estudar uma referência

Copiamos técnica e acabamento; nunca personagem, lugar, história ou nome.

## Passos
1. Login nas redes é do dono: abra o navegador (`node scripts/referencia_navegador.js`) e espere ele entrar.
   Nunca peça nem guarde senha.
2. Baixe 4 ou 5 vídeos variados (início de série, meio, virada forte, o mais visto) para `referencias/` (fora do git).
3. Meça: `python -I scripts/medir_referencia.py referencias/videos/<arquivo>.mp4` (cortes, legendas, falas por
   minuto, som por banda) e `python -I scripts/medir_balanco.py` para o balanço da câmera.
4. Anote em `memoria/estilo_visual.md` e `docs/metodo/estudo_referencia.md` separando MEDIDO (número, ferramenta) de
   HIPÓTESE. As histórias dos vídeos medidos não entram em prompt nem em regra.
5. Proponha ajustes ao dono (motor, regras de roteiro, som). Só implemente o que ele aprovar, e anote a aprovação.

## Entrega
Tabela medido × nosso, e a lista de ajustes propostos. Próxima skill: `producao` (para medir o nosso vídeo igual).
