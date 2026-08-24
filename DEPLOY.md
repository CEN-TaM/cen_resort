# 서버 배포 가이드

개발한 코드를 서버에 올리는 방법입니다. **명령 두 줄이면 끝납니다.**

| 서버 | 주소 |
|---|---|
| 개발 | http://192.168.64.57:8999 |
| 테스트 | http://192.168.64.58:8999 |

> **VPN(ITCEN Axgate) 연결이 필수**입니다. 안 되면 VPN부터 확인하세요.

---

## 0. 터미널 여는 법

명령을 입력하려면 **Git Bash** 터미널이 필요합니다. PowerShell 은 명령이 달라 안 됩니다.

1. VS Code 에서 **`Ctrl`** + **`Shift`** + **`` ` ``** 를 누릅니다
   (**`` ` ``** 는 숫자 `1` 왼쪽, `~` 와 같은 키)
2. 아래에 열린 터미널 **오른쪽 위 `+` 옆 꺾쇠(`∨`)** 클릭 → **Git Bash** 선택
3. 아래처럼 보이면 준비 완료입니다

```
홍길동@LAPTOP-XXXX MINGW64 ~
$
```

> 붙여넣기는 **마우스 오른쪽 클릭** 또는 `Shift`+`Insert` 입니다. `Ctrl`+`V` 는 안 먹을 수 있습니다.

---

## 1. 배포하기

### ① main 에 병합

배포되는 코드는 **항상 `main` 기준**입니다. 내 브랜치를 PR 로 main 에 병합하세요. (→ `TEAM_GUIDE.md` 1.5)

### ② 서버 접속

```bash
ssh -i ~/.ssh/cen_resort_deploy -p 7722 devadm01@192.168.64.57
```

프롬프트가 `[devadm01@dev-4027 ~]$` 로 바뀌면 들어간 것입니다.

### ③ 배포

```bash
cd ~/cen_resort && ./deploy.sh
```

끝입니다. `✅ 배포 완료` 가 나오면 성공입니다.

`deploy.sh` 가 알아서 합니다.

- GitHub 에서 `main` 최신 코드를 직접 받음
- `npm install`
- `pm2 reload` 로 무중단 재시작
- **동시 배포 차단** — 누가 배포 중이면 "잠시 후 시도" 안내

로컬 파일을 올릴 필요가 없습니다. 서버가 GitHub 에서 받아갑니다.

### ④ 확인

```bash
git log --oneline -1        # 서버에 올라간 커밋
exit                        # 서버에서 나오기
```

브라우저에서 http://192.168.64.57:8999 접속해 확인하세요.

---

## 2. 데이터는 매일 자동 백업됩니다

후기 DB 와 사진은 GitHub 에 없습니다(`.gitignore`). 서버 한 곳에만 있어서 매일 백업합니다.

| | |
|---|---|
| 주기 | 매일 새벽 3시 |
| 위치 | `~/backups/YYYY-MM-DD/` |
| 보관 | 14일 |

```bash
pm2 logs cen-resort-backup --lines 20     # 백업 이력 보기
node ~/cen_resort/server/backup.js        # 지금 바로 백업
ls ~/backups/                             # 보관 목록
```

복구 방법은 `server/backup.js` 맨 위 주석에 있습니다.

> `pm2 status` 에서 `cen-resort-backup` 이 **`stopped`** 인 것은 **정상**입니다.
> 새벽 3시에만 깨어나는 작업이라 평소엔 멈춰 있습니다.

---

## 3. 하지 말아야 할 것

| ⛔ | 왜 |
|---|---|
| `node index.js` 직접 실행 | 포트 8999 충돌. 반드시 pm2 로만 |
| 서버에서 코드 직접 수정 | 배포하면 `git reset --hard` 로 날아갑니다. 수정은 로컬 → PR → main → 배포 |
| `server/data/`, `server/uploads/` 삭제 | 후기 DB 와 사진. GitHub 에 없어 백업에서만 복구됩니다 |

---

## 4. 서버 상태 보기

서버 접속 후:

```bash
pm2 status                 # 실행 상태
pm2 logs cen-resort        # 실시간 로그 (Ctrl+C 로 나감)
pm2 reload cen-resort      # 재시작
```

---

## 5. 최초 1회 — SSH 키 등록

처음이라 서버 접속이 안 되면 이걸 먼저 하세요. **VPN 연결 상태**에서 Git Bash 에 붙여넣습니다.

```bash
ssh-keygen -t ed25519 -N "" -f ~/.ssh/cen_resort_deploy -C "cen_resort-deploy"
```

```bash
ssh-copy-id -i ~/.ssh/cen_resort_deploy.pub -p 7722 devadm01@192.168.64.57
```

- 서버 비밀번호를 물어봅니다 (팀 공유 비번 — 담당자에게 문의)
- **입력해도 화면에 아무것도 안 보이는 게 정상**입니다
- `Number of key(s) added: 1` 이 나오면 성공

### ⚠️ 윈도우 사용자 이름이 한글이면

`Could not create directory '/c/Users/\261\350...'` 같은 오류가 납니다.
OpenSSH 가 한글 경로를 못 읽어서 그렇습니다. 한글 없는 경로로 옮겨 쓰세요.

```bash
mkdir -p /c/dev_TaM/.ssh && cp ~/.ssh/cen_resort_deploy* /c/dev_TaM/.ssh/
ssh-keyscan -p 7722 -t ed25519 192.168.64.57 >> /c/dev_TaM/.ssh/known_hosts
```

```bash
cat /c/dev_TaM/.ssh/cen_resort_deploy.pub | ssh -o UserKnownHostsFile=/c/dev_TaM/.ssh/known_hosts -p 7722 devadm01@192.168.64.57 "mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys && echo OK"
```

이후 접속은 경로를 명시합니다.

```bash
ssh -i /c/dev_TaM/.ssh/cen_resort_deploy -o UserKnownHostsFile=/c/dev_TaM/.ssh/known_hosts -p 7722 devadm01@192.168.64.57
```

---

## 6. 문제가 생기면

| 화면에 나오는 것 | 뜻 / 대처 |
|---|---|
| `Connection timed out` | **VPN 끊김.** Axgate 재연결 |
| `Permission denied (publickey)` | SSH 키 미등록 → 위 5번 |
| `command not found` | 붙여넣기가 깨진 것. 다시 붙여넣기 |
| `^[[200~` 같은 문자 | 붙여넣기 깨짐. `Ctrl`+`C` 후 재시도 |
| `다른 사람이 지금 배포 중입니다` | 잠시 후 재시도. 계속되면 `rm -f /tmp/cen_resort_deploy.lock` |
| 화면은 뜨는데 후기가 안 보임 | `pm2 status` 에서 `cen-resort` 가 `online` 인지 확인 |
| 데이터가 사라짐 | `ls ~/backups/` 에서 복구 (`server/backup.js` 주석 참고) |

---

## 7. 새 서버를 처음 세팅할 때

기존 서버는 이미 끝났습니다. **새 서버를 추가할 때만** 필요합니다.

준비물: 서버 IP, 계정, 비밀번호, `sudo` 권한, 인터넷 연결

```bash
# ① SSH 키 등록 (로컬에서) — 위 5번과 동일
ssh-copy-id -i ~/.ssh/cen_resort_deploy.pub -p 7722 devadm01@<IP>

# ② 서버 접속
ssh -i ~/.ssh/cen_resort_deploy -p 7722 devadm01@<IP>
```

아래는 **서버 안에서** 실행합니다.

```bash
# ③ Node 설치 (sudo 불필요 — tar 가 없어 python 으로 추출)
V=v22.23.2; T=node-$V-linux-x64
curl -sSL -o /tmp/$T.tar.gz https://nodejs.org/dist/$V/$T.tar.gz
mkdir -p ~/opt && python3 -c "import tarfile; tarfile.open('/tmp/$T.tar.gz').extractall('/tmp/nx')"
mv /tmp/nx/$T ~/opt/node && rm -rf /tmp/nx /tmp/$T.tar.gz
echo 'export PATH="$HOME/opt/node/bin:$PATH"' >> ~/.bashrc
export PATH="$HOME/opt/node/bin:$PATH"

# ④ pm2 설치 (sudo 불필요)
npm install -g pm2

# ⑤ git 설치 · 방화벽 · 자동실행  ← sudo 비밀번호 필요
sudo dnf install -y git
sudo firewall-cmd --add-port=8999/tcp --permanent && sudo firewall-cmd --reload
sudo env PATH=$PATH $(command -v pm2) startup systemd -u $USER --hp $HOME

# ⑥ 코드 받고 배포
git clone https://github.com/CEN-TaM/cen_resort.git ~/cen_resort
cd ~/cen_resort && ./deploy.sh

# ⑦ 자동 백업 등록  ← 빠뜨리기 쉬움. 꼭 하세요
cd ~/cen_resort/server
pm2 start backup.js --name cen-resort-backup --cron "0 3 * * *" --no-autorestart
pm2 save
```

확인:

```bash
pm2 status                                          # cen-resort=online, backup=stopped 면 정상
curl -s -o /dev/null -w "%{http_code}\n" localhost:8999
```

> 새 서버는 **빈 DB 로 시작**합니다. 다른 서버의 후기·사진은 넘어오지 않습니다
> (`.gitignore` 대상이라 GitHub 에 없음). 옮기려면 `~/backups/` 를 복사하세요.