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
- 사진 · 첨부: `server/uploads/` (후기 사진) · `server/uploads/resorts/` (휴양소 대표 사진) · `server/uploads/notices/` (공지 첨부). `/uploads/...` 로 제공 (공지 첨부는 늘 내려받기)
- 두 폴더는 `.gitignore` 처리되어 저장소에 올라가지 않습니다.

DB 안의 테이블 (서버가 켜질 때 없으면 만든다 — `server/db.js`, `server/auth.js`)

| 테이블 | 내용 | 넣는 방법 |
|---|---|---|
| `resorts` · `resort_aliases` | 휴양소 정보 · 옛 이름 | 처음엔 자동, 이후 관리자 페이지 → 휴양소 정보 (여러 곳 한꺼번에는 `tools/import_resorts.js`) |
| `reviews` · `review_photos` | 후기 · 후기 사진 (`hidden` = 관리자가 숨김) | 앱에서 작성, 또는 `tools/import_reviews.js` (`DATA_IMPORT.md`) |
| `review_comments` · `review_likes` | 댓글 · 좋아요(1인 1회) | 앱 |
| `notifications` · `notification_reads` | 알림 · 읽음 | 앱 |
| `favorites` | 즐겨찾기 (사번 × 휴양소) | 앱 |
| `notices` · `notice_views` | 공지사항 · 본 사람(조회수) | 관리자 페이지 → 공지사항 (여러 개 한꺼번에는 `tools/notices.js`) |
| `tips` · `tip_likes` | 꿀팁 · 꿀팁 좋아요(1인 1회) | 앱, 또는 `tools/import_tips.js` (`DATA_IMPORT.md` '꿀팁 올리기') |
| `point_history` | 휴양소 포인트 내역 (후기 1건 +10P · 관리자 조정은 reason=adjust + note 이유 · by_empno) | 앱 · 관리자 페이지 → 직원 명단 |
| `badges` · `badge_awards` | 배지 기준 · 받은 기록 (한 번 받으면 유지) | 처음엔 자동(기본 13개), 이후 관리자 페이지 → 배지 |
| `users` · `sessions` · `verify_codes` | 직원 명단 · 로그인 · 사번인증 코드 | 관리자 페이지 → 직원 명단 · 권한 (서버에서는 `tools/users.js`) |

## 휴양소 데이터

휴양소 목록 · 검색 · 지도 · 상세 · 후기 작성 선택지는 모두 DB 의 **`resorts` 테이블**(+ 옛 표기 `resort_aliases`)을 봅니다.
화면(`index.html`)에 휴양소를 직접 적지 않습니다.

- 서버가 처음 켜질 때 테이블이 비어 있으면 `assets/js/data/resorts.js` 의 `RESORT_SEED` 로 채웁니다.
- 그 뒤로는 **DB 가 원본**입니다. `resorts.js` 를 고쳐도 이미 채워진 DB 에는 반영되지 않습니다.
- 서버 없이 열면(GitHub Pages 등) 화면은 `RESORT_SEED` 를 대신 씁니다.
- 고치기 · 숨기기(`active = 0`) · 추가는 관리자 페이지 → 휴양소 정보에서 합니다. 후기가 휴양소 이름으로 저장되므로, 관리자 페이지에서 이름을 바꾸면 옛 이름을 `resort_aliases` 에 **자동으로** 남깁니다 (도구로 바꿀 때는 직접 남기세요).

## API

| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | `/api/auth/login` | 사번 로그인 → 세션 쿠키 발급 |
| POST | `/api/auth/logout` | 로그아웃 |
| GET  | `/api/auth/me` | 내 정보 (로그인 안 했으면 401) |
| PUT  | `/api/auth/me` | 연락처·메일·비밀번호 수정 🔒 |
| POST | `/api/auth/verify/code` · `/verify/check` · `/api/auth/activate` | 사번인증 및 비밀번호 설정 (코드 발급 → 확인 → 설정) |
| GET  | `/api/resorts` | 휴양소 목록 (평점·후기 수는 후기에서 계산). `photo` 대표 사진 · `photos` 상세에서 넘겨 보는 사진 목록 (비어 있으면 대표 한 장) |
| POST | `/api/reviews` | 후기 등록 (사진 base64 — JPG·PNG·WEBP, 최대 10장, 장당 10MB. 앱은 긴 변 1600px JPEG 으로 줄여 보낸다 — `assets/js/review-write.js`) → 작성자에게 **+10P** |
| GET  | `/api/notices` · `/api/notices/:id` | 공지 목록 · 상세 (상세를 열면 조회수에 기록) |
| GET  | `/api/tips?resort=` · `/api/tips/mine` | 휴양소 꿀팁 · 내 꿀팁 |
| POST | `/api/tips` · PUT · DELETE `/api/tips/:id` · POST `/api/tips/:id/like` | 꿀팁 쓰기 · 고치기 · 지우기(본인·관리자) · 좋아요 `{ liked }` |
| GET  | `/api/me/badges` | 내 배지 (기준은 DB `badges` — 관리자 페이지에서 고침, 받은 기록 `badge_awards`, 계산은 `server/badges.js`) |
| GET  | `/api/favorites` | 내 즐겨찾기 (휴양소 id, 추가한 순서) |
| PUT  | `/api/favorites/:resortId` | 즐겨찾기 `{ on }` — true 추가 / false 해제 |
| GET  | `/api/points/me` | 내 휴양소 포인트 잔액 + 내역 (`point_history`). 후기를 지우면 그 후기로 받은 포인트 차감 |
| GET  | `/api/reviews?resort=이름` | 휴양소별 후기 목록 (정식명·옛 표기 모두 가능, 없으면 전체) |
| GET  | `/api/reviews/mine` | 내가 쓴 후기 (사번은 받지 않고 로그인 세션으로 판단) |
| DELETE | `/api/reviews/:id` | 후기 지우기 (본인 또는 관리자). 그 후기로 받은 포인트 차감 · 사진 파일 · 알림 정리 |
| POST | `/api/reviews/:id/like` | 좋아요 `{ liked }` — 1인 1회 (`review_likes`) |
| POST | `/api/reviews/:id/comments` | 댓글 등록 |
| GET  | `/api/notifications` | 내 알림 (내 후기에 달린 댓글 · 답글) + 읽은 알림 목록. 공지 알림은 화면이 공지 목록으로 만든다 |
| POST | `/api/notifications/read` | 읽음 처리 `{ keys: [...] }` |
| GET  | `/api/health` | 헬스체크 |

🔒 표시가 없어도 **후기 등록 · 내 후기 · 삭제 · 좋아요 · 댓글 · 알림은 모두 로그인이 필요**합니다.
작성자와 "본인인지"는 화면이 보낸 사번이 아니라 **서버 세션**으로 판단합니다. 후기 삭제는 본인 또는 관리자만 됩니다.

## 관리자 페이지 (PC)

**http://localhost:8999/admin** (개발서버는 http://192.168.64.57:8999/admin). 앱과 같은 계정으로 로그인하고, **관리자(`role = admin`)만** 들어갑니다.
화면은 `admin/` — index.html · admin.css · admin.js(로그인 · 메뉴 · 쪽 나누기 · 공지) + 메뉴별 admin-users.js · admin-content.js · admin-badges.js · admin-resorts.js.
API 는 `server/admin.js`(공지 · 직원 · 포인트 · 후기 · 꿀팁) · `server/badges.js`(배지) · `server/admin-resorts.js`(휴양소).
앱 로그인 화면 아래 '관리자 바로가기' 로도 열 수 있습니다 (새 탭). 권한은 화면이 아니라 서버가 세션으로 판단합니다(`requireAdmin`).

| 메뉴 | 할 수 있는 것 |
|---|---|
| 공지사항 | 목록(숨긴 공지 · 조회수 포함) · 쓰기 · 고치기 · 숨기기/보이기 · 맨 위 고정 · 삭제 · 첨부 |
| 직원 명단 · 권한 | 목록(상태 · 휴양소 포인트 · 마지막 로그인) · 포인트 칸을 누르면 내역 · 조정(더하기/빼기 + 이유, 직원 앱 적립내역에 '포인트 조정 · 이유') · 한 명 추가 · 엑셀로 여러 명 추가(양식 받기 → CSV 로 저장해 올리기 → 결과 확인 → 넣기, 엑셀 EUC-KR 도 읽음) · 고치기 · 관리자 지정 · 비밀번호 초기화 · 로그인 막기/풀기 |
| 후기 · 꿀팁 | 전체 목록(숨긴 글 · 옮겨 온 글 표시) · 휴양소 · 상태 필터 · 본문 검색 · 자세히 보기(본문 · 사진 · 댓글) · 숨기기/보이기 · 삭제 |
| 배지 | 목록(검색 · 보이는/숨긴 필터) · 기준(무엇을 셀지 · 기준 숫자) · 이름 · 설명 · 아이콘 · 색 · 보이기/숨기기 · 새 배지, 받은 사람 수 |
| 휴양소 정보 | 목록(사진 · 장 수 · 후기 수 · 평점 · 종류 · 사진 필터 · 검색) · 고치기(기본 정보 · 객실 · 문의 · 사진 여러 장(순서 · 첫 장이 대표) · 편의시설 칩 · 상세 표 · 주변 관광지 · 이용 수칙) · 숨기기/보이기 · 새 휴양소. 여러 곳을 한꺼번에 넣을 때는 `tools/import_resorts.js` |

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/api/admin/notices` · `/api/admin/notices/:id` | 공지 전체 (숨김 포함) · 한 개 |
| POST | `/api/admin/notices` | 새 공지 `{ category, title, body, pinned, active, files, createdAt } (author 작성 부서는 선택 · 화면에 안 보임)` |
| PUT | `/api/admin/notices/:id` | 고치기 (보낸 칸만) |
| DELETE | `/api/admin/notices/:id` | 지우기 (조회 기록 · 첨부 파일도 지움 · 되돌릴 수 없음) |
| POST | `/api/admin/notice-files` | 공지 첨부 올리기 `{ name, data(base64) }` → `{ name, url, size }` — PDF · 한글 · 오피스 · JPG · PNG · ZIP · TXT · CSV, 20MB 까지. `server/uploads/notices/<무작위>/<원래 이름>` 에 저장, 받을 때 원래 이름으로 내려받음. 공지에서 빼거나 공지를 지우면 파일도 지움 |
| GET · POST | `/api/admin/users` | 직원 명단 (비밀번호 해시 · 연락처는 보내지 않음) · 한 명 추가 |
| PUT | `/api/admin/users/:empno` | 고치기 · 역할 · 로그인 막기 `{ active }` (막으면 지금 로그인도 끊음) |
| POST | `/api/admin/users/:empno/reset` | 비밀번호 초기화 (로그인도 끊음 → 사번인증부터 다시) |
| POST | `/api/admin/users/import` | CSV `{ csv, commit }` — commit 이 아니면 결과만 |
| GET · POST | `/api/admin/users/:empno/points` | 휴양소 포인트 잔액 + 내역 · 조정 `{ amount(+/-), note(이유, 꼭) }` — `point_history` 에 `reason=adjust` 로 쌓임 (지우지 않음, 잔액이 0 밑으로는 못 뺌) |
| GET | `/api/admin/reviews` · `/api/admin/reviews/:id` | 후기 전체 (숨김 포함) · 한 개 (사진 · 댓글) |
| GET | `/api/admin/tips` | 꿀팁 전체 (숨김 포함) |
| PUT | `/api/admin/reviews/:id` · `/api/admin/tips/:id` | `{ hidden }` 숨기기 / 보이기 |
| GET · POST | `/api/admin/badges` | 배지 전체 + 받은 사람 수 + 셀 수 있는 항목(metrics) · 새 배지 |
| PUT | `/api/admin/badges/:id` | 배지 고치기 (기준을 바꿔도 이미 받은 사람은 유지) |
| GET · POST | `/api/admin/resorts` | 휴양소 전체 (숨김 포함) + 후기 수 · 평점 + 편의시설 고르기 목록 · 지도 지역 · 새 휴양소 (id 는 서버가 만듦) — `server/admin-resorts.js` |
| PUT | `/api/admin/resorts/:id` | 휴양소 고치기 (보낸 칸만). 이름을 바꾸면 옛 이름을 `resort_aliases` 에 남겨 옛 후기도 계속 셈. 지우기는 없음 (숨기기) |
| POST | `/api/admin/resort-photos` | 휴양소 사진 올리기 `{ data(data URL) }` → `{ url }` (화면이 긴 쪽 1600px 로 줄여 보냄, `server/uploads/resorts/`). 휴양소에는 저장할 때 `photos: [주소...]` (최대 10장, 첫 장 = 대표 `photo`)로 붙고, 목록에서 빠진 파일은 지움 |

- 배지가 '무엇을 셀지' 는 `server/badges.js` 의 METRICS 에서만 고릅니다 (후기 · 사진 있는 후기 · 휴양소 수 · 종류별 · 지역별 · 꿀팁 · 댓글 · 받은/누른 좋아요). 새 셈법은 거기에 더합니다.
- 앱에서 직접 쓴 글만 세고 숨긴 글은 뺍니다. 기준을 넘으면 앱의 '내 배지' 를 열 때 받은 기록을 남깁니다.

- **숨긴 후기 · 꿀팁**(`hidden = 1`)은 앱 어디에도 안 보이고, 휴양소 평점 · 후기 수 · 배지 계산 · 좋아요 · 댓글에서도 빠집니다. 데이터는 남습니다.
- 지우기는 앱과 같은 `DELETE /api/reviews/:id` · `/api/tips/:id` (관리자는 남의 글도). 후기를 지우면 받은 포인트 차감 · 사진 파일 · 알림도 정리됩니다.

- 자기 자신의 관리자 권한 빼기 · 로그인 막기 · 비밀번호 초기화는 안 됩니다 (아무도 못 들어가는 일 방지).
- 회사명은 법인 표기(주식회사 · (주))를 떼고 저장합니다 (후기와 같은 규칙, `tools/clean_company.js`).

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

명단 관리는 **관리자 페이지 → 직원 명단 · 권한** 에서 합니다. 서버에서 `tools/users.js` 로도 됩니다.

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
