#!/usr/bin/env bash
# Agenda a fábrica no cron (Linux/Mac). Uso: bash scripts/agendar-linux.sh 17:30
set -euo pipefail
HORA="${1:-17:30}"
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
H="${HORA%%:*}"; M="${HORA##*:}"
NODE="$(command -v node)"
LINHA="$M $H * * * cd $RAIZ && $NODE fabrica/cli.js diario >> $RAIZ/fabrica-diaria.log 2>&1"
( crontab -l 2>/dev/null | grep -v "fabrica/cli.js diario" ; echo "$LINHA" ) | crontab -
echo "Agendado no cron: $LINHA"
echo "Log em $RAIZ/fabrica-diaria.log"
