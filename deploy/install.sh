#!/usr/bin/env bash
# One-time setup on a VPS (Ubuntu/Debian). Run from the repository: ./deploy/install.sh
# Starts Postgres + the game server on port 5555 (or PUBLIC_PORT=xxxx ./deploy/install.sh).
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v docker >/dev/null 2>&1; then
  echo "▶ Docker 설치 중…"
  curl -fsSL https://get.docker.com | sh
fi
SUDO=""; [ "$(id -u)" -ne 0 ] && SUDO="sudo"

if [ ! -f .env ]; then
  # The app is built against web/.env.production; use the same port when it is set.
  BAKED_PORT=$(grep -s '^VITE_SERVER_URL=' ../web/.env.production | sed -nE 's#.*:([0-9]+)/?$#\1#p' || true)
  PORT=${PUBLIC_PORT:-${BAKED_PORT:-5555}}
  PW=$(head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \n')
  printf 'PUBLIC_PORT=%s\nPOSTGRES_PASSWORD=%s\nSEASON=1\n' "$PORT" "$PW" > .env
  chmod 600 .env
  echo "▶ 설정을 deploy/.env에 저장했어요 (DB 비밀번호 포함, 지우지 마세요)."
fi
PORT=$(grep '^PUBLIC_PORT=' .env | cut -d= -f2)

# Open the port if a firewall is active.
if command -v ufw >/dev/null 2>&1 && $SUDO ufw status | grep -q "Status: active"; then
  $SUDO ufw allow "${PORT}/tcp" >/dev/null
fi

echo "▶ 빌드하고 시작하는 중… (처음엔 몇 분 걸려요)"
$SUDO docker compose up -d --build

echo "▶ 서버 확인 중…"
for i in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1; then
    IP=$(curl -4 -fsS https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')
    echo
    echo "✅ 완료! 서버 주소: http://${IP}:${PORT}"
    echo "   · 앱 받기: http://${IP}:${PORT}/download"
    echo "   · 밖에서 안 열리면 VPS 업체 방화벽(보안 그룹)에서 ${PORT}/tcp를 열어 주세요."
    exit 0
  fi
  sleep 3
done
echo "⚠ 서버가 응답하지 않아요. 'sudo docker compose -f deploy/docker-compose.yml logs app'로 로그를 확인하세요."
exit 1
