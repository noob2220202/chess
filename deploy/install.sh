#!/usr/bin/env bash
# One-time setup on a VPS (Ubuntu/Debian). Run from the repository: ./deploy/install.sh
# Starts Postgres + the game server on port 5555 (or PUBLIC_PORT=xxxx ./deploy/install.sh).
set -euo pipefail
cd "$(dirname "$0")"

wait_for_apt() {
  # Fresh servers often run automatic updates at boot; installing Docker fails while apt is locked.
  local waited=0
  while fuser /var/lib/dpkg/lock-frontend /var/lib/dpkg/lock /var/lib/apt/lists/lock >/dev/null 2>&1 \
     || pgrep -x apt-get >/dev/null || pgrep -x apt >/dev/null || pgrep -x dpkg >/dev/null; do
    [ $waited -eq 0 ] && echo "▶ 다른 패키지 설치(자동 업데이트)가 끝나길 기다리는 중… (몇 분 걸릴 수 있어요)"
    sleep 5; waited=$((waited + 5))
    if [ $waited -ge 900 ]; then echo "⚠ 15분이 지나도 apt가 잠겨 있어요. 'ps aux | grep apt'로 확인해 주세요."; exit 1; fi
  done
}

if ! command -v docker >/dev/null 2>&1; then
  wait_for_apt
  echo "▶ Docker 설치 중…"
  curl -fsSL https://get.docker.com | sh
fi
if ! docker compose version >/dev/null 2>&1; then
  wait_for_apt
  apt-get install -y docker-compose-plugin
fi
SUDO=""; [ "$(id -u)" -ne 0 ] && SUDO="sudo"

# Make sure the Docker daemon is running (the install script does not always start it).
if ! $SUDO docker info >/dev/null 2>&1; then
  echo "▶ Docker 서비스 시작 중…"
  $SUDO systemctl enable --now docker >/dev/null 2>&1 || $SUDO service docker start >/dev/null 2>&1 || true
  for i in $(seq 1 20); do $SUDO docker info >/dev/null 2>&1 && break; sleep 1; done
  if ! $SUDO docker info >/dev/null 2>&1; then
    echo "⚠ Docker 서비스가 켜지지 않아요. 아래 명령 결과를 확인해 주세요:"
    echo "   systemctl status docker --no-pager ; journalctl -u docker -n 30 --no-pager"
    exit 1
  fi
fi

if [ ! -f .env ]; then
  # The app is built against web/.env.production; use the same port when it is set.
  BAKED_PORT=$(grep -s '^VITE_SERVER_URL=' ../web/.env.production | sed -nE 's#.*:([0-9]+)/?$#\1#p' || true)
  PORT=${PUBLIC_PORT:-${BAKED_PORT:-5555}}
  PW=$(head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \n')
  printf 'PUBLIC_PORT=%s\nPOSTGRES_PASSWORD=%s\nSEASON=1\n# Contact address shown on the privacy policy and in the footer\nCONTACT_EMAIL=\n' "$PORT" "$PW" > .env
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
