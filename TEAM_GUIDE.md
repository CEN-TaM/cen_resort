# 🏝️ cen_resort 팀 개발/배포 가이드 (Claude와 함께)

이 문서는 **모바일 휴양소 후기 서비스**를 팀원이 각자 개발하고, 공용 개발서버에 배포할 수 있도록 정리한 실행 가이드입니다.
**Claude Code로 개발한다면, 이 파일을 Claude에게 그대로 보여주세요.** 필요한 명령과 함정까지 정리돼 있어 Claude가 바로 따라 할 수 있습니다.

---

## 0. 사전 준비물

### 사람에게 받아야 하는 것 (AI가 대신 못 함)

| 항목 | 어떻게 |
|---|---|
| **VPN (ITCEN Axgate)** | ⚠️ **필수.** 없으면 서버 접속·배포 전부 timeout. 팀 담당자에게 설치 파일과 계정 요청 |
| **서버 공용 비밀번호** | `devadm01` 계정 비번. 팀 내 공유 — 담당자에게 문의 |
| **GitHub 저장소 권한** | `CEN-TaM/cen_resort` collaborator 등록. 저장소 관리자에게 GitHub 아이디 전달 |

### 직접 설치하는 것

| 항목 | 받는 곳 |
|---|---|
| **Git Bash** (Windows) | https://git-scm.com/download/win — 설치 중 옵션은 전부 기본값으로 두면 됩니다 |
| **Node.js 22.5+** | https://nodejs.org — `node:sqlite` 내장 모듈 때문에 **22.5 이상**. LTS 버전 받으세요 |
| **GitHub CLI** (`gh`) | https://cli.github.com — PR 만들 때 필요. 설치 후 `gh auth login` 한 번 |

설치 확인 (Git Bash 에서):

```bash
node -v     # v22.5.0 이상
git --version
gh --version
```

### 터미널 여는 법

명령은 전부 **Git Bash** 기준입니다. PowerShell 은 문법이 달라 안 됩니다.

1. VS Code 에서 **`Ctrl`** + **`Shift`** + **`` ` ``** (숫자 `1` 왼쪽, `~` 키)
2. 터미널 **오른쪽 위 `+` 옆 꺾쇠(`∨`)** → **Git Bash**
3. `홍길동@LAPTOP-XXXX MINGW64 ~` 처럼 보이면 준비 완료

> 붙여넣기는 **마우스 오른쪽 클릭** 또는 `Shift`+`Insert`. `Ctrl`+`V` 는 안 먹을 수 있습니다.

---

## 1. 로컬 개발 환경 세팅

```bash
git clone https://github.com/CEN-TaM/cen_resort.git
cd cen_resort/server
npm install          # express 설치 (최초 1회)
npm start            # http://localhost:8999 에서 실행
```

- 브라우저에서 **http://localhost:8999** 접속 → 후기 작성/조회 테스트.
- ⚠️ 로컬은 **각자 빈 DB**입니다. 애월 실제 후기 16건은 **서버에만** 있어요.
- 데이터(DB)·사진은 git에 없습니다(`server/data/`, `server/uploads/`는 `.gitignore`).

---

## 1.5 브랜치 규칙 (⚠️ 꼭 지켜주세요)

**저장소는 GitHub `CEN-TaM/cen_resort`에 연결되어 있고, 각자 개인 브랜치가 있습니다.**

| 브랜치 | 담당자 | 회사 이메일 |
|---|---|---|
| `gypark` | 박가연 | gypark@itcen.com |
| `gywjdkim` | 김효정 | hjkim4@itcen.com |
| `jkkim` | 김자경 | jk_kim@itcen.com |
| `smlim` | 임소미 | smlim@itcen.com |
| `solyi` | 김솔이 | kimsolyi@itcen.com |
| `main` | **통합 브랜치 (직접 push 금지)** | — |

### 올리는 순서 — 반드시 이렇게
1. **본인 개인 브랜치**에서 작업하고 **먼저 개인 브랜치에 push**
   ```bash
   git checkout <내브랜치>          # 예: git checkout gypark
   git pull origin <내브랜치>       # 최신 상태로
   # ... 코드 수정 ...
   git add -A && git commit -m "작업 내용"
   git push origin <내브랜치>       # ① 개인 브랜치에 먼저
   ```
2. 개인 브랜치 → **main 병합은 PR로**
   ```bash
   gh pr create --base main --head <내브랜치> --title "..." --body "..."
   gh pr merge <PR번호> --merge      # ② 검토 후 main에 반영
   ```

- ⛔ **`main`에 직접 push 금지.** 반드시 `개인 브랜치 → PR → main` 순서.
- ⛔ 남의 브랜치에 push 금지.
- 💡 main의 최신 내용을 내 브랜치로 가져오려면: `git checkout <내브랜치> && git merge origin/main`

### 개발 흐름 요약
로컬 수정 → `npm start` 확인 → **개인 브랜치 push** → **PR로 main 병합** → 개발서버 배포(아래 4번)

---

## 2. 서버 접속 준비 — SSH 키 등록 (최초 1회)

공용 서버 계정: **`devadm01` @ `192.168.64.57` (SSH 포트 7722)**

각자 배포용 SSH 키를 만들고 서버에 등록하세요. (VPN 연결 상태에서)

```bash
# 1) 키 생성 (비밀번호 없이)
ssh-keygen -t ed25519 -N "" -f ~/.ssh/cen_resort_deploy -C "cen_resort-deploy"

# 2) 서버에 공개키 등록 (devadm01 서버 비밀번호 입력 — 팀 내 공유 비번)
ssh-copy-id -i ~/.ssh/cen_resort_deploy.pub -p 7722 devadm01@192.168.64.57
```

- `Number of key(s) added: 1` 나오면 성공.
- 이후부터는 비밀번호 없이 접속됩니다:
  ```bash
  ssh -i ~/.ssh/cen_resort_deploy -p 7722 devadm01@192.168.64.57
  ```

> 💡 **비밀번호 프롬프트에서 화면에 아무것도 안 보이는 건 정상**입니다. 그냥 입력하고 Enter.
> 💡 `Connection timed out` → **VPN이 끊긴 것**. Axgate 재연결 후 다시 시도.

---

## 3. 서버 현황 (이미 세팅 완료 — 재설치 불필요)

공용 계정 `devadm01`에는 아래가 **이미 준비돼 있습니다.** 팀원은 다시 설치할 필요 없어요:

- ✅ Node 22 (`~/opt/node`), npm, **pm2**
- ✅ 앱 코드 + 애월 후기 DB/사진 (`~/cen_resort`)
- ✅ 방화벽 8999 개방, **재부팅 시 자동 실행**(pm2 startup)
- ✅ 서비스 주소: **http://192.168.64.57:8999** (VPN 접속 후)

즉 팀원은 **① SSH 키만 등록**하면 바로 배포/관리에 참여할 수 있습니다.

---

## 4. 서버에 코드 반영 (배포)

**① main 에 병합 → ② 서버에서 `./deploy.sh`** — 이게 전부입니다.

```bash
ssh -i ~/.ssh/cen_resort_deploy -p 7722 devadm01@192.168.64.57
cd ~/cen_resort && ./deploy.sh
```

`deploy.sh` 가 알아서 합니다.

- `origin/main` 최신 코드로 동기화 (`git fetch` → `git reset --hard`)
- `npm install`
- `pm2 reload` 로 무중단 재시작
- **동시 배포 차단** — 누가 배포 중이면 "잠시 후 시도" 안내 후 종료

로컬 파일을 올리지 않습니다. 서버가 GitHub 에서 직접 받습니다.
`server/data`·`server/uploads` 는 `.gitignore` 대상이라 배포해도 **건드려지지 않습니다.**

```bash
git log --oneline -1        # 서버에 지금 올라가 있는 커밋 확인
```

### Claude에게 시키는 법
> "최신 코드를 개발서버(192.168.64.57)에 배포해줘"

---

## 4.5 데이터 자동 백업

후기 DB(`server/data`)와 사진(`server/uploads`)은 git 에 없습니다. 서버 한 곳에만 있으므로 매일 자동 백업합니다.

| | |
|---|---|
| 주기 | 매일 새벽 3시 (pm2 cron — `crontab` 이 금지돼 있어 pm2 로 처리) |
| 위치 | `~/backups/YYYY-MM-DD/` |
| 보관 | 14일 |

```bash
pm2 logs cen-resort-backup --lines 20     # 백업 이력
node ~/cen_resort/server/backup.js        # 수동 백업 (배포 직전 등)
ls ~/backups/                             # 보관 목록
```

- DB 는 `VACUUM INTO` 로 스냅샷을 떠 **WAL 모드에서도 일관성**이 보장됩니다.
- 사진은 하드링크라 14일치를 쌓아도 디스크를 거의 쓰지 않습니다.
- 복구 절차는 `server/backup.js` 상단 주석에 있습니다.

> `pm2 status` 에서 `cen-resort-backup` 이 `stopped` 인 것은 **정상**입니다. 정해진 시각에만 깨어납니다.

**새 서버에 백업을 붙일 때** (기존 서버는 이미 등록됨 — 빠뜨리기 쉬우니 주의):

```bash
cd ~/cen_resort/server
pm2 start backup.js --name cen-resort-backup --cron "0 3 * * *" --no-autorestart
pm2 save
```

새 서버 전체 세팅 절차는 `DEPLOY.md` 7번을 보세요.

---

## 5. 서버 관리 (pm2)

```bash
ssh -i ~/.ssh/cen_resort_deploy -p 7722 devadm01@192.168.64.57
# 접속 후 (pm2 경로: ~/opt/node/bin/pm2)
~/opt/node/bin/pm2 status              # 실행 상태
~/opt/node/bin/pm2 logs cen-resort     # 실시간 로그 (Ctrl+C로 나감)
~/opt/node/bin/pm2 reload cen-resort   # 재시작(무중단)
```

> PATH에 넣어두면 편합니다: 접속 후 `export PATH="$HOME/opt/node/bin:$PATH"` (또는 `.bashrc`에 이미 등록됨)

---

## 6. 공용 계정 사용 규칙 (꼬임 방지)

여러 명이 같은 `devadm01` 계정을 씁니다. 아래만 지키면 안전해요:

- ⛔ **`node index.js` 직접 실행 금지** → 포트 8999 충돌. 반드시 **pm2**를 통해서만.
- ⛔ **서버에서 코드 직접 수정 금지** → `git reset --hard` 로 날아갑니다. 수정은 **로컬 → PR → main → 배포**.
- ⛔ **`server/data/`, `server/uploads/` 삭제 금지** → 후기 DB·사진. git에 없어 백업에서만 복구됩니다.
- ✅ **동시 배포는 `deploy.sh` 가 막아줍니다** (flock). 겹치면 "잠시 후 시도" 안내가 뜹니다.

---

## 7. ⚙️ Claude를 위한 환경 메모 (중요 — 안 그러면 헤맵니다)

개발서버(Rocky Linux 9.8) 환경에는 특이점이 있어, 팀원 Claude가 미리 알면 시행착오를 피할 수 있습니다:

- **`git` 2.52 설치됨**(2026-08-24). `tar`는 **여전히 없음**, **`sudo`는 비밀번호 필요**(devadm01은 wheel 그룹).
- **있는 것**: `git`, `flock`, `python3`, `curl`, `gzip`, `xz`, `cpio`. **인터넷 됨**(github/nodejs.org 접근 가능).
- **배포는 `./deploy.sh`** — 서버가 `origin/main` 을 직접 받습니다. scp 로 파일을 밀어넣지 마세요.
- **tar 없이 압축 풀기**(필요한 경우) → python 사용:
  ```bash
  python3 -c "import tarfile; tarfile.open('archive.tgz').extractall('dest')"
  ```
  (`cpio`로 풀면 GNU tar의 긴 경로(`@LongLink`)가 깨지니 **python tarfile 사용**.)
- **Windows 홈 경로에 한글이 있으면** OpenSSH 가 `~/.ssh` 를 못 읽습니다(`Could not create directory '/c/Users/\261\350...'`).
  한글 없는 경로로 키를 옮기고 `-i`, `-o UserKnownHostsFile=` 을 명시하세요.
- **Node는 sudo 없이 사용자 레벨 설치됨**: `~/opt/node` (nodejs.org tarball → python tarfile 추출 → `PATH="$HOME/opt/node/bin:$PATH"`). 이미 설치돼 있으니 재설치 불필요.
- **pm2 전역 설치**는 사용자 레벨 node라 `npm install -g pm2`가 **sudo 없이** 됨.
- **sudo가 꼭 필요한 것**은 방화벽 개방(`firewall-cmd --add-port=8999/tcp`)과 pm2 startup뿐 — **둘 다 이미 완료**됨.
- **`crontab`은 devadm01에게 금지**됨(재부팅 자동실행은 pm2 startup으로 처리했음).
- **VPN 끊기면 모든 SSH/HTTP가 timeout** → Axgate 재연결이 1순위 점검.
- 앱은 `express.json({limit:'30mb'})` + `node:sqlite`(experimental 경고는 정상). 사진은 base64로 받아 `server/uploads/`에 파일로 저장.

---

## 8. 접속 요약

| 대상 | 주소 | 조건 |
|---|---|---|
| 로컬 개발 | http://localhost:8999 | 로컬에서 `npm start` |
| 개발서버(팀 공유) | http://192.168.64.57:8999 | **VPN 연결** |
| 테스트서버 | http://192.168.64.58:8999 | (아직 미배포) |

문제가 생기면 가장 먼저 **① VPN 연결 ② `pm2 status`** 를 확인하세요.
