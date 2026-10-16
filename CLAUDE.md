# cen_resort — Claude 작업 안내

아이티센그룹 임직원용 **휴양소 후기 모바일 웹**. 프론트는 정적 HTML/JS, 백엔드는 `server/` (Express + Node 내장 SQLite).
팀원 5명이 각자 Claude Code 로 작업한다. 작업 전에 해당 문서를 먼저 읽는다.

| 할 일 | 읽을 문서 |
|---|---|
| 개발 환경 · 브랜치 규칙 · 화면 파일 구조 · 서버 접속 | `TEAM_GUIDE.md` |
| 개발서버 배포 · 새 서버 세팅 | `DEPLOY.md` |
| **후기 · 휴양소 정보 · 사진 넣기** | `DATA_IMPORT.md` |
| API · DB 테이블 · 직원 명단(로그인) · 관리자 페이지 | `server/README.md` |

## 꼭 지킬 것

- **`index.html` 은 직접 고치지 않는다.** `screens/<화면>.html` · `screens/_layout.html` · `screens/_popups.html` 을 고치면
  `tools/build_index.js` 가 만든다 (`npm start` 중이면 자동, 아니면 `cd server && npm run build`). 결과물 `index.html` 도 함께 커밋한다.
- **데이터(휴양소 · 후기 · 회원)는 화면 코드에 적지 않는다.** DB 에 있고 화면은 API 로 읽는다. 넣을 때는 `tools/` 의 적재 도구 + `DATA_IMPORT.md` 순서.
  모든 적재 도구는 시험 실행 먼저, 확인 후 `--commit`.
- **저장소는 공개(public)다.** 실명 · 사번 · 메일 · 연락처 · 주소 · 실제 후기 본문 · 실제 사진을 커밋하지 않는다.
  받은 자료와 적재용 파일(meta.json · contents.txt · 정보.json)은 저장소 밖에 둔다. `server/data/` · `server/uploads/` 는 `.gitignore`.
- 휴양소 안내 PDF 에서 **넣지 않는 것**: 담당자 개인 연락처, 와이파이, 렌터카 세부(업체 · 예약자명 · 조건), 회사 내부 예약 절차, 출입 비밀번호.
  (`DATA_IMPORT.md` '넣지 않는 것')
- 서버는 웹으로 `index.html` · `assets/` · `admin/` · `/uploads` 만 연다 (`server/index.js` 정적 파일). 저장소 전체를 열면 `server/data/reviews.db` 가 받아진다 — 2026-10 실제로 그랬다. 새 폴더를 웹에 열 때는 그 폴더만 추가한다.
- 권한은 서버가 세션으로 판단한다. 화면이 보낸 사번을 믿는 코드를 만들지 않는다 (`server/auth.js` 의 `req.user`).
- 브랜치: 본인 브랜치에서 작업 → push → PR → `main`. `main` 에 직접 push 하지 않는다. 커밋 · push · 배포는 사용자가 요청할 때만.

## 구조 한눈에

```
screens/            화면 HTML (화면마다 1개) → index.html 로 합쳐진다
assets/js/          화면 동작. 주요 창구:
  core.js             화면 전환 showScreen() · 주소(#/resort/<id> 등) · 뒤로가기
  resort-data.js      휴양소 데이터(ResortAPI) → 목록 · 지도 · 검색 · 후기 작성 선택지
  data-source.js      후기(ReviewAPI) · 서버 감지
  auth.js / signup.js 로그인(AuthAPI) · 사번인증
  favorites.js points.js badges.js  즐겨찾기 · 휴양소 포인트 · 배지(기준은 DB badges, 서버가 계산)
  notice.js           공지(NoticeAPI)      tips.js  꿀팁(TipAPI) · 휴양소 상세
  data/resorts.js     휴양소 기본값(시드) · 편의시설 아이콘(FEATURE_META)
admin/              관리자 페이지 (PC, /admin) — 관리자만. API 는 server/admin.js · badges.js · admin-resorts.js
server/             index.js(API) · admin.js(관리자 API) · admin-resorts.js(관리자 휴양소) · badges.js(배지 기준 · 계산) · db.js(테이블) · auth.js(로그인 · 권한) · data/reviews.db(DB, git 제외)
tools/              build_index.js · 적재 도구(import_*.js · xlsx_to_meta.js · pdf_photos.js · prepare_photos.js) · users.js(직원 명단) · notices.js(공지)
```

## 확인하는 법

- 로컬: `cd server && npm start` → http://localhost:8999 (로그인 계정은 `node tools/users.js add <사번> <이름> --password` 로 내 PC DB 에 만든다)
- 서버 없이 파일로 열면(file://) 시연 데이터 · 시연 계정(11223/0000)으로만 동작한다.
- 고친 뒤에는 실제 브라우저(헤드리스 Chrome 등)로 화면을 열어 확인하고, 콘솔 오류가 없는지 본다.
