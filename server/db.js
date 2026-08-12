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
    author     TEXT,
    color      TEXT,
    text       TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_reviews_resort ON reviews(resort_name);
  CREATE INDEX IF NOT EXISTS idx_reviews_empno  ON reviews(empno);
  CREATE INDEX IF NOT EXISTS idx_photos_review  ON review_photos(review_id);
  CREATE INDEX IF NOT EXISTS idx_comments_review ON review_comments(review_id);
`);

module.exports = db;
