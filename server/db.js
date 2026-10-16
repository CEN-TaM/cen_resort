'use strict';

// 내장 SQLite (Node 22.5+). 외부 네이티브 패키지 불필요.
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'reviews.db'));

// WAL 모드: 동시 읽기/쓰기 안정성 향상
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
  CREATE TABLE IF NOT EXISTS reviews (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    empno           TEXT,              -- 작성자 사번
    author_name     TEXT,              -- 작성자 표시 이름
    department      TEXT,              -- 부서
    company         TEXT,              -- 회사
    resort_name     TEXT NOT NULL,     -- 휴양소 이름
    resort_type     TEXT,              -- regular | summer | winter
    companions      TEXT,              -- JSON 배열 문자열 (예: ["가족","친구"])
    content         TEXT,              -- 상세 후기
    rating_location INTEGER,           -- 위치(접근성) 1~5
    rating_facility INTEGER,           -- 시설(편의) 1~5
    rating_clean    INTEGER,           -- 청결도 1~5
    rating_avg      REAL,              -- 3항목 평균
    likes           INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT NOT NULL      -- ISO8601
  );

  CREATE TABLE IF NOT EXISTS review_photos (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    review_id  INTEGER NOT NULL,
    path       TEXT NOT NULL,          -- /uploads/xxxxx.png
    FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS review_comments (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    review_id  INTEGER NOT NULL,
    parent_id  INTEGER,                -- 답글이면 부모 댓글 id, 일반 댓글이면 NULL
    empno      TEXT,                   -- 작성자 사번 (알림 대상 판별에 필요)
    author     TEXT,
    color      TEXT,
    text       TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES review_comments(id) ON DELETE CASCADE
  );

  -- 알림 (댓글 / 답글). 공지 알림은 클라이언트가 NOTICES 로 만들고 읽음만 여기서 관리한다.
  CREATE TABLE IF NOT EXISTS notifications (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    empno       TEXT NOT NULL,         -- 받는 사람 사번
    type        TEXT NOT NULL,         -- comment | reply
    actor_name  TEXT,                  -- 행동한 사람 표시 이름
    review_id   INTEGER,               -- 이동 대상 후기
    comment_id  INTEGER,               -- 해당 댓글/답글
    resort_name TEXT,                  -- 목록에 보여줄 휴양소명
    created_at  TEXT NOT NULL
  );

  -- 읽음 기록. key 는 개인 알림 'n:{id}' 또는 공지 'notice:{공지id}'
  CREATE TABLE IF NOT EXISTS notification_reads (
    empno   TEXT NOT NULL,
    key     TEXT NOT NULL,
    read_at TEXT NOT NULL,
    PRIMARY KEY (empno, key)
  );

  CREATE INDEX IF NOT EXISTS idx_reviews_resort ON reviews(resort_name);
  CREATE INDEX IF NOT EXISTS idx_reviews_empno  ON reviews(empno);
  CREATE INDEX IF NOT EXISTS idx_photos_review  ON review_photos(review_id);
  CREATE INDEX IF NOT EXISTS idx_comments_review ON review_comments(review_id);
  CREATE INDEX IF NOT EXISTS idx_notif_empno     ON notifications(empno);
`);

// 기존 DB 마이그레이션: 없는 컬럼만 추가 (이미 있으면 조용히 넘어감)
// CREATE TABLE IF NOT EXISTS 는 기존 테이블을 건드리지 않으므로, 이미 만들어진 DB 에는
// 위 정의에 새로 넣은 컬럼이 없다. 그래서 여기서 따로 채워준다.
for (const [table, col, type] of [
  ['reviews', 'department', 'TEXT'],
  ['reviews', 'company', 'TEXT'],
  ['reviews', 'hidden', 'INTEGER NOT NULL DEFAULT 0'],   // 1 = 관리자가 숨김 (앱 어디에도 안 보임 · 평점 · 배지에서도 빠짐. 지우지는 않음)
  ['review_comments', 'parent_id', 'INTEGER'],
  ['review_comments', 'empno', 'TEXT'],
]) {
  try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`); } catch (e) { /* 이미 존재 */ }
}

// parent_id 를 쓰는 인덱스는 컬럼 추가가 끝난 뒤에 만들어야 한다.
db.exec('CREATE INDEX IF NOT EXISTS idx_comments_parent ON review_comments(parent_id);');

// 좋아요 기록 — 한 사람이 한 후기에 한 번만 (PRIMARY KEY). reviews.likes 는 이 기록으로 늘고 준다.
db.exec(`
  CREATE TABLE IF NOT EXISTS review_likes (
    review_id   INTEGER NOT NULL,
    empno       TEXT NOT NULL,
    created_at  TEXT NOT NULL,
    PRIMARY KEY (review_id, empno),
    FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE
  );
`);

// 휴양소 포인트 내역 — 잔액은 amount 합계. 지우지 않고 쌓기만 한다 (후기를 지우면 차감 줄을 하나 더 넣는다).
// 회사 복지포인트(복지몰)와는 별개인 이 서비스의 포인트다.
db.exec(`
  CREATE TABLE IF NOT EXISTS point_history (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    empno        TEXT NOT NULL,
    amount       INTEGER NOT NULL,         -- +적립 / -차감
    reason       TEXT NOT NULL,            -- review(후기 작성) | review_deleted(후기 삭제)
    review_id    INTEGER,                  -- 후기가 지워져도 내역은 남기므로 FK 를 걸지 않는다
    resort_name  TEXT,                     -- 내역에 보여줄 휴양소명
    created_at   TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_points_empno ON point_history(empno);
`);

// ───────────────────────── 휴양소 ─────────────────────────
// 휴양소 목록 · 검색 · 지도 · 상세 · 후기 작성 선택지가 모두 이 테이블을 본다 (GET /api/resorts).
// 후기는 resort_name 에 정식 이름(resorts.name)이나 옛 표기(resort_aliases.alias)로 저장돼 있다.
db.exec(`
  CREATE TABLE IF NOT EXISTS resorts (
    id          TEXT PRIMARY KEY,      -- 고유키 (영문, 바꾸지 않는다)
    name        TEXT NOT NULL UNIQUE,  -- 정식 이름
    type        TEXT NOT NULL CHECK (type IN ('regular', 'summer', 'winter')),
    loc         TEXT,                  -- 짧은 지역 표기
    address     TEXT,                  -- 주소 (없으면 화면은 loc)
    img         TEXT,                  -- 사진 키 (assets/js/data/images.js)
    room_type   TEXT,                  -- 객실
    capacity    INTEGER,               -- 정원
    features    TEXT,                  -- 분류별 편의시설 JSON { 환경: [...], ... }
    map_label   TEXT,                  -- 지도 마커 이름 (같은 이름끼리 한 마커)
    map_x       REAL,                  -- 지도 SVG 좌표
    map_y       REAL,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    active      INTEGER NOT NULL DEFAULT 1   -- 0 이면 화면에서 숨김 (운영 종료 등)
  );

  -- 옛 표기 → 휴양소. 예전 후기가 '속초(힐스) 휴양소' 처럼 저장돼 있어도 같은 곳으로 묶는다
  CREATE TABLE IF NOT EXISTS resort_aliases (
    alias      TEXT PRIMARY KEY,
    resort_id  TEXT NOT NULL,
    FOREIGN KEY (resort_id) REFERENCES resorts(id) ON DELETE CASCADE
  );
`);

// 휴양소 상세 정보 칸 (나중에 추가된 것 — 이미 만들어진 DB 에도 없는 칸만 더한다)
// 내용은 tools/import_resorts.js 로 넣는다. 원본은 회사 안내 PDF (이벤트 세부안내 · 휴양소 이용 가이드)
for (const [col, type] of [
  ['facility_name', 'TEXT'],   // 실제 숙소 이름 (예: 알펜시아 평창 리조트 · 디럭스 스위트)
  ['summary', 'TEXT'],         // 한 줄 소개
  ['capacity_base', 'INTEGER'],// 기준 인원 (capacity 는 최대 인원)
  ['details', 'TEXT'],         // 상세 표 JSON [{ label, value }] — 가전 · 가구 · 부대시설 · 냉난방 · 교통 · 입퇴실 등
  ['phone', 'TEXT'],           // 숙소 문의처
  ['website', 'TEXT'],
  ['nearby', 'TEXT'],          // 주변 관광지 JSON [이름...]
  ['notices', 'TEXT'],         // 이용 수칙 JSON [문장...]
  ['season', 'TEXT'],          // 이벤트 휴양소 운영 시즌 (예: 2026 하계)
  ['photo', 'TEXT'],           // 대표 사진 경로 (/uploads/resorts/...). 없으면 img 키의 기본 사진
]) {
  try { db.exec(`ALTER TABLE resorts ADD COLUMN ${col} ${type}`); } catch (e) { /* 이미 있음 */ }
}

// 테이블이 비어 있을 때만 초기값(assets/js/data/resorts.js)으로 채운다.
// 이미 데이터가 있으면 건드리지 않는다 — 그 뒤의 추가·수정은 DB 가 원본이다.
function seedResorts() {
  if (db.prepare('SELECT COUNT(*) AS n FROM resorts').get().n > 0) return;
  const { RESORT_SEED } = require(path.join(__dirname, '..', 'assets', 'js', 'data', 'resorts.js'));
  const insResort = db.prepare(`
    INSERT INTO resorts (id, name, type, loc, address, img, room_type, capacity, features, map_label, map_x, map_y, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const insAlias = db.prepare('INSERT INTO resort_aliases (alias, resort_id) VALUES (?, ?)');
  db.exec('BEGIN');
  try {
    RESORT_SEED.forEach(r => {
      const m = r.map || {};
      insResort.run(r.id, r.name, r.type, r.loc || null, r.address || null, r.img || null,
        r.roomType || null, r.capacity ?? null, r.features ? JSON.stringify(r.features) : null,
        m.label || null, m.x ?? null, m.y ?? null, r.sort ?? 0);
      (r.aliases || []).forEach(a => insAlias.run(a, r.id));
    });
    db.exec('COMMIT');
    console.log(`휴양소 초기값 ${RESORT_SEED.length}곳을 resorts 테이블에 넣었습니다.`);
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}
seedResorts();

// 공지사항 — 관리자가 tools/notices.js 로 쓴다. 본문은 간단한 표기(### 소제목, - 목록, > 강조, **굵게>) 글자로 저장한다
db.exec(`
  CREATE TABLE IF NOT EXISTS notices (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    category    TEXT NOT NULL,          -- 이용수칙 | 예약 | 복지포인트 (화면의 분류 칩 · server/admin.js NOTICE_CATEGORIES)
    title       TEXT NOT NULL,
    body        TEXT NOT NULL,
    author      TEXT NOT NULL,          -- 부서 이름 (예: 인사복지팀)
    pinned      INTEGER NOT NULL DEFAULT 0,
    files       TEXT,                   -- 첨부 JSON [{ name, url, size }] — url 이 있는 것만 받기 버튼이 생긴다
    active      INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
  );
  -- 조회수 = 본 사람 수 (한 사람이 여러 번 열어도 1)
  CREATE TABLE IF NOT EXISTS notice_views (
    notice_id   INTEGER NOT NULL,
    empno       TEXT NOT NULL,
    viewed_at   TEXT NOT NULL,
    PRIMARY KEY (notice_id, empno),
    FOREIGN KEY (notice_id) REFERENCES notices(id) ON DELETE CASCADE
  );

  -- 꿀팁 — 휴양소 상세에서 누구나 쓴다
  CREATE TABLE IF NOT EXISTS tips (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    resort_id   TEXT NOT NULL,
    empno       TEXT NOT NULL,
    author      TEXT NOT NULL,          -- '홍길동 책임'
    tag         TEXT,
    title       TEXT NOT NULL,
    content     TEXT NOT NULL,
    created_at  TEXT NOT NULL,
    FOREIGN KEY (resort_id) REFERENCES resorts(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_tips_resort ON tips(resort_id);
  CREATE TABLE IF NOT EXISTS tip_likes (
    tip_id      INTEGER NOT NULL,
    empno       TEXT NOT NULL,
    created_at  TEXT NOT NULL,
    PRIMARY KEY (tip_id, empno),
    FOREIGN KEY (tip_id) REFERENCES tips(id) ON DELETE CASCADE
  );
`);

// 꿀팁 작성자의 회사 · 부서 (후기 카드처럼 이름 아래 보여준다). 앱에서 쓰면 로그인한 직원 정보로 채운다
for (const col of ['department', 'company']) {
  try { db.exec(`ALTER TABLE tips ADD COLUMN ${col} TEXT`); } catch (e) { /* 이미 있음 */ }
}
// 1 = 관리자가 숨김 (앱에 안 보임, 지우지는 않음 — 관리자 페이지 '후기 · 꿀팁')
try { db.exec('ALTER TABLE tips ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0'); } catch (e) { /* 이미 있음 */ }

// 즐겨찾기 — 사람(사번) × 휴양소(id). 휴양소가 지워지면 같이 지워진다
db.exec(`
  CREATE TABLE IF NOT EXISTS favorites (
    empno       TEXT NOT NULL,
    resort_id   TEXT NOT NULL,
    created_at  TEXT NOT NULL,
    PRIMARY KEY (empno, resort_id),
    FOREIGN KEY (resort_id) REFERENCES resorts(id) ON DELETE CASCADE
  );
`);

module.exports = db;
