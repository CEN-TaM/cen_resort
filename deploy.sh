#!/usr/bin/env bash
# ============================================================
#  cen_resort 공용 배포 스크립트  (개발/테스트 서버 공용 계정용)
#  여러 명이 같은 계정을 써도 꼬이지 않도록:
#   - 배포 락(flock): 동시 배포 차단
#   - 항상 origin/main 기준으로 코드 강제 동기화
#   - pm2로 단일 프로세스만 재시작 (node 직접 실행 금지)
#
#  사용법:  ./deploy.sh
# ============================================================
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
BRANCH="main"
LOCK="/tmp/cen_resort_deploy.lock"

# --- 1) 동시 배포 방지 락 ---
exec 9>"$LOCK"
if ! flock -n 9; then
  echo "⛔ 다른 사람이 지금 배포 중입니다. 잠시 후 다시 시도하세요."
  exit 1
fi
echo "🔒 배포 락 획득 (다른 배포는 대기됨)"

# --- 2) pm2 확인 ---
if ! command -v pm2 >/dev/null 2>&1; then
  echo "⛔ pm2가 없습니다. 최초 1회 설치 필요:  npm install -g pm2   (권한 없으면 관리자에게 요청)"
  exit 1
fi

# --- 3) 최신 코드로 강제 동기화 (서버는 배포 대상이므로 로컬 변경 무시) ---
echo "📥 origin/$BRANCH 최신 코드로 동기화"
cd "$REPO_DIR"
git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"
#   ↑ data/·uploads/ 는 .gitignore 대상이라 이 명령에도 지워지지 않음 (후기 데이터 보존)

# --- 4) 의존성 설치 ---
echo "📦 의존성 설치"
cd "$REPO_DIR/server"
npm install --no-audit --no-fund

# --- 5) 단일 프로세스로 재시작 (있으면 reload, 없으면 start) ---
echo "🔄 pm2로 서버 재시작 (cen-resort 단일 인스턴스)"
if pm2 describe cen-resort >/dev/null 2>&1; then
  pm2 reload ecosystem.config.js --update-env
else
  pm2 start ecosystem.config.js
fi
pm2 save

echo ""
echo "✅ 배포 완료"
pm2 status
echo "→ 접속: http://$(hostname -I 2>/dev/null | awk '{print $1}'):8999"
