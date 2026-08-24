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
  ['review_comments', 'parent_id', 'INTEGER'],
  ['review_comments', 'empno', 'TEXT'],
]) {
  try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`); } catch (e) { /* 이미 존재 */ }
}

// parent_id 를 쓰는 인덱스는 컬럼 추가가 끝난 뒤에 만들어야 한다.
db.exec('CREATE INDEX IF NOT EXISTS idx_comments_parent ON review_comments(parent_id);');

module.exports = db;
