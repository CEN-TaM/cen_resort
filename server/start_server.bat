@echo off
REM 모바일 휴양소 후기 서비스 백엔드 실행
cd /d "%~dp0"
if not exist node_modules (
  echo [설치] 최초 1회 의존성 설치 중...
  call npm install
)
echo [실행] http://localhost:8999 에서 서버 시작
node index.js
pause
