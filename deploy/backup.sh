#!/usr/bin/env bash
# Dump the database to deploy/backups/chess-<date>.sql.gz
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p backups
SUDO=""; [ "$(id -u)" -ne 0 ] && SUDO="sudo"
f="backups/chess-$(date +%Y%m%d-%H%M).sql.gz"
$SUDO docker compose exec -T db pg_dump -U chess chess | gzip > "$f"
echo "✅ 백업: deploy/$f"
