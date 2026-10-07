#!/usr/bin/env bash
# Pull the latest code and restart. Accounts and ratings are kept (Postgres volume).
set -euo pipefail
cd "$(dirname "$0")/.."
git pull --ff-only
SUDO=""; [ "$(id -u)" -ne 0 ] && SUDO="sudo"
$SUDO docker compose -f deploy/docker-compose.yml up -d --build
$SUDO docker image prune -f >/dev/null
$SUDO docker builder prune -af >/dev/null  # build cache fills small disks quickly
echo "✅ 업데이트 완료"
