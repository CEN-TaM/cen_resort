# 서버 배포 가이드

공용 계정 `devadm01` 하나를 여러 명이 함께 씁니다. **아래만 지키면 서로 꼬이지 않아요.**

| 서버 | 주소 | 상태 |
|---|---|---|
| 개발 | http://192.168.64.57:8999 | 운영 중 |
| 테스트 | http://192.168.64.58:8999 | 미세팅 |

> 접속에는 **VPN(ITCEN Axgate)** 이 필수입니다. 안 되면 VPN부터 확인하세요.

---

## 배포

**① main 에 병합한 뒤 ② 서버에서 `./deploy.sh`** — 이게 전부입니다.

```bash
ssh -i ~/.ssh/cen_resort_deploy -p 7722 devadm01@192.168.64.57
cd ~/cen_resort && ./deploy.sh
```

`deploy.sh` 가 알아서 합니다.

- `origin/main` 최신 코드로 동기화 (`git fetch` → `git reset --hard`)
- `npm install`
- `pm2 reload` 로 무중단 재시작
- **동시 배포 차단** — 누가 배포 중이면 "잠시 후 시도" 안내 후 종료

로컬에서 파일을 올릴 필요가 없습니다. 서버가 GitHub 에서 직접 받습니다.

### 배포 전 확인

```bash
git log --oneline -1        # 서버에 지금 올라가 있는 커밋
```

---

## 데이터는 자동 백업됩니다

후기 DB(`server/data`)와 사진(`server/uploads`)은 `.gitignore` 대상이라 **git 에 없습니다.**
서버 한 곳에만 있으므로 매일 자동 백업합니다.

| | |
|---|---|
| 주기 | 매일 새벽 3시 (pm2 cron) |
| 위치 | `~/backups/YYYY-MM-DD/` |
| 보관 | 14일 |

```bash
pm2 logs cen-resort-backup --lines 20     # 백업 이력
node ~/cen_resort/server/backup.js        # 수동 백업
ls ~/backups/                             # 보관 목록
```

복구 절차는 [`server/backup.js`](server/backup.js) 상단 주석에 있습니다.

> `pm2 status` 에서 `cen-resort-backup` 이 `stopped` 인 것은 **정상**입니다.
> 정해진 시각에만 깨어나는 작업이라 평소에는 멈춰 있습니다.

---

## ⛔ 하지 말 것

- **`node index.js` 직접 실행 금지** → 포트 8999 충돌. 반드시 pm2 를 통해서만.
- **서버에서 코드 직접 수정 금지** → `git reset --hard` 로 날아갑니다. 수정은 로컬 → PR → main → 배포.
- **`server/data/`, `server/uploads/` 삭제 금지** → 후기 DB 와 사진. git 에 없어 백업에서만 복구됩니다.

---

## 서버 관리 (pm2)

```bash
export PATH="$HOME/opt/node/bin:$PATH"    # pm2 경로 (.bashrc 에 이미 있음)

pm2 status                 # 실행 상태
pm2 logs cen-resort        # 실시간 로그 (Ctrl+C 로 나감)
pm2 reload cen-resort      # 무중단 재시작
```

---

## 최초 1회 — SSH 키 등록

```bash
ssh-keygen -t ed25519 -N "" -f ~/.ssh/cen_resort_deploy -C "cen_resort-deploy"
ssh-copy-id -i ~/.ssh/cen_resort_deploy.pub -p 7722 devadm01@192.168.64.57
```

> 💡 **홈 경로에 한글이 있으면**(`C:\Users\홍길동`) OpenSSH 가 `~/.ssh` 를 못 읽습니다.
> `Could not create directory '/c/Users/\261\350...'` 가 뜨면 한글 없는 경로로 옮겨 쓰세요.
>
> ```bash
> mkdir -p /c/dev_TaM/.ssh && cp ~/.ssh/cen_resort_deploy* /c/dev_TaM/.ssh/
> ssh -i /c/dev_TaM/.ssh/cen_resort_deploy \
>     -o UserKnownHostsFile=/c/dev_TaM/.ssh/known_hosts \
>     -p 7722 devadm01@192.168.64.57
> ```

---

## 문제가 생기면

| 증상 | 확인 |
|---|---|
| 접속·화면 전부 안 됨 | **VPN 연결** |
| 화면은 뜨는데 후기가 안 보임 | `pm2 status` → `cen-resort` online 인지 |
| 배포가 "다른 사람이 배포 중" | 잠시 후 재시도. 계속되면 `rm -f /tmp/cen_resort_deploy.lock` |
| 데이터가 사라짐 | `ls ~/backups/` 에서 복구 |