#!/usr/bin/env bash
# One-time setup on a fresh VPS (Ubuntu/Debian). Run from the repository: ./deploy/install.sh
# Optional: DOMAIN=chess.example.com ./deploy/install.sh   (otherwise asks, defaulting to <ip>.sslip.io)
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v docker >/dev/null 2>&1; then
  echo "▶ Docker 설치 중…"
  curl -fsSL https://get.docker.com | sh
fi
SUDO=""; [ "$(id -u)" -ne 0 ] && SUDO="sudo"

if [ ! -f .env ]; then
  IP=$(curl -4 -fsS https://api.ipify.org || curl -4 -fsS https://ifconfig.me)
  DEFAULT_DOMAIN="$(echo "$IP" | tr . -).sslip.io"
  if [ -z "${DOMAIN:-}" ]; then
    read -rp "도메인 (없으면 그냥 엔터 → ${DEFAULT_DOMAIN}): " DOMAIN </dev/tty || true
  fi
  DOMAIN=${DOMAIN:-$DEFAULT_DOMAIN}
  PW=$(head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \n')
  printf 'DOMAIN=%s\nPOSTGRES_PASSWORD=%s\nSEASON=1\n' "$DOMAIN" "$PW" > .env
  chmod 600 .env
  echo "▶ 설정을 deploy/.env에 저장했어요 (DB 비밀번호 포함, 지우지 마세요)."
fi

# Open the web ports if a firewall is active.
if command -v ufw >/dev/null 2>&1 && $SUDO ufw status | grep -q "Status: active"; then
  $SUDO ufw allow 80/tcp >/dev/null; $SUDO ufw allow 443/tcp >/dev/null; $SUDO ufw allow 443/udp >/dev/null
fi

echo "▶ 빌드하고 시작하는 중… (처음엔 몇 분 걸려요)"
$SUDO docker compose up -d --build

DOMAIN=$(grep '^DOMAIN=' .env | cut -d= -f2)
echo "▶ 서버 확인 중…"
for i in $(seq 1 60); do
  if curl -fsS "https://${DOMAIN}/api/health" >/dev/null 2>&1; then
    echo
    echo "✅ 완료! 서버 주소: https://${DOMAIN}"
    echo "   · 앱: 설정 → 게임 서버 주소에 위 주소 입력"
    echo "   · 웹/아이폰: 브라우저로 위 주소 열기"
    exit 0
  fi
  sleep 3
done
echo "⚠ 아직 HTTPS로 응답이 없어요. 'sudo docker compose -f deploy/docker-compose.yml logs caddy app'로 로그를 확인하세요."
echo "  (도메인이 이 서버 IP를 가리키는지, 80/443 포트가 클라우드 방화벽에서 열려 있는지 확인)"
exit 1
