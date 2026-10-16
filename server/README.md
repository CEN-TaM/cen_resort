# cen_resort 백엔드 (후기 저장 서버)

모바일 휴양소 후기 서비스의 후기를 **실제로 저장/조회**하는 API 서버입니다.
Express + Node 내장 SQLite(`node:sqlite`)로 구성되어 별도 DB 설치가 필요 없습니다.

## 실행

```bash
cd server
npm install      # 최초 1회 (Express 설치)
npm start        # = node index.js
```

- Windows에서는 `start_server.bat` 더블클릭으로도 실행됩니다.
- 실행 후 브라우저에서 **http://localhost:8999** 접속 → `index.html`이 서버로 서빙됩니다.
- `index.html`을 파일로 직접 열면 둘러보기만 됩니다(시연 계정 로그인). 서버 로그인·후기 작성은 `http://` 주소로 여세요.

## 데이터 위치

- DB: `server/data/reviews.db`
  - WAL 모드라 최근 쓰기가 `reviews.db-wal`에 있습니다. 켜진 채로 `.db`만 복사하면 누락·손상될 수 있으니 **백업은 `node backup.js`** 로 하세요.
- 사진: `server/uploads/` (후기 사진) · `server/uploads/resorts/` (휴양소 대표 사진). `/uploads/...` 로 제공
- 두 폴더는 `.gitignore` 처리되어 저장소에 올라가지 않습니다.

DB 안의 테이블 (서버가 켜질 때 없으면 만든다 — `server/db.js`, `server/auth.js`)

| 테이블 | 내용 | 넣는 방법 |
|---|---|---|
| `resorts` · `resort_aliases` | 휴양소 정보 · 옛 이름 | 처음엔 자동, 이후 `tools/import_resorts.js` |
| `reviews` · `review_photos` | 후기 · 후기 사진 | 앱에서 작성, 또는 `tools/import_reviews.js` (`DATA_IMPORT.md`) |
| `review_comments` · `review_likes` | 댓글 · 좋아요(1인 1회) | 앱 |
| `notifications` · `notification_reads` | 알림 · 읽음 | 앱 |
| `favorites` | 즐겨찾기 (사번 × 휴양소) | 앱 |
| `notices` · `notice_views` | 공지사항 · 본 사람(조회수) | `tools/notices.js` (`DATA_IMPORT.md` '공지사항 올리기') |
| `tips` · `tip_likes` | 꿀팁 · 꿀팁 좋아요(1인 1회) | 앱, 또는 `tools/import_tips.js` (`DATA_IMPORT.md` '꿀팁 올리기') |
| `point_history` | 휴양소 포인트 내역 (후기 1건 +10P) | 앱 |
| `users` · `sessions` · `verify_codes` | 직원 명단 · 로그인 · 사번인증 코드 | `tools/users.js` |

## 휴양소 데이터

휴양소 목록 · 검색 · 지도 · 상세 · 후기 작성 선택지는 모두 DB 의 **`resorts` 테이블**(+ 옛 표기 `resort_aliases`)을 봅니다.
화면(`index.html`)에 휴양소를 직접 적지 않습니다.

- 서버가 처음 켜질 때 테이블이 비어 있으면 `assets/js/data/resorts.js` 의 `RESORT_SEED` 로 채웁니다.
- 그 뒤로는 **DB 가 원본**입니다. `resorts.js` 를 고쳐도 이미 채워진 DB 에는 반영되지 않습니다.
- 서버 없이 열면(GitHub Pages 등) 화면은 `RESORT_SEED` 를 대신 씁니다.
- 숨기려면 `active = 0`. 후기가 휴양소 이름으로 저장되므로 `name` 을 바꿀 때는 옛 이름을 `resort_aliases` 에 남기세요.

## API

| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | `/api/auth/login` | 사번 로그인 → 세션 쿠키 발급 |
| POST | `/api/auth/logout` | 로그아웃 |
| GET  | `/api/auth/me` | 내 정보 (로그인 안 했으면 401) |
| PUT  | `/api/auth/me` | 연락처·메일·비밀번호 수정 🔒 |
| POST | `/api/auth/verify/code` · `/verify/check` · `/api/auth/activate` | 사번인증 및 비밀번호 설정 (코드 발급 → 확인 → 설정) |
| GET  | `/api/resorts` | 휴양소 목록 (평점·후기 수는 후기에서 계산) |
| POST | `/api/reviews` | 후기 등록 (사진 base64 — JPG·PNG·WEBP, 최대 10장, 장당 10MB) → 작성자에게 **+10P** |
| GET  | `/api/notices` · `/api/notices/:id` | 공지 목록 · 상세 (상세를 열면 조회수에 기록) |
| GET  | `/api/tips?resort=` · `/api/tips/mine` | 휴양소 꿀팁 · 내 꿀팁 |
| POST | `/api/tips` · PUT · DELETE `/api/tips/:id` · POST `/api/tips/:id/like` | 꿀팁 쓰기 · 고치기 · 지우기(본인·관리자) · 좋아요 `{ liked }` |
| GET  | `/api/me/stats` | 내 활동 숫자 (배지 — 기준은 `assets/js/badges.js`) |
| GET  | `/api/favorites` | 내 즐겨찾기 (휴양소 id, 추가한 순서) |
| PUT  | `/api/favorites/:resortId` | 즐겨찾기 `{ on }` — true 추가 / false 해제 |
| GET  | `/api/points/me` | 내 휴양소 포인트 잔액 + 내역 (`point_history`). 후기를 지우면 그 후기로 받은 포인트 차감 |
| GET  | `/api/reviews?resort=이름` | 휴양소별 후기 목록 (정식명·옛 표기 모두 가능, 없으면 전체) |
| GET  | `/api/reviews/mine?empno=사번` | 내가 쓴 후기 |
| POST | `/api/reviews/:id/like` | 좋아요 `{ liked }` — 1인 1회 (`review_likes`) |
| POST | `/api/reviews/:id/comments` | 댓글 등록 |
| GET  | `/api/health` | 헬스체크 |

🔒 표시가 없어도 **후기 등록 · 내 후기 · 삭제 · 좋아요 · 댓글 · 알림은 모두 로그인이 필요**합니다.
작성자와 "본인인지"는 화면이 보낸 사번이 아니라 **서버 세션**으로 판단합니다. 후기 삭제는 본인 또는 관리자만 됩니다.

## 관리자 페이지 (PC)

**http://localhost:8999/admin** (개발서버는 http://192.168.64.57:8999/admin). 앱과 같은 계정으로 로그인하고, **관리자(`role = admin`)만** 들어갑니다.
화면은 `admin/`(index.html · admin.css · admin.js), API 는 `server/admin.js`. 권한은 화면이 아니라 서버가 세션으로 판단합니다(`requireAdmin`).

| 메뉴 | 할 수 있는 것 |
|---|---|
| 공지사항 | 목록(숨긴 공지 · 조회수 포함) · 쓰기 · 고치기 · 숨기기/보이기 · 맨 위 고정 · 삭제 · 첨부 |
| 직원 명단 · 후기 · 꿀팁 · 배지 · 휴양소 | 다음 단계 (지금은 `tools/` 도구) |

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/api/admin/notices` · `/api/admin/notices/:id` | 공지 전체 (숨김 포함) · 한 개 |
| POST | `/api/admin/notices` | 새 공지 `{ category, title, body, author, pinned, active, files, createdAt }` |
| PUT | `/api/admin/notices/:id` | 고치기 (보낸 칸만) |
| DELETE | `/api/admin/notices/:id` | 지우기 (조회 기록도 지움 · 되돌릴 수 없음) |

- 관리자 지정은 `node tools/users.js role <사번> admin`.

## 직원 명단 · 로그인

**회원가입은 없습니다.** 직원 명단은 DB 의 **`users` 테이블**에 있고, 관리자가 미리 넣어 둡니다(사번 · 이름 · 직급 · 회사 메일).
직원은 처음 한 번 로그인 화면의 **'사번인증 및 비밀번호 설정'** 에서

1. 사번 + 회사 메일 입력 → 명단과 일치하면 인증코드 발급
2. 인증코드 확인 → 명단의 이름·직급이 자동으로 채워짐
3. 비밀번호 · 연락처 입력 → 이후 사번 + 비밀번호로 로그인

명단에 없거나 메일이 다르면 진행되지 않습니다. 비밀번호는 해시로만 저장되고, 로그인 상태는 `sessions` 테이블 + HttpOnly 쿠키로 유지됩니다.
코드(`index.html`, `assets/js`)에는 계정이 없습니다. 서버 없이 열 때(시연)만 `auth.js` 의 시연 계정 `11223` / `0000` 이 쓰입니다.
서버의 관리자 계정은 이와 별개로 `tools/users.js` 로 DB 에 만듭니다 (아래).

명단 관리는 서버에서 `tools/users.js` 로 합니다.

```bash
node tools/users.js list                                        # 명단 (상태: 사번인증 전 / 인증완료 / 막힘)
node tools/users.js add 12345 홍길동 hong@itcen.com 책임 [--admin]   # 한 명 추가
node tools/users.js add 11223 관리자 --password --admin   # 관리자 계정 (사번인증 없이 바로 로그인, 임시 비밀번호 출력)
node tools/users.js import 명단.csv            # 여러 명 (시험) — CSV 열: 사번,이름,직급,이메일[,부서,회사]
node tools/users.js import 명단.csv --commit   # 여러 명 (실제)
node tools/users.js role 12345 admin            # 관리자 지정 / user 로 되돌리기
node tools/users.js reset 12345                 # 비밀번호 초기화 → 그 직원이 사번인증부터 다시
node tools/users.js off 12345                   # 로그인 막기 (on 으로 해제)
```

- **메일 발송 서버가 아직 없어서** 인증코드를 화면에 그대로 보여줍니다(개발용). 메일 발송을 붙이면 `AUTH_SHOW_CODE=0` 으로 끕니다 (`server/auth.js` 상단 주석).
  그 전까지는 남의 사번과 회사 메일을 알면 그 사람 대신 비밀번호를 정할 수 있습니다.
- `index.html` 을 파일로 직접 열면(file://) 서버 로그인이 되지 않습니다. 반드시 `http://` 주소로 여세요.

## 개발서버 배포 (192.168.64.57, 포트 8999)

서버는 이미 세팅되어 있습니다. main 에 병합한 뒤 서버에서 실행하면 됩니다.

```bash
cd ~/cen_resort && ./deploy.sh
```

- ⛔ 서버에서 `node index.js` 직접 실행 금지 — pm2 프로세스와 포트 8999가 충돌합니다. 재시작은 `pm2 reload cen-resort`.
- 자세한 절차·새 서버 세팅은 루트의 `DEPLOY.md` 를 보세요.
