# 개발/테스트 서버 배포 가이드 (공용 계정)

공용 계정 1개를 여러 명이 함께 씁니다. **아래 규칙만 지키면 서로 꼬이지 않아요.**

## ✅ 해야 할 것

### 배포(코드 반영)는 항상 이 명령 하나로
```bash
cd ~/cen_resort   # 저장소 위치
./deploy.sh
```
- `git 최신화 → npm install → pm2 재시작`을 자동으로, 항상 같은 방식으로 처리
- **동시 배포 방지**: 누군가 배포 중이면 자동으로 막고 "잠시 후 시도" 안내
- 항상 `origin/main` 기준으로 맞춤

### 서버 상태 확인 / 로그
```bash
pm2 status                 # 실행 상태
pm2 logs cen-resort        # 실시간 로그 (Ctrl+C로 나감)
pm2 reload cen-resort      # 코드 변경 없이 재시작만
```

## ⛔ 하지 말 것
- **`node index.js` 직접 실행 금지** → 포트 8999 충돌·중복 실행의 원인. 반드시 pm2를 통해서만.
- **서버에서 코드 직접 수정 금지** → 수정은 로컬에서 → `git push` → 서버에서 `./deploy.sh`. (서버는 배포 대상일 뿐, 개발 공간이 아님)
- **`server/data/`, `server/uploads/` 삭제 금지** → 후기 DB와 사진이 여기 있음. git에는 없으니 지우면 복구 어려움.

## 최초 1회 세팅 (관리자가 이미 해둠)
```bash
npm install -g pm2         # pm2 설치 (sudo 필요할 수 있음)
git clone <repo> ~/cen_resort
cd ~/cen_resort && ./deploy.sh
pm2 startup                # 서버 재부팅 후에도 자동 실행 (안내되는 명령 실행)
pm2 save
```

## 접속
- 팀원: VPN 접속 후 브라우저에서 **http://192.168.64.57:8999** (개발) / **http://192.168.64.58:8999** (테스트)
