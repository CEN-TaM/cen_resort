# 🏝️ cen_resort 팀 개발/배포 가이드 (Claude와 함께)

이 문서는 **모바일 휴양소 후기 서비스**를 팀원이 각자 개발하고, 공용 개발서버에 배포할 수 있도록 정리한 실행 가이드입니다.
**Claude Code로 개발한다면, 이 파일을 Claude에게 그대로 보여주세요.** 필요한 명령과 함정까지 정리돼 있어 Claude가 바로 따라 할 수 있습니다.

---

## 0. 사전 준비물

| 항목 | 설명 |
|---|---|
| **VPN (ITCEN Axgate)** | ⚠️ **필수.** 연결 안 하면 서버 접속·배포 전부 timeout. 개발 시작 전 항상 연결(연결완료 100% 확인). |
| **Git Bash** (Windows) | 아래 명령들은 Git Bash(POSIX 셸) 기준. PowerShell 아님. |
| **Node.js 22.5+** (로컬) | 로컬 테스트용. `node:sqlite` 내장 모듈 때문에 **22.5 이상** 필요. |
| **GitHub 접근 권한** | 저장소 `CEN-TaM/cen_resort` collaborator 등록 필요. |

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

> ⚠️ **현재 서버엔 git이 설치돼 있지 않습니다.** 그래서 배포는 **로컬 코드를 scp로 전송**하는 방식입니다.
> (git 기반 `./deploy.sh` 자동화를 쓰려면 6번 "권장 개선" 참고)

### Claude에게 시키는 법
> "최신 코드를 개발서버(192.168.64.57)에 배포해줘"

Claude가 아래를 수행합니다 (수동으로 할 경우 참고):

```bash
KEY=~/.ssh/cen_resort_deploy
# 1) 로컬에서 전송용 압축 (node_modules/.git 제외, data·uploads 포함)
cd /path/to/cen_resort
tar czf /tmp/deploy.tgz --exclude=.git --exclude=server/node_modules --exclude='*.log' .

# 2) 서버로 전송
scp -i $KEY -P 7722 /tmp/deploy.tgz devadm01@192.168.64.57:~/deploy.tgz

# 3) 서버에서 풀고 재시작 (서버엔 tar가 없어 python으로 추출)
ssh -i $KEY -p 7722 devadm01@192.168.64.57 '
  export PATH="$HOME/opt/node/bin:$PATH"
  # 코드만 갱신하고 기존 DB/uploads는 보존하려면 별도 처리 필요 — 아래는 코드 전체 교체 예시
  python3 -c "import tarfile; tarfile.open(\"$HOME/deploy.tgz\").extractall(\"$HOME/cen_resort\")"
  rm -f ~/deploy.tgz
  cd ~/cen_resort/server && npm install --no-audit --no-fund
  pm2 reload cen-resort
'
```

> ⚠️ **데이터 주의**: 위 방식으로 `server/data`·`server/uploads`까지 덮어쓰면 서버의 후기가 로컬 것으로 바뀝니다.
> 코드만 바꾸고 서버 데이터를 지키려면, **로컬 tar에서 `server/data`·`server/uploads`를 제외**하고 전송하세요:
> ```bash
> tar czf /tmp/deploy.tgz --exclude=.git --exclude=server/node_modules \
>   --exclude=server/data --exclude=server/uploads --exclude='*.log' .
> ```

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
- ⛔ **서버에서 코드 직접 수정 금지** → 수정은 **로컬 → git push → 배포**. 서버는 실행 대상일 뿐.
- ⛔ **`server/data/`, `server/uploads/` 삭제 금지** → 후기 DB·사진. git에 없어 복구 어려움.
- ⚠️ **동시 배포 주의** → 두 명이 동시에 배포하지 않기. (git 기반 `deploy.sh`엔 락이 있지만 scp 방식엔 없음)

### (권장 개선) git 기반 배포로 전환
서버에 git을 설치하면 `./deploy.sh` 한 번으로 배포 + 동시배포 락까지 됩니다. 관리자가 1회 세팅:
```bash
# 서버에서 (sudo 비번 필요)
sudo dnf install -y git tar
# 저장소 clone + 인증(비공개 저장소라 토큰/deploy key 필요) 후
cd ~/cen_resort && ./deploy.sh   # 이후 배포는 이 한 줄
```

---

## 7. ⚙️ Claude를 위한 환경 메모 (중요 — 안 그러면 헤맵니다)

개발서버(Rocky Linux 9.8) 환경에는 특이점이 있어, 팀원 Claude가 미리 알면 시행착오를 피할 수 있습니다:

- **`tar`가 없음**, `git`도 없음, **`sudo`는 비밀번호 필요**(devadm01은 wheel 그룹).
- **있는 것**: `python3`, `curl`, `gzip`, `xz`, `cpio`. **인터넷 됨**(github/nodejs.org 접근 가능).
- **tar 없이 압축 풀기** → python 사용:
  ```bash
  python3 -c "import tarfile; tarfile.open('archive.tgz').extractall('dest')"
  ```
  (`cpio`로 풀면 GNU tar의 긴 경로(`@LongLink`)가 깨지니 **python tarfile 사용**.)
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
